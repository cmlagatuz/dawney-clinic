import {useEffect,useRef,useState} from 'react'
import {Link} from 'react-router'
import {classifyChartError,draftSnapshot,prepareSaveTicket,
  validateChartPage,validateDraftAcknowledgement,validateEncounter} from './chart-model.mjs'
import type {ChartCursor,ChartDraft,ChartItem,ChartPatient,ChartRequest,
  ChartResult,DraftContent,DraftSaveRequest,SaveTicket} from './chart-model.mjs'
import {unconnectedClinicalPort,type ClinicalChartPort} from './chart-port'
import {OPS_UI_ENABLED} from '../ops/flag'
import type {OpsRole} from '../ops/ops-model.mjs'

type VerifiedPage=Extract<ChartResult,{kind:'ok'}>
type FailKind='denied'|'unavailable'|'not_found'|'network'|'error'
type View={kind:'loading'}|{kind:'ok';page:VerifiedPage}|{kind:FailKind}
type Mode='overview'|'visits'|'history'|'encounter'
type Props={accountId:string;branchId:string;petId:string;ownerId:string;appointmentId:string;
  role:OpsRole;mode:Mode;port?:ClinicalChartPort;onDenied?:()=>void;
  /** Only a test-only fixture may pass true. Production never enables this. */
  syntheticSave?:boolean}
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
  port=unconnectedClinicalPort,onDenied,syntheticSave=false}:Props){
  const section=sectionFor(mode)
  const allowed=section==='appointments'||role!=='receptionist'
  const [view,setView]=useState<View>({kind:'loading'})
  const [attempt,setAttempt]=useState(0)
  const [paging,setPaging]=useState(false)
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
    if(!previous?.hasMore||!previous.nextCursor||paging)return
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
          disabled={paging} onClick={loadMore}>{paging?'Loading older entries…':'Load older entries (up to 50)'}</button>
      </div>}
      {!view.page.hasMore&&<p className="clinical-muted">End of verified {section} history · {view.page.items.length} entries loaded.</p>}
      {mode==='encounter'&&<EncounterEditor key={appointmentId} accountId={accountId}
        branchId={branchId} petId={petId} appointmentId={appointmentId} role={role}
        page={view.page} port={port} syntheticSave={syntheticSave}
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
  syntheticSave,onDenied,onReload}:{accountId:string;branchId:string;petId:string;
  appointmentId:string;role:OpsRole;page:VerifiedPage;port:ClinicalChartPort;
  syntheticSave:boolean;onDenied?:()=>void;onReload:()=>void}){
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
  const validContext=!!draft||!page.hasMore // Never assume a draft is absent while unseen pages remain.
  const canWrite=syntheticSave&&!!port.saveDraft&&role==='veterinarian'&&validContext
  const dirty=draftSnapshot(form)!==baseline
  useEffect(()=>{latest.current=form},[form])
  const update=(key:keyof DraftContent,value:string)=>{
    setForm(old=>({...old,[key]:value}))
    setErrors(old=>({...old,[key]:''}))
    setNotice('')
  }
  const save=async(event:React.FormEvent)=>{
    event.preventDefault()
    if(!canWrite||busy.current||conflict||!dirty)return
    const result=validateEncounter(form)
    setErrors(result.errors)
    if(!result.valid){setNotice('Correct the highlighted fields. Nothing was saved.');return}
    const ticket=prepareSaveTicket(pending.current,{...form,expectedRevision:revision},()=>crypto.randomUUID())
    pending.current=ticket
    const request:DraftSaveRequest={branchId,petId,appointmentId,requestId:ticket.requestId,
      expectedRevision:revision,...form}
    busy.current=true;setSaving(true);setNotice('Save requested; awaiting verified server acknowledgement…')
    try{
      const raw=await port.saveDraft!(request)
      if(raw&&typeof raw==='object'&&'kind' in raw&&raw.kind!=='saved'){
        if(raw.kind==='conflict'){setConflict(true);setNotice('Revision conflict. Reload the authoritative draft before trying again.')}
        else if(raw.kind==='denied'){
          setForm(blank());setAuthoritative(blank());setBaseline(draftSnapshot(blank()))
          pending.current=null;onDenied?.()
        }
        else setNotice(raw.kind==='invalid'?'Server rejected invalid draft data. Nothing was saved.':
          'Save was not confirmed. The same unchanged request can be retried.')
        return
      }
      const ack=validateDraftAcknowledgement(raw,request,accountId)
      setRevision(ack.revision)
      setSaved({revision:ack.revision,authorId:ack.authorId,editorId:ack.editorId,updatedAt:ack.updatedAt})
      setAuthoritative({complaint:request.complaint,examination:request.examination,
        assessment:request.assessment,plan:request.plan})
      setBaseline(ticket.snapshot)
      pending.current=null
      setNotice(draftSnapshot(latest.current)===ticket.snapshot?
        'Server-acknowledged DRAFT saved (synthetic fixture only).':
        'An earlier version was acknowledged. Newer unsaved edits remain in this browser.')
    }catch(error){
      const kind=classifyChartError(error)
      if(error&&typeof error==='object'&&'code' in error&&
        (error.code==='40001'||error.code==='23505')){
        setConflict(true);setNotice('Revision or request-ID conflict. Reload authoritative history; no overwrite was attempted.')
      }else if(kind==='denied'){
        setForm(blank());setAuthoritative(blank());setBaseline(draftSnapshot(blank()))
        pending.current=null;onDenied?.()
      }
      else if(kind==='unavailable')setNotice('Draft backend unavailable. Save not verified; retry is possible.')
      else setNotice('Save was not verified. Retry unchanged text with the same request ID.')
    }finally{busy.current=false;setSaving(false)}
  }
  const labels:readonly [keyof DraftContent,string][]=[
    ['complaint','Presenting complaint'],['examination','Examination findings'],
    ['assessment','Clinical assessment'],['plan','Care and follow-up plan']]
  return <section className="clinical-encounter-editor" aria-label="Encounter draft editor">
    <h4>Veterinarian encounter DRAFT</h4>
    <p role="status" className="clinical-inline-warning">
      {dirty?'Unsaved local edits — not persisted.':saved?
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
          disabled={role!=='veterinarian'||conflict||saving}
          aria-invalid={!!errors[key]} aria-describedby={errors[key]?'chart-error-'+key:undefined}
          onChange={event=>update(key,event.target.value)}/>
        {errors[key]&&<span className="clinical-validation" id={'chart-error-'+key}>{errors[key]}</span>}
      </label>)}
      </div>
      {notice&&<p role="status" className="clinical-feedback">{notice}</p>}
      <div className="clinical-actions">
        <button type="submit" className="button button-primary"
          disabled={!canWrite||!dirty||saving||conflict}>
          {saving?'Awaiting acknowledgement…':canWrite?'Save encounter DRAFT':'Save unavailable — not connected'}
        </button>
        <button type="button" className="button button-secondary"
          onClick={()=>{setForm({...authoritative});pending.current=null;
            setErrors({});setNotice('Local edits restored to the last verified response. Reload to recheck remote state.')}} disabled={!dirty}>
          Discard local edits
        </button>
        <button type="button" className="button button-quiet" onClick={onReload}>
          {dirty?'Discard local edits and reload':conflict?'Reload after conflict':'Reload authoritative history'}
        </button>
      </div>
    </form>
    <p className="clinical-muted">This form cannot finalize a chart, prescribe medication, vaccinate,
      dispense stock, change appointment status or issue an invoice. Clinical write integration is OFF
      in production until SOL acceptance, hosted RLS and persistence checks, and owner approval.</p>
  </section>
}
