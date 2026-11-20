import test from 'node:test'
import assert from 'node:assert/strict'
import {classifyChartError,validateChartPage,validateDraftAcknowledgement,
  prepareSaveTicket,validateEncounter,CLINICAL_PAGE_LIMIT} from '../src/clinical/chart-model.mjs'

const id=n=>'20000000-0000-4000-8000-'+String(n).padStart(12,'0')
const context={accountId:id(1),branchId:id(2),petId:id(3),section:'appointments',cursor:null,limit:50}
const patient={id:id(3),ownerId:id(4),name:'Synthetic Patient',species:'Dog',breed:'Chow Chow',
  sex:'unknown',birthDate:'2021-01-01',taxonomyReviewNeeded:false}
const stamp=n=>new Date(Date.parse('2026-11-20T12:00:00Z')-n*60000).toISOString()
const appointment=n=>({id:id(100+n),branchId:id(2),petId:id(3),startsAt:stamp(n),
  endsAt:new Date(Date.parse(stamp(n))+1800000).toISOString(),status:'confirmed',concern:'Synthetic only'})
const record=n=>({id:id(100+n),branchId:id(2),petId:id(3),performedAt:stamp(n),
  procedure:'Synthetic historical note',temperatureC:38.5,weightKg:7.2,comments:null,authoredBy:id(1)})
const draft=n=>({id:id(100+n),appointmentId:id(400+n),branchId:id(2),petId:id(3),
  authorId:id(5),editorId:id(6),revision:3,status:'draft',
  complaint:'Synthetic concern',examination:'',assessment:'',plan:'',
  createdAt:stamp(n),updatedAt:new Date(Date.parse(stamp(n))+3000).toISOString()})
const response=(section,items,hasMore=false)=>({kind:'ok',accountId:id(1),branchId:id(2),
  patient,section,items,hasMore,nextCursor:hasMore?{at:section==='appointments'?items.at(-1).startsAt:
    section==='records'?items.at(-1).performedAt:items.at(-1).createdAt,id:items.at(-1).id}:null})
const check=(section,items,more=false,cursor=null)=>validateChartPage(response(section,items,more),
  {...context,section,cursor})

test('clinical boundary keeps 50/51 appointment pages immutable and bounded',()=>{
  const rows=Array.from({length:51},(_,n)=>appointment(n))
  const first=check('appointments',rows.slice(0,50),true)
  assert.equal(first.kind,'ok')
  assert.equal(first.items.length,50)
  assert.equal(first.hasMore,true)
  const next=check('appointments',rows.slice(50),false,first.nextCursor)
  assert.equal(next.items.length,1)
  assert.equal(next.hasMore,false)
  assert.equal(CLINICAL_PAGE_LIMIT,50)
  assert.throws(()=>check('appointments',rows),/Malformed/)
})
test('clinical record 50/51 pages strictly match branch/patient/provenance contract',()=>{
  const rows=Array.from({length:51},(_,n)=>record(n))
  const first=check('records',rows.slice(0,50),true)
  assert.equal(first.items[0].procedure,'Synthetic historical note')
  assert.equal(check('records',rows.slice(50),false,first.nextCursor).items.length,1)
  assert.throws(()=>check('records',[{...record(0),petId:id(9)}]),/Malformed/)
  assert.throws(()=>check('records',[{...record(0),temperatureC:100}]),/Malformed/)
  assert.throws(()=>check('records',[{...record(0),weightKg:Number.POSITIVE_INFINITY}]),/Malformed/)
})
test('draft pagination is ordered by immutable createdAt not changed updatedAt',()=>{
  const rows=Array.from({length:51},(_,n)=>draft(n))
  const first=check('drafts',rows.slice(0,50),true)
  rows[50].updatedAt='2027-01-01T00:00:00Z'
  assert.equal(check('drafts',[rows[50]],false,first.nextCursor).items[0].id,rows[50].id)
  assert.equal(first.items[0].authorId,id(5))
  assert.equal(first.items[0].editorId,id(6))
})
test('malformed pages and wrong identities fail closed without leaking the patient',()=>{
  const base=response('appointments',[appointment(0)])
  for(const update of [
    {accountId:id(8)},{branchId:id(8)},{patient:{...patient,id:id(8)}},
    {patient:{...patient,ownerId:'not-id'}},{patient:{...patient,birthDate:'2026-02-30'}},
    {items:[{...appointment(0),branchId:id(9)}]},{items:[appointment(0),appointment(0)]},
    {items:[{...appointment(0),status:'paid'}]},{items:[{...appointment(0),endsAt:stamp(0)}]},
    {items:[{...appointment(0),startsAt:'yesterday'}]},
    {hasMore:true,nextCursor:null},{hasMore:false,nextCursor:{at:stamp(0),id:id(100)}},
    {kind:'ok',patient:null},
  ])assert.throws(()=>validateChartPage({...base,...update},context),/Malformed/)
})
test('reject forged cursor, out-of-order pages, duplicates and nonsensical limits',()=>{
  const row=appointment(0)
  assert.throws(()=>validateChartPage(response('appointments',[row]),{...context,limit:0}),/Malformed/)
  assert.throws(()=>validateChartPage(response('appointments',[row]),{...context,cursor:{at:stamp(1),id:id(101)}}),/Malformed/)
  assert.throws(()=>check('appointments',[appointment(1),appointment(0)]),/Malformed/)
  assert.throws(()=>validateChartPage(response('appointments',[row]),{...context,cursor:{at:'unknown',id:id(8)}}),/Malformed/)
  const bad=response('appointments',[row],true)
  bad.nextCursor={at:stamp(100),id:id(100)}
  assert.throws(()=>validateChartPage(bad,context),/Malformed/)
})
test('not_found/denied/unavailable are not silently converted to empty chart',()=>{
  for(const kind of ['not_found','denied','unavailable']){
    assert.deepEqual(validateChartPage({kind},context),{kind})
  }
  assert.throws(()=>validateChartPage(null,context),/Malformed/)
})
test('strict acknowledgement requires matching actor, branch, patient, visit and CAS revision',()=>{
  const req={branchId:id(2),petId:id(3),appointmentId:id(5),
    requestId:id(8),expectedRevision:2,complaint:'Presenting complaint',examination:'',assessment:'',plan:''}
  const ack={kind:'saved',id:id(10),branchId:id(2),petId:id(3),appointmentId:id(5),
    authorId:id(5),editorId:id(1),status:'draft',revision:3,updatedAt:stamp(0)}
  assert.equal(validateDraftAcknowledgement(ack,req,id(1)).revision,3)
  for(const altered of [{editorId:id(9)},{branchId:id(9)},{petId:id(9)},
    {appointmentId:id(9)},{revision:4},{updatedAt:'tomorrow'},{status:'finalized'}]){
    assert.throws(()=>validateDraftAcknowledgement({...ack,...altered},req,id(1)),/Malformed/)
  }
})
test('save ticket is reused on network retry and replaced on changed payload/revision',()=>{
  const data={complaint:'Synthetic concern',examination:'',assessment:'',plan:'',expectedRevision:0}
  let counter=800
  const first=prepareSaveTicket(null,data,()=>id(++counter))
  assert.equal(prepareSaveTicket(first,{...data},()=>id(++counter)).requestId,first.requestId)
  assert.notEqual(prepareSaveTicket(first,{...data,plan:'Changed'},()=>id(++counter)).requestId,first.requestId)
  assert.notEqual(prepareSaveTicket(first,{...data,expectedRevision:1},()=>id(++counter)).requestId,first.requestId)
})
test('user input controls are bounded; backend errors keep distinct statuses',()=>{
  assert.equal(validateEncounter({complaint:'',examination:'',assessment:'',plan:''}).valid,false)
  assert.equal(validateEncounter({complaint:'okay',examination:'',assessment:'',plan:''}).valid,true)
  assert.equal(validateEncounter({complaint:'x'.repeat(4001),examination:'',assessment:'',plan:''}).valid,false)
  assert.equal(validateEncounter({complaint:'valid\u0001',examination:'',assessment:'',plan:''}).valid,false)
  assert.equal(classifyChartError({code:'42501'}),'denied')
  assert.equal(classifyChartError({code:'PGRST202'}),'unavailable')
  assert.equal(classifyChartError(new TypeError('Failed to fetch')),'network')
  assert.equal(classifyChartError({code:'500'}),'error')
})
