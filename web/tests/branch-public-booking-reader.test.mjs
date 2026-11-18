import test from 'node:test'
import assert from 'node:assert/strict'
import {readBranchPublicBooking,BRANCH_BOOKING_READ_STATUSES}
 from '../src/lib/branch-public-booking-reader.mjs'
const N='11111111-0000-4000-8000-000000000077',C='22222222-0000-4000-8000-000000000077'
const S='cccc0000-7777-4777-8777-000000000051',S2='cccc0000-7777-4777-8777-000000000052'
const R='bbbb0000-7777-4777-8777-000000000051',R2='bbbb0000-7777-4777-8777-000000000052'
const hours=()=>({sun:[],mon:[{open:'10:00',close:'12:00'}],tue:[],wed:[],thu:[],fri:[],sat:[]})
function defaults(){
 return {
  clinic_branches:{id:N,booking_enabled:true,public_display_hours:{mon:'08:00-17:00'}},
  branch_booking_policies:{branch_id:N,timezone:'Asia/Manila',weekly_hours:hours(),
   holidays:[],lead_minutes:60,max_advance_days:30,slot_step_minutes:30,revision:1,is_approved:true},
  clinic_services:[{id:S,branch_id:N,slug:'synthetic-visit',display_name:'Synthetic visit',
   summary:null,duration_minutes:30,published_at:'2026-11-17T10:00:00Z'}],
  clinic_service_resources:[{service_id:S,resource_id:R,public_label:'Room A',capacity:1}],
  appointment_resources:[{id:R,branch_id:N,is_active:true}]
 }
}
function mock(settings={}){
 const data={...defaults(),...settings},calls=[],errors=settings.errors??{}
 const db={calls,from(table){
  if(!['clinic_branches','branch_booking_policies','clinic_services',
   'clinic_service_resources','appointment_resources'].includes(table))throw Error('Unexpected '+table)
  const q={filters:[],select(fields){calls.push(['select',table,fields]);return q},
   eq(k,v){q.filters.push(['eq',k,v]);return q},
   in(k,v){q.filters.push(['in',k,v]);return Promise.resolve(result())},
   order(k){calls.push(['order',table,k]);return Promise.resolve(result())},
   maybeSingle(){return Promise.resolve(result())}}
  function result(){
   calls.push(['query',table,...q.filters])
   if(settings.throwOn===table)throw Error('network unavailable')
   if(Object.hasOwn(errors,table))return {data:null,error:errors[table]}
   if(settings.omitData===table)return {error:null}
   let rows=data[table]
   if(Array.isArray(rows)){
    for(const [op,key,val] of q.filters)rows=rows.filter(x=>op==='eq'?x[key]===val:val.includes(x[key]))
    return {data:rows,error:null}
   }
   return {data:rows??null,error:null}
  }
  return q
 }}
 return db
}
test('closed result status enum never allows legacy or assumed approval',()=>{
 assert.deepEqual(BRANCH_BOOKING_READ_STATUSES,
 ['missing_contract','unapproved_branch','unavailable','backend_error','ready'])
})
test('fully approved Naga service and real room only; never display hours or singleton',async()=>{
 const db=mock(),result=await readBranchPublicBooking(db,N)
 assert.equal(result.kind,'ready')
 assert.equal(result.branchId,N)
 assert.deepEqual(result.schedule.weekly_hours,hours())
 assert.deepEqual(result.services[0].resources,[{resource_id:R,public_label:'Room A',capacity:1}])
 assert.equal(JSON.stringify(result).includes('public_display_hours'),false)
 assert.equal(db.calls.some(x=>x[1]==='clinic_booking_policy'||x[0]==='rpc'),false)
 assert.equal(db.calls.some(x=>x[0]==='query'&&x[1]==='appointment_resources'&&
  x.some(y=>Array.isArray(y)&&y[1]==='branch_id'&&y[2]===N)),true)
})
test('malformed, injected and upper-case branch IDs',async()=>{
 for(const value of ['',null,[],{},'naga','../cavite',N+'-bad']){
  const db=mock()
  assert.deepEqual(await readBranchPublicBooking(db,value),{kind:'unapproved_branch'})
  assert.equal(db.calls.length,0)
 }
 assert.equal((await readBranchPublicBooking(mock(),N.toUpperCase())).kind,'ready')
})
test('branch OFF, hidden policy, wrong branch policy all deny service reads',async()=>{
 const base=defaults()
 for(const settings of [
  {clinic_branches:null},
  {clinic_branches:{id:N,booking_enabled:false}},
  {branch_booking_policies:null},
  {branch_booking_policies:{...base.branch_booking_policies,is_approved:false}},
  {branch_booking_policies:{...base.branch_booking_policies,branch_id:C}}
 ]){
  const db=mock(settings)
  assert.deepEqual(await readBranchPublicBooking(db,N),{kind:'unapproved_branch'})
  assert.equal(db.calls.some(x=>x[1]==='clinic_services'),false)
 }
})
test('missing exact schema versus backend error across every stage',async()=>{
 for(const table of ['clinic_branches','branch_booking_policies','clinic_services',
  'clinic_service_resources','appointment_resources']){
  for(const code of ['PGRST205','42P01']){
   const e={code,message:'relation public.'+table+' does not exist'}
   assert.deepEqual(await readBranchPublicBooking(mock({errors:{[table]:e}}),N),
    {kind:'missing_contract',table})
  }
  assert.deepEqual(await readBranchPublicBooking(mock({errors:{
   [table]:{code:'PGRST205',message:'another table missing'}}}),N),{kind:'backend_error'})
  assert.deepEqual(await readBranchPublicBooking(mock({throwOn:table}),N),{kind:'backend_error'})
  assert.deepEqual(await readBranchPublicBooking(mock({omitData:table}),N),{kind:'backend_error'})
 }
 assert.deepEqual(await readBranchPublicBooking(null,N),{kind:'backend_error'})
})
test('anonymous RLS-hidden resource links and room visibility never imply ready',async()=>{
 for(const table of ['clinic_service_resources','appointment_resources']){
  assert.deepEqual(await readBranchPublicBooking(mock({[table]:[]}),N),
   {kind:'unavailable',reason:'eligible_resources_not_visible'})
  assert.deepEqual(await readBranchPublicBooking(mock({errors:{
   [table]:{code:'42501',message:'permission denied'}}}),N),
   {kind:'unavailable',reason:'eligible_resources_not_visible'})
 }
 assert.deepEqual(await readBranchPublicBooking(mock({errors:{
  clinic_services:{code:'42501',message:'permission denied'}}}),N),{kind:'backend_error'})
})
test('invalid owner schedules do not borrow Monday-Saturday public display hours',async()=>{
 const p=defaults().branch_booking_policies
 for(const change of [
  {timezone:'Invalid/Zone'},{weekly_hours:{mon:[{open:'08:00',close:'17:00'}]}},
  {weekly_hours:{...hours(),mon:[]}},
  {weekly_hours:{...hours(),mon:[{open:'12:00',close:'10:00'}]}},
  {weekly_hours:{...hours(),mon:[{open:'wrong',close:'17:00'}]}},
  {weekly_hours:{...hours(),mon:[{open:'10:00',close:'12:00'},
    {open:'11:00',close:'14:00'}]}},
  {lead_minutes:-1},{lead_minutes:null},{slot_step_minutes:0},
  {slot_step_minutes:90},{max_advance_days:366},{revision:0},
  {holidays:['2026-02-30']}
 ]){
  assert.deepEqual(await readBranchPublicBooking(mock({
   branch_booking_policies:{...p,...change}}),N),
   {kind:'unavailable',reason:'invalid_schedule'})
 }
})
test('zero published services is unavailable, never legacy',async()=>{
 assert.deepEqual(await readBranchPublicBooking(mock({clinic_services:[]}),N),
  {kind:'unavailable',reason:'services'})
})
test('unpublished, foreign-branch or malformed returned services fail closed',async()=>{
 const s=defaults().clinic_services[0]
 for(const change of [{branch_id:C},{published_at:null},{duration_minutes:0},
  {slug:'INVALID'},{id:'not-a-uuid'}]){
  assert.deepEqual(await readBranchPublicBooking(mock({
   clinic_services:[{...s,...change}]}),N),{kind:'backend_error'})
 }
})
test('foreign service, invalid resource ID and capacity bypass rejected',async()=>{
 const r=defaults().clinic_service_resources[0]
 for(const change of [{capacity:2},{service_id:S2},{resource_id:'../cavite'}]){
  assert.deepEqual(await readBranchPublicBooking(mock({
   clinic_service_resources:[{...r,...change}]}),N),{kind:'backend_error'})
 }
})
test('cross-branch/inactive room cannot make a service eligible',async()=>{
 const r=defaults().appointment_resources[0]
 for(const change of [{branch_id:C},{is_active:false},{id:R2}]){
  assert.notEqual((await readBranchPublicBooking(mock({
   appointment_resources:[{...r,...change}]}),N)).kind,'ready')
 }
})
test('only eligible service and room are emitted, not unlinked service',async()=>{
 const data=defaults(),first=data.clinic_services[0]
 const result=await readBranchPublicBooking(mock({
  clinic_services:[first,{...first,id:S2,slug:'second-visit',display_name:'Second visit'}],
  clinic_service_resources:[...data.clinic_service_resources,
   {service_id:S2,resource_id:R2,public_label:'Second room',capacity:1}]
 }),N)
 assert.equal(result.kind,'ready')
 assert.equal(result.services.length,1)
 assert.equal(result.services[0].id,S)
})
