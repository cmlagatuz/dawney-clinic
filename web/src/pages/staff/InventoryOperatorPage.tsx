import {useEffect,useRef,useState} from 'react'
import type {User} from '@supabase/supabase-js'
import {useAuth} from '../../hooks/AuthProvider'
import {PageHeading,LoadingCard} from '../../components/ui'
import {verifiedStaffNavigationBranches} from '../../release/verified-staff-branches'
import {inventoryError} from '../../inventory/model.mjs'
import {operationalFlags} from '../../operational/port'
import type {OpsBranch} from '../../ops/branch-model.mjs'
import type {ItemArgs,ReceiptArgs} from '../../operational/contract'
import {PharmacyPage} from './PharmacyPage'
import {InventoryOperatorForms} from './InventoryOperatorForms'
import './operator-workspaces.css'
import {useUnresolvedOperationWarning} from '../../hooks/useUnresolvedOperationWarning'

const READ_ONLY_PHARMACY=import.meta.env.VITE_PHASE5B_PHARMACY_UI==='true'
type Access={kind:'loading'}|{kind:'ready';branches:OpsBranch[]}|{kind:'denied'}|{kind:'failed';reason:string}
export function InventoryOperatorPage(){const {user}=useAuth()
 return user?<OperatorAccount key={user.id} user={user}/>:<p role="alert">A verified account is required for clinic inventory.</p>
}
function OperatorAccount({user}:{user:User}){
 const [attempt,setAttempt]=useState(0)
 const [access,setAccess]=useState<Access>({kind:'loading'})
 const [selected,setSelected]=useState<string|null>(null)
 const verifiedRole=useRef<OpsBranch['role']|null>(null)
 // Focus revalidation can unmount the forms; retain the exact nonce/payload
 // only within this account boundary, clearing it on branch or role loss.
 const [itemTicket,setItemTicket]=useState<ItemArgs|null>(null)
 const [receiptTicket,setReceiptTicket]=useState<ReceiptArgs|null>(null)
 const pending=!!itemTicket||!!receiptTicket
 useUnresolvedOperationWarning(pending)
 const discardTickets=()=>{setItemTicket(null);setReceiptTicket(null)}
 useEffect(()=>{
  let current=true
  // Hide protected forms while checking, but retain the branch selection so
  // a multi-branch operator can safely replay the original nonce afterward.
  setAccess({kind:'loading'})
  void verifiedStaffNavigationBranches(user).then(branches=>{
   if(!current)return
   const eligible=branches.filter(b=>b.role==='administrator'||b.role==='receptionist')
   if(!eligible.length){discardTickets();setSelected(null);setAccess({kind:'denied'});return}
   const sameBranch=selected!==null&&eligible.some(b=>b.id===selected)
   const nextRole=eligible.find(b=>b.id===selected)?.role??null
   if(selected!==null&&(!sameBranch||verifiedRole.current!==null&&verifiedRole.current!==nextRole))discardTickets()
   verifiedRole.current=nextRole??(eligible.length===1?eligible[0]?.role??null:null)
   setAccess({kind:'ready',branches:eligible})
   setSelected(sameBranch?selected:eligible.length===1?eligible[0]?.id??null:null)
  },error=>{
   if(!current)return
   const reason=inventoryError(error)
   if(reason==='denied'){discardTickets();setSelected(null)}
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
    'Item creation and stock receiving remain unavailable until the operational backend is owner-enabled. Stock reading requires its separately approved reader.'}
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
     <select id="operator-branch" value={branch?.id??''} disabled={pending} onChange={e=>{if(pending)return;discardTickets();const next=access.branches.find(b=>b.id===e.target.value);verifiedRole.current=next?.role??null;setSelected(next?.id??null)}}>
      <option value="">Choose an authorized branch</option>
      {access.branches.map(b=><option key={b.id} value={b.id}>{b.name} · {b.role}</option>)}
     </select>
    </label>
    <p className="operator-muted">Selection is a UI filter. Each operation must still validate the verified session, current role and selected branch in PostgreSQL.</p>
   </section>
   {pending&&<p role="status">Branch switching is locked until the original operation is reconciled.</p>}
   {branch?<InventoryOperatorForms key={user.id+':'+branch.id} user={user} branch={branch}
     itemTicket={itemTicket} setItemTicket={setItemTicket}
     receiptTicket={receiptTicket} setReceiptTicket={setReceiptTicket}
     onDenied={()=>{discardTickets();setAccess({kind:'denied'});setSelected(null)}}/>:
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
