import {useEffect,useMemo,useRef,useState} from 'react'
import type {User} from '@supabase/supabase-js'
import {Link} from 'react-router'
import type {OpsBranch} from '../../ops/branch-model.mjs'
import {createPharmacyPort} from '../../inventory/port'
import {validateNewItem,validateReceipt,validDraft,PRODUCT_TYPES} from '../../inventory/operator-validation.mjs'
import type {ItemType,NewItemDraft,ReceiptDraft} from '../../inventory/operator-validation.mjs'
import type {Snapshot,Catalog} from '../../inventory/model.mjs'
import {verifiedStaffNavigationBranches} from '../../release/verified-staff-branches'
import {operationalError} from '../../operational/model.mjs'
import {createOperationalPort,operationalFlags} from '../../operational/port'
import type {ItemArgs,ReceiptArgs,EditArgs,Balance} from '../../operational/contract'
import {LoadingCard} from '../../components/ui'

const emptyItem:NewItemDraft={type:'medicine',code:'',name:'',unit:'',formulation:'',strength:'',reorder:'',supplier:''}
const emptyReceipt:ReceiptDraft={branchId:'',code:'',lot:'',quantity:'',receivedOn:'',expiresOn:'',supplier:''}
type CatalogState={kind:'off'}|{kind:'loading'}|{kind:'failed';message:string}|{kind:'ready';data:Snapshot}
type BalanceState={kind:'none'}|{kind:'loading'}|{kind:'failed';message:string}|{kind:'ready';balance:Balance}
const labels=(x:Catalog)=>x.product_code+' · '+x.generic_name
const err=(errors:Readonly<Record<string,string>>,field:string)=>errors[field]?
  <span role="alert" className="operator-inline-error">{errors[field]}</span>:null

/** Source-only #126 transport. The RPC write flags are OFF by default. */
export function InventoryOperatorForms({user,branch,onDenied}:{user:User;branch:OpsBranch;onDenied:()=>void}){
 const write=operationalFlags.inventory
 const port=useMemo(()=>createOperationalPort(user),[user.id])
 const pharmacy=useMemo(()=>createPharmacyPort(user),[user.id])
 const [item,setItem]=useState<NewItemDraft>({...emptyItem})
 const [description,setDescription]=useState('')
 const [receipt,setReceipt]=useState<ReceiptDraft>({...emptyReceipt,branchId:branch.id})
 const [checkedItem,setCheckedItem]=useState(false)
 const [checkedReceipt,setCheckedReceipt]=useState(false)
 const [controlled,setControlled]=useState(false)
 const [cold,setCold]=useState(false)
 const [catAttempt,setCatAttempt]=useState(0)
 const [catalog,setCatalog]=useState<CatalogState>(write?{kind:'loading'}:{kind:'off'})
 const [search,setSearch]=useState('')
 const [balance,setBalance]=useState<BalanceState>({kind:'none'})
 const [balanceAttempt,setBalanceAttempt]=useState(0)
 const [selectedId,setSelectedId]=useState('')
 const [created,setCreated]=useState('')
 const [receiptNotice,setReceiptNotice]=useState('')
 const [editNotice,setEditNotice]=useState('')
 const [editReady,setEditReady]=useState(false)
 const [profileState,setProfileState]=useState<'none'|'loading'|'failed'|'ready'>('none')
 const [busy,setBusy]=useState<'create'|'receive'|'edit'|null>(null)
 const [itemTicket,setItemTicket]=useState<ItemArgs|null>(null)
 const [receiptTicket,setReceiptTicket]=useState<ReceiptArgs|null>(null)
 const [editName,setEditName]=useState('')
 const [editDescription,setEditDescription]=useState('')
 const [editReorder,setEditReorder]=useState('0')
 const [editWarning,setEditWarning]=useState<30|60|90>(30)
 const live=useRef(true)
 useEffect(()=>()=>{live.current=false},[])
 const guard=async()=>{
  const branches=await verifiedStaffNavigationBranches(user)
  if(!branches.some(b=>b.id===branch.id&&b.role===branch.role&&
    (b.role==='receptionist'||b.role==='administrator')))
   throw Object.assign(Error('Current inventory role no longer valid'),{code:'42501'})
 }
 useEffect(()=>{
  let active=true
  if(!write){setCatalog({kind:'off'});return ()=>{active=false}}
  setCatalog({kind:'loading'})
  void (async()=>{
   try{
    await guard()
    const data=await pharmacy.overview(branch.id)
    if(active)setCatalog({kind:'ready',data})
   }catch(error){
    if(!active)return
    const info=operationalError(error)
    setCatalog({kind:'failed',message:info.text})
    if(info.kind==='denied')onDenied()
   }
  })()
  return()=>{active=false}
 },[user.id,branch.id,catAttempt,write,pharmacy])
 const items=useMemo(()=>{
  if(catalog.kind!=='ready')return []
  const rules=new Set(catalog.data.rules.items.map(x=>x.medicine_id))
  const q=search.trim().toLowerCase()
  return catalog.data.catalog.items.filter(x=>rules.has(x.id)&&x.is_active&&
    [x.generic_name,x.product_code,x.formulation].some(v=>v.toLowerCase().includes(q)))
 },[catalog,search])
 const selected=items.find(x=>x.id===selectedId)||null
 useEffect(()=>{
  let active=true
  setBalance({kind:selectedId?'loading':'none'})
  if(!write||!selectedId)return ()=>{active=false}
  void (async()=>{
   try{
    await guard()
    const value=await port.balance(branch.id,selectedId,selected?.product_code)
    await guard()
    if(active)setBalance({kind:'ready',balance:value})
   }catch(error){
    if(!active)return
    const info=operationalError(error)
    setBalance({kind:'failed',message:info.text})
    if(info.kind==='denied')onDenied()
   }
  })()
  return()=>{active=false}
 },[branch.id,selectedId,balanceAttempt,write,port,selected?.product_code])
 const profileRevision=balance.kind==='ready'?balance.balance.revision:null
 useEffect(()=>{
  let active=true
  setEditReady(false);setProfileState('none')
  if(!selected||profileRevision===null||!write)return ()=>{active=false}
  setProfileState('loading')
  void (async()=>{
   try{
    const profile=await port.profile(branch.id,selected.id)
    if(profile.revision!==profileRevision)throw Error('Inventory profile revision differs from server balance')
    if(!active)return
    setEditName(profile.name??selected.generic_name)
    setEditDescription(profile.description)
    setEditReorder(String(profile.reorderPointUnits))
    setEditWarning(profile.expiryWarningDays)
    setEditReady(true);setProfileState('ready')
   }catch(error){
    if(active){setProfileState('failed');setEditNotice(operationalError(error).text)}
   }
  })()
  return()=>{active=false}
 },[selected?.id,profileRevision,port,branch.id,write])
 useEffect(()=>{
  if(selected&&balance.kind==='ready')
   setReceipt(r=>({...r,code:selected.product_code,branchId:branch.id,
    receivedOn:catalog.kind==='ready'?catalog.data.today:r.receivedOn}))
 },[selected?.id,profileRevision])
 const itemErrors:Readonly<Record<string,string>>=checkedItem?validateNewItem(item):{}
 const branchToday=catalog.kind==='ready'?catalog.data.today:new Date().toISOString().slice(0,10)
 const receiptErrors:Readonly<Record<string,string>>=checkedReceipt?validateReceipt(receipt,branchToday):{}
 const updateItem=<K extends keyof NewItemDraft>(k:K,value:NewItemDraft[K])=>{
  setItem(old=>({...old,[k]:value}));setCheckedItem(false)
 }
 const updateReceipt=<K extends keyof ReceiptDraft>(k:K,value:ReceiptDraft[K])=>{
  setReceipt(old=>({...old,[k]:value}));setCheckedReceipt(false)
 }
 function choose(value:string){
  setSelectedId(value);setBalance({kind:value?'loading':'none'})
  setReceipt(r=>({...r,code:items.find(x=>x.id===value)?.product_code??''}))
  setReceiptNotice('');setEditNotice('')
 }
 async function create(){
  setCheckedItem(true);setCreated('')
  if(busy||!write||catalog.kind!=='ready'||itemTicket===null&&
    (!validDraft(validateNewItem(item))||controlled||cold||
     description.length>2000||item.supplier.trim().length===1))return
  const ticket:ItemArgs=itemTicket??{
   p_branch:branch.id,p_request_id:crypto.randomUUID(),p_product_code:item.code,
   p_name:item.name.trim(),p_description:description,p_category:item.type,
   p_unit:item.unit,p_formulation:item.type==='medicine'?item.formulation.trim():null,
   p_strength:item.type==='medicine'?item.strength.trim():null,
   p_reorder_point:Number(item.reorder||0),p_lot:null,p_expiry:null,
   p_supplier:item.supplier.trim()||null,p_opening_units:0
  }
  setBusy('create');setItemTicket(ticket)
  try{
   await guard()
   const ack=await port.create(ticket)
   await guard()
   const [confirmed,snapshot]=await Promise.all([
    port.balance(branch.id,ack.itemId,ack.productCode),
    pharmacy.overview(branch.id)
   ])
   if(confirmed.onHandUnits!==ack.onHandUnits||
      !snapshot.catalog.items.some(x=>x.id===ack.itemId&&x.product_code===ack.productCode)||
      !snapshot.rules.items.some(x=>x.medicine_id===ack.itemId))
    throw Error('Created item is not confirmed by scoped catalog and balance readback')
   await guard()
   if(!live.current)return
   setItemTicket(null)
   setCatalog({kind:'ready',data:snapshot})
   setSelectedId(ack.itemId)
   setReceipt(r=>({...r,code:ack.productCode,receivedOn:snapshot.today}))
   setCreated('Item saved and confirmed on server: '+ack.productCode+' · on hand '+confirmed.onHandUnits)
  }catch(error){
   if(!live.current)return
   const info=operationalError(error)
   setCreated(info.text)
   // Ticket persists after lost ACK, bad readback or unknown server outcome.
   if(['denied','invalid','conflict','stale'].includes(info.kind))setItemTicket(null)
   if(info.kind==='denied')onDenied()
  }finally{if(live.current)setBusy(null)}
 }
 async function receive(){
  setCheckedReceipt(true);setReceiptNotice('')
  if(busy||!write||catalog.kind!=='ready'||
    (receiptTicket===null&&(!validDraft(validateReceipt(receipt,branchToday))||!selected||
      receipt.code!==selected.product_code)))return
  const ticket:ReceiptArgs=receiptTicket??{
   p_branch:branch.id,p_medicine:selected!.id,p_request_id:crypto.randomUUID(),
   p_lot:receipt.lot.trim(),p_expiry:receipt.expiresOn,
   p_supplier:receipt.supplier.trim()||null,p_quantity:Number(receipt.quantity)
  }
  setBusy('receive');setReceiptTicket(ticket)
  try{
   await guard()
   const ack=await port.receive(ticket)
   const [confirmed,verifiedMovement,snapshot]=await Promise.all([
    port.balance(branch.id,ticket.p_medicine),
    port.movement(branch.id,ticket.p_medicine,ack.eventId,ack.batchId,ack.receivedUnits,ack.lotOnHandUnits),
    pharmacy.overview(branch.id)
   ])
   if(!verifiedMovement||confirmed.onHandUnits<ack.lotOnHandUnits)
    throw Error('Receipt event or balance was not confirmed by the server')
   await guard()
   if(!live.current)return
   setReceiptTicket(null)
   setBalance({kind:'ready',balance:confirmed})
   setCatalog({kind:'ready',data:snapshot})
   setReceiptNotice('Received '+ack.receivedUnits+' units — server-confirmed stock event '+
     ack.eventId.slice(0,8)+'…; on hand '+confirmed.onHandUnits+'.')
  }catch(error){
   if(!live.current)return
   const info=operationalError(error)
   setReceiptNotice(info.text)
   if(['denied','invalid','conflict','stale'].includes(info.kind))setReceiptTicket(null)
   if(info.kind==='denied')onDenied()
  }finally{if(live.current)setBusy(null)}
 }
 async function edit(){
  if(!write||busy||!selected||balance.kind!=='ready'||!editReady||!editName.trim()||
     editName.trim().length<2||editName.length>160||editDescription.length>2000||
     !/^(0|[1-9][0-9]*)$/.test(editReorder)||Number(editReorder)>1000000000)return
  const args:EditArgs={p_branch:branch.id,p_medicine:selected.id,
   p_expected_revision:balance.balance.revision,
   p_name:editName.trim(),p_description:editDescription,
   p_reorder_point:Number(editReorder),p_expiry_warning_days:editWarning}
  setBusy('edit');setEditNotice('')
  try{
   await guard()
   const ack=await port.edit(args)
   const [confirmed,snapshot,profile]=await Promise.all([
    port.balance(branch.id,selected.id,selected.product_code),pharmacy.overview(branch.id),
    port.profile(branch.id,selected.id)
   ])
   // CAS edit is NOT nonce-idempotent. After a timeout, do not blind retry:
   // re-read and compare the intended server revision + resulting branch rule.
   if(confirmed.revision!==ack.revision||ack.revision!==args.p_expected_revision+1||
     ack.name!==args.p_name||ack.description!==args.p_description||
     ack.reorderPointUnits!==args.p_reorder_point||ack.expiryWarningDays!==args.p_expiry_warning_days||
     profile.revision!==ack.revision||profile.name!==ack.name||profile.description!==ack.description||
     profile.reorderPointUnits!==ack.reorderPointUnits||profile.expiryWarningDays!==ack.expiryWarningDays||
     !snapshot.rules.items.some(x=>x.medicine_id===selected.id&&
       x.reorder_point_units===ack.reorderPointUnits&&x.expiry_warning_days===ack.expiryWarningDays))
    throw Error('Edited profile not verified by fresh branch rule')
   await guard()
   if(!live.current)return
   setCatalog({kind:'ready',data:snapshot})
   setBalance({kind:'ready',balance:confirmed})
   setEditNotice('Item change confirmed at server revision '+ack.revision+'.')
  }catch(error){
   if(!live.current)return
   setEditNotice(operationalError(error).text+
     ' Refresh item before making another edit; this CAS request has no retry nonce.')
   if(operationalError(error).kind==='denied')onDenied()
  }finally{if(live.current)setBusy(null)}
 }
 return <>
  <div className="operator-state-grid">
   <div className="card"><h2>Authorized branch</h2><p>{branch.name} · {branch.role}</p></div>
   <div className="card"><h2>Product entry</h2><p>{write?'Saved only after catalog and balance readback.':'Local form validation available. Saving is disabled until audited API rollout.'}</p></div>
   <div className="card"><h2>Stock movements</h2><p>{write?'Exact receipt event and server balance are required to confirm receiving.':'Receiving remains unavailable without the approved ledger.'}</p></div>
  </div>
  {write&&<section className="card operator-section" aria-label="Live branch inventory catalog">
   <div className="operator-headline"><h2>Branch items and balances</h2>
    <button className="button button-secondary" type="button" disabled={!!busy} onClick={()=>{setSelectedId('');setBalance({kind:'none'});setCatAttempt(n=>n+1)}}>Refresh inventory</button></div>
   {catalog.kind==='loading'&&<LoadingCard label="Reading authorized branch catalog and stock status…" rows={3}/>}
   {catalog.kind==='failed'&&<p role="alert">{catalog.message} No item records shown. Retry the authorized inventory read.</p>}
   {catalog.kind==='ready'&&<>
    <label>Search inventory<input value={search} type="search" onChange={e=>setSearch(e.target.value)}
      placeholder="Code, name, formulation" autoComplete="off"/></label>
    <p role="status">{items.length} branch-configured items in validated results. {catalog.data.catalog.hasMore||catalog.data.rules.hasMore?
      'Catalog or rule reader is truncated; unreturned items may be missing.':''}</p>
    <label>Select an existing branch item<select value={selected?.id??''} disabled={!!busy||!!itemTicket||!!receiptTicket}
       onChange={e=>choose(e.target.value)}>
     <option value="">Choose an item</option>
     {items.map(x=><option value={x.id} key={x.id}>{labels(x)}</option>)}
    </select></label>
    {selected&&<p className="operator-muted">Server item UUID: <code>{selected.id}</code></p>}
    {balance.kind==='loading'&&<p role="status">Reading authoritative branch balance…</p>}
    {balance.kind==='failed'&&<p role="alert">{balance.message}</p>}
    {balance.kind==='ready'&&<div className="operator-balances" aria-label="Server-confirmed quantity">
     <div><strong>{balance.balance.onHandUnits}</strong><span>On hand</span></div>
     <div><strong>{balance.balance.availableUnits}</strong><span>Available</span></div>
     <div><strong>{balance.balance.reservedUnits}</strong><span>Reserved</span></div>
     <div><strong>{balance.balance.quarantinedUnits}</strong><span>Quarantined</span></div>
     <div><strong>{balance.balance.revision}</strong><span>Profile revision</span></div>
    </div>}
   </>}
  </section>}
  <div className="operator-form-grid operator-two-column">
   <section className="card operator-section" aria-labelledby="add-item-heading">
    <h2 id="add-item-heading">Add Item</h2>
    <p className="operator-muted operator-subtitle">{write?'Create a server-stored item with zero opening stock; receive quantity separately.':'Build a local item draft. No medicine, consumable or supply is stored here.'}</p>
    <form noValidate onSubmit={e=>{e.preventDefault();if(write)void create();else setCheckedItem(true)}}>
     <div className="operator-form-grid">
      <label>Product type<select disabled={!!itemTicket||!!busy} value={item.type} onChange={e=>updateItem('type',e.target.value as ItemType)}>
       {PRODUCT_TYPES.map(x=><option key={x} value={x}>{x.charAt(0).toUpperCase()+x.slice(1)}</option>)}
      </select>{err(itemErrors,'type')}</label>
      <label>Item code<input disabled={!!itemTicket||!!busy} value={item.code} maxLength={40} aria-invalid={Boolean(itemErrors.code)}
       onChange={e=>updateItem('code',e.target.value.toUpperCase())} placeholder="MED-001"/>{err(itemErrors,'code')}</label>
      <label>Description / item name<input disabled={!!itemTicket||!!busy} value={item.name} maxLength={160} aria-invalid={Boolean(itemErrors.name)}
       onChange={e=>updateItem('name',e.target.value)} placeholder="Item name"/>{err(itemErrors,'name')}</label>
      <label>Stock unit<input disabled={!!itemTicket||!!busy} value={item.unit} maxLength={30} aria-invalid={Boolean(itemErrors.unit)}
       onChange={e=>updateItem('unit',e.target.value)} placeholder="each"/>{err(itemErrors,'unit')}</label>
      {item.type==='medicine'&&<>
       <label>Formulation<input disabled={!!itemTicket||!!busy} value={item.formulation} maxLength={80} aria-invalid={Boolean(itemErrors.formulation)}
        onChange={e=>updateItem('formulation',e.target.value)} placeholder="tablet, vial, solution"/>{err(itemErrors,'formulation')}</label>
       <label>Strength<input disabled={!!itemTicket||!!busy} value={item.strength} maxLength={80} aria-invalid={Boolean(itemErrors.strength)}
        onChange={e=>updateItem('strength',e.target.value)} placeholder="5 mg"/>{err(itemErrors,'strength')}</label>
      </>}
      <label>Reorder point (whole units)<input disabled={!!itemTicket||!!busy} inputMode="numeric" value={item.reorder}
       aria-invalid={Boolean(itemErrors.reorder)} onChange={e=>updateItem('reorder',e.target.value)} placeholder="10"/>{err(itemErrors,'reorder')}</label>
      <label>Supplier reference (optional)<input disabled={!!itemTicket||!!busy} maxLength={120} value={item.supplier}
       onChange={e=>updateItem('supplier',e.target.value)}/>{err(itemErrors,'supplier')}</label>
      {write&&<label className="operator-wide">Additional item description<textarea value={description} maxLength={2000} rows={2}
       disabled={!!itemTicket||!!busy} onChange={e=>setDescription(e.target.value)}/></label>}
     </div>
     {item.type==='medicine'&&<div className="operator-actions">
      <label><input type="checkbox" disabled={!!itemTicket||!!busy} checked={controlled} onChange={e=>setControlled(e.target.checked)}/> Controlled medicine</label>
      <label><input type="checkbox" disabled={!!itemTicket||!!busy} checked={cold} onChange={e=>setCold(e.target.checked)}/> Requires refrigeration</label>
     </div>}
     {controlled&&<p role="alert">Controlled medicine: no item activation until separate clinic policy and approved backend authorization.</p>}
     {cold&&write&&<p role="alert">This RPC cannot persist refrigeration requirements. Clear this classification; do not save inaccurate stock policy.</p>}
     {write&&item.supplier.trim().length===1&&<p role="alert">Supplier references must contain at least two characters.</p>}
     <div className="operator-actions">
      <button type="submit" className="button button-secondary" disabled={!!busy||!!itemTicket}>
       {write?'Create validated item':'Validate item details'}</button>
      {!write&&<button type="button" className="button button-primary" disabled>Add Item · unavailable</button>}
      {write&&itemTicket&&<button type="button" className="button button-secondary" disabled={!!busy} onClick={()=>void create()}>
       Retry original Add Item ID</button>}
     </div>
     {write&&<p className="operator-muted">Add Item commits with zero opening units. Stock is only increased through the separately audited Receive Stock RPC.</p>}
     {!write&&checkedItem&&<p role="status" className="operator-summary">{validDraft(itemErrors)?'Item fields look valid locally. Nothing has been saved.':'Correct the highlighted item fields. Nothing has been saved.'}</p>}
     {created&&<p role={itemTicket?'alert':'status'} className="operator-summary">{created}</p>}
    </form>
   </section>
   <section className="card operator-section" aria-labelledby="receive-heading">
    <h2 id="receive-heading">Receive Stock</h2>
    <p className="operator-muted operator-subtitle">Receipt quantity must post one immutable stock event and survive a server readback. A typed existing item UUID is mandatory.</p>
    <form noValidate onSubmit={e=>{e.preventDefault();if(write)void receive();else setCheckedReceipt(true)}}>
     <div className="operator-form-grid">
      <label>Clinic branch<input value={branch.name} disabled readOnly/><span className="operator-muted">Selected from approved membership</span></label>
      <label>Existing item code{write?<select value={receipt.code} disabled={!!busy||!!receiptTicket}
        onChange={e=>{const code=e.target.value;updateReceipt('code',code);choose(items.find(x=>x.product_code===code)?.id??'')}}>
       <option value="">Select an authorized item</option>{items.map(x=><option key={x.id} value={x.product_code}>{labels(x)}</option>)}
       </select>:
       <input value={receipt.code} maxLength={40} aria-invalid={Boolean(receiptErrors.code)}
         onChange={e=>updateReceipt('code',e.target.value.toUpperCase())} placeholder="MED-001"/>}{err(receiptErrors,'code')}</label>
      <label>Batch / lot number<input disabled={!!busy||!!receiptTicket} value={receipt.lot} maxLength={80} aria-invalid={Boolean(receiptErrors.lot)}
       onChange={e=>updateReceipt('lot',e.target.value)}/>{err(receiptErrors,'lot')}</label>
      <label>Quantity (whole stock units)<input disabled={!!busy||!!receiptTicket} value={receipt.quantity} inputMode="numeric"
       aria-invalid={Boolean(receiptErrors.quantity)} onChange={e=>updateReceipt('quantity',e.target.value)} placeholder="10"/>{err(receiptErrors,'quantity')}</label>
      <label>Received date<input value={write?branchToday:receipt.receivedOn} type="date" disabled={write||!!busy||!!receiptTicket}
       readOnly={write} aria-invalid={Boolean(receiptErrors.receivedOn)}
       onChange={e=>updateReceipt('receivedOn',e.target.value)}/>{err(receiptErrors,'receivedOn')}</label>
      <label>Expiry date<input disabled={!!busy||!!receiptTicket} value={receipt.expiresOn} type="date" aria-invalid={Boolean(receiptErrors.expiresOn)}
       onChange={e=>updateReceipt('expiresOn',e.target.value)}/>{err(receiptErrors,'expiresOn')}</label>
      <label>Supplier reference (optional)<input disabled={!!busy||!!receiptTicket} value={receipt.supplier} maxLength={120}
       onChange={e=>updateReceipt('supplier',e.target.value)}/>{err(receiptErrors,'supplier')}</label>
     </div>
     {write&&<p className="operator-muted">Received date is the branch-local server day, not an editable historical date. Expired batches are rejected server-side.</p>}
     <div className="operator-actions">
      <button type="submit" className="button button-secondary" disabled={!!busy||!!receiptTicket}>
       {write?'Receive Stock':'Validate receipt details'}</button>
      {!write&&<><button type="button" className="button button-primary" disabled>Receive Stock · unavailable</button>
       <button type="button" className="button button-secondary" disabled>Edit stock · unavailable</button></>}
      {write&&receiptTicket&&<button type="button" className="button button-secondary" disabled={!!busy} onClick={()=>void receive()}>
       Retry original receipt ID</button>}
     </div>
     {!write&&checkedReceipt&&<p role="status" className="operator-summary">{validDraft(receiptErrors)?'Receipt details look valid locally. No quantity or movement was posted.':'Correct the receipt errors. No quantity or movement was posted.'}</p>}
     {receiptNotice&&<p role={receiptTicket?'alert':'status'} className="operator-summary">{receiptNotice}</p>}
    </form>
    <p className="operator-muted">A lost acknowledgement retains the same UUID and exact request fields. Never generate another receipt ID until the original movement is reconciled.</p>
   </section>
  </div>
  {write&&selected&&balance.kind==='ready'&&!editReady&&<p role="status">{profileState==='failed'?'Item editing unavailable until the branch profile can be verified.':'Checking branch item edit revision and current fields…'}</p>}
  {write&&selected&&balance.kind==='ready'&&editReady&&<section className="card operator-section" aria-labelledby="edit-heading">
   <h2 id="edit-heading">Edit branch item profile</h2>
   <p className="operator-muted">Editable: branch-local display, description, reorder point and warning days. Item code, unit, category and ledger are immutable here.</p>
   <div className="operator-form-grid">
    <label>Branch display name<input value={editName} maxLength={160} disabled={!!busy} onChange={e=>setEditName(e.target.value)}/></label>
    <label>Reorder point<input value={editReorder} inputMode="numeric" disabled={!!busy} onChange={e=>setEditReorder(e.target.value)}/></label>
    <label>Expiry warning days<select value={editWarning} disabled={!!busy} onChange={e=>setEditWarning(Number(e.target.value) as 30|60|90)}>
     <option value="30">30</option><option value="60">60</option><option value="90">90</option></select></label>
    <label>Branch description<textarea value={editDescription} maxLength={2000} rows={2} disabled={!!busy} onChange={e=>setEditDescription(e.target.value)}/></label>
   </div>
   <div className="operator-actions"><button type="button" className="button button-secondary" disabled={!!busy}
      onClick={()=>void edit()}>Save branch item edit</button>
    <button type="button" className="button button-quiet" onClick={()=>setBalanceAttempt(n=>n+1)} disabled={!!busy}>Refresh revision</button></div>
   {editNotice&&<p role="status" className="operator-summary">{editNotice}</p>}
  </section>}
  <p className="operator-muted">Existing stock readers, not local drafts, are authoritative. <Link to="/app/staff-access">View staff approval status</Link>.</p>
 </>
}
