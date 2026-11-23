// CLOUD — staff appointment transitions. Pure contract/validation, no transport or authority.
export const ACTIONS=Object.freeze(['confirm','decline','check_in','complete','no_show','cancel'])
export const STATES=Object.freeze(['requested','confirmed','checked_in','completed','cancelled','no_show'])
export const ROLES=Object.freeze(['administrator','veterinarian','receptionist'])
export const STATUS_AFTER=Object.freeze({confirm:'confirmed',decline:'cancelled',check_in:'checked_in',complete:'completed',no_show:'no_show',cancel:'cancelled'})
export const ACTION_COPY=Object.freeze({confirm:'Confirm request',decline:'Decline request',check_in:'Check in',complete:'Complete visit',no_show:'Mark no-show',cancel:'Cancel appointment'})
const isObject=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const isUuid=v=>typeof v==='string'&&uuid.test(v)
const validRevision=v=>Number.isSafeInteger(v)&&v>0&&v<=2147483647
function bad(){throw Error('Appointment lifecycle response could not be verified')}
export function actionsFor(status,role,linked=false,startsAt='',nowMs=Date.now()){
 if(!ROLES.includes(role))return []
 if(status==='requested')return ['confirm','decline','cancel']
 if(status==='confirmed')return ['check_in',...(Number.isFinite(Date.parse(startsAt))&&nowMs>=Date.parse(startsAt)?['no_show']:[]),'cancel']
 if(status==='checked_in')return linked&&['administrator','veterinarian'].includes(role)?['complete']:[]
 return []
}
export function verifyAppointmentDetail(raw,expected,branchId){
 if(!isObject(raw)||!isObject(expected)||!isUuid(branchId)||raw.branch_id!==branchId||
 !['id','owner_id','pet_id','resource_id'].every(k=>isUuid(raw[k])&&raw[k]===expected[k])||
 !isUuid(raw.id)||!STATES.includes(raw.status)||!validRevision(raw.lifecycle_revision)||
 typeof raw.starts_at!=='string'||raw.starts_at!==expected.starts_at||
 typeof raw.ends_at!=='string'||raw.ends_at!==expected.ends_at||
 !Number.isFinite(Date.parse(raw.starts_at))||Date.parse(raw.ends_at)<=Date.parse(raw.starts_at))bad()
 return {id:raw.id,branchId,status:raw.status,revision:raw.lifecycle_revision,
  startsAt:raw.starts_at,endsAt:raw.ends_at,petId:raw.pet_id,ownerId:raw.owner_id,resourceId:raw.resource_id}
}
export function verifyTransitionReply(raw,{id,branchId,revision},action){
 if(!isObject(raw)||raw.kind!=='staff_appointment_transition'||raw.appointmentId!==id||
 raw.branchId!==branchId||raw.action!==action||raw.status!==STATUS_AFTER[action]||
 !validRevision(raw.revision)||raw.revision!==revision+1)bad()
 return {appointmentId:id,branchId,status:raw.status,revision:raw.revision,action}
}
export function transitionError(error){
 const code=String(error&&typeof error==='object'&&'code' in error?error.code:'')
 const message=String(error&&typeof error==='object'&&'message' in error?error.message:'').toLowerCase()
 if(code==='42501'||code==='401'||code==='403'||code==='PGRST301'||/jwt expired|not authorized|permission denied|session expired/.test(message))return 'denied'
 if(code==='40001')return 'conflict'
 if(code==='23505')return 'nonce'
 if(code==='23514'||code==='22023')return 'policy'
 if(code==='PGRST202'||/not integrated|could not find the function|does not exist/.test(message))return 'unavailable'
 if(/failed to fetch|network|timeout|timed out|load failed|connection|fetch failed/.test(message)||code==='08006')return 'uncertain'
 return 'unverified'
}
