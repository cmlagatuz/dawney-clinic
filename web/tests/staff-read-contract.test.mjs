import test from 'node:test'
import assert from 'node:assert/strict'
import {
  STAFF_ROLES,verifyStaffFromRls,validateClinicUtcWindow,
  queryClinicQueue,queryClinicDashboardCounts
} from '../src/staff-read-contract.mjs'
const USER_A='11111111-1111-4111-8111-111111111111'
const USER_B='22222222-2222-4222-8222-222222222222'
const verified=id=>({id,is_anonymous:false,email_confirmed_at:'2026-11-14T00:00:00Z'})
function staffDb({authUser=verified(USER_A),authError=null,membership={user_id:USER_A,role:'receptionist',is_active:true},memberError=null}={}) {
  const calls=[]
  const db={calls,auth:{getUser:async()=>{calls.push('getUser');return {data:{user:authUser},error:authError}}},
    from:table=>{calls.push(table);assert.equal(table,'staff_memberships');return {
      select:fields=>{calls.push(fields);return {eq:(key,value)=>{
        calls.push([key,value]);return {maybeSingle:async()=>({data:membership,error:memberError})}
      }}}
    }}}
  return db
}
test('verified active staff roles are returned only from the server-authorized membership row',async()=>{
  for(const role of STAFF_ROLES){
    const db=staffDb({membership:{user_id:USER_A,role,is_active:true}})
    assert.deepEqual(await verifyStaffFromRls(db,USER_A),{userId:USER_A,role,isActive:true})
    assert.deepEqual(db.calls,['getUser','staff_memberships','user_id,role,is_active',['user_id',USER_A]])
  }
})
test('owner without staff, revoked staff and forged role all fail closed',async()=>{
  for(const membership of [null,{user_id:USER_A,role:'receptionist',is_active:false},
    {user_id:USER_A,role:'owner',is_active:true},{user_id:USER_B,role:'administrator',is_active:true}]){
    const db=staffDb({membership})
    await assert.rejects(verifyStaffFromRls(db,USER_A),/Clinic staff access is not approved/)
    assert.equal(db.calls.includes('appointments'),false)
  }
})
test('anonymous, unconfirmed, wrong-account and missing Auth identities cannot reach membership query',async()=>{
  for(const authUser of [null,{...verified(USER_A),is_anonymous:true},
    {...verified(USER_A),email_confirmed_at:null},verified(USER_B)]){
    const db=staffDb({authUser})
    await assert.rejects(verifyStaffFromRls(db,USER_A),/Verified staff session required/)
    assert.deepEqual(db.calls,['getUser'])
  }
})
test('Auth and staff query errors reject, never imply staff access',async()=>{
  const db=staffDb({authError:{code:'invalid_token'}})
  await assert.rejects(verifyStaffFromRls(db,USER_A),/Verified staff session required/)
  await assert.rejects(verifyStaffFromRls(staffDb({memberError:{code:'42501'}}),USER_A),/Clinic staff access is not approved/)
  await assert.rejects(verifyStaffFromRls(staffDb(),'not-a-uuid'),/Verified staff identity required/)
})
function queueDb({data=[],error=null}={}) {
  const calls=[]
  const db={calls,from:table=>{calls.push(['from',table]);return {
    select:fields=>{calls.push(['select',fields]);return {
      gte:(col,val)=>{calls.push(['gte',col,val]);return {
        lt:(col2,val2)=>{calls.push(['lt',col2,val2]);return {
          order:(field,sort)=>{calls.push(['order',field,sort]);return {
            limit:async n=>{calls.push(['limit',n]);return {data,error}}
          }}
        }}
      }}
    }}
  }}}
  return db
}
const START='2032-01-02T00:00:00Z',END='2032-01-03T00:00:00Z'
const row={id:'visit1',pet_id:'pet1',owner_id:'owner1',resource_id:'room1',
  starts_at:START,ends_at:'2032-01-02T00:30:00Z',status:'confirmed',concern:'Synthetic followup'}
test('bounded UTC window is queried with a RLS-scoped SELECT and real rows',async()=>{
  const db=queueDb({data:[row]})
  assert.deepEqual(await queryClinicQueue(db,START,END),[row])
  assert.deepEqual(db.calls,[['from','appointments'],
    ['select','id,pet_id,owner_id,resource_id,starts_at,ends_at,status,concern'],
    ['gte','starts_at','2032-01-02T00:00:00.000Z'],
    ['lt','starts_at','2032-01-03T00:00:00.000Z'],
    ['order','starts_at',{ascending:true}],['limit',250]])
})
test('timezone guesses, malformed calendar dates and overlong windows are denied before reads',async()=>{
  for(const [from,to] of [
    ['2032-01-02T00:00:00+08:00',END],['2032-02-30T00:00:00Z',END],
    [START,START],[END,START],[START,'2032-01-04T00:00:00Z'],
    ['2032-01-02',END],['2032-01-02T00:00:00.0000Z',END]]) {
    const db=queueDb({data:[row]})
    await assert.rejects(queryClinicQueue(db,from,to),/Valid UTC clinic queue window required/)
    assert.deepEqual(db.calls,[])
  }
  assert.deepEqual(validateClinicUtcWindow(START,END),{from:'2032-01-02T00:00:00.000Z',to:'2032-01-03T00:00:00.000Z'})
})
test('empty queue is real; denied/malformed responses never become fake emptiness',async()=>{
  assert.deepEqual(await queryClinicQueue(queueDb(),START,END),[])
  const denied={code:'42501',message:'RLS denied'}
  await assert.rejects(queryClinicQueue(queueDb({error:denied}),START,END),e=>e===denied)
  for(const data of [null,[{}],[{...row,status:'in_consult'}]]) {
    await assert.rejects(queryClinicQueue(queueDb({data}),START,END),/Clinic queue response could not be verified/)
  }
})
function countsDb({counts=[0,2,3],errors=[null,null,null]}={}) {
  const calls=[];let appts=0
  return {calls,from:table=>{
    const index=table==='pets'?0:++appts
    calls.push([table,index]);return {select:(fields,opts)=>{
      assert.deepEqual(opts,{count:'exact',head:true});calls.push(['select',fields]);
      return {eq:async()=>({count:counts[index],error:errors[index]}),
        then(resolve){return Promise.resolve({count:counts[index],error:errors[index]}).then(resolve)}}
    }}
  }}
}
test('dashboard counts are real server counts and zero is valid',async()=>{
  const db=countsDb({counts:[0,2,3]})
  assert.deepEqual(await queryClinicDashboardCounts(db),{
    patients:0,requestedAppointments:2,confirmedAppointments:3
  })
  assert.equal(db.calls.filter(c=>c[0]==='pets').length,1)
})
test('unknown, malformed or denied counts fail closed, not zero',async()=>{
  for(const val of [null,undefined,-1,1.5,'7']) {
    await assert.rejects(queryClinicDashboardCounts(countsDb({counts:[val,2,3]})),/Clinic dashboard count unavailable/)
  }
  const denied={code:'42501',message:'permission denied'}
  await assert.rejects(queryClinicDashboardCounts(countsDb({errors:[null,denied,null]})),e=>e===denied)
})
