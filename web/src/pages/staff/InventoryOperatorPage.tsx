import {useEffect,useState} from 'react'
import type {User} from '@supabase/supabase-js'
import {Link} from 'react-router'
import {useAuth} from '../../hooks/AuthProvider'
import {PageHeading,LoadingCard} from '../../components/ui'
import {verifiedStaffNavigationBranches} from '../../release/verified-staff-branches'
import {inventoryError} from '../../inventory/model.mjs'
import {validateNewItem,validateReceipt,validDraft,PRODUCT_TYPES} from '../../inventory/operator-validation.mjs'
import type {ItemType,NewItemDraft,ReceiptDraft} from '../../inventory/operator-validation.mjs'
import type {OpsBranch} from '../../ops/branch-model.mjs'
import {PharmacyPage} from './PharmacyPage'
import './operator-workspaces.css'

const READ_ONLY_PHARMACY=import.meta.env.VITE_PHASE5B_PHARMACY_UI==='true'
const ITEM_WRITER_AVAILABLE=false
const STOCK_RECEIPT_WRITER_AVAILABLE=false
type Access={kind:'loading'}|{kind:'ready';branches:OpsBranch[]}|{kind:'denied'}|{kind:'failed';reason:string}
const emptyItem:NewItemDraft={type:'medicine',code:'',name:'',unit:'',formulation:'',strength:'',reorder:'',supplier:''}
const emptyReceipt:ReceiptDraft={branchId:'',code:'',lot:'',quantity:'',receivedOn:'',expiresOn:'',supplier:''}
export function InventoryOperatorPage(){const {user}=useAuth()
 return user?<OperatorAccount key={user.id} user={user}/>:<p role="alert">A verified account is required for clinic inventory.</p>
}
function OperatorAccount({user}:{user:User}){
 const [nonce,setNonce]=useState(0)
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
  const recheck=()=>setNonce(n=>n+1)
  window.addEventListener('focus',recheck)
  return()=>{current=false;window.removeEventListener('focus',recheck)}
 },[user.id,nonce])
 const branch=access.kind==='ready'?access.branches.find(b=>b.id===selected)??null:null
 return <section className="page operator" aria-labelledby="inventory-operator-heading">
  <PageHeading id="inventory-operator-heading" eyebrow="Branch operations · source preview" title="Inventory management">
   Browse verified medicine stock using the existing read-only service. Item creation and stock receiving need separately approved, atomic server contracts.
  </PageHeading>
  {access.kind==='loading'&&<LoadingCard label="Verifying active receptionist or administrator branch access…" rows={4}/>}
  {access.kind==='denied'&&<div className="card" role="alert"><h2>Inventory operations denied</h2>
   <p>Only a currently approved receptionist or administrator in the selected clinic branch can prepare stock operations. No inventory records or drafts from another account are displayed.</p>
   <button className="button button-secondary" type="button" onClick={()=>setNonce(n=>n+1)}>Recheck access</button>
  </div>}
  {access.kind==='failed'&&<div className="card" role="alert"><h2>Inventory authorization unavailable</h2>
   <p>Verification failed ({access.reason}). No previous branch or stock is retained. Check the connection and retry.</p>
   <button className="button button-secondary" type="button" onClick={()=>setNonce(n=>n+1)}>Retry secure authorization</button>
  </div>}
  {access.kind==='ready'&&<>
   <section className="card operator-section" aria-label="Authorized inventory branch">
    <label htmlFor="operator-branch">Inventory branch
     <select id="operator-branch" value={branch?.id??''} onChange={e=>setSelected(access.branches.some(b=>b.id===e.target.value)?e.target.value:null)}>
      <option value="">Choose an authorized branch</option>
      {access.branches.map(b=><option key={b.id} value={b.id}>{b.name} · {b.role}</option>)}
     </select>
    </label>
    <p className="operator-muted">The selected branch is only a visual filter. Any eventual write must independently authorize your current verified account, role and branch on the server.</p>
   </section>
   {branch?<OperatorForms key={user.id+':'+branch.id} branch={branch}/>:
    <div className="card" role="status"><h2>Choose a clinic branch</h2><p>Item and stock draft controls are hidden until an authorized branch is selected.</p></div>}
  </>}
  <section className="operator-inventory-read" aria-label="Existing medicine stock reader">
   {READ_ONLY_PHARMACY?<PharmacyPage/>:
    <div className="card" role="status"><h2>Inventory list and movement history</h2>
     <p>Read-only medicine search, low-stock indicators, FEFO lots and movement history already exist in <code>/app/pharmacy</code>. Their rollout flag remains OFF until the reviewed source migration and hosted RLS acceptance.</p>
     <p>Quantity is unavailable. No stock balance, item, receipt or movement is created from this screen.</p>
    </div>}
  </section>
 </section>
}
function OperatorForms({branch}:{branch:OpsBranch}){
 const [item,setItem]=useState<NewItemDraft>({...emptyItem})
 const [receipt,setReceipt]=useState<ReceiptDraft>({...emptyReceipt,branchId:branch.id})
 const [checkedItem,setCheckedItem]=useState(false)
 const [checkedReceipt,setCheckedReceipt]=useState(false)
 const [controlled,setControlled]=useState(false)
 const [cold,setCold]=useState(false)
 const itemErrors:Readonly<Record<string,string>>=checkedItem?validateNewItem(item):{}
 const receiptErrors:Readonly<Record<string,string>>=checkedReceipt?validateReceipt(receipt,new Date().toISOString().slice(0,10)):{}
 const updateItem=<K extends keyof NewItemDraft>(k:K,value:NewItemDraft[K])=>{
  setItem(old=>({...old,[k]:value}));setCheckedItem(false)
 }
 const updateReceipt=<K extends keyof ReceiptDraft>(k:K,value:ReceiptDraft[K])=>{
  setReceipt(old=>({...old,[k]:value}));setCheckedReceipt(false)
 }
 const error=(errors:Readonly<Record<string,string>>,field:string)=>errors[field]?
  <span className="operator-inline-error" role="alert">{errors[field]}</span>:null
 return <>
  <div className="operator-state-grid">
   <div className="card"><h2>Authorized branch</h2><p>{branch.name}</p><p className="operator-muted">{branch.role} · server-verified navigation</p></div>
   <div className="card"><h2>Product entry</h2><p>Local form validation is available. Saving is blocked until an audited item-creation API exists.</p></div>
   <div className="card"><h2>Stock movements</h2><p>Receive Stock is blocked until one atomic, idempotent, auditable ledger operation is accepted.</p></div>
  </div>
  <div className="operator-form-grid">
   <section className="card operator-section" aria-labelledby="add-item-heading">
    <h2 id="add-item-heading">Add Item</h2>
    <p className="operator-muted operator-subtitle">Build a local item draft. No medicine, consumable or supply is stored here.</p>
    <form noValidate onSubmit={e=>{e.preventDefault();setCheckedItem(true)}}>
     <div className="operator-form-grid">
      <label>Product type<select value={item.type} onChange={e=>updateItem('type',e.target.value as ItemType)}>
       {PRODUCT_TYPES.map(x=><option key={x} value={x}>{x.charAt(0).toUpperCase()+x.slice(1)}</option>)}
      </select>{error(itemErrors,'type')}</label>
      <label>Item code<input value={item.code} maxLength={40} aria-invalid={Boolean(itemErrors.code)} onChange={e=>updateItem('code',e.target.value.toUpperCase())} placeholder="MED-001"/>{error(itemErrors,'code')}</label>
      <label>Description<input value={item.name} maxLength={160} aria-invalid={Boolean(itemErrors.name)} onChange={e=>updateItem('name',e.target.value)} placeholder="Item description"/>{error(itemErrors,'name')}</label>
      <label>Stock unit<input value={item.unit} maxLength={30} aria-invalid={Boolean(itemErrors.unit)} onChange={e=>updateItem('unit',e.target.value)} placeholder="each"/>{error(itemErrors,'unit')}</label>
      {item.type==='medicine'&&<>
       <label>Formulation<input value={item.formulation} maxLength={80} aria-invalid={Boolean(itemErrors.formulation)} onChange={e=>updateItem('formulation',e.target.value)} placeholder="tablet, vial, solution"/>{error(itemErrors,'formulation')}</label>
       <label>Strength<input value={item.strength} maxLength={80} aria-invalid={Boolean(itemErrors.strength)} onChange={e=>updateItem('strength',e.target.value)} placeholder="5 mg"/>{error(itemErrors,'strength')}</label>
      </>}
      <label>Reorder point (whole units)<input inputMode="numeric" value={item.reorder} aria-invalid={Boolean(itemErrors.reorder)} onChange={e=>updateItem('reorder',e.target.value)} placeholder="10"/>{error(itemErrors,'reorder')}</label>
      <label>Supplier reference (optional)<input maxLength={120} value={item.supplier} onChange={e=>updateItem('supplier',e.target.value)}/>{error(itemErrors,'supplier')}</label>
     </div>
     {item.type==='medicine'&&<div className="operator-actions">
      <label><input type="checkbox" checked={controlled} onChange={e=>setControlled(e.target.checked)}/> Controlled medicine</label>
      <label><input type="checkbox" checked={cold} onChange={e=>setCold(e.target.checked)}/> Requires refrigeration</label>
     </div>}
     {controlled&&<p role="alert">Controlled medicine: no item activation until separate clinic policy and approved backend authorization.</p>}
     <div className="operator-actions">
      <button type="submit" className="button button-secondary">Validate item details</button>
      <button type="button" className="button button-primary" disabled={!ITEM_WRITER_AVAILABLE}>Add Item · unavailable</button>
     </div>
     {checkedItem&&<p role="status" className="operator-summary">{validDraft(itemErrors)?'Item fields look valid locally. Nothing has been saved.':'Correct the highlighted item fields. Nothing has been saved.'}</p>}
    </form>
   </section>
   <section className="card operator-section" aria-labelledby="receive-heading">
    <h2 id="receive-heading">Receive Stock</h2>
    <p className="operator-muted operator-subtitle">A receipt must target a server-confirmed item and active branch. Quantity changes require an immutable movement ledger.</p>
    <form noValidate onSubmit={e=>{e.preventDefault();setCheckedReceipt(true)}}>
     <div className="operator-form-grid">
      <label>Clinic branch<input value={branch.name} disabled readOnly/><span className="operator-muted">Selected from approved membership</span></label>
      <label>Existing item code<input value={receipt.code} maxLength={40} aria-invalid={Boolean(receiptErrors.code)} onChange={e=>updateReceipt('code',e.target.value.toUpperCase())} placeholder="MED-001"/>{error(receiptErrors,'code')}</label>
      <label>Batch / lot number<input value={receipt.lot} maxLength={80} aria-invalid={Boolean(receiptErrors.lot)} onChange={e=>updateReceipt('lot',e.target.value)}/>{error(receiptErrors,'lot')}</label>
      <label>Quantity (whole stock units)<input value={receipt.quantity} inputMode="numeric" aria-invalid={Boolean(receiptErrors.quantity)} onChange={e=>updateReceipt('quantity',e.target.value)} placeholder="10"/>{error(receiptErrors,'quantity')}</label>
      <label>Received date<input value={receipt.receivedOn} type="date" aria-invalid={Boolean(receiptErrors.receivedOn)} onChange={e=>updateReceipt('receivedOn',e.target.value)}/>{error(receiptErrors,'receivedOn')}</label>
      <label>Expiry date<input value={receipt.expiresOn} type="date" aria-invalid={Boolean(receiptErrors.expiresOn)} onChange={e=>updateReceipt('expiresOn',e.target.value)}/>{error(receiptErrors,'expiresOn')}</label>
      <label>Supplier reference (optional)<input value={receipt.supplier} maxLength={120} onChange={e=>updateReceipt('supplier',e.target.value)}/>{error(receiptErrors,'supplier')}</label>
     </div>
     <div className="operator-actions">
      <button type="submit" className="button button-secondary">Validate receipt details</button>
      <button type="button" className="button button-primary" disabled={!STOCK_RECEIPT_WRITER_AVAILABLE}>Receive Stock · unavailable</button>
      <button type="button" className="button button-secondary" disabled>Edit stock · unavailable</button>
     </div>
     {checkedReceipt&&<p role="status" className="operator-summary">{validDraft(receiptErrors)?'Receipt details look valid locally. No quantity or movement was posted.':'Correct the receipt errors. No quantity or movement was posted.'}</p>}
    </form>
    <p className="operator-muted">If a future receipt times out, it must first read back the original idempotency event; blindly retrying would risk double stock. This frontend has no write transport.</p>
   </section>
  </div>
  <p className="operator-muted">Existing stock reads and movement history remain authoritative and separate from these drafts. <Link to="/app/staff-access">View your staff approval status</Link>.</p>
 </>
}
