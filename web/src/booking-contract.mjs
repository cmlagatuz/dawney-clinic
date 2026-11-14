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
 if(!value||typeof value!=='object'||!uuid.test(value.serviceId))throw Error('A published service is required')
 if(value.resourceId!=null&&!uuid.test(value.resourceId))throw Error('Invalid resource')
 if(value.startsAtUtc!=null&&!validUtcInstant(value.startsAtUtc))throw Error('Invalid UTC slot')
 if(value.startsAtUtc!=null&&!value.resourceId)throw Error('Resource required for selected slot')
 return {serviceId:value.serviceId,
  ...(value.resourceId?{resourceId:value.resourceId}:{}),
  ...(value.startsAtUtc?{startsAtUtc:value.startsAtUtc}:{})}
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
