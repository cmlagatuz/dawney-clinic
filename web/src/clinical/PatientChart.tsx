import {useRef,useState,type KeyboardEvent} from 'react'
import {StatusBadge} from '../components/ui'
import {formatClinicTime,shortRef} from '../ops/ops-model.mjs'
import type {OpsRole,OpsRow} from '../ops/ops-model.mjs'
import {CLINICAL_SECTIONS,DRAFT_FIELDS,newDraft,selectPatientVisits,validateClinicalDraft} from './draft.mjs'
import type {ClinicalSectionId,DraftSection} from './draft.mjs'

type Props={
  petId:string
  rows:OpsRow[]
  branchName:string
  role:OpsRole
}
const localSections=new Set<ClinicalSectionId>(['encounter','treatments','vaccinations','prescriptions'])
const scratchTypes=['encounter','treatments','vaccinations','prescriptions'] as const
type Drafts=Record<DraftSection,Record<string,string>>
function emptyDrafts():Drafts{
  return {encounter:newDraft('encounter'),treatments:newDraft('treatments'),
    vaccinations:newDraft('vaccinations'),prescriptions:newDraft('prescriptions')}
}

export function PatientChart({petId,rows,branchName,role}:Props){
  const [section,setSection]=useState<ClinicalSectionId>('overview')
  const tabs=useRef<Array<HTMLButtonElement|null>>([])
  const [drafts,setDrafts]=useState<Drafts>(emptyDrafts)
  const [errors,setErrors]=useState<Record<string,string>>({})
  const [notice,setNotice]=useState('')
  const clinician=role==='veterinarian'||role==='administrator'
  const visits=selectPatientVisits({items:rows},petId)
  const focusTab=(index:number)=>{
    const section=CLINICAL_SECTIONS[index]
    if(!section)return
    setSection(section.id)
    setErrors({})
    setNotice('')
    tabs.current[index]?.focus()
  }
  const onTabsKey=(event:KeyboardEvent<HTMLButtonElement>,index:number)=>{
    let next:number
    if(event.key==='ArrowRight')next=(index+1)%CLINICAL_SECTIONS.length
    else if(event.key==='ArrowLeft')next=(index+CLINICAL_SECTIONS.length-1)%CLINICAL_SECTIONS.length
    else if(event.key==='Home')next=0
    else if(event.key==='End')next=CLINICAL_SECTIONS.length-1
    else return
    event.preventDefault()
    focusTab(next)
  }
  const change=(kind:DraftSection,name:string,value:string)=>{
    setDrafts(previous=>({...previous,[kind]:{...previous[kind],[name]:value}}))
    setErrors(previous=>({...previous,[name]:''}))
    setNotice('')
  }
  const check=(kind:DraftSection)=>{
    if(!clinician)return
    const result=validateClinicalDraft(kind,drafts[kind])
    setErrors(result.errors)
    setNotice(result.valid
      ? 'Local draft checked. Nothing was saved or submitted to the clinic.'
      : 'Review the highlighted fields. Nothing was saved.')
  }
  const discard=(kind:DraftSection)=>{
    setDrafts(previous=>({...previous,[kind]:newDraft(kind)}))
    setErrors({})
    setNotice('Unsaved notes cleared from this browser view.')
  }
  const current=CLINICAL_SECTIONS.find(s=>s.id===section)
  return <section className="clinical-chart" aria-label="Selected patient chart">
    <header className="clinical-chart-head">
      <div><p className="eyebrow">Verified appointment · {branchName}</p>
        <h2>Patient record {shortRef(petId)}</h2>
        <p className="clinical-muted">Only a branch-authorized appointment establishes this patient context.
          The secure patient profile read is not connected. No species, breed, owner identity or medical history is inferred.</p></div>
      <span className="clinical-state">Chart preview · read-only backend</span>
    </header>
    <div className="clinical-tabs" role="tablist" aria-label="Patient chart sections">
      {CLINICAL_SECTIONS.map((item,index)=><button key={item.id}
        ref={el=>{tabs.current[index]=el}} id={'clinical-tab-'+item.id}
        role="tab" type="button" aria-selected={section===item.id} tabIndex={section===item.id?0:-1}
        aria-controls={'clinical-panel-'+item.id}
        onClick={()=>{setSection(item.id);setErrors({});setNotice('')}}
        onKeyDown={e=>onTabsKey(e,index)}>{item.label}</button>)}
    </div>
    <section className="clinical-panel" role="tabpanel" id={'clinical-panel-'+section}
      aria-labelledby={'clinical-tab-'+section} tabIndex={0}>
      <h3>{current?.label}</h3>
      {section==='overview'&&<div className="clinical-two">
        <div className="clinical-card">
          <h4>Patient context</h4>
          <dl><dt>Branch</dt><dd>{branchName}</dd>
            <dt>Patient identifier</dt><dd>{shortRef(petId)} (abbreviated)</dd>
            <dt>Verified appointments in selected day</dt><dd>{visits.length}</dd>
            <dt>Patient name and demographics</dt><dd>Unavailable — scoped chart contract required</dd>
            <dt>Allergy / medication safety flags</dt><dd>Not verified — do not infer absence</dd></dl>
        </div>
        <div className="clinical-card">
          <h4>Clinical readiness</h4>
          <p>Historical clinical records, vaccines, prescriptions, treatments and attachments cannot be
            verified for this branch and patient with the currently approved API.</p>
          <p role="status" className="clinical-inline-warning">No clinical chart updates or medical orders can be sent from this preview.</p>
        </div></div>}
      {section==='visits'&&<div className="clinical-timeline">
        <p className="clinical-muted">Appointments shown are only from the selected branch and clinic day.
          They are not a complete longitudinal history.</p>
        {visits.map(v=><article className="clinical-visit" key={v.id}>
          <div className="clinical-visit-top"><strong>Appointment {shortRef(v.id)}</strong><StatusBadge status={v.status}/></div>
          <time dateTime={v.starts_at}>{formatClinicTime(v.starts_at)}</time>
          <p><strong>Reason provided:</strong> {v.concern}</p>
          <p className="clinical-muted">Resource {shortRef(v.resource_id)} · Requested/confirmed and completed are distinct recorded states.</p>
        </article>)}
      </div>}
      {section==='history'&&<div className="clinical-empty">
        <h4>Historical clinical records unavailable</h4>
        <p>The existing staff-wide clinical-record reader does not prove patient membership
          in the selected branch. Showing its results here would risk disclosing unrelated records.</p>
        <p>This is <strong>not</strong> a verified empty chart. ASTRA must provide a branch-asserted,
          patient-scoped history reader, with pagination and access-denial semantics.</p>
      </div>}
      {localSections.has(section)&&<ClinicalDraft key={section} kind={section as DraftSection}
        value={drafts[section as DraftSection]} clinician={clinician}
        errors={errors} notice={notice} change={change} check={check} discard={discard}/>}
    </section>
  </section>
}

function ClinicalDraft({kind,value,clinician,errors,notice,change,check,discard}:{
  kind:DraftSection;value:Record<string,string>;clinician:boolean;errors:Record<string,string>;
  notice:string;change:(k:DraftSection,n:string,v:string)=>void;check:(k:DraftSection)=>void;discard:(k:DraftSection)=>void
}){
  const fields=DRAFT_FIELDS[kind]
  const hasText=fields.some(f=>Boolean(value[f.id]?.trim()))
  return <div className="clinical-form-shell">
    <p className="clinical-inline-warning" role="status">
      {clinician
        ? 'Local, unsaved working notes only. This browser does not store or transmit them. Closing, changing patient, branch or account discards them.'
        : 'Read-only: receptionists cannot draft a clinical treatment, vaccination or prescription.'}
    </p>
    <form aria-label={kind+' local working draft'} onSubmit={event=>{event.preventDefault();check(kind)}}>
      <div className="clinical-fields">
        {fields.map(field=><label className="clinical-field" key={field.id}>
          <span>{field.label}{field.required?' *':''}</span>
          {field.id==='administeredOn'
            ?<input type="date" value={value[field.id]??''}
                disabled={!clinician} aria-invalid={Boolean(errors[field.id])}
                aria-describedby={errors[field.id]?'clinical-error-'+field.id:undefined}
                onChange={event=>change(kind,field.id,event.target.value)}/>
            :field.max>500
              ?<textarea rows={4} maxLength={field.max} value={value[field.id]??''}
                disabled={!clinician} aria-invalid={Boolean(errors[field.id])}
                aria-describedby={errors[field.id]?'clinical-error-'+field.id:undefined}
                onChange={event=>change(kind,field.id,event.target.value)}/>
              :<input type="text" maxLength={field.max} value={value[field.id]??''}
                disabled={!clinician} aria-invalid={Boolean(errors[field.id])}
                aria-describedby={errors[field.id]?'clinical-error-'+field.id:undefined}
                onChange={event=>change(kind,field.id,event.target.value)}/>}
          {errors[field.id]&&<span className="clinical-validation" id={'clinical-error-'+field.id}>{errors[field.id]}</span>}
        </label>)}
      </div>
      {notice&&<p role={Object.keys(errors).filter(k=>errors[k]).length?'alert':'status'} className="clinical-feedback">{notice}</p>}
      <div className="clinical-actions">
        <button type="submit" className="button button-secondary" disabled={!clinician}>
          Review unsaved draft</button>
        <button type="button" className="button button-quiet"
          onClick={()=>discard(kind)} disabled={!clinician||!hasText}>Clear unsaved notes</button>
        <button type="button" className="button button-primary" disabled aria-describedby="clinical-save-blocked">
          Save to patient chart — unavailable</button>
      </div>
      <p className="clinical-muted" id="clinical-save-blocked">
        Requires a reviewed role- and branch-checked encounter API with persistence, idempotency,
        audit history and clinical approval. No write request will be attempted.</p>
    </form>
  </div>
}
