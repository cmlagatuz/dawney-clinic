import {validUtcInstant} from './booking-contract.mjs'

// A service-less booking is allowed only during the unapproved/missing-schema
// rollout window; PostgreSQL's insert trigger is the final authority.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const isId=value=>typeof value==='string'&&uuid.test(value)
const has= (obj,key)=>Object.prototype.hasOwnProperty.call(obj,key)

export function selectOwnerBookingPath(policyState,request){
 if(!request||typeof request!=='object')throw Error('Choose a booking request')
 if(request.kind==='legacy'){
  if(!request.details||typeof request.details!=='object')throw Error('Legacy appointment details are required')
  // Never downgrade a service-aware request (or nonce) into a legacy insert.
  if(['serviceId','service_id','requestNonce','request_nonce'].some(k=>has(request.details,k)))
   throw Error('Service-aware bookings cannot use the legacy appointment insert')
  if(policyState==='approved')
   throw Error('Clinic scheduling now requires an approved service; use service-aware booking')
  if(policyState==='unapproved'||policyState==='not_installed')return 'legacy'
  throw Error('Cannot verify clinic booking policy; appointment not submitted')
 }
 if(request.kind==='service'){
  const p=request.booking
  if(!p||typeof p!=='object'||![p.petId,p.serviceId,p.resourceId,p.requestNonce].every(isId))
   throw Error('Service booking requires patient, service, resource and stable request token')
  if(!validUtcInstant(p.startsAtUtc))throw Error('Service booking requires an explicit UTC time')
  if(typeof p.concern!=='string'||!p.concern.trim()||p.concern.length>300
    ||(p.details!=null&&(typeof p.details!=='string'||p.details.length>3000)))
   throw Error('Invalid service booking reason/details')
  if(policyState==='approved')return 'rpc'
  if(policyState==='unapproved'||policyState==='not_installed')
   throw Error('Clinic service booking remains unavailable until scheduling is approved')
  throw Error('Cannot verify clinic booking policy; appointment not submitted')
 }
 throw Error('Unknown appointment request mode')
}

// No automatic legacy fallback on an RPC/network/auth/conflict failure.
// Policy mode is advisory: the database RLS/trigger/RPC still enforce approval.
export async function submitOwnerBookingTransition(request,adapters){
 if(!adapters||typeof adapters.readPolicyState!=='function'
   ||typeof adapters.submitLegacy!=='function'||typeof adapters.submitService!=='function')
  throw Error('Booking transition adapters are required')
 const policyState=await adapters.readPolicyState()
 const path=selectOwnerBookingPath(policyState,request)
 return path==='legacy'
  ? adapters.submitLegacy(request.details)
  : adapters.submitService(request.booking)
}
