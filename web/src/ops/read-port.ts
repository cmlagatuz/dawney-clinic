import type {User} from '@supabase/supabase-js'
import type {OpsCounts,OpsRole,OpsWindow} from './ops-model.mjs'
import type {OpsBranch} from './branch-model.mjs'

/**
 * Typed read interface the Operations UI depends on. It mirrors the PR #59 staff read contract
 * (verifiedStaffSession / listClinicQueueWindow / getClinicDashboardCounts) WITHOUT copying any
 * backend code. Until #59 is integrated, `createOpsReadPort` returns null and the UI shows an
 * explicit "contract not integrated" state. It must never fall back to the legacy truncated
 * queue or to any sample rows. See docs/phase5a-ui/INTEGRATION.md for the one-file wiring.
 */
export interface OpsReadPort {
  /** Rejects unless the DB confirms an active administrator/veterinarian/receptionist membership. */
  verify(): Promise<{userId: string; role: OpsRole}>
  /** One bounded window (<=24h, half-open UTC). hasMore=true means INCOMPLETE. */
  window(fromUtc: string, toUtc: string): Promise<OpsWindow>
  counts(): Promise<OpsCounts>
  /** Present only when branch-scoped readers are wired; the page then requires a server-authorized branch. */
  branch?: OpsBranchPort
}
/** Branch-scoped reads (Issue #77 / PR #80 contracts). Absent until Astra provides the client readers. */
export interface OpsBranchPort {
  /** Own ACTIVE memberships ∩ public branch list, derived from server rows only. */
  load(): Promise<{branches: OpsBranch[]; dropped: number}>
  /** Server authorization of one selection (assert_staff_branch). Rejects 42501 when not authorized. */
  assertBranch(branchId: string): Promise<string>
  window(branchId: string, fromUtc: string, toUtc: string): Promise<OpsWindow>
  counts(branchId: string): Promise<OpsCounts>
}
export type OpsReadPortFactory = (user: User) => OpsReadPort | null
