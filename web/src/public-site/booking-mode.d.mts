export type BookingMode = 'legacy' | 'service' | 'no-services' | 'incomplete' | 'unknown'
export function isMissingPolicyTable(error: unknown): boolean
export function classifyBookingMode(input: { policyError?: unknown; schedule?: unknown; servicesError?: unknown; services?: unknown[] }): BookingMode
export const SAFE_BOOKING_MESSAGE: RegExp
export const POLICY_CHANGED: RegExp
export const DB_REQUIRES_SERVICE: RegExp
export const POLICY_FLIPPED_MESSAGE: string
export function failureText(error: unknown): string
export function isPolicyFlip(error: unknown): boolean
export type OwnerFormView = 'no-pets' | 'checking' | 'service' | 'unknown' | 'paused' | 'legacy' | 'no-calendar'
export function ownerFormView(input: { loading: boolean; mode: BookingMode; hasPets: boolean; hasSchedule: boolean; hasUser: boolean; resourceCount: number }): OwnerFormView
