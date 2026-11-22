/** Same integrated RC0 tree: runtime RPC, TS canonical aliases, actual SQL
 * function names and safe disabled-by-default behavior. No hosted calls. */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {RPC,verifyOperationalReply} from '../src/operational/model.mjs'
const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const backend=file('src/lib/operational-rpcs.ts')
const cloudTypes=file('src/operational/contract.ts')
const cloudPort=file('src/operational/port.ts')
const staffSql=readFileSync(new URL('../../supabase/migrations/20261121201000_staff_self_service_approval_accountant.sql',import.meta.url),'utf8')
const stockSql=readFileSync(new URL('../../supabase/migrations/20261121202000_inventory_transactional_branch_ops.sql',import.meta.url),'utf8')
const sessionSql=readFileSync(new URL('../../supabase/migrations/20261122120000_operational_live_session_read_guard.sql',import.meta.url),'utf8')
const uuid='11111111-1111-4111-8111-111111111111'
const branch='22222222-2222-4222-8222-222222222222'
const item='33333333-3333-4333-8333-333333333333'
test('RC0 all eight typed RPC names are identical in backend, CLOUD and PostgreSQL',()=>{
 const names=['request_staff_access','get_my_staff_access','list_staff_access_requests',
 'review_staff_access','create_branch_inventory_item','receive_branch_inventory_stock',
 'edit_branch_inventory_item','get_branch_inventory_balance']
 assert.deepEqual(Object.values(RPC).sort(),names.sort())
 for(const rpc of names){
  assert.ok(backend.includes("'"+rpc+"'"),'backend canonical name missing: '+rpc)
  assert.ok((staffSql+'\n'+stockSql).includes('create function public.'+rpc+'('),'SQL function missing '+rpc)
 }
 assert.match(cloudPort,/supabase\.rpc\(name,args\)/)
})
test('RC0 CLOUD types directly bind ASTRA canonical parameters rather than duplicate',()=>{
 assert.match(cloudTypes,/from '\.\.\/lib\/operational-rpcs'/)
 for(const mapping of ['ReviewStaffArgs as ReviewArgs','CreateInventoryItemArgs as ItemArgs',
  'ReceiveStockArgs as ReceiptArgs','EditBranchInventoryItemArgs as EditArgs',
  'InventoryBalance as Balance','StaffAccessRequest as StaffRequest'])assert.ok(cloudTypes.includes(mapping))
 for(const arg of ['p_expected_revision','p_request_id','p_opening_units','p_quantity',
  'p_expiry_warning_days'])assert.ok(backend.includes(arg),'missing canonical SQL field '+arg)
})
test('RC0 both independent browser write gates remain OFF unless explicitly true',()=>{
 assert.match(backend,/VITE_STAFF_APPROVAL_WRITES_ENABLED === 'true'/)
 assert.match(backend,/VITE_INVENTORY_WRITES_ENABLED === 'true'/)
 assert.match(cloudPort,/VITE_STAFF_APPROVAL_WRITES_ENABLED==='true'/)
 assert.match(cloudPort,/VITE_INVENTORY_WRITES_ENABLED==='true'/)
 assert.doesNotMatch(cloudPort,/service_role|user_metadata/)
})
test('RC0 deleted-session direct SELECT guard intersects all five base RLS scopes',()=>{
 for(const p of ['staff_access_requests','medicine_catalog','branch_medicine_rules',
 'branch_stock_batches','stock_movements'])assert.ok(sessionSql.includes('on public.'+p+' as restrictive for select'))
 assert.match(sessionSql,/auth\.sessions s/)
 assert.match(sessionSql,/s\.user_id=v_actor/)
 assert.match(sessionSql,/is_permanent_user\(\)/)
 assert.match(sessionSql,/revoke all on function clinic_private\.operational_read_session_live/)
})
test('RC0 request approval and separate accountant stay server checked',()=>{
 assert.match(staffSql,/create function clinic_private\.require_operational_actor/)
 assert.match(staffSql,/create function public\.review_staff_access/)
 assert.match(staffSql,/\baccountant\b/)
 assert.match(stockSql,/create function clinic_private\.require_inventory_writer/)
})
test('RC0 stock reply requires actual ten-unit server receipt, matching actor and nonce',()=>{
 const result={kind:'stock_received',branchId:branch,itemId:item,batchId:uuid,
  receivedUnits:10,lotOnHandUnits:10,actorId:uuid,eventId:uuid}
 assert.deepEqual(verifyOperationalReply('stock_received',result,
  {branchId:branch,itemId:item,actorId:uuid,quantity:10,requestId:uuid}),result)
 assert.throws(()=>verifyOperationalReply('stock_received',{...result,receivedUnits:20},
  {branchId:branch,itemId:item,actorId:uuid,quantity:10,requestId:uuid}))
 assert.throws(()=>verifyOperationalReply('stock_received',{...result,eventId:item},
  {requestId:uuid}))
})
test('RC0 authorized 10-unit persistence cannot be fabricated by local result',()=>{
 const balance={kind:'inventory_balance',branchId:branch,itemId:item,productCode:'RC0-TEN-001',
  revision:1,onHandUnits:10,availableUnits:10,reservedUnits:0,quarantinedUnits:0}
 assert.deepEqual(verifyOperationalReply('inventory_balance',balance,{branchId:branch,itemId:item}),balance)
 assert.throws(()=>verifyOperationalReply('inventory_balance',{...balance,availableUnits:20},{branchId:branch,itemId:item}))
})
