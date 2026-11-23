import type {User} from '@supabase/supabase-js'
import {supabase} from '../lib/supabase'
import {assertStaffBranch,listOwnBranchMemberships} from '../lib/staff-branch'
import {verifiedStaffSession} from '../lib/staff-clinic'
import {actionsFor,isUuid,verifyAppointmentDetail,verifyTransitionReply} from './lifecycle.mjs'
import type {AppointmentAction,AppointmentAck,AppointmentDetail,AppointmentRole} from './lifecycle.mjs'
import type {OpsRow} from '../ops/ops-model.mjs'

/** PR130's documented source-only RPC; no unreviewed #21 SQL or backend lib copied. */
export const APPOINTMENT_WRITES_ENABLED=import.meta.env.VITE_STAFF_APPOINTMENT_WRITES_ENABLED==='true'
const denied=()=>Object.assign(Error('Current branch and staff permission required'),{code:'42501'})
const missing=()=>Object.assign(Error('Appointment transition service is not enabled'),{code:'PGRST202'})
export interface AppointmentLifecyclePort {
 read(row:OpsRow):Promise<AppointmentDetail>
 linkedEncounter(detail:AppointmentDetail):Promise<boolean>
 transition(detail:AppointmentDetail,action:AppointmentAction,requestId:string):Promise<AppointmentAck>
}
function database(){if(!supabase)throw missing();return supabase}
export function createAppointmentLifecyclePort(user:User,branchId:string):AppointmentLifecyclePort{
 async function access():Promise<AppointmentRole>{
  if(!APPOINTMENT_WRITES_ENABLED)throw missing()
  if(!isUuid(branchId)||!isUuid(user.id))throw denied()
  const db=database()
  const {data,error}=await db.auth.getUser()
  if(error||!data.user||data.user.id!==user.id||!data.user.email_confirmed_at||data.user.is_anonymous)
   throw denied()
  const member=await verifiedStaffSession(user)
  if(member.userId!==user.id||!member.isActive)throw denied()
  await assertStaffBranch(user,branchId)
  const membership=await listOwnBranchMemberships(user)
  const active=membership.filter(m=>m.user_id===user.id&&m.branch_id===branchId&&m.is_active)
  if(active.length!==1||active[0]?.role!==member.role||
    !['administrator','veterinarian','receptionist'].includes(member.role))throw denied()
  return member.role
 }
 async function read(row:OpsRow):Promise<AppointmentDetail>{
  await access()
  if(!isUuid(row.id))throw denied()
  const {data,error}=await database().from('appointments')
   .select('id,branch_id,pet_id,owner_id,resource_id,starts_at,ends_at,status,lifecycle_revision')
   .eq('branch_id',branchId).eq('id',row.id).maybeSingle()
  if(error)throw error
  if(!data)throw denied()
  const detail=verifyAppointmentDetail(data,row,branchId)
  await access() // deny a revoked branch even if a response was already in flight
  return detail
 }
 async function linkedEncounter(detail:AppointmentDetail):Promise<boolean>{
  const role=await access()
  if(!['administrator','veterinarian'].includes(role)||detail.branchId!==branchId)throw denied()
  const {data,error}=await database().from('branch_encounters').select('id')
   .eq('branch_id',branchId).eq('appointment_id',detail.id).eq('pet_id',detail.petId).limit(2)
  if(error)throw error
  if(!Array.isArray(data)||data.length>2||data.some(r=>!r||!isUuid(r.id)))
   throw Error('Encounter linkage could not be verified')
  await access()
  return data.length>0
 }
 async function transition(detail:AppointmentDetail,action:AppointmentAction,requestId:string):Promise<AppointmentAck>{
  const role=await access()
  if(detail.branchId!==branchId||!isUuid(detail.id)||!isUuid(requestId)||
   !Number.isSafeInteger(detail.revision)||detail.revision<1||
   !actionsFor(detail.status,role,true,detail.startsAt).includes(action))throw denied()
  const {data,error}=await database().rpc('transition_staff_appointment',{
   p_appointment:detail.id,p_branch:branchId,p_action:action,
   p_expected_revision:detail.revision,p_request_id:requestId
  })
  if(error)throw error
  const ack=verifyTransitionReply(data,detail,action)
  await access()
  return ack
 }
 return {read,linkedEncounter,transition}
}
