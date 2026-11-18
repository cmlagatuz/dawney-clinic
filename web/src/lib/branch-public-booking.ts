/** Read-only, branch-aware backend adapter; NOT wired to Claude's UI.
 * Distinct return states; never read the retired global policy singleton.
 * This is discovery, NOT a booking authorization decision.
 * The existing requestAuthenticatedServiceBooking() 7-arg RPC stays unchanged.
 */
import {supabase} from './supabase'
import {readBranchPublicBooking} from './branch-public-booking-reader.mjs'
import type {BranchBookingReadStatus} from './branch-public-booking-reader.mjs'
export type {
 BranchBookingReadStatus,ApprovedBranchSchedule,EligibleBranchResource,EligibleBranchService
} from './branch-public-booking-reader.mjs'
/** Source-only candidate. Never convert a missing/denied schedule to legacy. */
export async function readApprovedBranchBookingConfig(
 branchId:string
):Promise<BranchBookingReadStatus>{
 if(!supabase)return {kind:'backend_error'}
 return readBranchPublicBooking(supabase,branchId)
}
