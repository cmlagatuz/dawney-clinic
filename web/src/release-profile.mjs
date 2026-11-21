/**
 * CLOUD — owner-selected frontend release profile. This is a build-time UI
 * capability gate, NOT backend authorization and not a service approval flag.
 * Query strings, hostnames, Pages preview domains and local storage MUST NOT
 * select or upgrade a release profile.
 */
export const PUBLIC_INFORMATIONAL = 'informational'
export const OWNER_BOOKING_CANDIDATE = 'connected'

export function resolveReleaseProfile(raw) {
  return raw === OWNER_BOOKING_CANDIDATE ? OWNER_BOOKING_CANDIDATE : PUBLIC_INFORMATIONAL
}

/** "connected" means the client may CHECK the approved backend contract,
 * never that online booking is actually available or a request confirmed. */
export function releaseCapabilities(raw, backendConfigured) {
  const profile = resolveReleaseProfile(raw)
  const canCheckBackend = profile === OWNER_BOOKING_CANDIDATE && backendConfigured === true
  return Object.freeze({
    profile,
    publicInformation: true,
    mayCheckBooking: canCheckBackend,
    mayRenderOwnerAccess: canCheckBackend,
    canConfirmAppointments: false,
    canPublishServices: false,
    canEnableStaff: false,
    canEnableClinicalWrites: false,
    canEnablePharmacyWrites: false,
    canEnableBilling: false
  })
}
