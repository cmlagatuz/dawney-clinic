// Single source for PUBLIC clinic facts. Only owner-approved values may appear here
// (Issue #76, owner decision 2026-11-17). Naga is the primary public branch; Cavite Main is informational only.
// Nothing here approves booking, slots, prices, durations or Sunday hours, and none of it is a clinic_services row.

export const CLINIC_NAME = 'Dawney Animal Clinic'
export const DEFAULT_BRANCH_ID = 'naga'
export const CLINIC_TIME_ZONE = 'Asia/Manila'

/** Owner-supplied display hours for the branch profiles (not booking hours). Sunday was not supplied → never asserted. */
export const BRANCH_HOURS = Object.freeze(['Monday–Saturday, 8:00 AM–5:00 PM (Philippine time)'])
export const SUNDAY_NOTE = 'Sunday hours have not been confirmed.'

export const BRANCHES = Object.freeze([
  Object.freeze({
    id: 'naga',
    name: 'Dawney Animal Clinic — Naga Branch',
    shortName: 'Naga',
    area: 'Naga, Camarines Sur, Philippines',
    address: '80 Perpetual Help Street, Peñafrancia Avenue, Naga, Camarines Sur, Philippines',
    mapsUrl: 'https://maps.app.goo.gl/7LrLejjre332MyxT6',
    facebookUrl: 'https://www.facebook.com/people/Dawney-Animal-Clinic-Naga/100057231318115/',
    messageLabel: 'Message Naga on Facebook',
    hours: BRANCH_HOURS
  }),
  Object.freeze({
    id: 'cavite',
    name: 'Dawney Animal Clinic — Cavite Main Branch',
    shortName: 'Cavite Main',
    area: 'General Trias, Cavite, Philippines',
    address: 'Phase 5 Lot 14 Block 1, San Francisco, Brookside Lane, EBS BUILDING, Arnaldo Hwy, General Trias, Cavite, Philippines',
    mapsUrl: 'https://maps.app.goo.gl/6XWkKudFbJXay1GJA',
    facebookUrl: 'https://www.facebook.com/p/Dawney-Animal-Clinic-100063754752769/',
    messageLabel: 'Message Cavite on Facebook',
    hours: BRANCH_HOURS
  })
])

export function getBranch(id) { return BRANCHES.find(b => b.id === id) ?? null }
export const NAGA = BRANCHES[0]
export const CAVITE = BRANCHES[1]

/** Owner-approved INFORMATIONAL categories for the Naga listing. No procedures, prices, durations or availability. */
export const NAGA_SERVICE_CATEGORIES = Object.freeze([
  'Veterinary consultations', 'Vaccinations', 'Deworming', 'Diagnostic services',
  'Surgical procedures', 'Dental care', 'Grooming', 'Hospitalization'
])

// Back-compat single-clinic exports now describe the PRIMARY (Naga) branch.
export const CLINIC_LOCATION = NAGA.area
export const DIRECTIONS_URL = NAGA.mapsUrl
/** No phone number has been supplied. null → no phone link; contact is via the Facebook page links. */
export const CLINIC_PHONE = null
export const CLINIC_HOURS = BRANCH_HOURS

export function telHref(phone) {
  if (typeof phone !== 'string') return null
  const digits = phone.replace(/[^\d+]/g, '')
  return /^\+?\d{7,15}$/.test(digits) ? `tel:${digits}` : null
}
export function isSafeExternalUrl(url) {
  try { const u = new URL(url); return u.protocol === 'https:' && !u.username && !u.password && !u.search && !u.hash } catch { return false }
}
