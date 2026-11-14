export const CLINIC_NAME: string
export const CLINIC_LOCATION: string
export const DIRECTIONS_URL: string
export const CLINIC_PHONE: string | null
export const CLINIC_HOURS: readonly string[] | null
export function telHref(phone: unknown): string | null
export function isSafeExternalUrl(url: string): boolean
