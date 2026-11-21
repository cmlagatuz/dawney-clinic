export type Branch = {
  readonly id: 'naga' | 'cavite'
  readonly name: string
  readonly shortName: string
  readonly area: string
  readonly address: string
  readonly mapsUrl: string
  readonly facebookUrl: string
  readonly messageLabel: string
  readonly hours: readonly string[]
}
export const CLINIC_NAME: string
export const DEFAULT_BRANCH_ID: 'naga'
export const CLINIC_TIME_ZONE: string
export const BRANCH_HOURS: readonly string[]
export const SUNDAY_NOTE: string
export const BRANCHES: readonly Branch[]
export const NAGA: Branch
export const CAVITE: Branch
export function getBranch(id: string): Branch | null
export const NAGA_SERVICE_CATEGORIES: readonly string[]
export const CLINIC_LOCATION: string
export const DIRECTIONS_URL: string
export const CLINIC_PHONE: string | null
export const CLINIC_HOURS: readonly string[]
export function telHref(phone: unknown): string | null
export function isSafeExternalUrl(url: string): boolean
