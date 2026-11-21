import {useEffect,useMemo,useRef,useState} from 'react'
import type {User} from '@supabase/supabase-js'
import {Link} from 'react-router'
import {useAuth} from '../../hooks/AuthProvider'
import {PageHeading,LoadingCard} from '../../components/ui'
import {verifiedStaffNavigationBranches} from '../../release/verified-staff-branches'
import {listClinicBranches} from '../../lib/staff-branch'
import type {OpsBranch} from '../../ops/branch-model.mjs'
import {createOperationalPort,operationalFlags} from '../../operational/port'
import {operationalError,validateReviewInput} from '../../operational/model.mjs'
import {classifyOpsError} from '../../ops/ops-model.mjs'
import type {StaffRequestState,StaffRole,ReviewAction,ReviewArgs,StaffListItem,MyStaffAccess} from '../../operational/contract'
import './operator-workspaces.css'

type BranchOption={id:string;display_name:string}
type AccessView={kind:'loading'}|{kind:'failed';message:string}|
 {kind:'ready';status:MyStaffAccess|null;branches:OpsBranch[];catalog:BranchOption[]}
const STATES=['pending','approved','rejected','inactive','revoked','none'] as const
const LABELS:Record<string,string>={none:'No staff request',pending:'Pending Approval',approved:'Approved',rejected:'Rejected',inactive:'Inactive',revoked:'Revoked'}
const explain=(error:unknown)=>operationalError(error).text
const denied=(error:unknown)=>operationalError(error).kind==='denied'

export function StaffAccessPage(){const {user}=useAuth()
 return user?<StaffAccessAccount key={user.id} user={user}/>:<p role="alert">A verified account is required.</p>
}
export function StaffManagementPage(){const {user}=useAuth()
 return user?<ManagementAccount key={user.id} user={user}/>:<p role="alert">A verified administrator account is required.</p>
}

/** Only the server's own-status reader can say "Pending Approval"; a signup option cannot. */
function StaffAccessAccount({user}:{user:User}){
 const port=useMemo(()=>createOperationalPort(user),[user.id])
 const [attempt,setAttempt]=useState(0)
 const [state,setState]=useState<AccessView>({kind:'loading'})
 const [desired,setDesired]=useState('veterinarian')
 const [branchId,setBranchId]=useState('')
 const [note,setNote]=useState('')
 const [busy,setBusy]=useState(false)
 const [uncertain,setUncertain]=useState<{branchId:string;note:string|null}|null>(null)
 const [notice,setNotice]=useState('')
 const alive=useRef(true)
 useEffect(()=>()=>{alive.current=false},[])
 useEffect(()=>{
  let active=true
  setState({kind:'loading'});setNotice('')
  const run=async()=>{
   if(!operationalFlags.staff){
    try{
     const branches=await verifiedStaffNavigationBranches(user)
     if(active)setState({kind:'ready',status:null,branches,catalog:[]})
    }catch(error){
     if(active)setState(classifyOpsError(error)==='denied'?{kind:'ready',status:null,branches:[],catalog:[]}:{kind:'failed',message:explain(error)})
    }
    return
   }
   try{
    const [status,raw]=await Promise.all([port.my(),listClinicBranches()])
    const catalog=raw.map((b:{id:string;display_name:string})=>({id:b.id,display_name:b.display_name}))
    let branches:OpsBranch[]=[]
    if(status.state==='approved'&&status.role!=='accountant'&&status.branches.length){
     branches=await verifiedStaffNavigationBranches(user)
     if(status.branches.some(id=>!branches.some(b=>b.id===id))||
       branches.some(b=>!status.branches.includes(b.id)))
      throw Object.assign(Error('Active branch mismatch'),{code:'42501'})
    }
    if(active){
     setState({kind:'ready',status,branches,catalog})
     setBranchId(old=>catalog.some(b=>b.id===old)?old:'')
    }
   }catch(error){
    if(active)setState({kind:'failed',message:explain(error)})
   }
  }
  void run()
  const onFocus=()=>setAttempt(n=>n+1)
  window.addEventListener('focus',onFocus)
  return()=>{active=false;window.removeEventListener('focus',onFocus)}
 },[user.id,attempt,port])
 const refresh=()=>{setNotice('');setState({kind:'loading'});setAttempt(n=>n+1)}
 const status=state.kind==='ready'?state.status:null
 const hasActive=state.kind==='ready'&&state.branches.length>0
 const canRequest=operationalFlags.staff&&state.kind==='ready'&&status?.state!=='pending'&&
   status?.state!=='approved'&&status?.state!=='revoked'&&Boolean(branchId)&&!busy
 async function submit(){
  if(!canRequest&&!uncertain)return
  const payload=uncertain??{branchId,note:note.trim()||null}
  if(!state||busy)return
  setBusy(true);setNotice('')
  try{
   const ack=await port.request(payload.branchId,payload.note)
   if(ack.state!=='pending'||ack.branchId!==payload.branchId)throw Error('Staff request reply mismatch')
   const confirmed=await port.my()
   if(confirmed.state!=='pending')throw Error('Staff request not confirmed by status readback')
   if(!alive.current)return
   setUncertain(null)
   setNotice('Pending Approval — confirmed by the staff access server.')
   refresh()
  }catch(error){
   if(!alive.current)return
   const info=operationalError(error)
   // A timeout/invalid response after write can already mean a persisted request.
   // Keep EXACT branch and note for retry, not a new self-request or different branch.
   if(info.kind==='uncertain'||info.kind==='unavailable')setUncertain(payload)
   setNotice(info.text)
   if(info.kind==='denied')refresh()
  }finally{if(alive.current)setBusy(false)}
 }
 return <section className="page operator" aria-labelledby="staff-approval-heading">
  <PageHeading id="staff-approval-heading" eyebrow="Verified account · clinic identity" title="Staff access">
   Sign up and verify your email through Dawney Auth. Approval is a separate server-controlled decision, never an account option.
  </PageHeading>
  {state.kind==='loading'&&<LoadingCard label="Reading current staff approval and verified branch access…" rows={3}/>}
  {state.kind==='failed'&&<div className="card" role="alert"><h2>Access check unavailable</h2><p>{state.message}</p>
    <p>No previously approved staff role, private records or pending status is assumed.</p>
    <button type="button" className="button button-secondary" onClick={refresh}>Retry permission check</button></div>}
  {state.kind==='ready'&&<>
   <div className="operator-state-grid">
    <div className="card"><h2>1. Email verified</h2><p>Your verified signed-in identity is confirmed by Dawney authentication. Signup never grants staff privileges.</p></div>
    <div className="card"><h2>2. Approval status</h2>
     {operationalFlags.staff&&status?
      <p role="status"><strong>{LABELS[status.state]}</strong> · {status.role??'No active role'}.
       {status.state==='approved'&&status.role==='accountant'?' Restricted accountant — no clinical, stock or admin access.':''}</p>:
      hasActive?<p role="status">Approved branch access: {state.branches.map(b=>b.name+' ('+b.role+')').join(', ')}.</p>:
      <p role="status">No approved staff access. A pending request cannot be confirmed: the request reader is not yet implemented.</p>}
    </div>
    <div className="card"><h2>3. Your workspaces</h2>
     {hasActive?<p><Link to="/app/clinic">Open verified clinic navigation</Link></p>:
      <p>Private clinic records and staff navigation are unavailable without currently asserted, approved privileges.</p>}
    </div>
   </div>
   <section className="card operator-section" aria-labelledby="request-heading">
    <h2 id="request-heading">Request clinic access</h2>
    <p className="operator-muted">{operationalFlags.staff
     ?'Choose the clinic branch where you work. This creates a pending application only; an administrator chooses your actual role.'
     :'Prepare your request. Nothing is submitted until reviewed staff RPCs are owner-enabled.'}</p>
    <div className="operator-form-grid">
     {operationalFlags.staff&&<label>Requested clinic branch<select value={branchId} disabled={busy||!!uncertain} onChange={e=>setBranchId(e.target.value)}>
      <option value="">Choose a clinic branch</option>
      {state.catalog.map(b=><option key={b.id} value={b.id}>{b.display_name}</option>)}
     </select></label>}
     <label>Interested staff role (not a permission)
      <select value={desired} disabled={busy||!!uncertain} onChange={e=>setDesired(e.target.value)}>
       <option value="veterinarian">Veterinarian</option><option value="receptionist">Receptionist</option>
       <option value="accountant">Accountant (restricted; backend review required)</option>
      </select>
     </label>
     {operationalFlags.staff&&<label>Additional note (optional, max 500 characters)
      <textarea maxLength={500} rows={3} value={note} disabled={busy||!!uncertain} onChange={e=>setNote(e.target.value)}
        placeholder="Describe your clinic role without including any patient information."/>
     </label>}
    </div>
    {desired==='accountant'&&<p role="alert">Accountant is a separate restricted identity and has no automatic administrator, patient-chart, inventory or finance access.</p>}
    {status?.state==='pending'&&<p role="status">Pending Approval — this is the status returned by the server. Your application does not grant any staff access.</p>}
    {status?.state==='revoked'&&<p role="alert">Your staff access was revoked. Self-request cannot restore this permission; contact an administrator.</p>}
    <div className="operator-actions">
     <button type="button" className="button button-primary" disabled={!canRequest||!!uncertain} onClick={()=>void submit()}>
      {busy?'Submitting…':operationalFlags.staff?'Submit staff access request':'Submit staff access request · unavailable'}
     </button>
     {uncertain&&<button type="button" className="button button-secondary" disabled={busy} onClick={()=>void submit()}>
      Retry same request</button>}
     <button type="button" className="button button-secondary" disabled={busy} onClick={refresh}>Recheck my approval</button>
    </div>
    {notice&&<p className="operator-summary" role={uncertain?'alert':'status'}>{notice}</p>}
    {!operationalFlags.staff&&<p className="operator-muted" role="status">Pending Approval is displayed only after an actual server-acknowledged request. No request was sent.</p>}
   </section>
  </>}
 </section>
}

type RosterView={kind:'loading'}|{kind:'failed';message:string}|{kind:'ready';items:StaffListItem[]}
function ManagementAccount({user}:{user:User}){
 const port=useMemo(()=>createOperationalPort(user),[user.id])
 const [attempt,setAttempt]=useState(0)
 const [scope,setScope]=useState<{kind:'loading'}|{kind:'failed'}|{kind:'ready';branches:OpsBranch[]}>({kind:'loading'})
 const [selected,setSelected]=useState('')
 useEffect(()=>{
  let live=true
  setScope({kind:'loading'});setSelected('')
  void verifiedStaffNavigationBranches(user).then(branches=>{
   if(!live)return
   const admin=branches.filter(b=>b.role==='administrator')
   setScope(admin.length?{kind:'ready',branches:admin}:{kind:'failed'})
   if(admin.length===1)setSelected(admin[0]?.id??'')
  },()=>{if(live)setScope({kind:'failed'})})
  const onFocus=()=>setAttempt(n=>n+1)
  window.addEventListener('focus',onFocus)
  return()=>{live=false;window.removeEventListener('focus',onFocus)}
 },[user.id,attempt])
 const retry=()=>setAttempt(n=>n+1)
 const branch=scope.kind==='ready'?scope.branches.find(b=>b.id===selected):null
 return <section className="page operator" aria-labelledby="staff-approval-heading">
  <PageHeading id="staff-approval-heading" eyebrow="Clinic staff · administrator" title="Staff management">
   Review pending staff requests and use server-reviewed role and branch assignments only for branches where you are currently an administrator.
  </PageHeading>
  {scope.kind==='loading'&&<LoadingCard label="Verifying live administrator branch permissions…" rows={3}/>}
  {scope.kind==='failed'&&<div className="card" role="alert"><h2>Administrator approval required</h2>
   <p>Current active administrator membership for an authorized branch was not verified. No staff roster or patient information is loaded.</p>
   <button className="button button-secondary" type="button" onClick={retry}>Recheck admin access</button>
   <p><Link to="/app/staff-access">View my staff access</Link></p>
  </div>}
  {scope.kind==='ready'&&<>
   <section className="card operator-section">
    <h2>Your authorized administration branches</h2>
    <ul className="operator-pills">{scope.branches.map(b=><li key={b.id}>{b.name} · Administrator</li>)}</ul>
    <label>Manage requests in branch<select value={selected} onChange={e=>setSelected(scope.branches.some(b=>b.id===e.target.value)?e.target.value:'')}>
     <option value="">Select an authorized branch</option>
     {scope.branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
    </select></label>
   </section>
   {branch?<AdminRoster key={user.id+':'+branch.id} user={user} branch={branch} adminBranches={scope.branches}
      retryScope={retry} port={port}/>:
    <div className="card" role="status">Select an authorized branch to inspect its staff review queue.</div>}
  </>}
 </section>
}
function AdminRoster({user,branch,adminBranches,retryScope,port}:{
 user:User;branch:OpsBranch;adminBranches:OpsBranch[];retryScope:()=>void;
 port:ReturnType<typeof createOperationalPort>
}){
 const [attempt,setAttempt]=useState(0)
 const [roster,setRoster]=useState<RosterView>({kind:'loading'})
 const [target,setTarget]=useState('')
 const [action,setAction]=useState<ReviewAction>('approve')
 const [role,setRole]=useState<StaffRole>('receptionist')
 const [assigned,setAssigned]=useState<string[]>([branch.id])
 const [busy,setBusy]=useState(false)
 const [pending,setPending]=useState<ReviewArgs|null>(null)
 const [notice,setNotice]=useState('')
 const alive=useRef(true)
 useEffect(()=>()=>{alive.current=false},[])
 useEffect(()=>{
  let live=true
  setRoster({kind:'loading'})
  if(!operationalFlags.staff){
   setRoster({kind:'failed',message:'Request list unavailable — no approved server reader. This is not an empty queue.'})
   return ()=>{live=false}
  }
  void port.list(branch.id).then(result=>{
   if(live)setRoster({kind:'ready',items:result.items})
  },error=>{
   if(live){setRoster({kind:'failed',message:explain(error)});if(denied(error))retryScope()}
  })
  return()=>{live=false}
 },[port,branch.id,attempt])
 const refresh=()=>{setNotice('');setRoster({kind:'loading'});setAttempt(n=>n+1)}
 const selected=roster.kind==='ready'?roster.items.find(x=>x.userId===target)??null:null
 const grant=action==='approve'||action==='role_change'
 const validActions=(s:StaffRequestState):ReviewAction[]=>s==='pending'?['approve','reject']:
  s==='approved'?['role_change','inactivate','revoke']:s==='inactive'?['revoke']:[]
 function setTargetId(value:string){
  setTarget(value);setNotice('');setPending(null)
  const request=roster.kind==='ready'?roster.items.find(x=>x.userId===value):null
  setAction(request?.state==='approved'?'role_change':request?.state==='inactive'?'revoke':'approve')
  setAssigned([branch.id])
 }
 async function review(){
  if(busy||!selected&&!pending)return
  const args:ReviewArgs=pending??{
   p_target:selected!.userId,p_action:action,p_role:grant?role:null,
   p_branches:grant?assigned:null,p_expected_revision:selected!.revision,
   p_request_id:crypto.randomUUID()
  }
  const issue=validateReviewInput(args,adminBranches.map(b=>b.id),user.id)
  if(issue){setNotice(issue);return}
  setBusy(true);setNotice('')
  try{
   const current=await verifiedStaffNavigationBranches(user)
   if(!current.some(b=>b.id===branch.id&&b.role==='administrator')||
      (args.p_branches??[]).some(id=>!current.some(b=>b.id===id&&b.role==='administrator')))
     throw Object.assign(Error('Admin branch revoked'),{code:'42501'})
   const result=await port.review(args)
   const [readback,stillAuthorized]=await Promise.all([port.list(branch.id),verifiedStaffNavigationBranches(user)])
   if(!stillAuthorized.some(b=>b.id===branch.id&&b.role==='administrator')||
      !readback.items.some(x=>x.userId===result.userId&&x.state===result.state&&x.revision===result.revision))
    throw Error('Staff decision not verified by refreshed server roster')
   if(!alive.current)return
   setPending(null);setNotice('Staff decision confirmed by the server and reloaded roster.')
   setRoster({kind:'ready',items:readback.items})
   setTarget('')
  }catch(error){
   if(!alive.current)return
   const info=operationalError(error)
   setNotice(info.text)
   if(info.kind==='denied'){setRoster({kind:'failed',message:info.text});retryScope()}
   else if(info.kind==='uncertain'||info.kind==='unavailable')setPending(args)
   else {setPending(null);refresh()}
  }finally{if(alive.current)setBusy(false)}
 }
 return <section className="card operator-section" aria-labelledby="pending-heading">
  <div className="operator-headline"><h2 id="pending-heading">Pending staff requests</h2>
   <button type="button" className="button button-secondary" onClick={refresh} disabled={busy}>Refresh requests</button>
  </div>
  {roster.kind==='loading'&&<LoadingCard label="Reading branch-scoped staff requests…" rows={3}/>}
  {roster.kind==='failed'&&<p role="alert">{roster.message}</p>}
  {roster.kind==='ready'&&<>
   <p role="status">{roster.items.length===0?'No requests returned for this authorized branch.':
      roster.items.filter(x=>x.state==='pending').length+' pending requests; '+roster.items.length+' server rows.'}</p>
   {roster.items.length>0&&<div className="operator-scroll">
    <table><thead><tr><th>Account ID (truncated)</th><th>Status</th><th>Revision</th><th>Requested</th><th>Review</th></tr></thead>
    <tbody>{roster.items.map(x=><tr key={x.userId}>
     <td><code>{x.userId.slice(0,8)}…</code></td><td>{LABELS[x.state]}</td><td>{x.revision}</td>
     <td><time dateTime={x.requestedAt}>{new Date(x.requestedAt).toLocaleDateString()}</time></td>
     <td><button type="button" className="button button-secondary button-small"
       disabled={busy||!!pending||!validActions(x.state).length} onClick={()=>setTargetId(x.userId)}>
       Review request</button></td>
    </tr>)}</tbody></table>
   </div>}
   {selected&&<div className="operator-review">
    <h3>Review selected account · {selected.userId.slice(0,8)}…</h3>
    <p>Status {LABELS[selected.state]} · revision {selected.revision}. No staff emails are exposed by this RPC.</p>
    <div className="operator-form-grid">
     <label>Decision<select value={action} disabled={busy||!!pending} onChange={e=>setAction(e.target.value as ReviewAction)}>
      {validActions(selected.state).map(a=><option key={a} value={a}>{a.replace('_',' ')}</option>)}
     </select></label>
     {grant&&<label>Assign role<select value={role} disabled={busy||!!pending} onChange={e=>setRole(e.target.value as StaffRole)}>
      {(['receptionist','veterinarian','administrator','accountant'] as StaffRole[]).map(x=><option key={x} value={x}>{x}</option>)}
     </select></label>}
    </div>
    {grant&&<fieldset className="operator-branches" disabled={busy||!!pending}><legend>Approved branch assignments</legend>
     {adminBranches.map(b=><label key={b.id}><input type="checkbox" checked={assigned.includes(b.id)} onChange={e=>setAssigned(old=>e.target.checked?[...old,b.id]:old.filter(x=>x!==b.id))}/>{b.name}</label>)}
    </fieldset>}
    {role==='accountant'&&grant&&<p role="status">Restricted accountant has no clinical, inventory, administrator or finance access by default.</p>}
    <div className="operator-actions">
     <button type="button" className="button button-primary" disabled={busy||!!pending||!operationalFlags.staff} onClick={()=>void review()}>
      {busy?'Confirming…':'Confirm '+action.replace('_',' ')}</button>
     {pending&&<button type="button" className="button button-secondary" disabled={busy} onClick={()=>void review()}>Retry same decision ID</button>}
    </div>
   </div>}
  </>}
  {roster.kind!=='ready'&&<div className="operator-actions">
   <button className="button button-primary" type="button" disabled>Approve · unavailable</button>
   <button className="button button-secondary" type="button" disabled>Reject · unavailable</button>
   <button className="button button-danger" type="button" disabled>Revoke · unavailable</button>
  </div>}
  {notice&&<p role={pending?'alert':'status'} className="operator-summary">{notice}</p>}
  <p className="operator-muted">An administrator cannot grant themselves access. Assignment scope and revision are checked again on the server. No secret or patient record is loaded.</p>
 </section>
}
