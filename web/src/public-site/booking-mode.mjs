import { isUsablePolicy } from './slots.mjs'

/** PostgREST PGRST205 / PostgreSQL 42P01 naming the Phase 4 policy table = schema not installed yet (legacy rollout window). */
export function isMissingPolicyTable(error) {
  if (!error || typeof error !== 'object') return false
  return (error.code === 'PGRST205' || error.code === '42P01') && typeof error.message === 'string' && error.message.includes('clinic_booking_policy')
}

/**
 * Which owner booking form to show. Never infers approval:
 *  legacy      – policy table missing, or policy not approved (null) → existing 30-minute request flow
 *  service     – approved, usable policy and at least one published service
 *  no-services – approved but nothing published → no booking form
 *  incomplete  – approved row that is not a complete policy → no booking form
 *  unknown     – policy/service read failed for any other reason → no booking form (fail closed)
 */
export function classifyBookingMode({ policyError, schedule, servicesError, services }) {
  if (policyError) return isMissingPolicyTable(policyError) ? 'legacy' : 'unknown'
  if (!schedule) return 'legacy'
  if (!isUsablePolicy(schedule)) return 'incomplete'
  if (servicesError) return 'unknown'
  return Array.isArray(services) && services.length > 0 ? 'service' : 'no-services'
}

/** Only these adapter messages are safe to show; everything else becomes a generic failure. */
export const SAFE_BOOKING_MESSAGE = /^(Complete owner profile|Select a registered patient|Verified customer login|A valid patient|Explicit UTC|Invalid booking|Choose|Enter|Select|Create an owner|Clinic scheduling now requires|Clinic service booking remains|Cannot verify clinic booking policy)/
/** Adapter says the policy flipped under an open form → reload the mode instead of retrying. */
export const POLICY_CHANGED = /^(Clinic scheduling now requires|Clinic service booking remains)/

/** PostgreSQL trigger text raised by validate_service_appointment() when a service-less insert reaches an APPROVED policy (stale form / race). */
export const DB_REQUIRES_SERVICE = /Select an approved service to request/i
export const POLICY_FLIPPED_MESSAGE = 'The clinic now takes appointment requests by service. Nothing was booked. Please use the updated request form.'

/** Message of an Error OR a plain PostgREST error object (supabase-js errors are not always Error instances). */
export function failureText(e) {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && typeof e.message === 'string') return e.message
  return ''
}
/** True when a failed legacy attempt means "the policy is now approved": reload the mode, never retry the legacy insert. */
export function isPolicyFlip(e) {
  const t = failureText(e)
  return POLICY_CHANGED.test(t) || DB_REQUIRES_SERVICE.test(t)
}

/**
 * Single decision for what the owner Appointments card renders. The service-less (legacy) form is returned ONLY for the
 * explicit 'legacy' mode (policy unapproved or schema not installed) with a loaded, settled mode check. Every approved,
 * unknown, loading, or inconsistent state resolves to something else, so there is no fall-through to the old form.
 */
export function ownerFormView({ loading, mode, hasPets, hasSchedule, hasUser, resourceCount }) {
  if (!hasPets) return 'no-pets'
  if (loading) return 'checking'
  if (mode === 'service') return hasSchedule && hasUser ? 'service' : 'unknown'
  if (mode === 'no-services' || mode === 'incomplete') return 'paused'
  if (mode === 'legacy') return resourceCount > 0 ? 'legacy' : 'no-calendar'
  return 'unknown'
}
