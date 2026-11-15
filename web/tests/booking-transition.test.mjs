import test from 'node:test'
import assert from 'node:assert/strict'
import {
 selectOwnerBookingPath,submitOwnerBookingTransition
} from '../src/booking-transition.mjs'
const PET='33333333-3333-4333-8333-333333333333'
const SERVICE='88888888-8888-4888-8888-888888888888'
const RESOURCE='55555555-5555-4555-8555-555555555555'
const NONCE='11111111-1111-4111-8111-111111111111'
const legacy={kind:'legacy',details:{petId:PET,resourceId:RESOURCE,startsAt:'2026-12-01T01:00:00Z',concern:'Annual check'}}
const service={kind:'service',booking:{petId:PET,serviceId:SERVICE,resourceId:RESOURCE,
 startsAtUtc:'2026-12-01T01:00:00Z',requestNonce:NONCE,concern:'Annual check'}}
const fakeRow={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',service_id:SERVICE,status:'requested'}
function handlers(state,log,legacyResult={status:'requested'},serviceResult=fakeRow){
 return {
  readPolicyState:async()=>{log.push('policy');return state},
  submitLegacy:async input=>{log.push(['legacy',input]);return legacyResult},
  submitService:async input=>{log.push(['rpc',input]);return serviceResult}
 }
}
test('old owner form still inserts unchanged legacy payload while policy is unapproved',async()=>{
 const log=[]
 assert.deepEqual(await submitOwnerBookingTransition(legacy,handlers('unapproved',log)),{status:'requested'})
 assert.deepEqual(log,['policy',['legacy',legacy.details]])
})
test('before migration, old form continues through the legacy adapter',async()=>{
 const log=[]
 await submitOwnerBookingTransition(legacy,handlers('not_installed',log))
 assert.deepEqual(log,['policy',['legacy',legacy.details]])
})
test('approved policy blocks service-less direct insert before any write',async()=>{
 const log=[]
 await assert.rejects(submitOwnerBookingTransition(legacy,handlers('approved',log)),/requires an approved service/)
 assert.deepEqual(log,['policy'])
})
test('no service request can downgrade to legacy, including with nonce hidden in details',()=>{
 for(const data of [
  {...legacy.details,serviceId:SERVICE},
  {...legacy.details,service_id:SERVICE},
  {...legacy.details,requestNonce:NONCE},
  {...legacy.details,request_nonce:NONCE}
 ])assert.throws(()=>selectOwnerBookingPath('unapproved',{kind:'legacy',details:data}),/cannot use the legacy/)
})
test('approved service-aware flow calls RPC exactly once with stable nonce and requested status',async()=>{
 const log=[]
 const saved=await submitOwnerBookingTransition(service,handlers('approved',log))
 assert.deepEqual(saved,fakeRow)
 assert.deepEqual(log,['policy',['rpc',service.booking]])
 assert.equal(log[1][1].requestNonce,NONCE)
})
test('service flow never silently falls back while clinic hours are unapproved or missing',async()=>{
 for(const state of ['unapproved','not_installed']){
  const log=[]
  await assert.rejects(submitOwnerBookingTransition(service,handlers(state,log)),/unavailable until scheduling is approved/)
  assert.deepEqual(log,['policy'])
 }
})
test('network, auth or permission errors stop submissions without a fallback',async()=>{
 for(const request of [legacy,service]){
  let writes=0
  await assert.rejects(submitOwnerBookingTransition(request,{
   readPolicyState:async()=>{throw Object.assign(new Error('permission or network denied'),{code:'42501'})},
   submitLegacy:async()=>{writes++},
   submitService:async()=>{writes++}
  }),/denied/)
  assert.equal(writes,0)
 }
})
test('approved request validates UUIDs, UTC time and concern before any write',async()=>{
 for(const bad of [
  {...service,booking:{...service.booking,petId:'other-owner'}},
  {...service,booking:{...service.booking,requestNonce:''}},
  {...service,booking:{...service.booking,startsAtUtc:'2026-12-01T09:00:00+08:00'}},
  {...service,booking:{...service.booking,concern:''}}
 ]){
  const log=[]
  await assert.rejects(submitOwnerBookingTransition(bad,handlers('approved',log)))
  assert.deepEqual(log,['policy'])
 }
})
test('RPC conflict or Auth denial is propagated without legacy fallback',async()=>{
 for(const code of ['23P01','42501']){
  const log=[]
  const error=Object.assign(new Error('RPC rejected'),{code})
  await assert.rejects(submitOwnerBookingTransition(service,{
   ...handlers('approved',log),
   submitService:async()=>{log.push('rpc');throw error}
  }),e=>e===error)
  assert.deepEqual(log,['policy','rpc'])
 }
})
test('exact retry preserves nonce and real later staff-confirmed status',async()=>{
 const log=[]
 const status={...fakeRow,status:'confirmed'}
 const adapter=handlers('approved',log,undefined,status)
 const first=await submitOwnerBookingTransition(service,adapter)
 const second=await submitOwnerBookingTransition(service,adapter)
 assert.equal(first.status,'confirmed')
 assert.equal(second.id,first.id)
 assert.deepEqual(log,['policy',['rpc',service.booking],'policy',['rpc',service.booking]])
})
test('if policy approval changes during a legacy insert, PostgreSQL refusal propagates',async()=>{
 const error=Object.assign(new Error('Select an approved service to request a clinic appointment'),{code:'23514'})
 const log=[]
 await assert.rejects(submitOwnerBookingTransition(legacy,{
  ...handlers('unapproved',log),
  submitLegacy:async()=>{log.push('server denied');throw error}
 }),e=>e===error)
 assert.deepEqual(log,['policy','server denied'])
})
