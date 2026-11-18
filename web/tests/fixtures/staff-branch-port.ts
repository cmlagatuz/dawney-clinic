import { createOpsReadPort as createBasePort } from '../../src/ops/port'
import { createBranchPortFor, type OpsBranchDeps } from '../../src/ops/port-adapter.mjs'
import type { OpsReadPortFactory } from '../../src/ops/read-port'
import {
  assertStaffBranch, getBranchDashboardCounts, listBranchQueueWindow,
  listClinicBranches, listOwnBranchMemberships
} from '../../src/lib/staff-branch'

const branchReaders = {
  assertStaffBranch, getBranchDashboardCounts, listBranchQueueWindow,
  listClinicBranches, listOwnBranchMemberships
} satisfies OpsBranchDeps

/** Mirrors the documented hookup in this fixture only. The existing unscoped port stays
 * available so an unintended fallback would make a real, detectable HTTP request. */
export const createOpsReadPort: OpsReadPortFactory = user => {
  const base = createBasePort(user)
  const branch = createBranchPortFor(branchReaders, user)
  return base && branch ? { ...base, branch } : null
}
