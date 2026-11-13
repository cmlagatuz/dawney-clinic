/**
 * Offline clinic scheduling contract: unapproved values fail closed.
 * Advisory only. Never enforces working hours in production until owner
 * approval + an additional reviewed SQL migration and live policy tests.
 */
const days=['sun','mon','tue','wed','thu','fri','sat'];
export const transitionMatrix=Object.freeze({
  requested:['confirmed','cancelled','no_show'],
  confirmed:['checked_in','cancelled','no_show'],
  checked_in:['completed'],
  completed:[],cancelled:[],no_show:[]
});
const format = /^([01]\d|2[0-3]):([0-5]\d)$/;
const isoDate=/^\d{4}-\d{2}-\d{2}$/;
const utcIso=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
function minute(value) {
 const match=typeof value==='string'?value.match(format):null;
 if(!match) throw Error('Invalid local HH:mm time');
 return Number(match[1])*60+Number(match[2]);
}
function dateOk(d) {
 if(typeof d!=='string'||!isoDate.test(d))return false;
 const date=new Date(d+'T00:00:00Z');
 return Number.isFinite(date.valueOf()) && date.toISOString().slice(0,10)===d;
}
function integer(value,min,max) {
 if(!Number.isSafeInteger(value)||value<min||value>max)throw Error('Invalid scheduling integer');
 return value;
}
function zoned(instant,timezone) {
 const parts=new Intl.DateTimeFormat('en-US',{
  timeZone:timezone,hourCycle:'h23',weekday:'short',year:'numeric',month:'2-digit',
  day:'2-digit',hour:'2-digit',minute:'2-digit'
 }).formatToParts(instant);
 const data=Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
 return {
  weekday:data.weekday.slice(0,3).toLowerCase(),
  day:data.year+'-'+data.month+'-'+data.day,
  minute:Number(data.hour)*60+Number(data.minute)
 };
}
export function validateClinicPolicy(policy) {
 if(!policy||typeof policy!=='object'||policy.approved!==true) {
  throw Error('Clinic scheduling policy is not owner-approved');
 }
 if(typeof policy.timezone!=='string'||policy.timezone.length>100)throw Error('Clinic timezone required');
 try {new Intl.DateTimeFormat('en-US',{timeZone:policy.timezone});}
 catch {throw Error('Invalid clinic IANA time zone');}
 integer(policy.leadMinutes,0,10080);
 integer(policy.maxAdvanceDays,1,365);
 integer(policy.slotStepMinutes,5,60);
 if(!Array.isArray(policy.durationsMinutes)||!policy.durationsMinutes.length||
    new Set(policy.durationsMinutes).size!==policy.durationsMinutes.length) {
  throw Error('Clinic booking durations required');
 }
 for(const d of policy.durationsMinutes) {
  integer(d,5,240);
  if(d%5!==0)throw Error('Duration increments must be five minutes');
 }
 if(!policy.hours||typeof policy.hours!=='object'||
    Object.keys(policy.hours).length!==7||!days.every(d=>Array.isArray(policy.hours[d]))) {
  throw Error('Exactly seven clinic weekday schedules required');
 }
 for(const day of days) {
  let endPrev=-1;
  for(const entry of policy.hours[day]) {
   if(!entry||typeof entry!=='object')throw Error('Invalid opening interval');
   const open=minute(entry.open),close=minute(entry.close);
   if(open>=close||open<endPrev)throw Error('Overlapping or overnight clinic opening intervals unsupported');
   endPrev=close;
  }
 }
 if(!Array.isArray(policy.holidays)||new Set(policy.holidays).size!==policy.holidays.length ||
    !policy.holidays.every(dateOk))throw Error('Invalid closed holiday dates');
 if(!Array.isArray(policy.resources)||!policy.resources.length)throw Error('Booking resources required');
 const ids=new Set();
 for(const r of policy.resources) {
  if(!r||typeof r.id!=='string'||!r.id.trim()||ids.has(r.id))throw Error('Invalid or duplicate resource ID');
  ids.add(r.id);
  // Existing Postgres exclusion constraint supports only 1 simultaneous booking.
  // Never accept >1 in an advisory config before capacity-aware database change.
  if(r.capacity!==1)throw Error('Resource capacity above one needs new database enforcement');
 }
 return policy;
}
export function mayTransition(from,to) {
 return Object.hasOwn(transitionMatrix,from)&&transitionMatrix[from].includes(to);
}
export function evaluateSlot(policy, request, now=new Date()) {
 validateClinicPolicy(policy);
 if(!request||!Number.isFinite(now.valueOf()))throw Error('Invalid slot request/current time');
 if(typeof request.startsAt!=='string'||!utcIso.test(request.startsAt))throw Error('UTC ISO slot required');
 const start=new Date(request.startsAt);
 if(!Number.isFinite(start.valueOf())||start.toISOString().slice(0,19)!==request.startsAt.slice(0,19)) {
  throw Error('Invalid UTC start');
 }
 if(!policy.resources.some(r=>r.id===request.resourceId))return {allowed:false,reason:'unknown_resource'};
 if(!policy.durationsMinutes.includes(request.durationMinutes))return {allowed:false,reason:'unsupported_duration'};
 const end=new Date(start.valueOf()+request.durationMinutes*60000);
 const diff=start.valueOf()-now.valueOf();
 if(diff<policy.leadMinutes*60000)return {allowed:false,reason:'lead_time'};
 if(diff>policy.maxAdvanceDays*86400000)return {allowed:false,reason:'booking_horizon'};
 const a=zoned(start,policy.timezone),b=zoned(end,policy.timezone);
 if(a.day!==b.day)return {allowed:false,reason:'crosses_local_day'};
 if(policy.holidays.includes(a.day))return {allowed:false,reason:'holiday'};
 if(a.minute%policy.slotStepMinutes!==0)return {allowed:false,reason:'unaligned_slot'};
 if(!policy.hours[a.weekday].some(({open,close})=>a.minute>=minute(open) && b.minute<=minute(close))) {
  return {allowed:false,reason:'outside_hours'};
 }
 return {allowed:true,reason:'within_configured_hours'};
}
