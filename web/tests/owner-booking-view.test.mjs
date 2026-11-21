import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {DB_REQUIRES_SERVICE,POLICY_CHANGED,POLICY_FLIPPED_MESSAGE,failureText,isPolicyFlip,ownerFormView} from '../src/public-site/booking-mode.mjs'
import {friendlyBookingError} from '../src/clinical.mjs'
import {submitOwnerBookingTransition} from '../src/booking-transition.mjs'

const MODES=['legacy','service','no-services','incomplete','unknown','weird',undefined,null,'']
const base={loading:false,hasPets:true,hasSchedule:true,hasUser:true,resourceCount:1}

test('the service-less form renders ONLY for settled legacy mode; no approved/unknown state falls through to it',()=>{
 for(const mode of MODES)for(const loading of [true,false])for(const hasPets of [true,false])for(const hasSchedule of [true,false])for(const hasUser of [true,false])for(const resourceCount of [0,1,3]){
  const v=ownerFormView({mode,loading,hasPets,hasSchedule,hasUser,resourceCount})
  const expectLegacy=mode==='legacy'&&!loading&&hasPets&&resourceCount>0
  assert.equal(v==='legacy',expectLegacy,JSON.stringify({mode,loading,hasPets,hasSchedule,hasUser,resourceCount,v}))
 }
 for(const approved of ['service','no-services','incomplete'])
  assert.notEqual(ownerFormView({...base,mode:approved}),'legacy',approved)
 assert.equal(ownerFormView({...base,mode:'service'}),'service')
 assert.equal(ownerFormView({...base,mode:'service',hasSchedule:false}),'unknown','inconsistent approved state fails closed, not to legacy')
 assert.equal(ownerFormView({...base,mode:'service',hasUser:false}),'unknown')
 assert.equal(ownerFormView({...base,mode:'no-services'}),'paused');assert.equal(ownerFormView({...base,mode:'incomplete'}),'paused')
 assert.equal(ownerFormView({...base,mode:'legacy'}),'legacy');assert.equal(ownerFormView({...base,mode:'legacy',resourceCount:0}),'no-calendar')
 assert.equal(ownerFormView({...base,mode:'legacy',loading:true}),'checking','a reload hides the old form immediately')
 assert.equal(ownerFormView({...base,mode:'unknown'}),'unknown')
})

test('REPRODUCTION of the old failure: the DB trigger rejection of a service-less insert was shown as a generic conflict and never switched the form',()=>{
 const dbError={code:'23514',message:'Select an approved service to request a clinic appointment'} // PostgREST plain object, not an Error
 // old handler: Error-only text, only adapter prefixes recognised
 const oldText=dbError instanceof Error?dbError.message:''
 assert.equal(POLICY_CHANGED.test(oldText),false,'old code never reloaded the booking mode')
 assert.match(friendlyBookingError(dbError.code),/conflicts with clinic scheduling rules/,'old user message was misleading')
 // new handler
 assert.equal(isPolicyFlip(dbError),true)
 assert.equal(isPolicyFlip(Object.assign(new Error(dbError.message),{code:'23514'})),true)
 assert.equal(failureText(dbError),dbError.message)
 assert.ok(DB_REQUIRES_SERVICE.test(dbError.message))
 assert.match(POLICY_FLIPPED_MESSAGE,/Nothing was booked/);assert.ok(!/confirmed/i.test(POLICY_FLIPPED_MESSAGE))
})

test('policy-flip detection is narrow: conflicts, permissions, network and unrelated errors do not trigger it',()=>{
 for(const e of [{code:'23P01',message:'conflicting key value violates exclusion constraint'},{code:'42501',message:'permission denied'},new TypeError('Failed to fetch'),null,undefined,{},'text',42,{message:'Registered patient taxonomy is required'}])
  assert.equal(isPolicyFlip(e),false,String(JSON.stringify(e)))
 for(const m of ['Clinic scheduling now requires an approved service; use service-aware booking','Clinic service booking remains unavailable until scheduling is approved'])assert.equal(isPolicyFlip(new Error(m)),true)
})

test('approved policy can never fall back to the legacy insert through the real transition adapter',async()=>{
 const legacy={petId:'11111111-1111-4111-8111-111111111111',resourceId:'55555555-5555-4555-8555-555555555555',startsAt:'2030-01-01T10:00',concern:'x'}
 const calls=[]
 const adapters=policy=>({readPolicyState:async()=>{if(policy instanceof Error)throw policy;return policy},submitLegacy:async d=>{calls.push('legacy');return d},submitService:async b=>{calls.push('service');return b}})
 // stale open form after the owner approves: adapter re-reads policy and refuses
 await assert.rejects(submitOwnerBookingTransition({kind:'legacy',details:legacy},adapters('approved')),e=>isPolicyFlip(e))
 // policy unreadable (auth/network/RLS): refuse, never guess
 for(const err of [new Error('permission denied'),new TypeError('Failed to fetch')])await assert.rejects(submitOwnerBookingTransition({kind:'legacy',details:legacy},adapters(err)))
 assert.deepEqual(calls,[],'legacy insert never invoked when approved or unverifiable')
 // race: policy read says unapproved, DB then rejects the insert -> error surfaces once, no retry, no service fallback
 let n=0
 const racing={readPolicyState:async()=>'unapproved',submitLegacy:async()=>{n++;throw {code:'23514',message:'Select an approved service to request a clinic appointment'}},submitService:async()=>{calls.push('service')}}
 await assert.rejects(submitOwnerBookingTransition({kind:'legacy',details:legacy},racing),e=>isPolicyFlip(e))
 assert.equal(n,1);assert.deepEqual(calls,[])
 // a service request in unapproved mode never becomes a legacy insert either
 await assert.rejects(submitOwnerBookingTransition({kind:'service',booking:{petId:legacy.petId,serviceId:'88888888-8888-4888-8888-888888888888',resourceId:legacy.resourceId,requestNonce:'77777777-7777-4777-8777-777777777777',startsAtUtc:'2030-01-01T02:00:00Z',concern:'x'}},adapters('unapproved')),/unavailable until scheduling is approved/)
 assert.deepEqual(calls,[])
})

test('both branch booking routes gate the forms on the approved reader and have no legacy submit path', () => {
  const src = name => readFileSync(new URL('../src/' + name, import.meta.url), 'utf8')
  const pages = ['pages/AppointmentsPage.tsx', 'pages/public/BookPage.tsx']
  for (const page of pages) {
    assert.match(src(page), /useBranchBooking\(\)/)
    assert.match(src(page), /options\.kind [!=]== 'ready'/)
  }
  for (const path of [...pages, 'components/ServiceBookingForm.tsx', 'public-site/useBookingRequest.ts', 'public-site/useBranchBooking.ts']) {
    assert.doesNotMatch(src(path), /bookAppointment|submitOwnerAppointment|listPublishedServiceResources|readApprovedPublicSchedule|\.insert\(/, path)
  }
  assert.match(src('public-site/useBookingRequest.ts'), /await requestAuthenticatedServiceBooking/)
  assert.match(src('public-site/useBranchBooking.ts'), /await readApprovedBranchBookingConfig\(branchId\)/)
})
