export type BookingMode = 'legacy' | 'service' | 'no-services' | 'incomplete' | 'unknown'
export function isMissingPolicyTable(error: unknown): boolean
export function classifyBookingMode(input: { policyError?: unknown; schedule?: unknown; servicesError?: unknown; services?: unknown[] }): BookingMode
export const SAFE_BOOKING_MESSAGE: RegExp
export const POLICY_CHANGED: RegExp
