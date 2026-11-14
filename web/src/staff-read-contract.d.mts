import type {SupabaseClient} from '@supabase/supabase-js'
export type StaffRole='administrator'|'veterinarian'|'receptionist'
export const STAFF_ROLES:readonly StaffRole[]
export type VerifiedStaffSession={userId:string;role:StaffRole;isActive:true}
export type StaffQueueRow={
 id:string;pet_id:string;owner_id:string;resource_id:string;starts_at:string;ends_at:string;
 status:'requested'|'confirmed'|'checked_in'|'completed'|'cancelled'|'no_show';concern:string
}
export function verifyStaffFromRls(db:SupabaseClient,userId:string):Promise<VerifiedStaffSession>
export function validateClinicUtcWindow(fromUtc:string,toUtc:string):{from:string;to:string}
export function queryClinicQueue(db:SupabaseClient,fromUtc:string,toUtc:string):Promise<StaffQueueRow[]>
export function queryClinicDashboardCounts(db:SupabaseClient):Promise<{
 patients:number;requestedAppointments:number;confirmedAppointments:number
}>
