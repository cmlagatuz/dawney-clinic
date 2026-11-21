import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {validateNewItem,validateReceipt,validDraft} from '../src/inventory/operator-validation.mjs'
const item={type:'medicine',code:'SYN-MED-1',name:'Synthetic Medicine',unit:'vial',formulation:'solution',strength:'5 mg',reorder:'10',supplier:'SUP-TEST'}
const receipt={branchId:'20000000-0000-4000-8000-000000000001',code:'SYN-MED-1',lot:'LOT-QA-01',quantity:'10',receivedOn:'2026-11-20',expiresOn:'2027-11-20',supplier:''}
const src=p=>readFileSync(new URL('../src/'+p,import.meta.url),'utf8')
test('new medicine form accepts valid synthetic draft without posting to a server',()=>{
 assert.deepEqual(validateNewItem(item),{})
 assert.equal(validDraft(validateNewItem(item)),true)
})
test('medicine requires formulation and strength, while supplies and consumables do not',()=>{
 assert.ok(validateNewItem({...item,formulation:'',strength:''}).formulation)
 for(const type of ['supply','consumable'])assert.deepEqual(validateNewItem({...item,type,formulation:'',strength:''}),{})
})
test('invalid code, fractional and negative stock point, missing name and suspicious supplier are blocked',()=>{
 assert.ok(validateNewItem({...item,code:'bad code'}).code)
 assert.ok(validateNewItem({...item,reorder:'10.2'}).reorder)
 assert.ok(validateNewItem({...item,reorder:'-5'}).reorder)
 assert.ok(validateNewItem({...item,name:' '}).name)
 assert.ok(validateNewItem({...item,supplier:'x\nbad'}).supplier)
})
test('synthetic quantity ten, valid lot and future expiry pass local receipt validation',()=>{
 assert.deepEqual(validateReceipt(receipt,'2026-11-21'),{})
 assert.equal(validDraft(validateReceipt(receipt,'2026-11-21')),true)
})
test('receiving rejects fractional, negative, zero and oversized stock quantities',()=>{
 for(const quantity of ['0','-1','2.5','1000000001','01','NaN',''])assert.ok(validateReceipt({...receipt,quantity},'2026-11-21').quantity,quantity)
})
test('receiving rejects expiry before received date, expired lots, impossible dates and absent branch',()=>{
 assert.ok(validateReceipt({...receipt,expiresOn:'2026-11-19'},'2026-11-21').expiresOn)
 assert.ok(validateReceipt({...receipt,expiresOn:'2026-11-21'},'2026-11-21').expiresOn)
 assert.ok(validateReceipt({...receipt,receivedOn:'2026-02-30'},'2026-11-21').receivedOn)
 assert.ok(validateReceipt({...receipt,branchId:''},'2026-11-21').branchId)
})
test('operator modules never invent an authenticated mutation endpoint',()=>{
 const a=src('pages/staff/StaffAccessPages.tsx')
 const b=src('pages/staff/InventoryOperatorPage.tsx')
 const c=src('inventory/port.ts')
 for(const code of [a,b]){assert.doesNotMatch(code,/\.rpc\s*\(|\.insert\s*\(|\.update\s*\(|\.delete\s*\(|service_role|serviceRole/)}
 assert.match(a,/APPROVAL_WRITER_AVAILABLE=false/)
 assert.match(b,/ITEM_WRITER_AVAILABLE=false/)
 assert.match(b,/STOCK_RECEIPT_WRITER_AVAILABLE=false/)
 assert.match(b,/verifiedStaffNavigationBranches/)
 assert.match(c,/list_branch_medicine_fefo/)
})
test('admin/receptionist only inventory editing; accountant is never an administrator surrogate',()=>{
 const inv=src('pages/staff/InventoryOperatorPage.tsx')
 const staff=src('pages/staff/StaffAccessPages.tsx')
 assert.match(inv,/b\.role==='administrator'\|\|b\.role==='receptionist'/)
 assert.match(staff,/value="accountant"/)
 assert.match(staff,/Accountant is a separate future role/)
 assert.doesNotMatch(staff,/\.user_metadata|\.app_metadata|setRole|grant_verified_staff/)
})
