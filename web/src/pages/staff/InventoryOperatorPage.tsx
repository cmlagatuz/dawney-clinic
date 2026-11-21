import {useEffect,useState} from 'react'
import type {User} from '@supabase/supabase-js'
import {useAuth} from '../../hooks/AuthProvider'
import {PageHeading,LoadingCard} from '../../components/ui'
import {verifiedStaffNavigationBranches} from '../../release/verified-staff-branches'
import {inventoryError} from '../../inventory/model.mjs'
import {operationalFlags} from '../../operational/port'
import type {OpsBranch} from '../../ops/branch-model.mjs'
import {PharmacyPage} from './PharmacyPage'
import {InventoryOperatorForms} from './InventoryOperatorForms'
import './operator-workspaces.css'

const READ_ONLY_PHARMACY=import.meta.env.VITE_PHASE5B_PHARMACY_UI==='true'
type Access={kind:'loading'}|{kind:'ready';branches:OpsBranch[]}|{kind:'denied'}|{kind:'failed';reason:string}
export function InventoryOperatorPage(){const {user}=useAuth()
 return user?<OperatorAccount key={user.id} user={user}/>:<p role="alert">A verified account is required for clinic inventory.</p>
}
function OperatorAccount({user}:{user:User}){
 const [attempt,setAttempt]=useState(0)
 const [access,setAccess]=useState<Access>({kind:'loading'})
 const [selected,setSelected]=useState<string|null>(null)
 useEffect(()=>{
  let current=true
  setAccess({kind:'loading'});setSelected(null)
  void verifiedStaffNavigationBranches(user).then(branches=>{
   if(!current)return
   const eligible=branches.filter(b=>b.role==='administrator'||b.role==='receptionist')
   if(!eligible.length){setAccess({kind:'denied'});return}
   setAccess({kind:'ready',branches:eligible})
   if(eligible.length===1)setSelected(eligible[0]?.id??null)
  },error=>{
   if(!current)return
   const reason=inventoryError(error)
   setAccess(reason==='denied'?{kind:'denied'}:{kind:'failed',reason})
  })
  const recheck=()=>setAttempt(n=>n+1)
  window.addEventListener('focus',recheck)
  return()=>{current=false;window.removeEventListener('focus',recheck)}
 },[user.id,attempt])
 const branch=access.kind==='ready'?access.branches.find(b=>b.id===selected)??null:null
 return <section className="page operator" aria-labelledby="inventory-operator-heading">
  <PageHeading id="inventory-operator-heading" eyebrow="Branch operations · protected operator workspace" title="Inventory management">
   {operationalFlags.inventory?
    'Manage branch-scoped stock through approved RPCs. Every saved item and receipt requires server acknowledgement and an independently verified readback.':
    'Browse verified medicine stock through the existing reader. Item creation and stock receiving remain unavailable until the operational backend is owner-enabled.'}
  </PageHeading>
  {access.kind==='loading'&&<LoadingCard label="Verifying active receptionist or administrator branch access…" rows={4}/>}
  {access.kind==='denied'&&<div className="card" role="alert"><h2>Inventory operations denied</h2>
   <p>Only a currently approved receptionist or administrator in the selected clinic branch can prepare stock operations. No inventory records or drafts from another account are displayed.</p>
   <button className="button button-secondary" type="button" onClick={()=>setAttempt(n=>n+1)}>Recheck access</button>
  </div>}
  {access.kind==='failed'&&<div className="card" role="alert"><h2>Inventory authorization unavailable</h2>
   <p>Verification failed ({access.reason}). No previous branch or stock is retained. Check the connection and retry.</p>
   <button className="button button-secondary" type="button" onClick={()=>setAttempt(n=>n+1)}>Retry secure authorization</button>
  </div>}
  {access.kind==='ready'&&<>
   <section className="card operator-section" aria-label="Authorized inventory branch">
    <label htmlFor="operator-branch">Inventory branch
     <select id="operator-branch" value={branch?.id??''} onChange={e=>setSelected(access.branches.some(b=>b.id===e.target.value)?e.target.value:null)}>
      <option value="">Choose an authorized branch</option>
      {access.branches.map(b=><option key={b.id} value={b.id}>{b.name} · {b.role}</option>)}
     </select>
    </label>
    <p className="operator-muted">Selection is a UI filter. Each operation must still validate the verified session, current role and selected branch in PostgreSQL.</p>
   </section>
   {branch?<InventoryOperatorForms key={user.id+':'+branch.id} user={user} branch={branch}
     onDenied={()=>{setAccess({kind:'denied'});setSelected(null)}}/>:
    <div className="card" role="status"><h2>Choose a clinic branch</h2><p>Item and receipt controls are hidden until you select an active authorized branch.</p></div>}
  </>}
  <section className="operator-inventory-read" aria-label="Existing medicine stock reader">
   {access.kind==='ready'&&READ_ONLY_PHARMACY?<PharmacyPage/>:
    <div className="card" role="status"><h2>Inventory list and movement history</h2>
     <p>Existing /app/pharmacy search, low-stock indicators, FEFO lots and movement history remain behind the inherited OFF-by-default pharmacy reader flag. The operational item selector uses the same trusted branch-bound read adapter only when its separately approved flag is enabled.</p>
     <p>{operationalFlags.inventory?'Exact balances and receipt events appear only when verified server rows are available.':'Quantity is unavailable. No stock balance, item, receipt or movement is created from this screen.'}</p>
    </div>}
  </section>
 </section>
}
