export type OpsRole='administrator'|'veterinarian'|'receptionist'
export type OpsStatus='requested'|'confirmed'|'checked_in'|'completed'|'cancelled'|'no_show'
export type OpsRow={id:string;pet_id:string;owner_id:string;resource_id:string;starts_at:string;ends_at:string;status:OpsStatus;concern:string}
export type OpsWindow={items:OpsRow[];hasMore:boolean}
export type OpsCounts={patients:number;requestedAppointments:number;confirmedAppointments:number}
export type OpsLane={key:string;label:string;statuses:readonly OpsStatus[];persisted:boolean;hint:string}
export type OpsKpi={key:string;label:string;state:'value'|'atLeast'|'unavailable'|'loading';value:number|null;note:string}
export type OpsErrorKind='denied'|'network'|'unavailable'|'error'
export const OPS_TIME_ZONE:string
export const OPS_VISIBLE_LIMIT:250
export const OPS_ROLES:readonly OpsRole[]
export const OPS_STATUSES:readonly OpsStatus[]
export const FLOW_LANES:readonly OpsLane[]
export const CLOSED_STATUSES:readonly OpsStatus[]
export function isIsoDate(v:unknown):boolean
export function addDays(date:string,n:number):string
export function todayInZone(nowMs:number,timezone?:string):string
export function weekDates(date:string):string[]
export function dayWindow(date:string,timezone?:string):{fromUtc:string;toUtc:string}
export const OPS_RANGES:readonly {key:string;label:string;from:string;to:string|null}[]
export function rangeWindow(date:string,rangeKey?:string,timezone?:string):{fromUtc:string;toUtc:string}
export function validateWindow(result:unknown):OpsWindow
export function validateCounts(c:unknown):OpsCounts
export function windowState(win:OpsWindow):'empty'|'ready'|'incomplete'
export function buildFlow(items:OpsRow[]):{lanes:(OpsLane&{items:OpsRow[]})[];closed:OpsRow[]}
export function buildKpis(input:{win:OpsWindow|null;counts:OpsCounts|null}):OpsKpi[]
export function classifyOpsError(err:unknown):OpsErrorKind
export function formatClinicTime(iso:string,timezone?:string):string
export function durationMinutes(a:string,b:string):number
export function shortRef(id:string):string
export function formatDayLabel(date:string):string
export function groupByResource(items:OpsRow[]):{id:string;rows:OpsRow[]}[]
