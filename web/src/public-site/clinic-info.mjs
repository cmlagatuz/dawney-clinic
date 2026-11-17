// Single source for PUBLIC clinic facts. Only owner-supplied values may appear here.
// Phone, address detail and opening hours are intentionally null until the owner confirms them
// (directory listings disagree on unit, phone and hours; the booking spec forbids guessing).

export const CLINIC_NAME = 'Dawney Animal Clinic'
export const CLINIC_LOCATION = 'General Trias, Cavite, Philippines'
/** Owner-supplied Google Maps short link, used verbatim. */
export const DIRECTIONS_URL = 'https://maps.app.goo.gl/JGCXR1H6sHN42aSo6'
/** Owner-confirmed, e.g. '0912 345 6789'. null = not yet confirmed → "pending" state, no tel: link. */
export const CLINIC_PHONE = null
/** Owner-confirmed opening hours as display lines, e.g. ['Mon–Sat 8:00–17:00']. null = not yet confirmed. */
export const CLINIC_HOURS = null

export function telHref(phone) {
  if (typeof phone !== 'string') return null
  const digits = phone.replace(/[^\d+]/g, '')
  return /^\+?\d{7,15}$/.test(digits) ? `tel:${digits}` : null
}
export function isSafeExternalUrl(url) {
  try { const u = new URL(url); return u.protocol === 'https:' && !u.username && !u.password } catch { return false }
}
