import type {User} from '@supabase/supabase-js'
import type {OpsReadPort} from './read-port'
export type OpsPortDeps = {
  verifiedStaffSession(user: User): Promise<{userId: string; role: string; isActive: boolean}>
  listClinicQueueWindow(user: User, fromUtc: string, toUtc: string): Promise<{items: unknown[]; hasMore: boolean}>
  getClinicDashboardCounts(user: User): Promise<{patients: number; requestedAppointments: number; confirmedAppointments: number}>
}
export function createReadPortFor(deps: OpsPortDeps, user: User): OpsReadPort | null
import type {OpsBranchPort} from './read-port'
export type OpsBranchDeps = {
  listOwnBranchMemberships(user: User): Promise<unknown>
  listClinicBranches(): Promise<unknown>
  assertStaffBranch(user: User, branchId: string): Promise<string>
  listBranchQueueWindow(user: User, branchId: string, fromUtc: string, toUtc: string): Promise<{items: unknown[]; hasMore: boolean}>
  getBranchDashboardCounts(user: User, branchId: string): Promise<{patients: number; requestedAppointments: number; confirmedAppointments: number}>
}
export function createBranchPortFor(deps: OpsBranchDeps, user: User): OpsBranchPort | null
