/**
 * CLOUD / Issue78: strict, presentation-only inventory model.
 * Row data comes exclusively from reviewed RLS table reads or read-only RPCs.
 * Client statuses NEVER decide dispense eligibility; FEFO RPC is authoritative.
 */
export const INVENTORY_LIMITS=Object.freeze({catalog:100,rules:100,alerts:100,batches:100,fefo:100,movements:50})
export const INVENTORY_FILTERS=Object.freeze([
  {id:'all',label:'All medicines'}, {id:'low',label:'Low stock'},
  {id:'out',label:'Out of stock'}, {id:'near',label:'Near expiry'},
  {id:'expired',label:'Expired lots'}, {id:'quarantined',label:'Quarantined / recalled'},
  {id:'unconfigured',label:'Not configured'}
])
export const INVENTORY_SORTS=Object.freeze([
  {id:'name',label:'Medicine name'}, {id:'code',label:'Product code'},
  {id:'available',label:'Available units (high to low)'},
  {id:'alert',label:'Needs attention first'}
])
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE=/^\d{4}-\d{2}-\d{2}$/
const code=/^[A-Z0-9][A-Z0-9._-]{1,39}$/
const dispositions=new Set(['released','quarantined','recalled'])
const movementTypes=new Set(['opening','receipt','dispense','adjustment','quarantine','expiry','transfer_send','transfer_receive'])
const safeText=(s,max)=>typeof s==='string'&&s.length<=max&&s.trim().length>0&&!/[\u0000-\u001f\u007f]/.test(s)
const int=(n,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(n)&&n>=0&&n<=max
const signedInt=n=>Number.isSafeInteger(n)
export function isInventoryId(v){return typeof v==='string'&&UUID.test(v)}
export function isInventoryDate(v){
  if(typeof v!=='string'||!DATE.test(v))return false
  const d=new Date(v+'T00:00:00Z')
  return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v
}
export function branchDay(now,timezone){
  if(!(now instanceof Date)||!Number.isFinite(now.getTime())||!safeText(timezone,90))
    throw Error('Clinic branch date unavailable')
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:timezone,
    year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now)
  const p=Object.fromEntries(parts.map(k=>[k.type,k.value]))
  const d=`${p.year}-${p.month}-${p.day}`
  if(!isInventoryDate(d))throw Error('Clinic branch date unavailable')
  return d
}
export function dayPlus(d,n){
  if(!isInventoryDate(d)||!Number.isInteger(n)||n<0||n>365)throw Error('Invalid warning window')
  const date=new Date(d+'T00:00:00Z')
  date.setUTCDate(date.getUTCDate()+n)
  return date.toISOString().slice(0,10)
}
function requireRows(rows,limit,name){
  if(!Array.isArray(rows)||rows.length>limit+1)throw Error(name+' read response could not be verified')
  return {items:rows.slice(0,limit),hasMore:rows.length>limit}
}
function validCatalog(x){return x&&isInventoryId(x.id)&&safeText(x.generic_name,160)&&
  typeof x.product_code==='string'&&code.test(x.product_code)&&
  safeText(x.formulation,80)&&safeText(x.strength,80)&&safeText(x.stock_unit,30)&&
  int(x.minimum_shelf_life_days,365)&&typeof x.is_active==='boolean'&&
  typeof x.requires_refrigeration==='boolean'&&typeof x.is_controlled==='boolean'}
function validRule(x,b){return x&&x.branch_id===b&&isInventoryId(x.medicine_id)&&
  int(x.reorder_point_units,1000000000)&&[30,60,90].includes(x.expiry_warning_days)}
function validAlert(x){return x&&isInventoryId(x.medicine_id)&&typeof x.product_code==='string'&&
  code.test(x.product_code)&&int(x.available_units)&&int(x.reorder_point_units,1000000000)&&
  [30,60,90].includes(x.expiry_warning_days)&&int(x.near_expiry_batches)&&
  int(x.expired_batches)&&int(x.quarantined_batches)&&typeof x.out_of_stock==='boolean'&&
  typeof x.low_stock==='boolean'&&x.out_of_stock===(x.available_units===0)&&
  x.low_stock===(x.available_units<=x.reorder_point_units)}
function validBatch(x,b,m){return x&&isInventoryId(x.id)&&x.branch_id===b&&x.medicine_id===m&&
  safeText(x.lot_number,80)&&isInventoryDate(x.received_on)&&
  isInventoryDate(x.expiry_date)&&x.expiry_date>=x.received_on&&
  dispositions.has(x.disposition)&&int(x.on_hand_units,1000000000)&&
  int(x.reserved_units,1000000000)&&int(x.quarantined_units,1000000000)&&
  x.reserved_units+x.quarantined_units<=x.on_hand_units}
function validFefo(x){return x&&isInventoryId(x.batch_id)&&safeText(x.lot_number,80)&&
  isInventoryDate(x.expiry_date)&&isInventoryDate(x.received_on)&&
  x.expiry_date>=x.received_on&&int(x.available_units)&&x.available_units>0}
function validMovement(x,b,m){return x&&isInventoryId(x.id)&&x.branch_id===b&&
  x.medicine_id===m&&isInventoryId(x.batch_id)&&isInventoryId(x.event_id)&&
  movementTypes.has(x.event_type)&&signedInt(x.delta_on_hand)&&
  signedInt(x.delta_reserved)&&signedInt(x.delta_quarantined)&&
  int(x.after_on_hand)&&int(x.after_reserved)&&int(x.after_quarantined)&&
  x.after_reserved+x.after_quarantined<=x.after_on_hand&&
  safeText(x.reason_code,40)&&isInventoryId(x.recorded_by)&&
  typeof x.recorded_at==='string'&&Number.isFinite(Date.parse(x.recorded_at))}
export function validateInventoryRows(kind,rows,{branchId,medicineId}={}){
  const cap=INVENTORY_LIMITS[kind]
  if(!cap)throw Error('Unknown inventory read type')
  const out=requireRows(rows,cap,'Inventory '+kind)
  const check={
    catalog:validCatalog,rules:x=>validRule(x,branchId),alerts:validAlert,
    batches:x=>validBatch(x,branchId,medicineId),fefo:validFefo,
    movements:x=>validMovement(x,branchId,medicineId)
  }[kind]
  if(!out.items.every(check))throw Error('Inventory '+kind+' response could not be verified')
  const keys=new Set()
  for(const item of out.items){
    const key=kind==='rules'||kind==='alerts'?item.medicine_id:
      kind==='catalog'?item.id:kind==='fefo'?item.batch_id:item.id
    if(keys.has(key))throw Error('Duplicate inventory '+kind+' identifier')
    keys.add(key)
  }
  if(kind==='fefo'){
    for(let i=1;i<out.items.length;i++){
      const prev=out.items[i-1],next=out.items[i]
      const a=[prev.expiry_date,prev.received_on,prev.lot_number,prev.batch_id].join('\u0000')
      const b=[next.expiry_date,next.received_on,next.lot_number,next.batch_id].join('\u0000')
      if(a.localeCompare(b,'en')>0)throw Error('FEFO server ordering not verified')
    }
  }
  // Whitelist stable non-cost fields only. Never spread unreviewed source objects to UI.
  const permitted={
    catalog:['id','product_code','generic_name','formulation','strength','stock_unit',
      'minimum_shelf_life_days','requires_refrigeration','is_controlled','is_active'],
    rules:['branch_id','medicine_id','reorder_point_units','expiry_warning_days'],
    alerts:['medicine_id','product_code','available_units','reorder_point_units',
      'out_of_stock','low_stock','expiry_warning_days','near_expiry_batches',
      'expired_batches','quarantined_batches'],
    batches:['id','branch_id','medicine_id','lot_number','received_on','expiry_date',
      'disposition','on_hand_units','reserved_units','quarantined_units'],
    fefo:['batch_id','lot_number','expiry_date','available_units','received_on'],
    movements:['id','branch_id','medicine_id','batch_id','event_id','event_type','delta_on_hand',
      'delta_reserved','delta_quarantined','after_on_hand','after_reserved',
      'after_quarantined','reason_code','recorded_by','recorded_at']
  }[kind]
  return {...out,items:out.items.map(x=>Object.fromEntries(permitted.map(k=>[k,x[k]])))}
}
export function medicineCards(snapshot,{search='',filter='all',sort='name'}={}){
  if(!snapshot||!Array.isArray(snapshot.catalog?.items)||!Array.isArray(snapshot.rules?.items)||
    !Array.isArray(snapshot.alerts?.items))return []
  const rules=new Map(snapshot.rules.items.map(x=>[x.medicine_id,x]))
  const alerts=new Map(snapshot.alerts.items.map(x=>[x.medicine_id,x]))
  const query=String(search).trim().toLocaleLowerCase()
  const cards=snapshot.catalog.items.map(m=>({medicine:m,rule:rules.get(m.id)??null,
    alert:alerts.get(m.id)??null}))
  const has=(c)=>{const a=c.alert
    switch(filter){
    case 'low':return Boolean(a?.low_stock&&!a?.out_of_stock)
    case 'out':return Boolean(a?.out_of_stock)
    case 'near':return Boolean(a?.near_expiry_batches)
    case 'expired':return Boolean(a?.expired_batches)
    case 'quarantined':return Boolean(a?.quarantined_batches)
    case 'unconfigured':return !c.rule||!a
    default:return true
    }
  }
  const filtered=cards.filter(c=>has(c)&&[c.medicine.generic_name,c.medicine.product_code,
    c.medicine.formulation,c.medicine.strength].some(v=>v.toLocaleLowerCase().includes(query)))
  const attention=c=>c.alert?(c.alert.out_of_stock?0:c.alert.expired_batches?1:
    c.alert.quarantined_batches?2:c.alert.low_stock?3:c.alert.near_expiry_batches?4:5):6
  return filtered.sort((a,b)=>{
    if(sort==='available')return (b.alert?.available_units??-1)-(a.alert?.available_units??-1)||
      a.medicine.generic_name.localeCompare(b.medicine.generic_name)
    if(sort==='alert')return attention(a)-attention(b)||a.medicine.generic_name.localeCompare(b.medicine.generic_name)
    if(sort==='code')return a.medicine.product_code.localeCompare(b.medicine.product_code)
    return a.medicine.generic_name.localeCompare(b.medicine.generic_name)
  })
}
/** UI date-only grouping. A client clock cannot override the server's FEFO/alert decisions. */
export function batchDisplayState(batch,branchDate,warningDays,serverEligibleIds){
  if(!isInventoryDate(branchDate)||![30,60,90].includes(warningDays))
    return {kind:'unknown',label:'Date unavailable'}
  if(batch.disposition==='recalled')return {kind:'held',label:'Recalled — excluded'}
  if(batch.disposition==='quarantined')return {kind:'held',label:'Quarantined — excluded'}
  if(batch.expiry_date<=branchDate)return {kind:'expired',label:'Expired — excluded'}
  if(serverEligibleIds?.has(batch.id))return {
    kind:batch.expiry_date<=dayPlus(branchDate,warningDays)?'near':'eligible',
    label:batch.expiry_date<=dayPlus(branchDate,warningDays)?'FEFO eligible · approaching expiry':'FEFO eligible'
  }
  if(batch.on_hand_units-batch.reserved_units-batch.quarantined_units===0)
    return {kind:'held',label:'No available units'}
  return {kind:'held',label:'Not FEFO eligible (shelf-life or policy)'}
}
export function inventoryError(error){
  const code=String(error&&typeof error==='object'&&'code' in error?error.code:'')
  const message=String(error&&typeof error==='object'&&'message' in error?error.message:'').toLowerCase()
  if(['42501','401','403','PGRST301'].includes(code)||/staff access is not approved|staff session|required|jwt|permission denied|not authoriz/.test(message))return 'denied'
  if(['42P01','42883','PGRST202'].includes(code)||/does not exist|not installed|not configured/.test(message))return 'unavailable'
  if(/failed to fetch|network|offline|timeout|load failed/.test(message))return 'network'
  return 'error'
}
