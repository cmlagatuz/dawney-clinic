import {OPS_ROLES} from './ops-model.mjs'

/**
 * Pure, injectable core of the read-only Operations port. `port.ts` supplies Astra's real
 * staff-clinic functions; tests supply fakes. Read-only by construction: only three reads exist.
 * - verify() must return the SAME user id the port was created for, with a known staff role
 *   (an account switch can never surface another account's membership).
 * - window()/counts() re-verify through the injected functions on every call, so a revoked
 *   membership fails the next read with a denial instead of serving cached data.
 * - Nothing here catches an error into an empty list/zero, and nothing falls back to samples.
 */
export function createReadPortFor(deps, user) {
  const uid = user && typeof user.id === 'string' ? user.id : ''
  if (!uid) return null
  return {
    async verify() {
      const s = await deps.verifiedStaffSession(user)
      if (!s || s.userId !== uid || s.isActive !== true || !OPS_ROLES.includes(s.role))
        throw Error('Clinic staff access is not approved')
      return {userId: s.userId, role: s.role}
    },
    window: (fromUtc, toUtc) => deps.listClinicQueueWindow(user, fromUtc, toUtc),
    counts: () => deps.getClinicDashboardCounts(user)
  }
}

import {branchDenied, deriveBranches, isBranchId} from './branch-model.mjs'

/**
 * Branch-scoped read port (source-only; needs Astra's #80 client readers). Injected deps:
 *  listOwnBranchMemberships(user) → own staff_branch_memberships rows
 *  listClinicBranches()          → public clinic_branches rows
 *  assertStaffBranch(user, id)   → RPC assert_staff_branch (rejects 42501 when unauthorized)
 *  listBranchQueueWindow(user, id, fromUtc, toUtc) / getBranchDashboardCounts(user, id)
 * Every call re-checks the id shape, re-asserts server-side where it matters, and passes errors through.
 */
export function createBranchPortFor(deps, user) {
  const uid = user && typeof user.id === 'string' ? user.id : ''
  if (!uid) return null
  const guard = id => { if (!isBranchId(id)) throw branchDenied() }
  return {
    async load() {
      const [memberships, catalog] = await Promise.all([deps.listOwnBranchMemberships(user), deps.listClinicBranches()])
      return deriveBranches(memberships, catalog, uid)
    },
    async assertBranch(id) {
      guard(id)
      const r = await deps.assertStaffBranch(user, id)
      if (r !== id) throw branchDenied()
      return id
    },
    window(id, fromUtc, toUtc) { guard(id); return deps.listBranchQueueWindow(user, id, fromUtc, toUtc) },
    counts(id) { guard(id); return deps.getBranchDashboardCounts(user, id) }
  }
}
