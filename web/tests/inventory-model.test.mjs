import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {branchDay,dayPlus,isInventoryDate,INVENTORY_LIMITS,validateInventoryRows,
  medicineCards,batchDisplayState,inventoryError} from '../src/inventory/model.mjs'
const id=n=>'20000000-0000-4000-8000-'+String(n).padStart(12,'0')
const branch=id(1),other=id(2),med=id(3)
const catalog={id:med,product_code:'QA78-A',generic_name:'Synthetic Medicine',formulation:'vial',
  strength:'1 mg',stock_unit:'vial',minimum_shelf_life_days:0,
  requires_refrigeration:false,is_controlled:false,is_active:true}
const rule={branch_id:branch,medicine_id:med,reorder_point_units:10,expiry_warning_days:30}
const alert={medicine_id:med,product_code:'QA78-A',available_units:9,
  reorder_point_units:10,out_of_stock:false,low_stock:true,
  expiry_warning_days:30,near_expiry_batches:1,expired_batches:1,quarantined_batches:1}
const batch={id:id(4),branch_id:branch,medicine_id:med,lot_number:'LOT-N-20',
  received_on:'2026-11-01',expiry_date:'2026-12-10',disposition:'released',
  on_hand_units:10,reserved_units:1,quarantined_units:0}
const fefo={batch_id:batch.id,lot_number:batch.lot_number,
  received_on:batch.received_on,expiry_date:batch.expiry_date,available_units:9}
const movement={id:id(5),branch_id:branch,medicine_id:med,batch_id:batch.id,event_id:id(6),
  event_type:'receipt',delta_on_hand:10,delta_reserved:0,delta_quarantined:0,
  after_on_hand:10,after_reserved:0,after_quarantined:0,reason_code:'opening',
  recorded_by:id(7),recorded_at:'2026-11-20T04:00:00Z'}
const scope={branchId:branch,medicineId:med}
const out=(kind,rows)=>validateInventoryRows(kind,rows,
  kind==='rules'?{branchId:branch}:kind==='batches'||kind==='movements'?scope:undefined)

test('CLOUD inventory: date boundaries use a valid branch-local ISO day',()=>{
  assert.equal(branchDay(new Date('2026-11-19T16:05:00Z'),'Asia/Manila'),'2026-11-20')
  assert.equal(branchDay(new Date('2026-11-19T15:59:00Z'),'Asia/Manila'),'2026-11-19')
  assert.equal(dayPlus('2026-11-20',30),'2026-12-20')
  assert.equal(dayPlus('2026-11-20',60),'2027-01-19')
  assert.equal(dayPlus('2026-11-20',90),'2027-02-18')
  assert.equal(isInventoryDate('2026-02-29'),false)
  assert.equal(isInventoryDate('2024-02-29'),true)
})
test('CLOUD inventory: FEFO eligibility comes only from reviewed server candidate IDs',()=>{
  const inServer=new Set([batch.id])
  assert.equal(batchDisplayState(batch,'2026-11-20',30,inServer).kind,'near')
  assert.equal(batchDisplayState({...batch,expiry_date:'2026-12-21'},'2026-11-20',30,inServer).kind,'eligible')
  assert.equal(batchDisplayState({...batch,expiry_date:'2026-11-20'},'2026-11-20',90,inServer).kind,'expired')
  assert.equal(batchDisplayState({...batch,expiry_date:'2026-11-19'},'2026-11-20',30,inServer).kind,'expired')
  assert.equal(batchDisplayState({...batch,disposition:'recalled'},'2026-11-20',30,inServer).kind,'held')
  assert.equal(batchDisplayState({...batch,disposition:'quarantined'},'2026-11-20',30,inServer).kind,'held')
  assert.equal(batchDisplayState(batch,'2026-11-20',30,new Set()).kind,'held')
  const plus30={...batch,expiry_date:'2026-12-20'}
  const plus60={...batch,expiry_date:'2027-01-19'}
  const plus90={...batch,expiry_date:'2027-02-18'}
  assert.equal(batchDisplayState(plus30,'2026-11-20',30,inServer).kind,'near')
  assert.equal(batchDisplayState(plus60,'2026-11-20',60,inServer).kind,'near')
  assert.equal(batchDisplayState(plus90,'2026-11-20',90,inServer).kind,'near')
})
test('CLOUD inventory: all authorized payloads are strictly checked and cost fields stripped',()=>{
  for(const [kind,row] of Object.entries({catalog, rules:rule,alerts:alert,batches:batch,
    fefo,movements:movement})){
    const data=out(kind==='rules'?'rules':kind,[{...row,unit_cost_minor:99999,currency_code:'PHP'}])
    assert.equal(data.items.length,1)
    assert.equal('unit_cost_minor' in data.items[0],false)
    assert.equal('currency_code' in data.items[0],false)
  }
})
test('CLOUD inventory: malformed or cross-branch lots and ledger denied, never silently hidden',()=>{
  assert.throws(()=>out('batches',[{...batch,branch_id:other}]),/could not be verified/)
  assert.throws(()=>out('movements',[{...movement,branch_id:other}]),/could not be verified/)
  assert.throws(()=>out('batches',[{...batch,reserved_units:20}]),/could not be verified/)
  assert.throws(()=>out('batches',[{...batch,expiry_date:'2026-10-01'}]),/could not be verified/)
  assert.throws(()=>out('alerts',[{...alert,out_of_stock:true}]),/could not be verified/)
  assert.throws(()=>out('fefo',[{...fefo,available_units:0}]),/could not be verified/)
  assert.throws(()=>out('fefo',[{...fefo,lot_number:'bad\u0000lot'}]),/could not be verified/)
  assert.throws(()=>out('catalog',[{...catalog,product_code:'BAD HTML<'}]),/could not be verified/)
})
test('CLOUD inventory: FEFO must remain in server expiry/receipt/lot/id order',()=>{
  const early={...fefo,batch_id:id(8),lot_number:'A',expiry_date:'2026-12-01'}
  assert.deepEqual(out('fefo',[early,fefo]).items.map(x=>x.batch_id),[id(8),batch.id])
  assert.throws(()=>out('fefo',[fefo,early]),/FEFO server ordering/)
  assert.throws(()=>out('fefo',[early,early]),/Duplicate/)
})
test('CLOUD inventory: bounded pages carry honest incomplete marker',()=>{
  const extras=Array.from({length:INVENTORY_LIMITS.catalog+1},(_,i)=>({...catalog,
    id:'20000000-0000-4000-8000-'+String(i+10).padStart(12,'0'),product_code:'QA'+i}))
  const data=out('catalog',extras)
  assert.equal(data.hasMore,true)
  assert.equal(data.items.length,INVENTORY_LIMITS.catalog)
  assert.throws(()=>out('catalog',extras.concat(catalog)),/could not be verified/)
})
test('CLOUD inventory: nonconfigured medication is not automatically out of stock',()=>{
  const snapshot={catalog:{items:[catalog],hasMore:false},rules:{items:[],hasMore:false},
    alerts:{items:[],hasMore:false},today:'2026-11-20',timezone:'Asia/Manila'}
  const card=medicineCards(snapshot)[0]
  assert.equal(card.rule,null)
  assert.equal(card.alert,null)
  assert.equal(medicineCards(snapshot,{filter:'out'}).length,0)
  assert.equal(medicineCards(snapshot,{filter:'unconfigured'}).length,1)
})
test('CLOUD inventory: low vs out, near vs expired and search are distinct',()=>{
  const snapshot={catalog:{items:[catalog],hasMore:false},rules:{items:[rule],hasMore:false},
    alerts:{items:[alert],hasMore:false},today:'2026-11-20',timezone:'Asia/Manila'}
  assert.equal(medicineCards(snapshot,{filter:'low'}).length,1)
  assert.equal(medicineCards(snapshot,{filter:'out'}).length,0)
  assert.equal(medicineCards(snapshot,{filter:'near'}).length,1)
  assert.equal(medicineCards(snapshot,{filter:'expired'}).length,1)
  assert.equal(medicineCards(snapshot,{search:'unrelated'}).length,0)
  assert.equal(medicineCards(snapshot,{search:'qa78'}).length,1)
  const zero={...alert,available_units:0,out_of_stock:true,low_stock:true}
  const changed={...snapshot,alerts:{items:[zero],hasMore:false}}
  assert.equal(medicineCards(changed,{filter:'low'}).length,0)
  assert.equal(medicineCards(changed,{filter:'out'}).length,1)
})
test('CLOUD inventory: denial, missing migration, network failure are not empty stock',()=>{
  assert.equal(inventoryError({code:'42501'}),'denied')
  assert.equal(inventoryError({code:'42P01'}),'unavailable')
  assert.equal(inventoryError({code:'PGRST202'}),'unavailable')
  assert.equal(inventoryError(Error('Failed to fetch')),'network')
  assert.equal(inventoryError(Error('Malformed inventory response')),'error')
})
test('CLOUD inventory: frontend port is read-only, exactly allowlisted cost-free SELECT columns',async()=>{
  const source=await readFile(new URL('../src/inventory/port.ts',import.meta.url),'utf8')
  const page=await readFile(new URL('../src/pages/staff/PharmacyPage.tsx',import.meta.url),'utf8')
  const route=await readFile(new URL('../src/App.tsx',import.meta.url),'utf8')
  assert.match(source,/assertStaffBranch\(user,branchId\)/)
  assert.match(source,/verifiedStaffSession/)
  assert.match(source,/list_branch_medicine_fefo/)
  assert.match(source,/list_branch_medicine_alerts/)
  assert.match(source,/\.eq\('branch_id',branchId\)/)
  assert.doesNotMatch(source,/unit_cost_minor|currency_code|\.insert\(|\.update\(|\.upsert\(|\.delete\(/)
  assert.match(page,/disabled\s+aria-describedby="pharmacy-transaction-help"/)
  assert.match(route,/VITE_PHASE5B_PHARMACY_UI === 'true'/)
})
