import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {billingList,billingDetail,displayAmount,billingFailure,shownInvoices,
  BILLING_LIMIT,BILLING_STATUSES,isBillingId} from '../src/billing/model.mjs'
const id=n=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0')
const naga=id(1),cavite=id(2),owner=id(3),pet=id(4),appt=id(5),invoiceId=id(6)
const base={id:invoiceId,branch_id:naga,owner_id:owner,pet_id:pet,appointment_id:appt,
 invoice_no:'QA-BILL-001',kind:'invoice',status:'issued',currency_code:'PHP',minor_scale:2,
 created_at:'2026-11-20T08:00:00Z',
 totals:{subtotal_minor:12500,discount_minor:500,tax_minor:0,
 total_minor:12000,paid_minor:0,refunded_minor:0,balance_minor:12000}}
const line={id:id(7),invoice_id:invoiceId,category:'service',description:'Synthetic check',
 quantity:1,unit_label:'visit',unit_price_minor:12500,line_total_minor:12500}
const payment={id:id(8),invoice_id:invoiceId,occurred_at:'2026-11-20T09:00:00Z',
 amount_minor:12000,status:'settled',method_label:'Synthetic offline tender'}
const receipt={id:id(9),invoice_id:invoiceId,payment_id:payment.id,
 receipt_no:'QA-REC-ONLY',issued_at:'2026-11-20T09:02:00Z',amount_minor:12000}
const detail=()=>({header:base,lines:[line],payments:[],receipts:[]})
const changed=(props={})=>({...base,...props})
const window=(items=[base],hasMore=false)=>({items,hasMore})
test('CLOUD billing: valid verified branch window and amount scale only from server',()=>{
 const w=billingList(window(),naga)
 assert.equal(w.items[0].invoice_no,'QA-BILL-001')
 assert.equal(displayAmount(12345,'PHP',2),'PHP 123.45')
 assert.equal(displayAmount(-12345,'PHP',2),'-PHP 123.45')
 assert.equal(displayAmount(0,'USD',0),'USD 0')
 assert.equal(displayAmount(105,'JPY',3),'JPY 0.105')
})
test('CLOUD billing: limit and hasMore never default to an empty or complete read',()=>{
 for(const x of [null,{},[],{items:[]},{items:[],hasMore:1}])
   assert.throws(()=>billingList(x,naga))
 assert.equal(billingList(window([]),naga).items.length,0)
 assert.equal(billingList(window([base],true),naga).hasMore,true)
 assert.throws(()=>billingList(window(Array.from({length:BILLING_LIMIT+1},(_,i)=>
   changed({id:id(100+i)})),true),naga))
})
test('CLOUD billing: deny foreign branch, foreign owner identity, duplicate, malformed IDs',()=>{
 assert.throws(()=>billingList(window(),cavite))
 assert.throws(()=>billingList(window([changed({branch_id:cavite})]),naga))
 assert.throws(()=>billingList(window([base,base]),naga))
 for(const bad of ['naga','../000','',null])assert.equal(isBillingId(bad),false)
 assert.throws(()=>billingList(window([changed({owner_id:'wrong'})]),naga))
 assert.throws(()=>billingList(window([changed({appointment_id:'wrong'})]),naga))
})
test('CLOUD billing: reject unapproved invoice status, currency, scale and date',()=>{
 for(const bad of [{status:'charged'},{currency_code:'php'},{currency_code:'US'},
   {minor_scale:-1},{minor_scale:4},{created_at:'next week'},{kind:'free'}])
   assert.throws(()=>billingList(window([changed(bad)]),naga))
 assert.deepEqual(BILLING_STATUSES,['draft','issued','paid','voided','refunded'])
})
test('CLOUD billing: reject inaccurate subtotal, refund/paid reconciliation, negative and float amounts',()=>{
 for(const totals of [
   {...base.totals,total_minor:12001},
   {...base.totals,paid_minor:12000,balance_minor:12000},
   {...base.totals,paid_minor:500,refunded_minor:800},
   {...base.totals,tax_minor:1.5},
   {...base.totals,discount_minor:-4},
   {...base.totals,paid_minor:NaN},
 ])assert.throws(()=>billingList(window([changed({totals})]),naga))
})
test('CLOUD billing: response drops restricted medicine cost and unsanctioned owner data',()=>{
 const row=changed({unit_cost_minor:999999,private_owner_email:'no@example.test',discount_policy:'arbitrary'})
 const x=billingList(window([row]),naga).items[0]
 assert.equal('unit_cost_minor' in x,false)
 assert.equal('private_owner_email' in x,false)
 assert.equal('discount_policy' in x,false)
})
test('CLOUD billing: detail identity requires exact authorized branch and invoice',()=>{
 const d=billingDetail(detail(),naga,invoiceId)
 assert.equal(d.lines[0].description,'Synthetic check')
 assert.throws(()=>billingDetail(detail(),cavite,invoiceId))
 assert.throws(()=>billingDetail(detail(),naga,id(51)))
})
test('CLOUD billing: itemization rejects duplicate lines, cross-invoice lines and malformed values',()=>{
 for(const rows of [
  {...detail(),lines:[line,line]},
  {...detail(),lines:[{...line,invoice_id:id(99)}]},
  {...detail(),lines:[{...line,quantity:0}]},
  {...detail(),lines:[{...line,line_total_minor:1.25}]},
  {...detail(),lines:[{...line,description:''}]},
  {...detail(),lines:[{...line,unit_price_minor:undefined}]},
 ])assert.throws(()=>billingDetail(rows,naga,invoiceId))
})
test('CLOUD billing: verified payment and receipt must reference this invoice and settled payment ID',()=>{
 const paid=changed({status:'paid',totals:{...base.totals,paid_minor:12000,balance_minor:0}})
 const x=billingDetail({header:paid,lines:[line],payments:[payment],receipts:[receipt]},naga,invoiceId)
 assert.equal(x.receipts[0].receipt_no,'QA-REC-ONLY')
 assert.throws(()=>billingDetail({header:paid,lines:[line],payments:[],receipts:[receipt]},naga,invoiceId))
 assert.throws(()=>billingDetail({header:paid,lines:[line],payments:[{...payment,invoice_id:cavite}],receipts:[]},naga,invoiceId))
 assert.throws(()=>billingDetail({header:paid,lines:[line],payments:[payment],receipts:[receipt,receipt]},naga,invoiceId))
})
test('CLOUD billing: no invented paid or receipt records from an empty authorized detail',()=>{
 const d=billingDetail({header:base,lines:[],payments:[],receipts:[]},naga,invoiceId)
 assert.equal(d.payments.length,0);assert.equal(d.receipts.length,0)
 assert.equal(d.header.totals.paid_minor,0)
})
test('CLOUD billing: format rejects unsafe, unknown or fractional minor-unit amounts',()=>{
 for(const x of [NaN,Infinity,1.3,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>displayAmount(x,'PHP',2))
 assert.throws(()=>displayAmount(10,'php',2));assert.throws(()=>displayAmount(10,'PHP',8))
})
test('CLOUD billing: sort/filter only already verified rows, no guessed finance aggregations',()=>{
 const b=changed({id:id(10),invoice_no:'QA-BILL-002',status:'paid',
  created_at:'2026-11-21T00:00:00Z',totals:{...base.totals,paid_minor:12000,balance_minor:0}})
 const rows=billingList(window([base,b]),naga).items
 assert.deepEqual(rows.map(x=>x.id),[b.id,base.id])
 assert.deepEqual(shownInvoices(rows,{status:'paid'}).map(x=>x.id),[b.id])
 assert.deepEqual(shownInvoices(rows,{query:'-001'}).map(x=>x.id),[base.id])
 assert.deepEqual(shownInvoices(rows,{status:'unapproved'}),[])
})
test('CLOUD billing: denied, unavailable, network and malformed reply remain distinct',()=>{
 assert.equal(billingFailure({code:'42501',message:'unauthorized'}),'denied')
 assert.equal(billingFailure({code:'PGRST301',message:'JWT expired'}),'denied')
 assert.equal(billingFailure({code:'BILLING_READER_NOT_INTEGRATED',message:'Billing reader not integrated'}),'unavailable')
 assert.equal(billingFailure(new TypeError('Failed to fetch')),'network')
 assert.equal(billingFailure(Error('Malformed invoice')),'error')
})
test('CLOUD billing: production adapter has NO finance SQL/HTTP/mutations, routes remain feature OFF',()=>{
 const rd=p=>readFileSync(new URL('../src/'+p,import.meta.url),'utf8')
 const port=rd('billing/port.ts')
 assert.match(port,/createClinicalReadPort/)
 assert.match(port,/assertStaffBranch/)
 assert.match(port,/BILLING_READER_NOT_INTEGRATED/)
 assert.doesNotMatch(port,/\.from\(|\.rpc\(|\.insert\(|\.update\(|\.delete\(|fetch\(|service_role/)
 assert.match(rd('App.tsx'),/VITE_PHASE5C_BILLING_UI === 'true'/)
 assert.match(rd('components/Layout.tsx'),/VITE_PHASE5C_BILLING_UI === 'true'/)
 assert.doesNotMatch(rd('billing/OwnerBillingPage.tsx'),/\.from\(|\.rpc\(|fetch\(/)
});
