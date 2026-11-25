import {useCallback,useEffect,useMemo,useState} from 'react'
import type {User} from '@supabase/supabase-js'
import {Link} from 'react-router'
import {useAuth} from '../../hooks/AuthProvider'
import {EmptyState,LoadingCard,PageHeading,StatusBadge} from '../../components/ui'
import {CLINICAL_PERSISTENCE_ENABLED,createPersistentChartPort,type ClinicalChartPort} from '../../clinical/chart-port'
import {PatientChart} from '../../clinical/PatientChart'
import {createClinicalReadPort,type ClinicalReadPort} from '../../clinical/port'
import {classifyOpsError,formatDayLabel,formatClinicTime,shortRef,todayInZone,validateWindow} from '../../ops/ops-model.mjs'
import type {OpsErrorKind,OpsRow,OpsWindow} from '../../ops/ops-model.mjs'
import type {OpsBranch} from '../../ops/branch-model.mjs'
import '../../clinical/workspace.css'

type Scope={status:'loading'}|{status:'failed';kind:OpsErrorKind}|{status:'ready';branches:OpsBranch[]}
type DayLoad={key:string;status:'loading'}|{key:string;status:'failed';kind:OpsErrorKind}|{key:string;status:'ready';rows:OpsWindow}
const failureCopy:Record<OpsErrorKind,string>={
  denied:'Your session expired or the clinic did not authorize this branch. No patient data is shown.',
  network:'The clinic could not be reached. No results were assumed and no clinical data was shown.',
  error:'The clinic response could not be verified. No patient information is displayed.',
  unavailable:'The required secure staff read service is not available.'
}
const roleNames={administrator:'Administrator',veterinarian:'Veterinarian',receptionist:'Receptionist'}

/** Staff pages are never mounted for a signed-out account. Switching account IDs fully unmounts drafts and rows. */
export function ClinicalWorkspacePage(){
  const {user}=useAuth()
  if(!user)return <p role="alert">A verified staff session is required to view this clinical workspace.</p>
  return <StaffClinicalWorkspace key={user.id} user={user}/>
}
function StaffClinicalWorkspace({user}:{user:User}){
  const port=useMemo(()=>createClinicalReadPort(user),[user.id])
  const [pending,setPending]=useState(false)
  const [scope,setScope]=useState<Scope>({status:'loading'})
  const [selected,setSelected]=useState<string|null>(null)
  const [attempt,setAttempt]=useState(0)
  const retry=useCallback(()=>{setSelected(null);setScope({status:'loading'});setAttempt(n=>n+1)},[])
  useEffect(()=>{
    let live=true
    setScope({status:'loading'})
    setSelected(null)
    void port.loadBranches().then(branches=>{
      if(!live)return
      if(!branches.length){setScope({status:'failed',kind:'denied'});return}
      setScope({status:'ready',branches})
      if(branches.length===1)setSelected(branches[0]?.id??null)
    },error=>{
      if(live)setScope({status:'failed',kind:classifyOpsError(error)})
    })
    return ()=>{live=false}
  },[port,attempt])
  // Selection is never read from a URL or a mutable JWT role hint.
  const branch=scope.status==='ready'&&selected
    ?scope.branches.find(item=>item.id===selected)??null:null
  const chartPort=useMemo(()=>CLINICAL_PERSISTENCE_ENABLED&&branch?createPersistentChartPort(user,branch.id,branch.role):undefined,[user.id,branch])
  const denied=()=>{setPending(false);setScope({status:'failed',kind:'denied'});setSelected(null)}
  return <div className="page clinical-workspace" aria-labelledby="clinical-title">
    <PageHeading id="clinical-title" eyebrow="Clinic staff · controlled preview" title="Patient charts & encounters"
      actions={<span className="clinical-state">{CLINICAL_PERSISTENCE_ENABLED?'Encounter drafts only':'Clinical write services not enabled'}</span>}>
      {CLINICAL_PERSISTENCE_ENABLED?'Branch-scoped verified chart history and veterinarian encounter drafts. No finalization or medical orders.':'Branch-scoped appointment context. Draft workflows are local only; records and prescriptions cannot be filed until the clinic has approved secure patient-specific API contracts.'}
    </PageHeading>
    {scope.status==='loading'&&<LoadingCard label="Checking active staff identity and permitted clinic branches…" rows={4}/>}
    {scope.status==='failed'&&<ClinicFailure kind={scope.kind} retry={retry}/>}
    {scope.status==='ready'&&<div className="clinical-branch-bar">
      <label htmlFor="clinical-branch">Authorized clinic branch</label>
      <select id="clinical-branch" disabled={pending} value={branch?.id??''} onChange={event=>{
        if(pending)return
        const next=scope.branches.find(b=>b.id===event.target.value)
        setSelected(next?.id??null)
      }}>
        <option value="">Select an authorized branch</option>
        {scope.branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
      <p>Access: {branch?roleNames[branch.role]:'No branch selected'}. Clinic date uses Asia/Manila.</p>
    </div>}
    {scope.status==='ready'&&!branch&&<EmptyState icon="shield" title="Select an authorized clinic branch">
      No patient information will load before a verified branch selection.</EmptyState>}
    {branch&&<ClinicalDay key={user.id+':'+branch.id} port={port} branch={branch} accountId={user.id}
      onDenied={denied} chartPort={chartPort} pending={pending} onPendingChange={setPending}/>}
    <p className="clinical-boundary">Staff identity, branch access and appointment rows are checked against
      the backend on every read. Patient names, historical records, vaccines, prescriptions and
      treatment orders are not retrieved using unscoped legacy endpoints.</p>
  </div>
}
function ClinicFailure({kind,retry}:{kind:OpsErrorKind;retry:()=>void}){
  return <section className="card clinical-failure" role="alert">
    <h2>{kind==='denied'?'Staff access unavailable':'Clinical queue unavailable'}</h2>
    <p>{failureCopy[kind]}</p>
    <div className="clinical-actions"><button type="button" className="button button-secondary"
      onClick={retry}>Recheck access</button>
      <Link to="/app/overview" className="button button-quiet">Return to overview</Link></div>
  </section>
}
function ClinicalDay({port,branch,accountId,onDenied,chartPort,pending,onPendingChange}:{port:ClinicalReadPort;branch:OpsBranch;accountId:string;onDenied:()=>void;chartPort?:ClinicalChartPort;pending:boolean;onPendingChange:(value:boolean)=>void}){
  const [day,setDay]=useState(()=>todayInZone(Date.now()))
  const [attempt,setAttempt]=useState(0)
  const readKey=branch.id+':'+day+':'+attempt
  const [raw,setRaw]=useState<DayLoad>({key:readKey,status:'loading'})
  const [chosen,setChosen]=useState<{key:string;id:string|null}>({key:readKey,id:null})
  const read:DayLoad=raw.key===readKey?raw:{key:readKey,status:'loading'}
  const selectedId=chosen.key===readKey?chosen.id:null
  const reload=()=>{if(!pending)setAttempt(n=>n+1)}
  useEffect(()=>{
    let live=true
    setRaw({key:readKey,status:'loading'})
    void port.readDay(branch.id,day).then(rows=>{
      if(!live)return
      try{setRaw({key:readKey,status:'ready',rows:validateWindow(rows)})}
      catch{setRaw({key:readKey,status:'failed',kind:'error'})}
    },error=>{
      if(!live)return
      const kind=classifyOpsError(error)
      setRaw({key:readKey,status:'failed',kind})
      if(kind==='denied')onDenied()
    })
    return ()=>{live=false}
  },[readKey,branch.id,day,port])
  const rows=read.status==='ready'?read.rows.items:[]
  const patients=chartPort?rows:Array.from(new Map(rows.map(row=>[row.pet_id,row])).values())
  const keyFor=(p:OpsRow)=>chartPort?p.id:p.pet_id
  const selected=(chartPort?patients.find(p=>keyFor(p)===selectedId):rows.find(p=>p.pet_id===selectedId))??null
  return <section aria-label={branch.name+' clinical appointments'}>
    <div className="clinical-daybar">
      <label htmlFor="clinical-day">Clinic date</label>
      <input id="clinical-day" type="date" disabled={pending} value={day} onChange={event=>{
        if(!pending&&/^\d{4}-\d{2}-\d{2}$/.test(event.target.value))setDay(event.target.value)
      }}/>
      <button type="button" className="button button-secondary button-small" disabled={pending} onClick={reload}>
        Refresh appointments</button>
      <span className="clinical-muted">Showing {formatDayLabel(day)} · read-only</span>
    </div>
    {read.status==='loading'&&<LoadingCard label="Verifying this branch and reading its appointments…" rows={5}/>}
    {read.status==='failed'&&<div className="card" role="alert">
      <h2>Unable to load appointments</h2><p>{failureCopy[read.kind]}</p>
      <button className="button button-secondary" type="button" onClick={reload}>Try again</button>
    </div>}
    {read.status==='ready'&&<>
      {read.rows.hasMore&&<p role="alert" className="clinical-inline-warning">
        More than 250 appointments matched this day. The queue is incomplete;
        do not interpret this as a complete clinical patient list.</p>}
      {rows.length===0?<EmptyState icon="calendar" title="No appointments in this branch and day">
        This is an empty verified appointment window, not proof of an empty patient chart.</EmptyState>
      :<div className="clinical-shell">
        <aside className="clinical-roster" aria-label="Patients from authorized appointments">
          <h2>Patients in today’s queue</h2>
          <p className="clinical-muted">Select a verified appointment to inspect clinical workflow.
            {chartPort?'Each visit has its own draft context.':'Names are unavailable without a scoped patient reader.'}</p>
          <ul>{patients.map(p=><li key={keyFor(p)}>
            <button type="button" className={selectedId===keyFor(p)?'clinical-patient is-selected':'clinical-patient'}
              disabled={pending} aria-pressed={selectedId===keyFor(p)} onClick={()=>{if(!pending)setChosen({key:readKey,id:keyFor(p)})}}>
              <strong>Patient {shortRef(p.pet_id)}{chartPort?' · Visit '+shortRef(p.id):''}</strong>
              <span>{formatClinicTime(p.starts_at)} · <StatusBadge status={p.status}/></span>
              <small>{rows.filter(row=>row.pet_id===p.pet_id).length} visit(s) in selected day</small>
            </button></li>)}</ul>
        </aside>
        <div className="clinical-detail">
          {selected
            ?<PatientChart key={branch.id+':'+readKey+':'+selected.id} petId={selected.pet_id}
              rows={rows} branchName={branch.name} role={branch.role}
              accountId={accountId} ownerId={selected.owner_id}
              branchId={branch.id} appointmentId={selected.id} chartPort={chartPort} persistentSave={!!chartPort} pending={pending} onPendingChange={onPendingChange}
              onDenied={onDenied}/>
            :<div className="card clinical-selection"><h2>Choose a patient appointment</h2>
              <p>No patient chart is loaded yet. Select a record from the authorized
                branch queue. {chartPort?'Chart access is checked for this visit.':'Historical records and clinical writes remain blocked.'}</p></div>}
        </div>
      </div>}
    </>}
  </section>
}
