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
 authorId:string;editorId:string;revision:number;status:'draft';complaint:string;examination:string;
 assessment:string;plan:string;createdAt:string;updatedAt:string}
export type ChartItem=ChartAppointment|ChartRecord|EncounterDraft
export type PatientChartPage={kind:'ok';accountId:string;branchId:string;patient:ChartPatient;
 section:ChartSection;items:ChartItem[];nextCursor:ChartCursor|null;hasMore:boolean}
export type PatientChartResult=PatientChartPage|{kind:'not_found'}|{kind:'denied'}|{kind:'unavailable'}
export type DraftInput={branchId:string;petId:string;appointmentId:string;requestId:string;
 expectedRevision:number;complaint:string;examination:string;assessment:string;plan:string}
export type SavedDraft={kind:'saved';id:string;branchId:string;petId:string;appointmentId:string;
 authorId:string;editorId:string;status:'draft';revision:number;updatedAt:string}
export type DraftResult=SavedDraft|{kind:'denied'}|{kind:'unavailable'}|{kind:'conflict'}|{kind:'invalid'}
export type ClinicalRecordInput={appointmentId:string;requestId:string;procedure:string;temperatureC?:number|null;weightKg?:number|null;comments?:string|null}
export type SavedClinicalRecord={kind:'saved';id:string;appointmentId:string;branchId:string;petId:string;authorId:string;performedAt:string}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
const validId=(s:string)=>uuid.test(s)
const obj=(x:unknown):x is Record<string,unknown>=>x!==null&&typeof x==='object'&&!Array.isArray(x)
const str=(x:unknown):x is string=>typeof x==='string'
const timestamp=(x:unknown):x is string=>str(x)&&
 /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(x)&&
 Number.isFinite(Date.parse(x))
const numeric=(x:unknown,min:number,max:number)=>x===null||
 (typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max)
const cursor=(x:unknown):x is ChartCursor=>obj(x)&&timestamp(x.at)&&str(x.id)&&validId(x.id)
function client(){if(!supabase)throw Error('Clinic database is not configured');return supabase}
async function authenticate(user:User){
 const {data,error}=await client().auth.getUser()
 if(error){
  if(error.status===401||error.status===403)throw Object.assign(Error('Clinical session is not verified'),{code:'42501'})
  throw error
 }
 if(!data.user||data.user.id!==user.id||!data.user.email_confirmed_at||data.user.is_anonymous)throw Object.assign(Error('Clinical session is not verified'),{code:'42501'})
}
function status(error:{code?:string}):'denied'|'unavailable'|'conflict'|'invalid'{
 if(['42501','401','403','PGRST301'].includes(String(error.code??'')))return 'denied'
 if(error.code==='40001'||error.code==='23505')return 'conflict'
 if(error.code==='22023'||error.code==='23514')return 'invalid'
 return 'unavailable'
}
function parsePage(raw:unknown,section:ChartSection,branchId:string,petId:string,accountId:string,limit:number):PatientChartPage{
 if(!obj(raw)||raw.kind!=='ok'||raw.branchId!==branchId||raw.accountId!==accountId||
 raw.section!==section||!obj(raw.patient)||!str(raw.patient.id)||
 !str(raw.patient.ownerId)||!str(raw.patient.name)||!str(raw.patient.species)||
 !Array.isArray(raw.items)||raw.items.length>limit||typeof raw.hasMore!=='boolean'||
 !(raw.nextCursor===null||cursor(raw.nextCursor))||
 (raw.hasMore&&raw.nextCursor===null))throw Error('Malformed clinical chart response')
 const p=raw.patient
 if(!str(p.id)||!str(p.ownerId)||p.id!==petId||!validId(p.id)||!validId(p.ownerId)||
 !(p.breed===null||str(p.breed))||
 !['male','female','unknown'].includes(String(p.sex))||
 !(p.birthDate===null||(str(p.birthDate)&&/^\d{4}-\d\d-\d\d$/.test(p.birthDate)&&!Number.isNaN(Date.parse(p.birthDate))))||typeof p.taxonomyReviewNeeded!=='boolean')
 throw Error('Malformed clinical patient')
 for(const item of raw.items){
  if(!obj(item)||!str(item.id)||!validId(item.id)||
    item.branchId!==branchId||item.petId!==p.id)
   throw Error('Malformed scoped clinical entry')
  if(section==='appointments'&&(!timestamp(item.startsAt)||!timestamp(item.endsAt)||Date.parse(item.endsAt)<=Date.parse(item.startsAt)||
    !str(item.concern)||!['requested','confirmed','checked_in','completed','cancelled','no_show'].includes(String(item.status))))
   throw Error('Malformed appointment')
  if(section==='records'&&(!timestamp(item.performedAt)||!str(item.procedure)||!numeric(item.temperatureC,0,60)||!numeric(item.weightKg,0,Number.MAX_VALUE)||
    !(item.comments===null||str(item.comments))||
    !(item.authoredBy===null||(str(item.authoredBy)&&validId(item.authoredBy)))))
   throw Error('Malformed clinical record')
  if(section==='drafts'&&(!str(item.appointmentId)||!validId(item.appointmentId)||
    item.status!=='draft'||!Number.isSafeInteger(item.revision)||
    !str(item.complaint)||!str(item.examination)||!str(item.assessment)||!str(item.plan)||
    !str(item.authorId)||!validId(item.authorId)||!str(item.editorId)||!validId(item.editorId)||
    !timestamp(item.createdAt)||!timestamp(item.updatedAt)||Date.parse(item.updatedAt)<Date.parse(item.createdAt)))
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
 return parsePage(data,section,branchId,petId,user.id,limit)
}
export async function saveStaffEncounterDraft(user:User,input:DraftInput,signal?:AbortSignal):Promise<DraftResult>{
 const {branchId,petId,appointmentId,requestId,expectedRevision,complaint,examination,assessment,plan}=input
 if(![branchId,petId,appointmentId,requestId].every(validId)||
 !Number.isSafeInteger(expectedRevision)||expectedRevision<0||expectedRevision>2147483646||
 typeof complaint!=='string'||complaint.trim().length<1||complaint.length>4000||
 [examination,assessment,plan].some(s=>typeof s!=='string'||s.length>4000))
 return {kind:'invalid'}
 await authenticate(user)
 // Context may have unmounted while getUser was pending; do not dispatch a stale write.
 if(signal?.aborted)throw new DOMException('Cancelled','AbortError')
 const {data,error}=await client().rpc('save_staff_clinical_encounter_draft',{
  p_branch:branchId,p_pet:petId,p_appointment:appointmentId,p_request_id:requestId,
  p_expected_revision:expectedRevision,p_complaint:complaint,p_examination:examination,
  p_assessment:assessment,p_plan:plan
 })
 if(error)return {kind:status(error)}
 if(!obj(data)||data.kind!=='saved'||data.status!=='draft'||
 !str(data.id)||!validId(data.id)||data.branchId!==branchId||data.petId!==petId||
 data.appointmentId!==appointmentId||!str(data.authorId)||!validId(data.authorId)||
 data.editorId!==user.id||
 !Number.isSafeInteger(data.revision)||Number(data.revision)<1||
 !timestamp(data.updatedAt))throw Error('Malformed clinical draft acknowledgement')
 return data as SavedDraft
}

/** Only the server chooses the branch/pet/author/time from this exact appointment.
 * Direct public.clinical_records inserts and branch_id are explicitly prohibited.
 */
export async function createStaffAppointmentClinicalRecord(user:User,input:ClinicalRecordInput):
 Promise<SavedClinicalRecord|{kind:'denied'|'unavailable'|'conflict'|'invalid'}>{
 if(!validId(input.appointmentId)||!validId(input.requestId)||
  typeof input.procedure!=='string'||input.procedure.trim().length<1||
  input.procedure.length>500||
  !numeric(input.temperatureC??null,0,60)||
  !numeric(input.weightKg??null,0,Number.MAX_VALUE)||
  !(input.comments===undefined||input.comments===null||
     (typeof input.comments==='string'&&input.comments.length<=8000)))return {kind:'invalid'}
 await authenticate(user)
 const {data,error}=await client().rpc('create_staff_appointment_clinical_record',{
  p_appointment:input.appointmentId,p_request_id:input.requestId,
  p_procedure:input.procedure,p_temperature_c:input.temperatureC??null,
  p_weight_kg:input.weightKg??null,p_comments:input.comments??null
 })
 if(error)return {kind:status(error)}
 if(!obj(data)||data.kind!=='saved'||!str(data.id)||!validId(data.id)||
  data.appointmentId!==input.appointmentId||
  !str(data.branchId)||!validId(data.branchId)||
  !str(data.petId)||!validId(data.petId)||
  data.authorId!==user.id||!timestamp(data.performedAt))
  throw Error('Malformed clinical record acknowledgement')
 return data as SavedClinicalRecord
}

/** #22: metadata only; never treats receipt discovery as identification of a lost save. */
export type ReceiptQuery={accountId:string;branchId:string;petId:string;appointmentId:string;
 requestId:string|null;beforeRevision:number|null}
export type Receipt={requestId:string;revision:number;auditEventId:string;savedAt:string}
export type ReceiptObservation=
 |{kind:'committed';currentRevision:number;draftId:string;receipt:Receipt}
 |{kind:'not_found';currentRevision:number;draftId:string|null;receipt:null}
 |{kind:'unknown';reason:'visit_busy'|'receipt_unverified';currentRevision:null;draftId:null;receipt:null}
const receiptRevision=(x:unknown):x is number=>typeof x==='number'&&Number.isSafeInteger(x)&&x>=0&&x<=2147483647
export function validateClinicalReceipt(raw:unknown,q:ReceiptQuery):ReceiptObservation{
 if(!obj(raw)||raw.accountId!==q.accountId||raw.branchId!==q.branchId||raw.petId!==q.petId||
 raw.appointmentId!==q.appointmentId||raw.requestId!==q.requestId||raw.beforeRevision!==q.beforeRevision)
 throw Error('Unverified receipt scope')
 if(raw.kind==='unknown'&&(raw.reason==='visit_busy'||raw.reason==='receipt_unverified')&&
 raw.currentRevision===null&&raw.draftId===null&&raw.receipt===null)
 return {kind:'unknown',reason:raw.reason,currentRevision:null,draftId:null,receipt:null}
 if(!receiptRevision(raw.currentRevision))throw Error('Unverified receipt revision')
 const currentRevision=raw.currentRevision
 if(raw.kind==='not_found'&&raw.receipt===null&&
 (currentRevision===0?raw.draftId===null:str(raw.draftId)&&validId(raw.draftId)))
 return {kind:'not_found',currentRevision,draftId:raw.draftId as string|null,receipt:null}
 const x=raw.receipt
 if(raw.kind!=='committed'||!str(raw.draftId)||!validId(raw.draftId)||!obj(x)||
 !str(x.requestId)||!validId(x.requestId)||(q.requestId!==null&&x.requestId!==q.requestId)||
 !receiptRevision(x.revision)||x.revision<1||x.revision>currentRevision||
 (q.beforeRevision!==null&&x.revision>=q.beforeRevision)||
 !str(x.auditEventId)||!/^[1-9][0-9]{0,18}$/.test(x.auditEventId)||!timestamp(x.savedAt))
 throw Error('Unverified receipt')
 return {kind:'committed',currentRevision,draftId:raw.draftId,
 receipt:{requestId:x.requestId,revision:x.revision,auditEventId:x.auditEventId,savedAt:x.savedAt}}
}
export async function reconcileStaffClinicalDraft(user:User,q:ReceiptQuery,signal?:AbortSignal):Promise<ReceiptObservation>{
 if(q.accountId!==user.id||![q.accountId,q.branchId,q.petId,q.appointmentId].every(validId)||
 (q.requestId!==null&&!validId(q.requestId))||
 (q.beforeRevision!==null&&(!receiptRevision(q.beforeRevision)||q.beforeRevision<1||q.requestId!==null)))
 throw Error('Invalid receipt query')
 await authenticate(user)
 if(signal?.aborted)throw new DOMException('Cancelled','AbortError')
 const {data,error}=await client().rpc('reconcile_staff_clinical_draft',{
 p_branch:q.branchId,p_pet:q.petId,p_appointment:q.appointmentId,p_request_id:q.requestId,p_before_revision:q.beforeRevision})
 if(signal?.aborted)throw new DOMException('Cancelled','AbortError')
 if(error)throw error
 return validateClinicalReceipt(data,q)
}
