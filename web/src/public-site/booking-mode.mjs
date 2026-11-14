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
