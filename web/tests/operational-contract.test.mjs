// CLOUD: exact #126 JSON-RPC wire contract, no hosted provider.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {RPC,verifyOperationalReply,operationalError,validateReviewInput} from '../src/operational/model.mjs'
const uuid=n=>'40000000-0000-4000-8000-'+String(n).padStart(12,'0')
const id=uuid(1),item=uuid(2),actor=uuid(3),event=uuid(4)
const src=p=>readFileSync(new URL('../src/'+p,import.meta.url),'utf8')
test('CLOUD eight RPC names exactly match ASTRA PR126 and all feature flags require explicit true',()=>{
 assert.deepEqual(RPC,{
  request:'request_staff_access',mine:'get_my_staff_access',
  list:'list_staff_access_requests',review:'review_staff_access',
  create:'create_branch_inventory_item',receive:'receive_branch_inventory_stock',
  edit:'edit_branch_inventory_item',balance:'get_branch_inventory_balance'
 })
 const port=src('operational/port.ts')
 for(const value of Object.values(RPC))assert.ok(port.includes('RPC.'),'only source-aligned RPC map is used')
 for(const flag of ['VITE_STAFF_APPROVAL_WRITES_ENABLED','VITE_INVENTORY_WRITES_ENABLED'])
  assert.match(port,new RegExp(flag+"==='true'"))
 assert.doesNotMatch(port,/service_role|serviceRole|localStorage|sessionStorage|\.insert\(|\.update\(|\.delete\(/)
})
test('self request and my status only accept authoritative kind and server-approved branch',()=>{
 assert.equal(verifyOperationalReply('staff_request',{kind:'staff_request',state:'pending',revision:1,branchId:id},{branchId:id}).state,'pending')
 assert.throws(()=>verifyOperationalReply('staff_request',{kind:'staff_request',state:'approved',revision:1,branchId:id}))
 assert.throws(()=>verifyOperationalReply('staff_request',{kind:'staff_request',state:'pending',revision:1,branchId:item},{branchId:id}))
 assert.deepEqual(verifyOperationalReply('my_staff_access',{kind:'my_staff_access',state:'none',role:null,branches:[]}).branches,[])
 assert.equal(verifyOperationalReply('my_staff_access',{kind:'my_staff_access',state:'pending',role:null,branches:[]}).state,'pending')
 assert.equal(verifyOperationalReply('my_staff_access',{kind:'my_staff_access',state:'approved',role:'accountant',branches:[]}).role,'accountant')
 assert.throws(()=>verifyOperationalReply('my_staff_access',{kind:'my_staff_access',state:'revoked',role:null,branches:[id]}))
})
test('scoped staff roster and review match requested branch, target and revision fields',()=>{
 const row={userId:item,requestedBranchId:id,state:'pending',revision:1,requestedAt:'2026-11-20T10:00:00Z',reviewedAt:null}
 const list={kind:'staff_requests',branchId:id,items:[row]}
 assert.equal(verifyOperationalReply('staff_requests',list,{branchId:id}).items.length,1)
 assert.throws(()=>verifyOperationalReply('staff_requests',list,{branchId:uuid(9)}))
 assert.throws(()=>verifyOperationalReply('staff_requests',{...list,items:[row,row]}))
 assert.equal(verifyOperationalReply('staff_review',{
  kind:'staff_review',userId:item,state:'approved',role:'receptionist',branches:[id],revision:2
 },{userId:item}).revision,2)
 assert.throws(()=>verifyOperationalReply('staff_review',{
  kind:'staff_review',userId:item,state:'approved',role:'receptionist',branches:[id],revision:2
 },{userId:uuid(9)}))
})
test('admin review guard rejects self-elevation, unapproved target branches and role attached to revoke',()=>{
 const args={p_target:item,p_action:'approve',p_role:'accountant',p_branches:[id],p_expected_revision:1,p_request_id:event}
 assert.equal(validateReviewInput(args,[id],actor),null)
 assert.ok(validateReviewInput({...args,p_target:actor},[id],actor))
 assert.ok(validateReviewInput({...args,p_branches:[uuid(9)]},[id],actor))
 assert.ok(validateReviewInput({...args,p_branches:[id,id]},[id],actor))
 assert.ok(validateReviewInput({...args,p_action:'revoke'},[id],actor))
 assert.equal(validateReviewInput({...args,p_action:'revoke',p_role:null,p_branches:null},[id],actor),null)
})
test('create, receive and readback require exact branch, product, item and numeric quantity',()=>{
 const result={kind:'inventory_item',itemId:item,branchId:id,productCode:'SYN-ITEM',category:'supply',
  unit:'each',revision:1,onHandUnits:0,batchId:null}
 assert.equal(verifyOperationalReply('inventory_item',result,{branchId:id,productCode:'SYN-ITEM'}).itemId,item)
 assert.throws(()=>verifyOperationalReply('inventory_item',{...result,category:'unsafe'}))
 assert.throws(()=>verifyOperationalReply('inventory_item',result,{branchId:uuid(9)}))
 const receipt={kind:'stock_received',branchId:id,itemId:item,batchId:uuid(5),
  receivedUnits:10,lotOnHandUnits:10,actorId:actor,eventId:event}
 assert.equal(verifyOperationalReply('stock_received',receipt,{branchId:id,itemId:item,actorId:actor,quantity:10}).receivedUnits,10)
 assert.throws(()=>verifyOperationalReply('stock_received',receipt,{branchId:id,itemId:item,actorId:actor,quantity:11}))
 assert.throws(()=>verifyOperationalReply('stock_received',{...receipt,actorId:uuid(9)},{actorId:actor}))
 assert.throws(()=>verifyOperationalReply('stock_received',{...receipt,lotOnHandUnits:4}))
 const balance={kind:'inventory_balance',branchId:id,itemId:item,productCode:'SYN-ITEM',
  revision:1,onHandUnits:10,availableUnits:10,reservedUnits:0,quarantinedUnits:0}
 assert.equal(verifyOperationalReply('inventory_balance',balance,{branchId:id,itemId:item}).onHandUnits,10)
 assert.throws(()=>verifyOperationalReply('inventory_balance',{...balance,availableUnits:11}))
})
test('edit CAS result cannot be faked with bad source shape',()=>{
 const item={kind:'inventory_item_updated',branchId:id,itemId:uuid(2),revision:2,name:'Synthetic item',
  description:'Local display',reorderPointUnits:5,expiryWarningDays:30}
 assert.equal(verifyOperationalReply('inventory_item_updated',item,{branchId:id,itemId:uuid(2)}).revision,2)
 assert.throws(()=>verifyOperationalReply('inventory_item_updated',{...item,revision:-1}))
 assert.throws(()=>verifyOperationalReply('inventory_item_updated',{...item,expiryWarningDays:999}))
})
test('known SQLSTATE errors distinguish denied/conflict/stale from uncertain outcome',()=>{
 for(const [code,kind] of [['42501','denied'],['22023','invalid'],['23505','conflict'],['23514','invalid'],['40001','stale'],['PGRST202','unavailable'],['08006','uncertain']])
  assert.equal(operationalError({code,message:'Synthetic error'}).kind,kind)
 assert.equal(operationalError(new TypeError('Failed to fetch')).kind,'uncertain')
})
test('operator forms use verified readback and preserve same payload ID after uncertain response',()=>{
 const staff=src('pages/staff/StaffAccessPages.tsx')
 const inv=src('pages/staff/InventoryOperatorForms.tsx')
 assert.match(staff,/port\.request\(payload\.branchId,payload\.note\)/)
 assert.match(staff,/port\.my\(\)/)
 assert.match(staff,/port\.review\(args\)/)
 assert.match(staff,/port\.list\(branch\.id\)/)
 assert.match(staff,/p_expected_revision:selected!\.revision/)
 assert.match(staff,/p_request_id:crypto\.randomUUID\(\)/)
 assert.match(inv,/p_request_id:crypto\.randomUUID\(\)/)
 assert.match(inv,/itemTicket\?\?/)
 assert.match(inv,/receiptTicket\?\?/)
 assert.match(inv,/port\.receive\(ticket\)/)
 assert.match(inv,/port\.movement\(branch\.id/)
 assert.match(inv,/port\.balance\(branch\.id/)
 assert.match(inv,/port\.profile\(branch\.id/)
 assert.match(inv,/getCurrentAuthorizations|verifiedStaffNavigationBranches/)
 assert.doesNotMatch(staff+inv,/\.insert\s*\(|\.update\s*\(|\.delete\s*\(|\.rpc\s*\(/)
})
