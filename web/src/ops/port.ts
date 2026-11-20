import type {OpsReadPortFactory} from './read-port'
import {createBranchPortFor} from './port-adapter.mjs'
import {verifiedStaffSession} from '../lib/staff-clinic'
import {
  listOwnBranchMemberships, listClinicBranches, assertStaffBranch,
  listBranchQueueWindow, getBranchDashboardCounts
} from '../lib/staff-branch'

/**
 * CLOUD Issue #58: the *only* live Operations data path is the verified,
 * branch-scoped reader approved in PR #85. Branch selection merely narrows
 * the UI: membership and assert_staff_branch are checked by the server.
 *
 * The old global queue/count adapters are intentionally NOT imported.
 * The interface's legacy methods reject so a future accidental unscoped
 * caller fails visibly instead of broadening clinic data access.
 *
 * VITE_PHASE5A_OPS_UI remains OFF until staged Auth/RLS acceptance.
 */
const branchDeps = {
  listOwnBranchMemberships, listClinicBranches, assertStaffBranch,
  listBranchQueueWindow, getBranchDashboardCounts
}
const unscopedDenied = () =>
  Promise.reject(Object.assign(new Error('Branch-scoped staff access required'), {code:'42501'}))

export const createOpsReadPort: OpsReadPortFactory = user => {
  const branch = createBranchPortFor(branchDeps, user)
  if (!branch) return null
  return {
    async verify() {
      const member = await verifiedStaffSession(user)
      if (member.userId !== user.id || !member.isActive)
        throw Object.assign(new Error('Clinic staff access is not approved'), {code:'42501'})
      return {userId: member.userId, role: member.role}
    },
    window: unscopedDenied,
    counts: unscopedDenied,
    branch
  }
}
