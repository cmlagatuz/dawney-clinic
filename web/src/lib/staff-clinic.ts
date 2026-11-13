import type {User} from '@supabase/supabase-js'
import {supabase} from './supabase'

/** Staff-facing read contracts only. All results come from persisted RLS queries.
 * No client-invented role, no role bootstrap, no mock dashboard statistics. */
export type StaffRole='administrator'|'veterinarian'|'receptionist'
export type StaffSession={userId:string;role:StaffRole;isActive:true}
export type ClinicPatient={
 id:string;owner_id:string;name:string;species:string;breed:string|null;
 species_id:string|null;breed_id:string|null;taxonomy_review_needed:boolean
}
export type ClinicQueueItem={
 id:string;pet_id:string;owner_id:string;resource_id:string;starts_at:string;ends_at:string;
 status:'requested'|'confirmed'|'checked_in'|'completed'|'cancelled'|'no_show';concern:string
}
export type ClinicalRecord={
 id:string;pet_id:string;performed_at:string;procedure:string;
 temperature_c:number|null;weight_kg:number|null;comments:string|null;authored_by:string|null
}
const roles=new Set<StaffRole>(['administrator','veterinarian','receptionist'])
const actions={
 'queue.read':roles,'patients.read':roles,'clinical_records.read':roles,
 'encounter.write':new Set<StaffRole>(['administrator','veterinarian']),
 'appointment.transition':roles,
 // Not implemented: deny regardless of role until DB migrations, approved policy and tests.
 'prescription.write':new Set<StaffRole>(),
 'vaccination.write':new Set<StaffRole>(),
 'inventory.write':new Set<StaffRole>(),
 'invoice.write':new Set<StaffRole>(),
 'staff.grant':new Set<StaffRole>()
} as const
export type StaffAction=keyof typeof actions
export function roleCan(role:StaffRole,action:StaffAction):boolean{
 return actions[action].has(role)
}
function client(){if(!supabase)throw Error('Clinic database is not configured');return supabase}
export async function verifiedStaffSession(user:User):Promise<StaffSession>{
 const db=client()
 const {data:auth,error:authError}=await db.auth.getUser()
 if(authError||!auth.user||auth.user.id!==user.id||!auth.user.email_confirmed_at||
   auth.user.is_anonymous)throw Error('Verified staff session required')
 const {data,error}=await db.from('staff_memberships')
   .select('user_id,role,is_active').eq('user_id',user.id).maybeSingle()
 if(error||!data||!data.is_active||!roles.has(data.role as StaffRole))
  throw Error('Clinic staff access is not approved')
 return {userId:user.id,role:data.role as StaffRole,isActive:true}
}
export async function listClinicPatients(user:User,offset=0,limit=50):Promise<ClinicPatient[]> {
 await verifiedStaffSession(user)
 if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>100)
  throw Error('Invalid staff patient pagination')
 const {data,error}=await client().from('pets')
  .select('id,owner_id,name,species,breed,species_id,breed_id,taxonomy_review_needed')
  .order('created_at',{ascending:false}).range(offset,offset+limit-1)
 if(error)throw error
 return (data??[]) as ClinicPatient[]
}
/** Supply UTC bounds derived from an *approved* clinic timezone, never device-local guess. */
export async function listClinicQueue(
 user:User,fromUtc:string,toUtc:string
):Promise<ClinicQueueItem[]>{
 await verifiedStaffSession(user)
 const from=new Date(fromUtc),to=new Date(toUtc)
 if(!/Z$/.test(fromUtc)||!/Z$/.test(toUtc)||!Number.isFinite(from.valueOf())||
   !Number.isFinite(to.valueOf())||to<=from||
   to.valueOf()-from.valueOf()>86400000)throw Error('Valid UTC clinic queue window required')
 const {data,error}=await client().from('appointments')
 .select('id,pet_id,owner_id,resource_id,starts_at,ends_at,status,concern')
 .gte('starts_at',from.toISOString()).lt('starts_at',to.toISOString())
 .order('starts_at',{ascending:true}).limit(250)
 if(error)throw error
 return (data??[]) as ClinicQueueItem[]
}
export async function listClinicClinicalRecords(
 user:User,petId:string
):Promise<ClinicalRecord[]>{
 const member=await verifiedStaffSession(user)
 if(!roleCan(member.role,'clinical_records.read'))throw Error('Staff medical view denied')
 if(!/^[0-9a-f-]{36}$/i.test(petId))throw Error('Invalid patient ID')
 const {data,error}=await client().from('clinical_records')
 .select('id,pet_id,performed_at,procedure,temperature_c,weight_kg,comments,authored_by')
 .eq('pet_id',petId).order('performed_at',{ascending:false}).limit(100)
 if(error)throw error
 return (data??[]) as ClinicalRecord[]
}
export async function getClinicDashboardCounts(user:User) {
 await verifiedStaffSession(user)
 const db=client()
 const [patients,requested,confirmed]=await Promise.all([
  db.from('pets').select('id',{count:'exact',head:true}),
  db.from('appointments').select('id',{count:'exact',head:true}).eq('status','requested'),
  db.from('appointments').select('id',{count:'exact',head:true}).eq('status','confirmed')
 ])
 for(const item of [patients,requested,confirmed])if(item.error)throw item.error
 return {
  patients:patients.count??0,
  requestedAppointments:requested.count??0,
  confirmedAppointments:confirmed.count??0
 }
}
