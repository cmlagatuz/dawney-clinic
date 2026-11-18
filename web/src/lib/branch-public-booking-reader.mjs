// ASTRA Issue #51 — read-only public branch booking discovery.
// No global clinic_booking_policy fallback; no auth grants or booking mutations.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DAYS=['sun','mon','tue','wed','thu','fri','sat']
const CLOCK=/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/
const DATE=/^\d{4}-\d{2}-\d{2}$/
const TABLES=new Set(['clinic_branches','branch_booking_policies','clinic_services',
 'clinic_service_resources','appointment_resources'])
export const BRANCH_BOOKING_READ_STATUSES=Object.freeze([
 'missing_contract','unapproved_branch','unavailable','backend_error','ready'
])
const unavailable=(reason)=>({kind:'unavailable',reason})
const backendError=()=>({kind:'backend_error'})
const missing=(table)=>({kind:'missing_contract',table})
function id(value){return typeof value==='string'&&UUID.test(value)?value.toLowerCase():null}
function isMissingSchema(error,table){
 return Boolean(error&&TABLES.has(table)&&
   ['PGRST205','42P01','42703','PGRST204'].includes(error.code)&&
   typeof error.message==='string'&&error.message.includes(table))
}
function check(result,table){
 if(!result||typeof result!=='object')return {kind:'backend_error'}
 if(result.error)return isMissingSchema(result.error,table)?missing(table):backendError()
 if(!Object.hasOwn(result,'data')||result.data===undefined)return backendError()
 return null
}
const safeDate=s=>typeof s==='string'&&DATE.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&
  new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s
function usableSchedule(p,branch){
 if(!p||p.branch_id!==branch||p.is_approved!==true||
  typeof p.timezone!=='string'||p.timezone.length>80||
  !Number.isInteger(p.lead_minutes)||p.lead_minutes<0||p.lead_minutes>10080||
  !Number.isInteger(p.max_advance_days)||p.max_advance_days<1||p.max_advance_days>365||
  !Number.isInteger(p.slot_step_minutes)||p.slot_step_minutes<5||p.slot_step_minutes>60||
  !Number.isInteger(p.revision)||p.revision<1||
  !Array.isArray(p.holidays)||p.holidays.some(h=>!safeDate(h))||
  !p.weekly_hours||typeof p.weekly_hours!=='object'||Array.isArray(p.weekly_hours))return false
 try{new Intl.DateTimeFormat('en-PH',{timeZone:p.timezone})}catch{return false}
 let hasOpen=false
 for(const day of DAYS){
  const intervals=p.weekly_hours[day]
  if(!Array.isArray(intervals))return false
  let lastClose=-1
  for(const range of intervals){
   if(!range||typeof range!=='object'||!CLOCK.test(range.open)||!CLOCK.test(range.close))
    return false
   const toM=t=>Number(t.slice(0,2))*60+Number(t.slice(3,5))
   const start=toM(range.open),end=toM(range.close)
   if(start>=end||start<lastClose)return false
   lastClose=end;hasOpen=true
  }
 }
 return hasOpen
}
function validService(s,branch){
 return s&&s.branch_id===branch&&id(s.id)===s.id&&
  typeof s.slug==='string'&&/^[a-z][a-z0-9-]{1,79}$/.test(s.slug)&&
  typeof s.display_name==='string'&&s.display_name.trim().length>=2&&
  (s.summary===null||typeof s.summary==='string')&&
  Number.isInteger(s.duration_minutes)&&s.duration_minutes>=5&&
  s.duration_minutes<=240&&s.duration_minutes%5===0&&
  typeof s.published_at==='string'&&Number.isFinite(Date.parse(s.published_at))
}
function validLink(r,serviceIds){
 return r&&serviceIds.has(r.service_id)&&id(r.resource_id)===r.resource_id&&
  r.capacity===1&&(r.public_label===null||
   (typeof r.public_label==='string'&&r.public_label.trim().length>=2))
}
function validResource(r,branch,allowed){
 return r&&allowed.has(r.id)&&id(r.id)===r.id&&r.branch_id===branch&&r.is_active===true
}
/** Only approved rows returned by the database count. A caller-supplied branch
 * is a FILTER, never authorization. The unchanged authenticated RPC validates
 * the true owner, pet, service, resource, nonce and requested status at write. */
export async function readBranchPublicBooking(db,selectedBranchId){
 const branch=id(selectedBranchId)
 if(!branch)return {kind:'unapproved_branch'}
 if(!db||typeof db.from!=='function')return backendError()
 try{
  const br=await db.from('clinic_branches').select('id,booking_enabled')
   .eq('id',branch).maybeSingle()
  const brFailure=check(br,'clinic_branches')
  if(brFailure)return brFailure
  if(br.data===null||br.data?.id!==branch||br.data.booking_enabled!==true)
   return {kind:'unapproved_branch'}
  const p=await db.from('branch_booking_policies')
   .select('branch_id,timezone,weekly_hours,holidays,lead_minutes,max_advance_days,slot_step_minutes,is_approved,revision')
   .eq('branch_id',branch).maybeSingle()
  const pFailure=check(p,'branch_booking_policies')
  if(pFailure)return pFailure
  // RLS hides unapproved policies; NULL NEVER implies a legacy booking path.
  if(p.data===null||p.data?.is_approved!==true||p.data?.branch_id!==branch)
   return {kind:'unapproved_branch'}
  if(!usableSchedule(p.data,branch))return unavailable('invalid_schedule')
  const s=await db.from('clinic_services')
   .select('id,branch_id,slug,display_name,summary,duration_minutes,published_at')
   .eq('branch_id',branch).order('display_name',{ascending:true})
  const sFailure=check(s,'clinic_services')
  if(sFailure)return sFailure
  if(!Array.isArray(s.data))return backendError()
  if(s.data.some(row=>!validService(row,branch)))return backendError()
  if(s.data.length===0)return unavailable('services')
  const serviceIds=new Set(s.data.map(x=>x.id))
  const l=await db.from('clinic_service_resources')
   .select('service_id,resource_id,public_label,capacity')
   .in('service_id',[...serviceIds])
  const lFailure=check(l,'clinic_service_resources')
  if(lFailure)return l.error?.code==='42501'
    ?unavailable('eligible_resources_not_visible'):lFailure
  if(!Array.isArray(l.data))return backendError()
  if(l.data.some(r=>!validLink(r,serviceIds)))return backendError()
  if(l.data.length===0)return unavailable('eligible_resources_not_visible')
  const resourceIds=new Set(l.data.map(r=>r.resource_id))
  const resources=await db.from('appointment_resources')
   .select('id,branch_id,is_active').eq('branch_id',branch)
   .eq('is_active',true).in('id',[...resourceIds])
  const resourceFailure=check(resources,'appointment_resources')
  if(resourceFailure)return resources.error?.code==='42501'
    ?unavailable('eligible_resources_not_visible'):resourceFailure
  if(!Array.isArray(resources.data))return backendError()
  if(resources.data.some(r=>!validResource(r,branch,resourceIds)))return backendError()
  const eligible=new Set(resources.data.map(r=>r.id))
  const grouped=s.data.map(service=>({
   id:service.id,slug:service.slug,display_name:service.display_name,
   summary:service.summary,duration_minutes:service.duration_minutes,
   published_at:service.published_at,
   resources:l.data.filter(link=>link.service_id===service.id&&eligible.has(link.resource_id))
    .map(({resource_id,public_label,capacity})=>({resource_id,public_label,capacity}))
  })).filter(s=>s.resources.length>0)
  if(grouped.length===0)return unavailable('eligible_resources_not_visible')
  return {kind:'ready',branchId:branch,schedule:{
   timezone:p.data.timezone,weekly_hours:p.data.weekly_hours,holidays:p.data.holidays,
   lead_minutes:p.data.lead_minutes,max_advance_days:p.data.max_advance_days,
   slot_step_minutes:p.data.slot_step_minutes,revision:p.data.revision
  },services:grouped}
 }catch{return backendError()}
}
