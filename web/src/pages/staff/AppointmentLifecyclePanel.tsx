import {useEffect,useMemo,useRef,useState, type Dispatch, type SetStateAction} from 'react'
import {StatusBadge} from '../../components/ui'
import {formatClinicTime,shortRef} from '../../ops/ops-model.mjs'
import type {OpsRow,OpsRole} from '../../ops/ops-model.mjs'
import {APPOINTMENT_WRITES_ENABLED,createAppointmentLifecyclePort} from '../../appointments/port'
import {ACTION_COPY,STATUS_AFTER,actionsFor,transitionError} from '../../appointments/lifecycle.mjs'
import type {AppointmentAction,AppointmentDetail,AppointmentFailure} from '../../appointments/lifecycle.mjs'
import {useAuth} from '../../hooks/AuthProvider'
import './appointment-lifecycle.css'

type Read={status:'loading'}|{status:'blocked';kind:AppointmentFailure|'stale'}|
 {status:'ready';detail:AppointmentDetail;encounter:'yes'|'no'|'unavailable'|'checking'}
export type AppointmentTicket={action:AppointmentAction;detail:AppointmentDetail;requestId:string}
const severe=new Set<AppointmentAction>(['decline','no_show','cancel','complete'])
const messages:Record<AppointmentFailure|'stale',string>={
 denied:'Staff access or session is no longer authorized. Appointment details have been cleared.',
 conflict:'Another change won the revision check. Re-read the latest appointment before taking action.',
 nonce:'This request ID was already used for different parameters. No new request was sent.',
 policy:'The server rejected the action because its scheduling, visit or clinical requirements were not satisfied.',
 unavailable:'The reviewed appointment lifecycle backend is not installed or not available. No status changed.',
 uncertain:'The server response was lost or unavailable. Outcome is uncertain; do not create a new request ID.',
 unverified:'The server response or subsequent readback could not be verified. No success is claimed.',
 stale:'Appointment status changed while this view was open. Refresh the verified branch queue.'
}
export function AppointmentLifecyclePanel({row,role,branchId,accountId,ticket,setTicket,onRefresh,onDenied}:{
 row:OpsRow|null;role:OpsRole;branchId:string;accountId:string;
 ticket:AppointmentTicket|null;setTicket:Dispatch<SetStateAction<AppointmentTicket|null>>;
 onRefresh:()=>void;onDenied:()=>void
}){
 const {user}=useAuth()
 const authRef=useRef(user);authRef.current=user
 const port=useMemo(()=>authRef.current?.id===accountId
   ?createAppointmentLifecyclePort(authRef.current,branchId):null,[accountId,branchId])
 const callbacks=useRef({onRefresh,onDenied});callbacks.current={onRefresh,onDenied}
 const mounted=useRef(false), seq=useRef(0),busyRef=useRef(false),ticketRef=useRef<AppointmentTicket|null>(ticket)
 const [read,setRead]=useState<Read>({status:'loading'})
 ticketRef.current=ticket
 const [busy,setBusy]=useState(false)
 const [confirm,setConfirm]=useState<AppointmentAction|null>(null)
 const [notice,setNotice]=useState<{tone:'info'|'danger'|'success';message:string}|null>(null)
 const [attempt,setAttempt]=useState(0)
 const confirmButton=useRef<HTMLButtonElement>(null)
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;seq.current++}},[])
 useEffect(()=>{if(confirm)confirmButton.current?.focus()},[confirm])
 const rowId=row?.id??null,rowStatus=row?.status??null
 useEffect(()=>{
  const current=++seq.current
  if(!row||!port||!APPOINTMENT_WRITES_ENABLED){setRead({status:'loading'});return}
  setRead({status:'loading'})
  void (async()=>{
   try{
    const d=await port.read(row)
    if(current!==seq.current||!mounted.current)return
    // An uncertain request may already have committed. Do not reject its
    // authoritative new status merely because the queue still has an old row.
    if(d.status!==row.status&&!ticketRef.current){setRead({status:'blocked',kind:'stale'});return}
    setRead({status:'ready',detail:d,encounter:d.status==='checked_in'?'checking':'no'})
    if(d.status==='checked_in'&&['administrator','veterinarian'].includes(role)){
     try{
      const linked=await port.linkedEncounter(d)
      if(current===seq.current&&mounted.current)setRead({status:'ready',detail:d,encounter:linked?'yes':'no'})
     }catch(err){
      if(current!==seq.current||!mounted.current)return
      if(transitionError(err)==='denied'){setRead({status:'blocked',kind:'denied'});callbacks.current.onDenied()}
      else setRead({status:'ready',detail:d,encounter:'unavailable'})
     }
    }
   }catch(err){
    if(current!==seq.current||!mounted.current)return
    const kind=transitionError(err)
    setRead({status:'blocked',kind})
    if(kind==='denied')callbacks.current.onDenied()
   }
  })()
  return()=>{seq.current++}
 },[port,rowId,rowStatus,row?.starts_at,row?.ends_at,role,attempt])
 const clearTicket=()=>{ticketRef.current=null;setTicket(null)}
 const choose=(action:AppointmentAction)=>{
  if(ticketRef.current||busyRef.current)return
  setNotice(null)
  if(severe.has(action)){setConfirm(action);return}
  void submit(action)
 }
 async function submit(action:AppointmentAction){
  if(!row||!port||!APPOINTMENT_WRITES_ENABLED||busyRef.current||read.status!=='ready'&&!ticketRef.current)return
  const current=ticketRef.current
  if(current&&(current.action!==action||current.detail.id!==row.id))return
  const d=current?.detail??(read.status==='ready'?read.detail:null)
  if(!d)return
  if(!current&&!actionsFor(d.status,role,read.status==='ready'&&read.encounter==='yes',d.startsAt).includes(action))return
  const ticketToSend=current??{action,detail:d,requestId:crypto.randomUUID()}
  ticketRef.current=ticketToSend;setTicket(ticketToSend)
  busyRef.current=true;setBusy(true);setConfirm(null);setNotice(null)
  const currentSeq=seq.current
  try{
   const ack=await port.transition(ticketToSend.detail,action,ticketToSend.requestId)
   const checked=await port.read(row)
   if(checked.status!==ack.status||checked.revision!==ack.revision)
    throw Error('Post-transition server readback did not match the RPC result')
   if(!mounted.current)return
   clearTicket()
   setNotice({tone:'success',message:'Server confirmed '+ack.status.replaceAll('_',' ')+
     ' at revision '+ack.revision+'. The branch queue is being refreshed. This does not finalize a medical record.'})
   setRead({status:'ready',detail:checked,encounter:'no'})
   callbacks.current.onRefresh()
  }catch(err){
   if(!mounted.current)return
   const kind=transitionError(err)
   if(kind==='denied'){
    clearTicket();setRead({status:'blocked',kind:'denied'})
    setNotice({tone:'danger',message:messages.denied});callbacks.current.onDenied()
   }else if(kind==='conflict'||kind==='policy'||kind==='nonce'){
    clearTicket()
    setRead({status:'blocked',kind})
    setNotice({tone:'danger',message:messages[kind]})
    callbacks.current.onRefresh()
   }else{
    // ACK may have been committed. Keep the *same* payload+nonce for an explicit retry.
    setNotice({tone:'danger',message:messages[kind]+' Retry only the same request, or check the server outcome.'})
    callbacks.current.onRefresh()
   }
  }finally{
   busyRef.current=false
   if(mounted.current){setBusy(false)}
   // A different branch/account unmount ignores all stale responses.
   void currentSeq
  }
 }
 const blocked=read.status==='blocked'
 const loaded=read.status==='ready'?read.detail:null
 const choices=loaded?actionsFor(loaded.status,role,read.status==='ready'&&read.encounter==='yes',loaded.startsAt):[]
 return <section className="card appointment-lifecycle" aria-label="Staff appointment lifecycle" aria-labelledby="lifecycle-title">
  <div className="lifecycle-title"><h2 id="lifecycle-title">Appointment lifecycle</h2>
   <span className="lifecycle-lock">{APPOINTMENT_WRITES_ENABLED?'Source-only transition preview':'Protected writes OFF'}</span></div>
  {!row?<p role="status" className="ops-help">Refreshing selected appointment from this branch. No previous appointment details are displayed.</p>
   :<><p className="ops-help">Selected appointment <code>{shortRef(row.id)}</code> · Branch verified by server; status requires separate revision readback.</p>
    {!APPOINTMENT_WRITES_ENABLED?<div className="lifecycle-unavailable" role="status">
     <p>Staff transitions are disabled pending ASTRA security acceptance and explicit release approval. The requested appointment is not confirmed automatically.</p>
     <button type="button" className="button button-secondary button-small" disabled>Staff actions unavailable</button></div>
    :!port?<p role="alert">Your verified account is no longer available. No actions are permitted.</p>
    :<><div className="lifecycle-actions-line">
      {read.status==='loading'&&<p role="status">Checking appointment revision and current staff permissions…</p>}
      {blocked&&<p role="alert">{messages[read.kind]}</p>}
      {loaded&&<p className="lifecycle-status">Server status <StatusBadge status={loaded.status}/> · Revision <strong>{loaded.revision}</strong> · {formatClinicTime(loaded.startsAt)}</p>}
     </div>
     {loaded?.status==='requested'&&<p className="ops-help">Owner requested this visit. It is not confirmed until the server accepts a staff confirmation.</p>}
     {loaded?.status==='checked_in'&&role!=='receptionist'&&
      <p className="ops-help">Encounter linkage: {read.status==='ready'&&read.encounter==='yes'
       ?'A persisted, branch-matched encounter was found. Completing the visit changes appointment status only.'
       :read.status==='ready'&&read.encounter==='checking'?'Checking the clinical encounter…':
       read.status==='ready'&&read.encounter==='unavailable'?'Unable to verify the encounter: completion is unavailable.'
       :'No persisted encounter verified. A clinical draft is not sufficient for completion.'}</p>}
     {notice&&<p className={'lifecycle-message lifecycle-'+notice.tone} role={notice.tone==='danger'?'alert':'status'}>{notice.message}</p>}
     {ticket&&<p className="ops-help">Uncertain request is locked to the original action, revision and nonce. Do not start another transition.</p>}
     {confirm?<div className="lifecycle-confirm" role="group" aria-label="Confirm appointment action">
       <p>Apply “{ACTION_COPY[confirm]}” to this specific appointment? The server will validate it before changing any status.</p>
       <div className="lifecycle-buttons"><button ref={confirmButton} type="button" className="button button-primary button-small"
        disabled={busy} onClick={()=>void submit(confirm)}>Apply {ACTION_COPY[confirm]}</button>
        <button type="button" className="button button-secondary button-small" onClick={()=>setConfirm(null)}>Back</button></div>
      </div>:<div className="lifecycle-buttons" role="group" aria-label="Available appointment transitions">
       {ticket?<button type="button" className="button button-primary button-small" disabled={busy||read.status!=='ready'}
        onClick={()=>void submit(ticket.action)}>Retry same request</button>:
        choices.map(action=><button key={action} type="button" className="button button-secondary button-small"
         disabled={busy} onClick={()=>choose(action)}>{ACTION_COPY[action]}</button>)}
       {loaded?.status==='checked_in'&&read.status==='ready'&&read.encounter!=='yes'&&
        <button type="button" className="button button-secondary button-small" disabled>Complete visit (verified encounter required)</button>}
      </div>}
     <div className="lifecycle-buttons"><button type="button" className="button button-quiet button-small"
      disabled={busy} onClick={()=>{setConfirm(null);setAttempt(n=>n+1);callbacks.current.onRefresh()}}>
      Check latest server status</button></div>
    </>}</>}
 </section>
}
