import {useEffect,useState} from 'react'
import type {User} from '@supabase/supabase-js'
import {Link} from 'react-router'
import {useAuth} from '../../hooks/AuthProvider'
import {PageHeading,LoadingCard} from '../../components/ui'
import {verifiedStaffNavigationBranches} from '../../release/verified-staff-branches'
import {classifyOpsError} from '../../ops/ops-model.mjs'
import type {OpsBranch} from '../../ops/branch-model.mjs'
import './operator-workspaces.css'

type State={kind:'loading'}|{kind:'ready';branches:OpsBranch[]}|{kind:'none'}|{kind:'failed';reason:string}
type Mode='request'|'management'
const APPROVAL_WRITER_AVAILABLE=false // No accepted scoped staff request/grant/revoke API exists in PR123.

/** Staff permissions come exclusively from fresh server assertions, never signup metadata or draft roles. */
export function StaffAccessPage(){const {user}=useAuth()
 return user?<StaffAccount key={user.id} user={user} mode="request"/>:<p role="alert">A verified account is required.</p>
}
export function StaffManagementPage(){const {user}=useAuth()
 return user?<StaffAccount key={user.id} user={user} mode="management"/>:<p role="alert">A verified staff account is required.</p>
}
function StaffAccount({user,mode}:{user:User;mode:Mode}){
 const [attempt,setAttempt]=useState(0)
 const [state,setState]=useState<State>({kind:'loading'})
 const [desired,setDesired]=useState('veterinarian')
 useEffect(()=>{
  let live=true
  setState({kind:'loading'})
  void verifiedStaffNavigationBranches(user).then(branches=>{
   if(live)setState(branches.length?{kind:'ready',branches}:{kind:'none'})
  },error=>{
   if(!live)return
   const reason=classifyOpsError(error)
   setState(reason==='denied'?{kind:'none'}:{kind:'failed',reason})
  })
  const recheck=()=>setAttempt(n=>n+1)
  window.addEventListener('focus',recheck)
  return()=>{live=false;window.removeEventListener('focus',recheck)}
 },[user.id,attempt])
 const admins=state.kind==='ready'?state.branches.filter(branch=>branch.role==='administrator'):[]
 const isAdmin=admins.length>0
 const retry=()=>{setState({kind:'loading'});setAttempt(n=>n+1)}
 return <section className="page operator" aria-labelledby="staff-approval-heading">
  <PageHeading id="staff-approval-heading" eyebrow="Verified account · clinic identity" title={mode==='request'?'Staff access':'Staff management'}>
   {mode==='request'?'Register and verify your account first. Clinic privileges require an administrator-approved server record.':'Review and maintain branch-specific staff permissions only after an audited administrative service is approved.'}
  </PageHeading>
  {state.kind==='loading'&&<LoadingCard label="Rechecking account and branch permissions…" rows={3}/>}
  {state.kind==='failed'&&<div className="card" role="alert">
   <h2>Access check unavailable</h2>
   <p>No staff role or branch is assumed when secure authorization fails. Previously displayed permissions have been cleared.</p>
   <button type="button" className="button button-secondary" onClick={retry}>Retry permission check</button>
  </div>}
  {mode==='request'&&state.kind!=='loading'&&state.kind!=='failed'&&<>
   <div className="operator-state-grid">
    <div className="card"><h2>1. Email verified</h2><p>Your signed-in identity is confirmed by Dawney authentication. Signing up never grants a staff role.</p></div>
    <div className="card"><h2>2. Approval status</h2>
     {state.kind==='ready'?<p role="status">Approved branch access: {state.branches.map(b=>b.name+' ('+b.role+')').join(', ')}.</p>:
      <p role="status">No approved staff access. A pending request cannot be confirmed: the request reader is not yet implemented.</p>}
    </div>
    <div className="card"><h2>3. Your workspaces</h2>
     {state.kind==='ready'?<p><Link to="/app/clinic">Open verified clinic navigation</Link></p>:
      <p>Private clinic records and staff navigation are unavailable until approval.</p>}
    </div>
   </div>
   <section className="card operator-section" aria-labelledby="request-heading">
    <h2 id="request-heading">Request clinic access</h2>
    <p className="operator-muted">Prepare your request. Nothing here is submitted or stored until ASTRA provides a reviewed staff-request writer and current-status reader.</p>
    <label>Interested staff role
     <select value={desired} onChange={e=>setDesired(e.target.value)}>
      <option value="veterinarian">Veterinarian</option><option value="receptionist">Receptionist</option>
      <option value="accountant">Accountant (restricted; not yet supported)</option>
     </select>
    </label>
    {desired==='accountant'&&<p role="alert">Accountant is a separate future role with no administrator, patient-chart or finance privileges in the current backend.</p>}
    <div className="operator-actions"><button type="button" className="button button-primary" disabled={!APPROVAL_WRITER_AVAILABLE}>Submit staff access request · unavailable</button>
     <button type="button" className="button button-secondary" onClick={retry}>Recheck my approval</button></div>
    <p className="operator-muted" role="status">Pending Approval is displayed only after an actual server-acknowledged request. No request was sent.</p>
   </section>
  </>}
  {mode==='management'&&state.kind!=='loading'&&state.kind!=='failed'&&(!isAdmin?
   <div className="card" role="alert"><h2>Administrator approval required</h2><p>Current active administrator membership for an authorized branch was not verified. No staff roster or patient information is loaded.</p><Link to="/app/staff-access">View my staff access</Link></div>:
   <>
    <section className="card operator-section" aria-labelledby="admin-branches">
     <h2 id="admin-branches">Your authorized administration branches</h2>
     <ul className="operator-pills">{admins.map(b=><li key={b.id}>{b.name} · Administrator</li>)}</ul>
     <p>Each future approval, reassignment and revocation must recheck administrator authority and the target branch on the server.</p>
    </section>
    <section className="card operator-section" aria-labelledby="pending-heading">
     <div className="operator-headline"><h2 id="pending-heading">Pending staff requests</h2><button className="button button-secondary" type="button" onClick={retry}>Refresh authorization</button></div>
     <p role="status">Request list unavailable — no approved server reader. This is not an empty queue.</p>
     <div className="operator-form-grid" aria-label="Future approval controls">
      <label>Clinic branch<select disabled defaultValue=""><option value="">Awaiting approved roster API</option></select></label>
      <label>Assign staff role<select disabled defaultValue=""><option value="">Choose verified request first</option>
       <option>Veterinarian</option><option>Receptionist</option><option>Administrator</option></select></label>
     </div>
     <div className="operator-actions">
      <button type="button" className="button button-primary" disabled>Approve · unavailable</button>
      <button type="button" className="button button-secondary" disabled>Update assignment · unavailable</button>
      <button type="button" className="button button-danger" disabled>Revoke · unavailable</button>
      <button type="button" className="button button-secondary" disabled>Reject · unavailable</button>
     </div>
     <p className="operator-muted">No pending roster, staff email, role or accountant entitlement is fetched or fabricated. An owner-authorized first administrator must be bootstrapped by a trusted backend operator.</p>
    </section>
   </>)}
 </section>
}