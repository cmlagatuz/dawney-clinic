// Phase 5A staff Operations: pure, deterministic display model. No data access, no auth, no network.
// Every number derives from rows a successful, verified-staff read returned. Nothing here invents
// clinic hours, providers, visit counts, bookings, or an `in_consult` persisted status.
import {clinicSlotToUtc,utcToClinicSlot} from '../booking-contract.mjs'

export const OPS_TIME_ZONE='Asia/Manila'
export const OPS_VISIBLE_LIMIT=250
export const OPS_ROLES=Object.freeze(['administrator','veterinarian','receptionist'])
export const OPS_STATUSES=Object.freeze(['requested','confirmed','checked_in','completed','cancelled','no_show'])
const statusSet=new Set(OPS_STATUSES)
const dateRe=/^\d{4}-\d{2}-\d{2}$/

/** Lanes use ONLY persisted appointment statuses. `consult` is a labelled gap, never a data lane. */
export const FLOW_LANES=Object.freeze([
 {key:'expected',label:'Expected',statuses:['requested','confirmed'],persisted:true,
  hint:'Requested or confirmed, not yet checked in.'},
 {key:'checked_in',label:'Checked in',statuses:['checked_in'],persisted:true,
  hint:'Checked in. Waiting and with-veterinarian are not distinguished by the database.'},
 {key:'consult',label:'With veterinarian',statuses:[],persisted:false,
  hint:'Not recorded yet. A clinician-approved encounter model and audit trail are required first.'},
 {key:'completed',label:'Visit complete',statuses:['completed'],persisted:true,
  hint:'Marked completed.'},
])
export const CLOSED_STATUSES=Object.freeze(['cancelled','no_show'])

export function isIsoDate(v){
 if(typeof v!=='string'||!dateRe.test(v))return false
 const d=new Date(v+'T00:00:00Z')
 return Number.isFinite(d.valueOf())&&d.toISOString().slice(0,10)===v
}
export function addDays(date,n){
 if(!isIsoDate(date)||!Number.isInteger(n))throw Error('Valid date required')
 const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)
}
export function todayInZone(nowMs,timezone=OPS_TIME_ZONE){
 return utcToClinicSlot(new Date(nowMs).toISOString().replace(/\.\d{3}Z$/,'Z'),timezone).date
}
/** Monday-start week containing `date`. */
export function weekDates(date){
 if(!isIsoDate(date))throw Error('Valid date required')
 const dow=new Date(date+'T00:00:00Z').getUTCDay()
 const monday=addDays(date,-((dow+6)%7))
 return Array.from({length:7},(_,i)=>addDays(monday,i))
}
/** One clinic-local calendar day as a half-open UTC window (<=24h, per the #59 contract). */
export function dayWindow(date,timezone=OPS_TIME_ZONE){
 if(!isIsoDate(date))throw Error('Valid date required')
 return {fromUtc:clinicSlotToUtc(date,'00:00',timezone),toUtc:clinicSlotToUtc(addDays(date,1),'00:00',timezone)}
}

export const OPS_RANGES=Object.freeze([
 {key:'all',label:'Whole day',from:'00:00',to:null},
 {key:'night',label:'00:00–06:00',from:'00:00',to:'06:00'},
 {key:'morning',label:'06:00–12:00',from:'06:00',to:'12:00'},
 {key:'afternoon',label:'12:00–18:00',from:'12:00',to:'18:00'},
 {key:'evening',label:'18:00–24:00',from:'18:00',to:null},
])
/** Narrower clinic-local window inside one day, for when hasMore=true says the read was incomplete. */
export function rangeWindow(date,rangeKey='all',timezone=OPS_TIME_ZONE){
 const r=OPS_RANGES.find(x=>x.key===rangeKey)
 if(!r)throw Error('Unknown time range')
 if(!isIsoDate(date))throw Error('Valid date required')
 return {fromUtc:clinicSlotToUtc(date,r.from,timezone),
  toUtc:r.to?clinicSlotToUtc(date,r.to,timezone):clinicSlotToUtc(addDays(date,1),'00:00',timezone)}
}

function validRow(r){
 if(!r||typeof r!=='object')return false
 for(const k of ['id','pet_id','owner_id','resource_id','concern'])if(typeof r[k]!=='string'||!r[k].trim())return false
 if(!statusSet.has(r.status))return false
 if(typeof r.starts_at!=='string'||typeof r.ends_at!=='string')return false
 const s=Date.parse(r.starts_at),e=Date.parse(r.ends_at)
 return Number.isFinite(s)&&Number.isFinite(e)&&e>s
}
/** Fail closed on anything that is not the typed {items,hasMore} window; never treat it as empty. */
export function validateWindow(result){
 if(!result||typeof result!=='object'||!Array.isArray(result.items)||typeof result.hasMore!=='boolean')
  throw Error('Malformed staff queue response')
 if(result.items.length>OPS_VISIBLE_LIMIT)throw Error('Malformed staff queue response')
 if(!result.items.every(validRow))throw Error('Malformed staff queue response')
 return {items:[...result.items].sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at)||a.id.localeCompare(b.id)),hasMore:result.hasMore}
}
export function validateCounts(c){
 for(const k of ['patients','requestedAppointments','confirmedAppointments'])
  if(!c||!Number.isSafeInteger(c[k])||c[k]<0)throw Error('Malformed dashboard counts')
 return {patients:c.patients,requestedAppointments:c.requestedAppointments,confirmedAppointments:c.confirmedAppointments}
}

/** 'empty' only for a successful, complete, zero-row read. hasMore=true is NEVER complete. */
export function windowState(win){
 if(win.hasMore)return 'incomplete'
 return win.items.length===0?'empty':'ready'
}

export function buildFlow(items){
 const lanes=FLOW_LANES.map(l=>({...l,items:items.filter(i=>l.statuses.includes(i.status))}))
 return {lanes,closed:items.filter(i=>CLOSED_STATUSES.includes(i.status))}
}

/**
 * KPI display contracts. state: 'value' | 'atLeast' | 'unavailable' | 'loading'.
 * A derived count over an incomplete window is a lower bound; nothing is fabricated.
 */
export function buildKpis({win,counts}){
 const incomplete=Boolean(win&&win.hasMore)
 const fromWin=(key,label,pick,note)=>{
  if(!win)return {key,label,state:'unavailable',value:null,note:'Queue could not be read.'}
  const n=win.items.filter(pick).length
  return {key,label,state:incomplete?'atLeast':'value',value:n,note:incomplete?'Window incomplete: at least this many.':note}
 }
 const fromCounts=(key,label,field,note)=>{
  if(!counts)return {key,label,state:'unavailable',value:null,note:'Counts could not be read.'}
  return {key,label,state:'value',value:counts[field],note}
 }
 return [
  fromWin('visits','Appointments in view',()=>true,'Rows in the selected window.'),
  fromWin('checked_in','Checked in',i=>i.status==='checked_in','In the selected window.'),
  fromWin('completed','Completed',i=>i.status==='completed','In the selected window.'),
  fromWin('no_show','No-shows',i=>i.status==='no_show','Persisted no-show status, selected window.'),
  {key:'waiting',label:'Average waiting time',state:'unavailable',value:null,note:'Not recorded: no check-in time is stored.'},
  {key:'rooms',label:'Room occupancy',state:'unavailable',value:null,note:'Not tracked: no room occupancy model.'},
  fromCounts('patients','Registered patients','patients','All dates.'),
  fromCounts('requested_all','Requested (all dates)','requestedAppointments','All dates, not just this view.'),
  fromCounts('confirmed_all','Confirmed (all dates)','confirmedAppointments','All dates, not just this view.'),
 ]
}

/** Map any thrown read error to a UI state without leaking raw backend text. */
export function classifyOpsError(err){
 const m=String(err&&typeof err==='object'&&'message' in err?err.message:err??'').toLowerCase()
 const code=String(err&&typeof err==='object'&&'code' in err?err.code:'')
 if(/not integrated/.test(m))return 'unavailable'
 if(/staff session required|identity required|staff access is not approved|permission denied|not authori|jwt|forbidden|row-level security/.test(m)||
    code==='42501'||code==='401'||code==='403'||code==='PGRST301')return 'denied'
 if(/failed to fetch|networkerror|network request|load failed|offline|timeout|timed out|fetch/.test(m))return 'network'
 return 'error'
}

export function formatClinicTime(iso,timezone=OPS_TIME_ZONE){
 const s=utcToClinicSlot(new Date(iso).toISOString().replace(/\.\d{3}Z$/,'Z'),timezone)
 const h=Number(s.time.slice(0,2)),m=s.time.slice(3)
 return `${((h+11)%12)+1}:${m} ${h<12?'AM':'PM'}`
}
export function durationMinutes(a,b){return Math.round((Date.parse(b)-Date.parse(a))/60000)}
/** Real IDs only, abbreviated for display; names are not part of the #59 read contract. */
export function shortRef(id){return typeof id==='string'?id.replace(/-/g,'').slice(0,6).toUpperCase():'------'}
export function formatDayLabel(date){
 const d=new Date(date+'T00:00:00Z')
 return d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'})
}
export function groupByResource(items){
 const m=new Map();for(const i of items){(m.get(i.resource_id)??m.set(i.resource_id,[]).get(i.resource_id)).push(i)}
 return [...m.entries()].map(([id,rows])=>({id,rows})).sort((a,b)=>a.id.localeCompare(b.id))
}
