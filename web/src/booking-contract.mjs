/**
 * Public booking intent is intentionally PII-free; never persist names,
 * symptoms, patient IDs, access tokens or contact details before authentication.
 */
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const key='dawney.publicBookingIntent.v1'
const ttlMs=30*60*1000
export const BOOKING_RETURN_PATH='/book'
export function validUtcInstant(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value))return false
 const date=new Date(value)
 return Number.isFinite(date.valueOf())&&date.toISOString().slice(0,19)===value.slice(0,19)
}
export function validateBookingIntent(value){
 if(!value||typeof value!=='object'||typeof value.serviceId!=='string'||
    !uuid.test(value.serviceId))throw Error('A published service is required')
 if(value.resourceId!=null&&(typeof value.resourceId!=='string'||
    !uuid.test(value.resourceId)))throw Error('Invalid resource')
 if(value.startsAtUtc!=null&&!validUtcInstant(value.startsAtUtc))throw Error('Invalid UTC slot')
 if(value.startsAtUtc!=null&&!value.resourceId)throw Error('Resource required for selected slot')
 return {serviceId:value.serviceId.toLowerCase(),
  ...(value.resourceId?{resourceId:value.resourceId.toLowerCase()}:{}),
  ...(value.startsAtUtc?{startsAtUtc:value.startsAtUtc}:{})}
}
/** Normalize accepted UUIDs to PostgreSQL's lowercase canonical representation.
 * This is input normalization, never an authorization decision. */
export function normalizeBookingRequestIds(value){
 const fields=['petId','serviceId','resourceId','requestNonce']
 if(!value||typeof value!=='object'||fields.some(k=>
   typeof value[k]!=='string'||!uuid.test(value[k])))
  throw Error('A valid patient, service, resource and retry token are required')
 return Object.fromEntries(fields.map(k=>[k,value[k].toLowerCase()]))
}
export function persistedBookingIdsMatch(row,ids){
 return !!row&&!!ids&&
  [['pet_id','petId'],['service_id','serviceId'],['resource_id','resourceId']]
   .every(([col,input])=>typeof row[col]==='string'&&
    typeof ids[input]==='string'&&uuid.test(row[col])&&
    row[col].toLowerCase()===ids[input].toLowerCase())
}
export function saveBookingIntent(sessionStore,input,nowMs=Date.now()){
 if(!sessionStore||!Number.isSafeInteger(nowMs)||nowMs<0)throw Error('Invalid session store or clock')
 const v=validateBookingIntent(input)
 sessionStore.setItem(key,JSON.stringify({v:1,expiresAt:nowMs+ttlMs,...v}))
 return BOOKING_RETURN_PATH
}
export function readBookingIntent(sessionStore,nowMs=Date.now()){
 if(!sessionStore)return null
 let value
 try{value=JSON.parse(sessionStore.getItem(key)||'null')}catch{sessionStore.removeItem(key);return null}
 if(value===null)return null
 if(value.v!==1||!Number.isSafeInteger(value.expiresAt)||nowMs>value.expiresAt){
  sessionStore.removeItem(key);return null
 }
 try{return validateBookingIntent(value)}catch{sessionStore.removeItem(key);return null}
}
export function clearBookingIntent(sessionStore){sessionStore?.removeItem(key)}
export function signinForBooking(mode='signin'){
 if(!['signin','signup'].includes(mode))throw Error('Invalid login mode')
 return '/auth/'+mode+'?next=%2Fbook'
}
export function safeBookingReturnPath(untrusted){
 return untrusted===BOOKING_RETURN_PATH?BOOKING_RETURN_PATH:'/app/profile'
}
/**
 * Decide where an auth screen returns to. Only the exact allowlisted hint
 * '/book' (or a still-valid stored intent in THIS tab) selects the booking page;
 * everything else, including malformed/array/forged values, falls back to the
 * owner overview. `needsReselect` is true when the hint arrived without the
 * short-lived intent (e.g. email verification opened in a fresh tab).
 */
export function resolveAfterAuth(nextParam,storedIntent){
 const hint=typeof nextParam==='string'&&safeBookingReturnPath(nextParam)===BOOKING_RETURN_PATH
 const toBook=hint||Boolean(storedIntent)
 return {toBook,needsReselect:toBook&&!storedIntent,
  dest:toBook?BOOKING_RETURN_PATH:'/app/overview',suffix:toBook?'?next=%2Fbook':''}
}
/** Email-verification redirect: fixed path plus, at most, the constant '?next=/book' hint. Never any user data. */
export function authCallbackUrl(origin,toBook){
 if(typeof origin!=='string'||!/^https?:\/\/[^/?#\s]+$/.test(origin))throw Error('Valid origin required')
 return origin+'/auth/callback'+(toBook?'?next=%2Fbook':'')
}
function formatParts(date,zone){
 const parts=new Intl.DateTimeFormat('en-US',{
  timeZone:zone,hourCycle:'h23',year:'numeric',month:'2-digit',
  day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'
 }).formatToParts(date)
 return Object.fromEntries(parts.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]))
}
export function clinicSlotToUtc(date,time,timezone){
 if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||
    typeof time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error('Valid clinic-local date and time required')
 if(typeof timezone!=='string'||!timezone.trim())throw Error('Approved IANA timezone required')
 const target=date+'T'+time+':00'
 // Seek all possible offsets, never guess at nonexistent/ambiguous DST wall times.
 const match=new Set()
 const base=Date.parse(target+'Z')
 if(!Number.isFinite(base)||new Date(base).toISOString().slice(0,10)!==date)throw Error('Invalid date')
 for(let offset=-14*60;offset<=14*60;offset+=15){
  const instant=new Date(base-offset*60000)
  const p=formatParts(instant,timezone)
  if(p.year+'-'+p.month+'-'+p.day+'T'+p.hour+':'+p.minute+':'+p.second===target)
   match.add(instant.toISOString())
 }
 if(match.size!==1)throw Error('Ambiguous or nonexistent clinic-local time')
 return [...match][0]
}
export function utcToClinicSlot(utcIso,timezone){
 if(!validUtcInstant(utcIso))throw Error('Explicit UTC instant required')
 const p=formatParts(new Date(utcIso),timezone)
 return {date:p.year+'-'+p.month+'-'+p.day,time:p.hour+':'+p.minute,timezone}
}
