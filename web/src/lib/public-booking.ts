import type {User} from '@supabase/supabase-js'
import {supabase} from './supabase'
import {readOwner} from './owners'
import {validUtcInstant} from '../booking-contract.mjs'

export type PublicClinicService={
 id:string;slug:string;display_name:string;summary:string|null;
 duration_minutes:number;published_at:string
}
export type PublishedServiceResource={
 resource_id:string;public_label:string|null;capacity:1
}
export type ApprovedClinicSchedule={
 timezone:string;weekly_hours:Record<string,{open:string;close:string}[]>;
 holidays:string[];lead_minutes:number;max_advance_days:number;
 slot_step_minutes:number;revision:number
}
export type RequestBookingInput={
 petId:string;serviceId:string;resourceId:string;startsAtUtc:string;
 requestNonce:string;concern:string;details?:string|null
}
export type RequestedBooking={
 id:string;status:'requested'|'confirmed'|'checked_in'|'completed'|'cancelled'|'no_show';service_id:string;owner_id:string;
 pet_id:string;resource_id:string;starts_at:string;ends_at:string
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
function client(){if(!supabase)throw Error('Clinic Supabase public configuration unavailable');return supabase}
export async function listPublicClinicServices():Promise<PublicClinicService[]>{
 const {data,error}=await client().from('clinic_services')
 .select('id,slug,display_name,summary,duration_minutes,published_at')
 .order('display_name')
 if(error)throw error
 return (data??[]) as PublicClinicService[]
}
export async function listPublishedServiceResources(serviceId:string):Promise<PublishedServiceResource[]>{
 if(!uuid.test(serviceId))throw Error('Invalid service')
 const {data,error}=await client().from('clinic_service_resources')
  .select('resource_id,public_label,capacity').eq('service_id',serviceId)
 if(error)throw error
 return (data??[]) as PublishedServiceResource[]
}
/** Null until the owner approves actual hours and booking capacity. Never infer
 * default hours, time slots or availability from directory listings. */
export async function readApprovedPublicSchedule():Promise<ApprovedClinicSchedule|null>{
 const {data,error}=await client().from('clinic_booking_policy')
 .select('timezone,weekly_hours,holidays,lead_minutes,max_advance_days,slot_step_minutes,revision')
 .eq('policy_id',1).maybeSingle()
 if(error)throw error
 return data as ApprovedClinicSchedule|null
}
export function freshBookingRequestNonce():string{return crypto.randomUUID()}
export async function requestAuthenticatedServiceBooking(
 user:User,form:RequestBookingInput
):Promise<RequestedBooking>{
 if(!form||![form.petId,form.serviceId,form.resourceId,form.requestNonce].every(x=>typeof x==='string'&&uuid.test(x)))
  throw Error('A valid patient, service, resource and retry token are required')
 if(!validUtcInstant(form.startsAtUtc))throw Error('Explicit UTC appointment start required')
 if(typeof form.concern!=='string'||!form.concern.trim()||form.concern.length>300||
   (form.details!=null&&form.details.length>3000))throw Error('Invalid booking concern/details')
 const db=client()
 const {data:auth,error:authError}=await db.auth.getUser()
 if(authError||!auth.user||auth.user.id!==user.id||
   auth.user.is_anonymous||!auth.user.email_confirmed_at)throw Error('Verified customer login required')
 const owner=await readOwner(user)
 if(!owner)throw Error('Complete owner profile before booking')
 const {data:pet,error:petError}=await db.from('pets').select('id,owner_id')
 .eq('id',form.petId).eq('owner_id',owner.id).maybeSingle()
 if(petError||!pet)throw Error('Select a registered patient owned by your account')
 const {data:bookingId,error:requestError}=await db.rpc('request_service_appointment',{
  p_pet_id:form.petId,p_service_id:form.serviceId,p_resource_id:form.resourceId,
  p_starts_at:form.startsAtUtc,p_request_nonce:form.requestNonce,
  p_concern:form.concern,p_details:form.details??null
 })
 if(requestError)throw requestError
 if(typeof bookingId!=='string'||!uuid.test(bookingId))throw Error('Invalid booking response')
 const {data:row,error:readError}=await db.from('appointments')
 .select('id,status,service_id,owner_id,pet_id,resource_id,starts_at,ends_at')
 .eq('id',bookingId).eq('owner_id',owner.id).single()
 if(readError||!row||row.service_id!==form.serviceId||row.pet_id!==form.petId||
    row.resource_id!==form.resourceId)throw Error('Cannot verify persisted booking')
 // Exact retry may return a later staff-confirmed status, which is NOT a newly
 // confirmed request. Frontend must display the real persisted status.
 if(!['requested','confirmed','checked_in','completed','cancelled','no_show'].includes(row.status))
   throw Error('Unexpected appointment status')
 return row as RequestedBooking
}
