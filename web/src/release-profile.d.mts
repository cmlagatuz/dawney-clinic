export type ReleaseProfile = 'informational' | 'connected'
export type ReleaseCapabilities = {
  profile: ReleaseProfile
  publicInformation: true
  mayCheckBooking: boolean
  mayRenderOwnerAccess: boolean
  canConfirmAppointments: false
  canPublishServices: false
  canEnableStaff: false
  canEnableClinicalWrites: false
  canEnablePharmacyWrites: false
  canEnableBilling: false
}
export const PUBLIC_INFORMATIONAL: 'informational'
export const OWNER_BOOKING_CANDIDATE: 'connected'
export function resolveReleaseProfile(raw: unknown): ReleaseProfile
export function releaseCapabilities(raw: unknown, backendConfigured: boolean): ReleaseCapabilities
