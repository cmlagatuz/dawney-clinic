import type {SupabaseClient} from '@supabase/supabase-js'
export type BranchMembership={user_id:string;branch_id:string;role:'administrator'|'veterinarian'|'receptionist';is_active:boolean}
export type ClinicBranch={id:string;slug:string;display_name:string}
export type BranchQueueItem={id:string;pet_id:string;owner_id:string;resource_id:string;starts_at:string;ends_at:string;status:'requested'|'confirmed'|'checked_in'|'completed'|'cancelled'|'no_show';concern:string}
export type BranchCounts={patients:number;requestedAppointments:number;confirmedAppointments:number}
export const BRANCH_WINDOW_LIMIT:250
export function requireBranchId(id:unknown):string
export function queryOwnBranchMemberships(db:SupabaseClient,userId:string):Promise<BranchMembership[]>
export function queryClinicBranchCatalog(db:SupabaseClient):Promise<ClinicBranch[]>
export function assertBranchOnServer(db:SupabaseClient,branchId:string):Promise<string>
export function queryBranchQueueWindow(db:SupabaseClient,userId:string,branchId:string,fromUtc:string,toUtc:string):Promise<{items:BranchQueueItem[];hasMore:boolean}>
export function queryBranchDashboardCounts(db:SupabaseClient,userId:string,branchId:string):Promise<BranchCounts>
