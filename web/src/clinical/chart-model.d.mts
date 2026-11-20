export type ChartSection='appointments'|'records'|'drafts'
export type ChartCursor={at:string;id:string}
export type ChartPatient={id:string;ownerId:string;name:string;species:string;breed:string|null;sex:'male'|'female'|'unknown';birthDate:string|null;taxonomyReviewNeeded:boolean}
export type ChartAppointment={id:string;branchId:string;petId:string;startsAt:string;endsAt:string;status:'requested'|'confirmed'|'checked_in'|'completed'|'cancelled'|'no_show';concern:string}
export type ChartRecord={id:string;branchId:string;petId:string;performedAt:string;procedure:string;temperatureC:number|null;weightKg:number|null;comments:string|null;authoredBy:string|null}
export type ChartDraft={id:string;appointmentId:string;branchId:string;petId:string;authorId:string;editorId:string;revision:number;status:'draft';complaint:string;examination:string;assessment:string;plan:string;createdAt:string;updatedAt:string}
export type ChartItem=ChartAppointment|ChartRecord|ChartDraft
export type ChartRequest={accountId:string;branchId:string;petId:string;section:ChartSection;cursor:ChartCursor|null;limit:number}
export type ChartResult={kind:'ok';accountId:string;branchId:string;patient:ChartPatient;section:ChartSection;items:ChartItem[];hasMore:boolean;nextCursor:ChartCursor|null}|{kind:'not_found'|'denied'|'unavailable'}
export type DraftContent={complaint:string;examination:string;assessment:string;plan:string}
export type DraftSaveRequest=DraftContent&{branchId:string;petId:string;appointmentId:string;requestId:string;expectedRevision:number}
export type SavedAcknowledgement={kind:'saved';id:string;appointmentId:string;branchId:string;petId:string;authorId:string;editorId:string;status:'draft';revision:number;updatedAt:string}
export type SaveTicket={requestId:string;snapshot:string;expectedRevision:number}
export const CLINICAL_PAGE_LIMIT:50
export const CHART_SECTIONS:readonly ChartSection[]
export function isClinicalId(value:unknown):value is string
export function validateEncounter(data:Partial<DraftContent>):{valid:boolean;errors:Record<string,string>}
export function classifyChartError(error:unknown):'denied'|'not_found'|'unavailable'|'network'|'error'
export function validateChartPage(raw:unknown,request:ChartRequest):ChartResult
export function validateDraftAcknowledgement(raw:unknown,request:DraftSaveRequest,actorId:string):SavedAcknowledgement
export function draftSnapshot(data:DraftContent):string
export function prepareSaveTicket(previous:SaveTicket|null,input:DraftContent&{expectedRevision:number},uuidFactory:()=>string):SaveTicket
