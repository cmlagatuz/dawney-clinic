import type {User} from '@supabase/supabase-js'
import {supabase} from './supabase'

/** Unwired proposed #16 clinical RPC. Never use listClinicClinicalRecords as fallback.
 * No service-role, role metadata, direct clinical table DML, sign-off or pharmacy writes.
 */
export type ChartSection='appointments'|'records'|'drafts'
export type ChartCursor={at:string;id:string}
export type ChartPatient={id:string;ownerId:string;name:string;species:string;
 breed:string|null;sex:'male'|'female'|'unknown';birthDate:string|null;taxonomyReviewNeeded:boolean}
export type ChartAppointment={id:string;branchId:string;petId:string;startsAt:string;endsAt:string;
 status:'requested'|'confirmed'|'checked_in'|'completed'|'cancelled'|'no_show';concern:string}
export type ChartRecord={id:string;branchId:string;petId:string;performedAt:string;
 procedure:string;temperatureC:number|null;weightKg:number|null;comments:string|null;authoredBy:string|null}
export type EncounterDraft={id:string;appointmentId:string;branchId:string;petId:string;
 authorId:string;revision:number;status:'draft';complaint:string;examination:string;
 assessment:string;plan:string;createdAt:string;updatedAt:string}
export type ChartItem=ChartAppointment|ChartRecord|EncounterDraft
export type PatientChartPage={kind:'ok';accountId:string;branchId:string;patient:ChartPatient;
 section:ChartSection;items:ChartItem[];nextCursor:ChartCursor|null;hasMore:boolean}
export type PatientChartResult=PatientChartPage|{kind:'not_found'}|{kind:'denied'}|{kind:'unavailable'}
export type DraftInput={branchId:string;petId:string;appointmentId:string;requestId:string;
 expectedRevision:number;complaint:string;examination:string;assessment:string;plan:string}
export type SavedDraft={kind:'saved';id:string;branchId:string;petId:string;appointmentId:string;
 authorId:string;status:'draft';revision:number;updatedAt:string}
export type DraftResult=SavedDraft|{kind:'denied'}|{kind:'unavailable'}|{kind:'conflict'}|{kind:'invalid'}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
const validId=(s:string)=>uuid.test(s)
const obj=(x:unknown):x is Record<string,unknown>=>x!==null&&typeof x==='object'&&!Array.isArray(x)
const str=(x:unknown):x is string=>typeof x==='string'
const cursor=(x:unknown):x is ChartCursor=>obj(x)&&str(x.at)&&!Number.isNaN(Date.parse(x.at))&&str(x.id)&&validId(x.id)
function client(){if(!supabase)throw Error('Clinic database is not configured');return supabase}
async function authenticate(user:User){
 const {data,error}=await client().auth.getUser()
 if(error||!data.user||data.user.id!==user.id||!data.user.email_confirmed_at||
  data.user.is_anonymous)throw Error('Clinical session is not verified')
}
function status(error:{code?:string}):'denied'|'unavailable'|'conflict'|'invalid'{
 if(error.code==='42501')return 'denied'
 if(error.code==='40001'||error.code==='23505')return 'conflict'
 if(error.code==='22023'||error.code==='23514')return 'invalid'
 return 'unavailable'
}
function parsePage(raw:unknown,section:ChartSection,branchId:string,accountId:string,limit:number):PatientChartPage{
 if(!obj(raw)||raw.kind!=='ok'||raw.branchId!==branchId||raw.accountId!==accountId||
 raw.section!==section||!obj(raw.patient)||!str(raw.patient.id)||
 !str(raw.patient.ownerId)||!str(raw.patient.name)||!str(raw.patient.species)||
 !Array.isArray(raw.items)||raw.items.length>limit||typeof raw.hasMore!=='boolean'||
 !(raw.nextCursor===null||cursor(raw.nextCursor))||
 (raw.hasMore&&raw.nextCursor===null))throw Error('Malformed clinical chart response')
 const p=raw.patient
 if(!str(p.id)||!str(p.ownerId)||!validId(p.id)||!validId(p.ownerId)||
 !(p.breed===null||str(p.breed))||
 !['male','female','unknown'].includes(String(p.sex))||
 !(p.birthDate===null||str(p.birthDate))||typeof p.taxonomyReviewNeeded!=='boolean')
 throw Error('Malformed clinical patient')
 for(const item of raw.items){
  if(!obj(item)||!str(item.id)||!validId(item.id)||
    item.branchId!==branchId||item.petId!==p.id)
   throw Error('Malformed scoped clinical entry')
  if(section==='appointments'&&(!str(item.startsAt)||!str(item.endsAt)||
    !str(item.concern)||!['requested','confirmed','checked_in','completed','cancelled','no_show'].includes(String(item.status))))
   throw Error('Malformed appointment')
  if(section==='records'&&(!str(item.performedAt)||!str(item.procedure)||
    !(item.comments===null||str(item.comments))||
    !(item.authoredBy===null||str(item.authoredBy))))
   throw Error('Malformed clinical record')
  if(section==='drafts'&&(!str(item.appointmentId)||!validId(item.appointmentId)||
    item.status!=='draft'||!Number.isSafeInteger(item.revision)||
    !str(item.complaint)||!str(item.examination)||!str(item.assessment)||!str(item.plan)||
    !str(item.authorId)||!str(item.createdAt)||!str(item.updatedAt)))
   throw Error('Malformed clinical draft')
 }
 return raw as unknown as PatientChartPage
}
export async function readStaffPatientChart(user:User,branchId:string,petId:string,
 section:ChartSection='appointments',cursorValue:ChartCursor|null=null,limit=50):Promise<PatientChartResult>{
 if(!validId(branchId)||!validId(petId)||!['appointments','records','drafts'].includes(section)||
 !Number.isInteger(limit)||limit<1||limit>50||
 (cursorValue!==null&&!cursor(cursorValue)))throw Error('Invalid clinical chart request')
 await authenticate(user)
 const {data,error}=await client().rpc('read_staff_patient_chart',{
  p_branch:branchId,p_pet:petId,p_section:section,p_after_at:cursorValue?.at??null,
  p_after_id:cursorValue?.id??null,p_limit:limit
 })
 if(error)return {kind:status(error)==='denied'?'denied':'unavailable'}
 if(obj(data)&&data.kind==='not_found')return {kind:'not_found'}
 return parsePage(data,section,branchId,user.id,limit)
}
export async function saveStaffEncounterDraft(user:User,input:DraftInput):Promise<DraftResult>{
 const {branchId,petId,appointmentId,requestId,expectedRevision,complaint,examination,assessment,plan}=input
 if(![branchId,petId,appointmentId,requestId].every(validId)||
 !Number.isSafeInteger(expectedRevision)||expectedRevision<0||expectedRevision>2147483646||
 typeof complaint!=='string'||complaint.trim().length<1||complaint.length>4000||
 [examination,assessment,plan].some(s=>typeof s!=='string'||s.length>4000))
 return {kind:'invalid'}
 await authenticate(user)
 const {data,error}=await client().rpc('save_staff_clinical_encounter_draft',{
  p_branch:branchId,p_pet:petId,p_appointment:appointmentId,p_request_id:requestId,
  p_expected_revision:expectedRevision,p_complaint:complaint,p_examination:examination,
  p_assessment:assessment,p_plan:plan
 })
 if(error)return {kind:status(error)}
 if(!obj(data)||data.kind!=='saved'||data.status!=='draft'||
 !str(data.id)||!validId(data.id)||data.branchId!==branchId||data.petId!==petId||
 data.appointmentId!==appointmentId||data.authorId!==user.id||
 !Number.isSafeInteger(data.revision)||Number(data.revision)<1||
 !str(data.updatedAt))throw Error('Malformed clinical draft acknowledgement')
 return data as SavedDraft
}
