import test from 'node:test'
import assert from 'node:assert/strict'
import {dayWindow,weekDates,rangeWindow} from '../src/ops/ops-model.mjs'
import {
 requireBranchId,BRANCH_WINDOW_LIMIT,queryOwnBranchMemberships,queryClinicBranchCatalog,
 assertBranchOnServer,queryBranchQueueWindow,queryBranchDashboardCounts
} from '../src/staff-branch-read-contract.mjs'
const N='11111111-0000-4000-8000-000000000077'
const C='22222222-0000-4000-8000-000000000077'
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ID=i=>'eeeeeeee-eeee-4eee-8eee-'+String(i).padStart(12,'0')
const UTC_FROM='2026-11-17T16:00:00.000Z'
const UTC_TO='2026-11-18T16:00:00.000Z'
function row(i=1,branch_id=N){
 return {id:ID(i),owner_id:A,pet_id:ID(2),resource_id:ID(3),
  starts_at:'2026-11-18T08:00:00Z',ends_at:'2026-11-18T08:30:00Z',
  branch_id,status:'requested',concern:'Synthetic appointment'}
}
function harness(o={}){
 const db={calls:[],uid:o.uid??A,branchActive:o.branchActive??true,globalActive:o.globalActive??true}
 const fail=(msg)=>({code:'42501',message:msg})
 db.auth={getUser:async()=>({data:{user:db.uid?{id:db.uid,is_anonymous:o.anonymous??false,
     email_confirmed_at:o.unconfirmed?null:'2026-11-18T00:00:00Z'}:null},error:null})}
 db.from=t=>{
  db.calls.push(['from',t])
  if(t==='staff_memberships')return {select:()=>({eq:()=>({maybeSingle:async()=>({
   data:db.globalActive?{user_id:db.uid,role:'receptionist',is_active:true}:
    {user_id:db.uid,role:'receptionist',is_active:false},error:null})})})}
  if(t==='staff_branch_memberships')return {select:()=>({eq:async(col,id)=>({
   data:Object.hasOwn(o,'memberRows')?o.memberRows:[{user_id:id,branch_id:N,role:'receptionist',is_active:true}],error:o.membershipError??null
  })})}
  if(t==='clinic_branches')return {select:()=>({order:async()=>({
   data:Object.hasOwn(o,'catalog')?o.catalog:[{id:N,slug:'naga',display_name:'Naga clinic'},{id:C,slug:'cavite',display_name:'Cavite clinic'}],
   error:o.catalogError??null})})}
  if(t!=='appointments')throw Error('Unexpected query table '+t)
  let branch='',from='',to='',firstOrder='',secondOrder=''
  const chain={
   eq(key,value){assert.equal(key,'branch_id');branch=value;db.calls.push(['branch',value]);return chain},
   gte(key,value){assert.equal(key,'starts_at');from=value;return chain},
   lt(key,value){assert.equal(key,'starts_at');to=value;return chain},
   order(key){if(!firstOrder)firstOrder=key;else secondOrder=key;return chain},
   async limit(num){
    db.calls.push(['limit',num,branch,from,to,firstOrder,secondOrder])
    const data=Object.hasOwn(o,'rows')?o.rows:[]
    if(o.queryError)return {data:null,error:o.queryError}
    if(o.revokeAfterRead)db.branchActive=false
    if(o.switchAfterRead)db.uid=B
    return {data:!Array.isArray(data)?data:o.ignoreLimit?data:
      (o.ignoreFilter?data:data.filter(r=>r.branch_id===branch)).slice(0,num),error:null}
   }
  }
  return {select:cols=>{assert.match(cols,/branch_id/);return chain}}
 }
 db.rpc=async(name,args)=>{
  db.calls.push(['rpc',name,args.p_branch])
  if(!db.branchActive||args.p_branch!==N||db.uid!==A||!db.globalActive)
   return {data:null,error:fail('Branch access not authorized')}
  if(o.rpcError)return {data:null,error:o.rpcError}
  if(name==='assert_staff_branch')return {data:o.badEcho?C:N,error:null}
  if(name==='get_branch_dashboard_counts'){
   if(o.switchAfterCount)db.uid=B
   return {data:Object.hasOwn(o,'counts')?o.counts:[{
   patients:1,requested_appointments:251,confirmed_appointments:0}],error:null}
  }
  throw Error('Unknown RPC '+name)
 }
 return db
}
test('UUID guard denies malformed or forged IDs before any network request',async()=>{
 for(const id of ['naga','',null,{},'../x',N+'xx',C.slice(0,15)]){
  const db=harness()
  await assert.rejects(queryBranchQueueWindow(db,A,id,UTC_FROM,UTC_TO),e=>e.code==='42501')
  assert.deepEqual(db.calls,[])
 }
 assert.equal(requireBranchId(N),N)
 assert.equal(BRANCH_WINDOW_LIMIT,250)
})
test('membership list verifies current real Auth user/global role; catalog is public read-only',async()=>{
 const db=harness()
 assert.deepEqual(await queryOwnBranchMemberships(db,A),[{user_id:A,branch_id:N,role:'receptionist',is_active:true}])
 assert.equal((await queryClinicBranchCatalog(db)).length,2)
 for(const opts of [{uid:B},{anonymous:true},{unconfirmed:true},{globalActive:false}]){
  const x=harness(opts);await assert.rejects(queryOwnBranchMemberships(x,A))
  assert.equal(x.calls.some(c=>c[0]==='from'&&c[1]==='staff_branch_memberships'),false)
 }
 await assert.rejects(queryOwnBranchMemberships(harness({memberRows:null}),A))
 await assert.rejects(queryClinicBranchCatalog(harness({catalog:null})))
})
test('verified, RLS-filtered Naga queue returns exact 0/249/250/251 and NEVER Cavite',async()=>{
 for(const n of [0,249,250,251,300]){
  const db=harness({rows:[...Array.from({length:n},(_,i)=>row(i+5)),
   row(5555,C)]})
  const got=await queryBranchQueueWindow(db,A,N,UTC_FROM,UTC_TO)
  assert.equal(got.items.length,Math.min(n,250))
  assert.equal(got.hasMore,n>250)
  assert.ok(got.items.every(x=>!('branch_id' in x)))
  assert.equal(db.calls.filter(x=>x[0]==='rpc'&&x[1]==='assert_staff_branch').length,2)
  assert.deepEqual(db.calls.find(x=>x[0]==='limit'),['limit',251,N,
   '2026-11-17T16:00:00.000Z','2026-11-18T16:00:00.000Z','starts_at','id'])
 }
})
test('Manila UTC day and week bounds are half-open and per-day <=24h',()=>{
 const d=dayWindow('2026-11-18')
 assert.deepEqual(d,{fromUtc:UTC_FROM,toUtc:UTC_TO})
 assert.equal(new Date(d.toUtc)-new Date(d.fromUtc),86400000)
 const days=weekDates('2026-11-18')
 assert.equal(days.length,7);assert.equal(days[0],'2026-11-16')
 assert.equal(days.at(-1),'2026-11-22')
 for(let i=0;i<7;i++){
  const w=dayWindow(days[i])
  assert.equal(new Date(w.toUtc)-new Date(w.fromUtc),86400000)
  if(i)assert.equal(dayWindow(days[i-1]).toUtc,w.fromUtc)
 }
 assert.equal(rangeWindow('2026-11-18','morning').toUtc,'2026-11-18T04:00:00.000Z')
})
test('invalid UTC windows, corrupt rows and backend errors fail closed (not empty)',async()=>{
 for(const [f,t] of [
  [UTC_TO,UTC_FROM],[UTC_FROM,UTC_FROM],
  [UTC_FROM,'2026-11-19T16:00:00Z'],
  ['2026-11-18',UTC_TO],['2026-11-17T16:00:00+08:00',UTC_TO]]){
  const db=harness();await assert.rejects(queryBranchQueueWindow(db,A,N,f,t))
  assert.equal(db.calls.some(x=>x[0]==='from'&&x[1]==='appointments'),false)
 }
 for(const bad of [null,[{}],[{...row(),status:'in_consult'}],
  [{...row(),branch_id:C}],[{...row(),concern:''}],
  [{...row(),starts_at:'wrong'}]]){
  const db=harness({rows:bad,ignoreFilter:!(Array.isArray(bad)&&bad.length===1&&bad[0]?.branch_id===C)})
  // branch_id mismatch is removed by a conforming server-side predicate;
  // assert a foreign row cannot be returned to the consumer.
  if(Array.isArray(bad)&&bad.length===1&&bad[0]?.branch_id===C){
   assert.deepEqual(await queryBranchQueueWindow(db,A,N,UTC_FROM,UTC_TO),
    {items:[],hasMore:false})
  }else await assert.rejects(queryBranchQueueWindow(db,A,N,UTC_FROM,UTC_TO))
 }
 const oversized=harness({rows:Array.from({length:252},(_,i)=>row(i+5)),ignoreLimit:true})
 await assert.rejects(queryBranchQueueWindow(oversized,A,N,UTC_FROM,UTC_TO),
  /Clinic branch queue response could not be verified/)
 const denied={code:'42501',message:'RLS deny'}
 await assert.rejects(queryBranchQueueWindow(harness({queryError:denied}),A,N,UTC_FROM,UTC_TO),e=>e===denied)
 await assert.rejects(queryBranchQueueWindow(harness({rpcError:denied}),A,N,UTC_FROM,UTC_TO),e=>e===denied)
 await assert.rejects(assertBranchOnServer(harness({badEcho:true}),N),e=>e.code==='42501')
})
test('revoked branch, inactive global role, account switch midflight cannot release stale queue',async()=>{
 for(const opts of [{branchActive:false},{globalActive:false},{revokeAfterRead:true},
  {switchAfterRead:true},{uid:B}]){
  const db=harness({rows:[row()],...opts})
  await assert.rejects(queryBranchQueueWindow(db,A,N,UTC_FROM,UTC_TO))
 }
 const db=harness({rows:[row()]})
 assert.equal((await queryBranchQueueWindow(db,A,N,UTC_FROM,UTC_TO)).items.length,1)
 db.branchActive=false
 await assert.rejects(queryBranchQueueWindow(db,A,N,UTC_FROM,UTC_TO),e=>e.code==='42501')
})
test('branch patient/status counts are exact only for authorized invoker RPC',async()=>{
 const db=harness()
 assert.deepEqual(await queryBranchDashboardCounts(db,A,N),{
  patients:1,requestedAppointments:251,confirmedAppointments:0})
 assert.deepEqual(db.calls.filter(c=>c[0]==='rpc').map(x=>x[1]),[
  'get_branch_dashboard_counts','assert_staff_branch'])
 for(const opts of [{counts:null},{counts:[]},{counts:[{}]},{counts:[{patients:-1,requested_appointments:0,confirmed_appointments:0}]},
  {counts:[{patients:'1',requested_appointments:0,confirmed_appointments:0}]},
  {rpcError:{code:'42501',message:'denied'}},{branchActive:false},{switchAfterCount:true}]){
  await assert.rejects(queryBranchDashboardCounts(harness(opts),A,N))
 }
 await assert.rejects(queryBranchDashboardCounts(harness(),A,C),e=>e.code==='42501')
})
