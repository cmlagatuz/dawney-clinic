import {useEffect,useRef,useState} from 'react'
import {Link} from 'react-router'
import {classifyChartError,draftSnapshot,prepareSaveTicket,
  validateChartPage,validateDraftAcknowledgement,validateEncounter} from './chart-model.mjs'
import type {ChartCursor,ChartDraft,ChartItem,ChartPatient,ChartRequest,
  ChartResult,DraftContent,DraftSaveRequest,SaveTicket} from './chart-model.mjs'
import {unconnectedClinicalPort,type ClinicalChartPort} from './chart-port'
import type {ReceiptObservation} from '../lib/clinical-chart'
import {OPS_UI_ENABLED} from '../ops/flag'
import type {OpsRole} from '../ops/ops-model.mjs'

type VerifiedPage=Extract<ChartResult,{kind:'ok'}>
type FailKind='denied'|'unavailable'|'not_found'|'network'|'error'
type View={kind:'loading'}|{kind:'ok';page:VerifiedPage}|{kind:FailKind}
type Mode='overview'|'visits'|'history'|'encounter'
type Props={accountId:string;branchId:string;petId:string;ownerId:string;appointmentId:string;
  role:OpsRole;mode:Mode;port?:ClinicalChartPort;onDenied?:()=>void;
  /** Only a test-only fixture may pass true. Production never enables this. */
  syntheticSave?:boolean; persistentSave?:boolean; onPendingChange?:(value:boolean)=>void}
const blank=():DraftContent=>({complaint:'',examination:'',assessment:'',plan:''})
const copy:Record<FailKind,string>={
  denied:'The clinic did not authorize this patient or branch. Clinical details have been cleared.',
  not_found:'No verified branch-linked chart exists for this selection. This does not reveal whether a patient exists elsewhere.',
  unavailable:'The approved secure chart service or migration is unavailable. This is not a verified empty history.',
  network:'The clinic could not be reached. No chart or saved status can be assumed.',
  error:'The clinical response failed validation. Nothing from that response is displayed.'
}
const brief=(id:string)=>id.slice(0,8)
const localDate=(value:string)=>new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',
  year:'numeric',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(value))
function combine(previous:VerifiedPage,other:VerifiedPage):VerifiedPage{
  if(previous.patient.ownerId!==other.patient.ownerId||previous.patient.id!==other.patient.id||
     previous.accountId!==other.accountId||previous.branchId!==other.branchId||
     previous.section!==other.section)throw Error('Clinical page identity changed')
  const seen=new Set(previous.items.map(row=>row.id))
  if(other.items.some(row=>seen.has(row.id)))throw Error('Duplicate clinical page result')
  return {...other,items:[...previous.items,...other.items]}
}
const sectionFor=(mode:Mode)=>mode==='history'?'records':mode==='encounter'?'drafts':'appointments'

/** Executable UI over an injected, strictly checked reader. Hosted clinical APIs remain unwired. */
export function ChartIntegration({accountId,branchId,petId,ownerId,appointmentId,role,mode,
  port=unconnectedClinicalPort,onDenied,syntheticSave=false,persistentSave=false,onPendingChange}:Props){
  const section=sectionFor(mode)
  const allowed=section==='appointments'||role!=='receptionist'
  const [view,setView]=useState<View>({kind:'loading'})
  const [attempt,setAttempt]=useState(0)
  const [paging,setPaging]=useState(false)
  const [pendingWrite,setPendingWrite]=useState(false)
  const lock=(value:boolean)=>{setPendingWrite(value);onPendingChange?.(value)}
  const generation=useRef(0)
  const pageRef=useRef<VerifiedPage|null>(null)
  const controller=useRef<AbortController|null>(null)
  const retry=()=>{pageRef.current=null;setView({kind:'loading'});setAttempt(n=>n+1)}
  useEffect(()=>{
    const version=++generation.current
    controller.current?.abort()
    const aborter=new AbortController()
    controller.current=aborter
    pageRef.current=null
    setView({kind:'loading'})
    setPaging(false)
    if(!allowed)return ()=>{aborter.abort();generation.current++}
    const request:ChartRequest={accountId,branchId,petId,ownerId,section,cursor:null,limit:50}
    void port.read(request,aborter.signal).then(raw=>{
      if(aborter.signal.aborted||version!==generation.current)return
      const parsed=validateChartPage(raw,request)
      if(parsed.kind==='ok'){pageRef.current=parsed;setView({kind:'ok',page:parsed})}
      else{pageRef.current=null;setView({kind:parsed.kind});if(parsed.kind==='denied')onDenied?.()}
    },error=>{
      if(aborter.signal.aborted||version!==generation.current)return
      const kind=classifyChartError(error)
      pageRef.current=null;setView({kind});if(kind==='denied')onDenied?.()
    }).catch(()=>{
      if(!aborter.signal.aborted&&version===generation.current){
        pageRef.current=null;setView({kind:'error'})
      }
    })
    return ()=>{aborter.abort();generation.current++}
  },[accountId,branchId,petId,ownerId,section,port,attempt,allowed])
  const loadMore=()=>{
    const previous=pageRef.current
    if(!previous?.hasMore||!previous.nextCursor||paging||pendingWrite)return
    const version=generation.current
    const aborter=controller.current
    if(!aborter||aborter.signal.aborted)return
    setPaging(true)
    const request:ChartRequest={accountId,branchId,petId,ownerId,section,
      cursor:previous.nextCursor,limit:50}
    void port.read(request,aborter.signal).then(raw=>{
      if(aborter.signal.aborted||version!==generation.current)return
      const parsed=validateChartPage(raw,request)
      if(parsed.kind!=='ok'){
        pageRef.current=null;setView({kind:parsed.kind})
        if(parsed.kind==='denied')onDenied?.()
      }else{
        const merged=combine(previous,parsed)
        pageRef.current=merged
        setView({kind:'ok',page:merged})
      }
    }).catch(error=>{
      if(aborter.signal.aborted||version!==generation.current)return
      pageRef.current=null
      const kind=error?.message==='Duplicate clinical page result'||
        error?.message==='Clinical page identity changed'?'error':classifyChartError(error)
      setView({kind});if(kind==='denied')onDenied?.()
    }).finally(()=>{if(!aborter.signal.aborted&&version===generation.current)setPaging(false)})
  }
  return <section className="clinical-chart-gateway" aria-label="Verified clinical chart service">
    {!allowed&&<div className="clinical-inline-warning" role="status">
      Receptionists can view authorized appointments only. Clinical records and drafts are restricted.
    </div>}
    {allowed&&view.kind==='loading'&&<p role="status">Verifying patient identity and chart access…</p>}
    {allowed&&view.kind!=='loading'&&view.kind!=='ok'&&<div className="clinical-inline-warning" role="alert">
      <strong>{view.kind==='not_found'?'Patient context not found':view.kind==='denied'?'Chart access denied':
        view.kind==='unavailable'?'Secure chart unavailable':view.kind==='network'?'Network interruption':'Invalid clinical response'}</strong>
      <p>{copy[view.kind]}</p>
      {view.kind!=='denied'&&view.kind!=='not_found'&&<button type="button" className="button button-secondary button-small"
        onClick={retry}>Retry secure chart read</button>}
    </div>}
    {allowed&&view.kind==='ok'&&<>
      {(mode==='overview'||mode==='visits')&&<div className="clinical-verified-demographics">
        <h4>Verified patient demographics</h4>
        <dl><dt>Name</dt><dd>{view.page.patient.name}</dd>
          <dt>Species</dt><dd>{view.page.patient.species}</dd>
          <dt>Breed</dt><dd>{view.page.patient.breed??'Not recorded'}</dd>
          <dt>Sex</dt><dd>{view.page.patient.sex}</dd>
          <dt>Birth date</dt><dd>{view.page.patient.birthDate??'Not recorded'}</dd></dl>
        {view.page.patient.taxonomyReviewNeeded&&<p role="status">Taxonomy requires staff review.</p>}
      </div>}
      {view.page.items.length===0?<p role="status">
        Verified empty {section} history for the currently authorized branch and patient.
      </p>:<div className="clinical-timeline" aria-label={'Verified '+section+' history'}>
        {view.page.items.map(item=><HistoryRow key={item.id} section={section} item={item}/>)}
      </div>}
      {view.page.hasMore&&<div className="clinical-chart-pagination">
        <p>Loaded {view.page.items.length} authorized entries; more history exists.</p>
        <button type="button" className="button button-secondary button-small"
          disabled={paging||pendingWrite} onClick={loadMore}>{paging?'Loading older entries…':'Load older entries (up to 50)'}</button>
      </div>}
      {!view.page.hasMore&&<p className="clinical-muted">End of verified {section} history · {view.page.items.length} entries loaded.</p>}
      {mode==='encounter'&&<EncounterEditor
        key={appointmentId}
        accountId={accountId}
        branchId={branchId} petId={petId} appointmentId={appointmentId} role={role}
        page={view.page} port={port} syntheticSave={syntheticSave} persistentSave={persistentSave} ownerId={ownerId}
        paging={paging} onPendingChange={lock} onVerified={verified=>{pageRef.current=verified;setView({kind:'ok',page:verified})}}
        onDenied={onDenied} onReload={retry}/>}
    </>}
    {mode==='encounter'&&view.kind!=='ok'&&role==='veterinarian'&&
      <div className="clinical-card">
        <h4>Encounter working notes</h4>
        <p>Draft editor and Save are unavailable until a verified clinical chart response is received.
          Existing records are never presumed absent.</p>
      </div>}
    {mode==='overview'&&<div className="clinical-chart-context">
      <h4>Related clinic workflows</h4>
      <p>Read-only navigation. Opening these areas never changes a booking,
        stock, medication, invoice or encounter.</p>
      <div className="clinical-actions">
        {OPS_UI_ENABLED
          ?<Link to="/app/ops" className="button button-secondary button-small">Staff operations</Link>
          :<span className="button button-secondary button-small" aria-disabled="true">Operations unavailable</span>}
        {import.meta.env.VITE_PHASE5B_PHARMACY_UI==='true'
          ?<Link to="/app/pharmacy" className="button button-secondary button-small">Pharmacy context</Link>
          :<span className="button button-secondary button-small" aria-disabled="true">Pharmacy unavailable</span>}
        {import.meta.env.VITE_PHASE5C_BILLING_UI==='true'
          ?<Link to="/app/billing" className="button button-secondary button-small">Billing context</Link>
          :<span className="button button-secondary button-small" aria-disabled="true">Billing unavailable</span>}
      </div>
      <p className="clinical-muted">Related modules remain subject to their own OFF-by-default flags and authorization.</p>
    </div>}
  </section>
}
function HistoryRow({section,item}:{section:string;item:ChartItem}){
  if(section==='appointments'&&'startsAt' in item)return <article className="clinical-visit">
    <div className="clinical-visit-top"><strong>Appointment {brief(item.id)}</strong><span>{item.status}</span></div>
    <time dateTime={item.startsAt}>{localDate(item.startsAt)}</time>
    <p>{item.concern||'No concern supplied'}</p>
  </article>
  if(section==='records'&&'performedAt' in item)return <article className="clinical-visit">
    <div className="clinical-visit-top"><strong>Clinical record {brief(item.id)}</strong>
      <time dateTime={item.performedAt}>{localDate(item.performedAt)}</time></div>
    <p>{item.procedure}</p><p>{item.comments??'No comments recorded'}</p>
    <p className="clinical-muted">Temperature: {item.temperatureC??'Not recorded'} °C ·
      Weight: {item.weightKg??'Not recorded'} kg</p>
  </article>
  if('revision' in item)return <article className="clinical-visit">
    <div className="clinical-visit-top"><strong>Encounter draft revision {item.revision}</strong>
      <time dateTime={item.updatedAt}>{localDate(item.updatedAt)}</time></div>
    <p>Appointment {brief(item.appointmentId)} · {item.status}</p>
    <p><strong>Presenting complaint:</strong> {item.complaint}</p>
    <p className="clinical-muted">Created by {brief(item.authorId)} · Last edited by {brief(item.editorId)}</p>
  </article>
  return null
}
function EncounterEditor({accountId,branchId,petId,appointmentId,role,page,port,
  syntheticSave,persistentSave,ownerId,paging,onPendingChange,onVerified,onDenied,onReload}:{accountId:string;branchId:string;petId:string;
  appointmentId:string;role:OpsRole;page:VerifiedPage;port:ClinicalChartPort;
  syntheticSave:boolean;persistentSave:boolean;ownerId:string;paging:boolean;onPendingChange:(value:boolean)=>void;onVerified:(page:VerifiedPage)=>void;onDenied?:()=>void;onReload:()=>void}){
  const draft=page.items.find((item):item is ChartDraft=>
    'appointmentId' in item&&item.appointmentId===appointmentId)??null
  const [form,setForm]=useState<DraftContent>(()=>draft?{
    complaint:draft.complaint,examination:draft.examination,assessment:draft.assessment,plan:draft.plan}:blank())
  const [authoritative,setAuthoritative]=useState<DraftContent>(()=>draft?{
    complaint:draft.complaint,examination:draft.examination,
    assessment:draft.assessment,plan:draft.plan}:blank())
  const [baseline,setBaseline]=useState(()=>draftSnapshot(draft??blank()))
  const [revision,setRevision]=useState(draft?.revision??0)
  const [saved,setSaved]=useState<{revision:number;authorId:string;editorId:string;updatedAt:string}|null>(
    draft?{revision:draft.revision,authorId:draft.authorId,editorId:draft.editorId,updatedAt:draft.updatedAt}:null)
  const [errors,setErrors]=useState<Record<string,string>>({})
  const [notice,setNotice]=useState('')
  const [conflict,setConflict]=useState(false)
  const [saving,setSaving]=useState(false)
  const latest=useRef(form)
  const pending=useRef<SaveTicket|null>(null)
  const busy=useRef(false)
  const mounted=useRef(false)
  const operation=useRef<AbortController|null>(null)
  const [unresolved,setUnresolved]=useState(false)
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;operation.current?.abort()}},[])
  const [observation,setObservation]=useState<ReceiptObservation|null>(null)
  const [lookupExact,setLookupExact]=useState(false)
  const [currentUnverified,setCurrentUnverified]=useState(false)
  const [review,setReview]=useState<{page:VerifiedPage;draft:ChartDraft|null}|null>(null)
  const lock=(value:boolean)=>{setUnresolved(value);if(persistentSave)onPendingChange(value)}
  const validContext=!!draft||!page.hasMore // Never assume a draft is absent while unseen pages remain.
  const canWrite=(syntheticSave||persistentSave)&&!!port.saveDraft&&role==='veterinarian'&&validContext&&!paging&&revision<2147483647
  const dirty=draftSnapshot(form)!==baseline
  useEffect(()=>{latest.current=form},[form])
  // Dirty notes and unresolved tickets are memory-only. Forced authorization loss still unmounts them.
  useEffect(()=>{
    if(!persistentSave)return
    onPendingChange(dirty||unresolved||saving||!!review)
  },[persistentSave,dirty,unresolved,saving,review,onPendingChange])
  useEffect(()=>{
    if(!persistentSave||(!dirty&&!unresolved&&!saving&&!review))return
    const message='Unsaved clinical text or an unresolved save may be lost. Receipts cannot recover unsaved text. Leave anyway?'
    const unload=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=''}
    const leave=(event:Event)=>{if(!window.confirm(message)){event.preventDefault();event.stopPropagation()}}
    const link=(event:MouseEvent)=>{if(event.target instanceof Element&&event.target.closest('a[href]'))leave(event)}
    window.addEventListener('beforeunload',unload)
    document.addEventListener('click',link,true)
    window.addEventListener('dawney:before-sign-out',leave)
    return()=>{window.removeEventListener('beforeunload',unload);document.removeEventListener('click',link,true);window.removeEventListener('dawney:before-sign-out',leave)}
  },[persistentSave,dirty,unresolved,saving,review])
  // A paginated reader may reveal a previously unseen draft. Never replace dirty text.
  useEffect(()=>{
    if(!draft||dirty||unresolved||saving||review||draft.revision===revision)return
    const content={complaint:draft.complaint,examination:draft.examination,assessment:draft.assessment,plan:draft.plan}
    setForm(content);setAuthoritative(content);setBaseline(draftSnapshot(content));setRevision(draft.revision)
    setSaved({revision:draft.revision,authorId:draft.authorId,editorId:draft.editorId,updatedAt:draft.updatedAt})
  },[draft,dirty,unresolved,saving,review,revision])
  const applyReview=(verified:VerifiedPage,matched:ChartDraft|null)=>{
    const content=matched?{complaint:matched.complaint,examination:matched.examination,assessment:matched.assessment,plan:matched.plan}:blank()
    setForm(content);latest.current=content;setAuthoritative(content);setBaseline(draftSnapshot(content))
    setRevision(matched?.revision??0);setSaved(matched?{revision:matched.revision,authorId:matched.authorId,editorId:matched.editorId,updatedAt:matched.updatedAt}:null)
    pending.current=null;setReview(null);setCurrentUnverified(false);setConflict(false);lock(false);onVerified(verified)
  }
  const reconcile=async(beforeRevision:number|null=null)=>{
    if(!persistentSave||role!=='veterinarian'||!port.reconcile||busy.current||paging||(!pending.current&&dirty))return
    const ticket=pending.current
    const exact=!!ticket
    if(exact&&beforeRevision!==null)return
    const controller=new AbortController();operation.current=controller
    busy.current=true;setSaving(true);setLookupExact(exact);setObservation(null);setReview(null);setCurrentUnverified(true);setNotice('Checking durable receipt…')
    try{
      const result=await port.reconcile({accountId,branchId,petId,appointmentId,requestId:ticket?.requestId??null,beforeRevision},controller.signal)
      if(!mounted.current||controller.signal.aborted)return
      setObservation(result)
      if(result.kind==='unknown'){setNotice('Receipt unresolved. No save or current chart can be confirmed. Retry receipt lookup only.');return}
      if(exact&&result.kind==='committed'&&result.receipt.revision!==ticket!.expectedRevision+1){
        setObservation(null);throw Error('Receipt revision does not identify original request')
      }
      setNotice(result.kind==='committed'?'Receipt confirmed; verifying current chart separately…':'No matching receipt at observation time; verifying current chart separately…')
      let cursor:ChartCursor|null=null,verified:VerifiedPage|null=null,matched:ChartDraft|null=null
      for(let n=0;n<50;n++){
        const query:ChartRequest={accountId,branchId,petId,ownerId,section:'drafts',cursor,limit:50}
        const next=validateChartPage(await port.read(query,controller.signal),query)
        if(!mounted.current||controller.signal.aborted)return
        if(next.kind==='denied'){onDenied?.();return}
        if(next.kind!=='ok')throw Error('Current chart readback unavailable')
        verified=verified?combine(verified,next):next
        matched=next.items.find((item):item is ChartDraft=>'appointmentId' in item&&item.appointmentId===appointmentId)??null
        if(matched||!next.hasMore)break
        cursor=next.nextCursor
      }
      if(!verified||(!matched&&verified.hasMore)||
        (result.draftId!==null&&(!matched||matched.id!==result.draftId))||
        (matched?.revision??0)<result.currentRevision)
        throw Error('Current chart identity or revision unverified')
      if(exact&&result.kind==='committed'&&matched&&matched.revision===result.receipt.revision){
        if(draftSnapshot(matched)!==ticket!.snapshot)throw Error('Original saved content did not match readback')
        applyReview(verified,matched);setNotice('Verified persisted DRAFT saved. Exact request receipt and current chart confirmed.');return
      }
      setCurrentUnverified(false);setReview({page:verified,draft:matched})
      setNotice(exact&&result.kind==='not_found'?
        'Original request remains unresolved. Snapshot absence does not exclude a later commit. Review the current chart before deciding what to do.':
        'Review the current chart before editing. Discovery identifies previous own saves, not an unidentified lost request.')
    }catch(error){
      if(!mounted.current||controller.signal.aborted)return
      if(classifyChartError(error)==='denied'){onDenied?.();return}
      setNotice('Receipt lookup or current chart readback could not be verified. No current save is assumed. Retry lookup only.')
    }finally{operation.current=null;busy.current=false;if(mounted.current)setSaving(false)}
  }
  const update=(key:keyof DraftContent,value:string)=>{
    if(persistentSave&&(busy.current||pending.current))return
    setForm(old=>({...old,[key]:value}))
    setErrors(old=>({...old,[key]:''}))
    setNotice('')
  }
  const save=async(event:React.FormEvent)=>{
    event.preventDefault()
    if(!canWrite||busy.current||conflict||!dirty||unresolved||currentUnverified||review)return
    const result=validateEncounter(form)
    setErrors(result.errors)
    if(!result.valid){setNotice('Correct the highlighted fields. Nothing was saved.');return}
    const content=persistentSave?{...form,complaint:form.complaint.replace(/^ +| +$/g,'')}:form
    if(persistentSave&&pending.current&&(pending.current.snapshot!==draftSnapshot(content)||pending.current.expectedRevision!==revision)){
      setNotice('Original request context changed. Do not submit another draft until reconciled.');return
    }
    const ticket=prepareSaveTicket(pending.current,{...content,expectedRevision:revision},()=>crypto.randomUUID())
    pending.current=ticket
    setObservation(null);setReview(null)
    const request:DraftSaveRequest={branchId,petId,appointmentId,requestId:ticket.requestId,
      expectedRevision:revision,...content}
    busy.current=true;setSaving(true);if(persistentSave)lock(true);setNotice('Save requested; awaiting verified server acknowledgement…')
    try{
      const controller=new AbortController();operation.current=controller
      const raw=await port.saveDraft!(request,controller.signal)
      if(!mounted.current)return
      if(raw&&typeof raw==='object'&&'kind' in raw&&raw.kind!=='saved'){
        if(raw.kind==='conflict'){pending.current=null;lock(false);setConflict(true);setNotice('Revision conflict. Reload the authoritative draft before trying again.')}
        else if(raw.kind==='denied'){
          setForm(blank());setAuthoritative(blank());setBaseline(draftSnapshot(blank()))
          pending.current=null;lock(false);onDenied?.()
        }
        else {if(raw.kind==='invalid'){pending.current=null;lock(false)}
          setNotice(raw.kind==='invalid'?'Server rejected invalid draft data. Nothing was saved.':
          'Save was not confirmed. Check the original request receipt.')}
        return
      }
      const ack=validateDraftAcknowledgement(raw,request,accountId)
      if(persistentSave){
        if(draft&&(ack.id!==draft.id||ack.authorId!==draft.authorId))throw Error('Draft identity changed')
        let cursor:ChartCursor|null=null,verified:VerifiedPage|null=null
        let matched:ChartDraft|undefined
        // #17 pages by immutable createdAt; bound the readback, never assume absence.
        for(let n=0;n<50;n++){
          const query:ChartRequest={accountId,branchId,petId,ownerId,section:'drafts',cursor,limit:50}
          const next=validateChartPage(await port.read(query,controller.signal),query)
          if(!mounted.current)return
          if(next.kind==='denied'){pending.current=null;lock(false);onDenied?.();return}
          if(next.kind!=='ok')throw Error('Draft readback unavailable')
          verified=verified?combine(verified,next):next
          matched=next.items.find((item):item is ChartDraft=>'appointmentId' in item&&item.appointmentId===appointmentId)
          if(matched||!next.hasMore)break
          cursor=next.nextCursor
        }
        if(!matched||!verified||matched.id!==ack.id)throw Error('Draft readback not verified')
        if(matched.revision>ack.revision){setCurrentUnverified(true);setNotice('A newer server revision exists. Check the original receipt and review current chart before editing.');return}
        if(matched.revision!==ack.revision||matched.authorId!==ack.authorId||matched.editorId!==ack.editorId||
          matched.updatedAt!==ack.updatedAt||draftSnapshot(matched)!==ticket.snapshot)
          throw Error('Draft readback did not match acknowledgement')
        setForm({...content});latest.current=content
        onVerified(verified)
      }
      setRevision(ack.revision)
      setSaved({revision:ack.revision,authorId:ack.authorId,editorId:ack.editorId,updatedAt:ack.updatedAt})
      setAuthoritative({complaint:request.complaint,examination:request.examination,
        assessment:request.assessment,plan:request.plan})
      setBaseline(ticket.snapshot)
      pending.current=null;lock(false)
      setNotice(draftSnapshot(latest.current)===ticket.snapshot?
        (persistentSave?'Verified persisted DRAFT saved.':'Server-acknowledged DRAFT saved (synthetic fixture only).'):
        'An earlier version was acknowledged. Newer unsaved edits remain in this browser.')
    }catch(error){
      if(!mounted.current)return
      const kind=classifyChartError(error)
      if(error&&typeof error==='object'&&'code' in error&&
        (error.code==='40001'||error.code==='23505')){
        pending.current=null;lock(false);setConflict(true);setNotice('Revision or request-ID conflict. Reload authoritative history; no overwrite was attempted.')
      }else if(kind==='denied'){
        setForm(blank());setAuthoritative(blank());setBaseline(draftSnapshot(blank()))
        pending.current=null;lock(false);onDenied?.()
      }
      else if(kind==='unavailable')setNotice('Draft backend unavailable. Save not verified; check the original receipt.')
      else setNotice(persistentSave?'Save was not verified. Check the original request receipt; do not resubmit.':'Save was not verified. Retry unchanged text with the same request ID.')
    }finally{operation.current=null;busy.current=false;if(mounted.current)setSaving(false)}
  }
  const labels:readonly [keyof DraftContent,string][]=[
    ['complaint','Presenting complaint'],['examination','Examination findings'],
    ['assessment','Clinical assessment'],['plan','Care and follow-up plan']]
  return <section className="clinical-encounter-editor" aria-label="Encounter draft editor">
    <h4>Veterinarian encounter DRAFT</h4>
    <p role="status" className="clinical-inline-warning">
      {currentUnverified?'Current chart is not verified.':dirty?'Unsaved local edits — not persisted.':saved?
        'Authoritative draft revision '+saved.revision+' acknowledged by the reader.':
        'No saved draft for this appointment has been verified.'}
    </p>
    {saved&&<dl className="clinical-attribution">
      <dt>Created by</dt><dd>{brief(saved.authorId)}</dd>
      <dt>Last edited by</dt><dd>{brief(saved.editorId)}</dd>
      <dt>Revision</dt><dd>{saved.revision}</dd>
      <dt>Updated</dt><dd>{localDate(saved.updatedAt)}</dd>
    </dl>}
    {!validContext&&<p role="alert">Older draft pages must load before this appointment can be created safely.</p>}
    <form aria-label="Persisted encounter draft form" onSubmit={event=>void save(event)}>
      <div className="clinical-fields">
      {labels.map(([key,label])=><label className="clinical-field" key={key}>
        <span>{label}{key==='complaint'?' *':''}</span>
        <textarea rows={3} maxLength={4000} value={form[key]}
          disabled={role!=='veterinarian'||conflict||saving||unresolved||currentUnverified||!!review}
          aria-invalid={!!errors[key]} aria-describedby={errors[key]?'chart-error-'+key:undefined}
          onChange={event=>update(key,event.target.value)}/>
        {errors[key]&&<span className="clinical-validation" id={'chart-error-'+key}>{errors[key]}</span>}
      </label>)}
      </div>
      {persistentSave&&unresolved&&<p role="alert">Original draft request {pending.current?.requestId} is unresolved. Text and context are locked. Check its receipt, not another save. Reloading loses in-memory identity and unsaved text.</p>}
      {persistentSave&&role==='veterinarian'&&<section aria-label="Clinical save receipts">
        <h5>Save reconciliation</h5>
        <p>Previous own receipts confirm historical saves only. They cannot identify an unknown lost submission or recover unsaved text.</p>
        {observation?.kind==='committed'&&<p role="status">{lookupExact?'Exact original request committed.':'Previous own receipt found.'} Saved revision {observation.receipt.revision}. Chart revision at receipt lookup {observation.currentRevision}.</p>}
        {observation?.kind==='not_found'&&<p role="status">No matching receipt at observation time. This does not prove that a delayed request will never commit.</p>}
        {observation?.kind==='unknown'&&<p role="status">Receipt unresolved: {observation.reason==='visit_busy'?'visit busy':'receipt unverified'}.</p>}
        {review&&<div role="region" aria-label="Current chart review">
          <h5>Verified current chart revision {review.draft?.revision??0}</h5>
          {review.draft?labels.map(([key,label])=><p key={key}><strong>{label}: </strong>{review.draft?.[key]}</p>):<p>No draft found in the verified complete history.</p>}
          <button type="button" className="button button-secondary" onClick={()=>{
            if(pending.current&&!window.confirm('This does not recover unsaved text or rule out a delayed commit. Discard local text and review this chart as a new editing baseline?'))return
            applyReview(review.page,review.draft);setNotice('Current chart reviewed. Any new save requires deliberate editing and submission.')
          }}>Review and use current chart</button>
        </div>}
        <div className="clinical-actions">
          {unresolved?<button type="button" className="button button-secondary" disabled={saving||!port.reconcile} onClick={()=>void reconcile()}>Check original request receipt</button>:
          <button type="button" className="button button-secondary" disabled={saving||dirty||paging||!port.reconcile} onClick={()=>void reconcile()}>Find previous own receipt</button>}
          {!unresolved&&observation?.kind==='committed'&&<button type="button" className="button button-secondary" disabled={saving||dirty||!!review} onClick={()=>void reconcile(observation.receipt.revision)}>Find older own receipt</button>}
          {unresolved&&<button type="button" className="button button-quiet" disabled={saving} onClick={()=>{
            if(window.confirm('Original outcome may remain unresolved. Leaving discards local text and request identity. Continue?')){lock(false);onReload()}
          }}>Leave unresolved and reload chart</button>}
        </div>
      </section>}
      {notice&&<p role="status" className="clinical-feedback">{notice}</p>}
      <div className="clinical-actions">
        <button type="submit" className="button button-primary"
          disabled={!canWrite||!dirty||saving||conflict||unresolved||currentUnverified||!!review}>
          {saving?'Awaiting acknowledgement…':unresolved?'Save locked — check receipt':canWrite?'Save encounter DRAFT':'Save unavailable — not connected'}
        </button>
        <button type="button" className="button button-secondary"
          onClick={()=>{if(persistentSave&&(busy.current||pending.current))return;setForm({...authoritative});pending.current=null;
            setErrors({});setNotice('Local edits restored to the last verified response. Reload to recheck remote state.')}} disabled={!dirty||saving||unresolved}>
          Discard local edits
        </button>
        <button type="button" className="button button-quiet" disabled={saving||unresolved} onClick={()=>{if(!dirty||window.confirm('Discard unsaved local clinical text and reload?')){onPendingChange(false);onReload()}}}>
          {dirty?'Discard local edits and reload':conflict?'Reload after conflict':'Reload authoritative history'}
        </button>
      </div>
    </form>
    <p className="clinical-muted">This form cannot finalize a chart, prescribe medication, vaccinate,
      dispense stock, change appointment status or issue an invoice. Clinical persistence requires explicit release authorization; default activation remains OFF.</p>
  </section>
}
