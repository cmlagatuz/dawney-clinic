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
