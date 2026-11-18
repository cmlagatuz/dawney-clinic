/** ASTRA Issue #51 source-only branch-aware booking discovery contract. */
export type BranchBookingReadStatus=
 | {kind:'missing_contract';table:string}
 | {kind:'unapproved_branch'}
 | {kind:'unavailable';reason:'invalid_schedule'|'services'|'eligible_resources_not_visible'}
 | {kind:'backend_error'}
 | {kind:'ready';branchId:string;schedule:ApprovedBranchSchedule;services:EligibleBranchService[]}
export type ApprovedBranchSchedule={
 timezone:string;weekly_hours:Record<string,{open:string;close:string}[]>;
 holidays:string[];lead_minutes:number;max_advance_days:number;
 slot_step_minutes:number;revision:number
}
export type EligibleBranchResource={resource_id:string;public_label:string|null;capacity:1}
export type EligibleBranchService={
 id:string;slug:string;display_name:string;summary:string|null;
 duration_minutes:number;published_at:string;resources:EligibleBranchResource[]
}
export const BRANCH_BOOKING_READ_STATUSES:readonly ['missing_contract','unapproved_branch',
 'unavailable','backend_error','ready']
export function readBranchPublicBooking(db:import('@supabase/supabase-js').SupabaseClient,
 selectedBranchId:string):Promise<BranchBookingReadStatus>
