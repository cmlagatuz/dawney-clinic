import type {User} from '@supabase/supabase-js'
import {supabase} from './supabase'
import {
 queryOwnBranchMemberships,queryClinicBranchCatalog,assertBranchOnServer,
 queryBranchQueueWindow,queryBranchDashboardCounts
} from '../staff-branch-read-contract.mjs'
/** Source-only Issue #58 read adapter for PR81's injected OpsBranchDeps.
 * Must remain UNWIRED from ops/port.ts until Claude+security approval.
 * Uses the caller's real Supabase Auth session, NEVER service_role or JWT metadata.
 */
function client(){if(!supabase)throw Error('Clinic database is not configured');return supabase}
export async function listOwnBranchMemberships(user:User){
 return queryOwnBranchMemberships(client(),user.id)
}
export async function listClinicBranches(){
 return queryClinicBranchCatalog(client())
}
export async function assertStaffBranch(user:User,branchId:string):Promise<string>{
 const {verifyStaffFromRls}=await import('../staff-read-contract.mjs')
 await verifyStaffFromRls(client(),user.id)
 return assertBranchOnServer(client(),branchId)
}
export async function listBranchQueueWindow(user:User,branchId:string,fromUtc:string,toUtc:string){
 return queryBranchQueueWindow(client(),user.id,branchId,fromUtc,toUtc)
}
export async function getBranchDashboardCounts(user:User,branchId:string){
 return queryBranchDashboardCounts(client(),user.id,branchId)
}
