import type {User} from '@supabase/supabase-js'
import {bookAppointment,type Appointment} from './clinical'
import {
 readApprovedPublicSchedule,requestAuthenticatedServiceBooking,
 type RequestedBooking
} from './public-booking'
import {
 submitOwnerBookingTransition,
 type BookingPolicyState,type OwnerBookingTransitionRequest
} from '../booking-transition.mjs'

export type {OwnerBookingTransitionRequest} from '../booking-transition.mjs'

// PostgREST reports PGRST205 before the Phase4 booking table exists; PostgreSQL
// can instead return 42P01. Match BOTH code and exact table name, never generic
// permission/transport failures. The database trigger blocks any stale-schema
// legacy insert if an operator has meanwhile approved the schedule.
function isMissingPhase4Policy(error:unknown):boolean{
 if(!error||typeof error!=='object')return false
 const e=error as {code?:unknown;message?:unknown}
 return (e.code==='PGRST205'||e.code==='42P01')
   &&typeof e.message==='string'&&e.message.includes('clinic_booking_policy')
}
async function readPolicyState():Promise<BookingPolicyState>{
 try{
  const schedule=await readApprovedPublicSchedule()
  return schedule?'approved':'unapproved'
 }catch(error){
  if(isMissingPhase4Policy(error))return 'not_installed'
  throw error // never treat failed Auth, RLS, network or invalid schema as approval
 }
}

/**
 * Non-UI adapter for Issue #51. Claude can replace the old form's direct
 * bookAppointment() call with this explicit union after a reviewed UI rollout:
 *
 * - kind:'legacy': keeps the existing 30-minute owner request until policy is
 *   approved (or migration is not installed); no service/nonce accepted.
 * - kind:'service': requires approved schedule and invokes the verified-owner,
 *   owner/pet-scoped SECURITY INVOKER RPC with stable nonce and UTC time.
 *
 * Never infer an approved service, timezone, slot or resource. A failed RPC
 * cannot become a service-less INSERT. The DB is authoritative during races.
 * Existing appointments and their statuses are never rewritten.
 */
export async function submitOwnerAppointment(
 user:User,request:OwnerBookingTransitionRequest
):Promise<Appointment|RequestedBooking>{
 return submitOwnerBookingTransition(request,{
  readPolicyState,
  submitLegacy:details=>bookAppointment(user,details),
  submitService:booking=>requestAuthenticatedServiceBooking(user,booking)
 })
}
