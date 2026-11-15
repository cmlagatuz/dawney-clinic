/**
 * Service-specific animal eligibility, layered on top of the global typed-catalog eligibility.
 *
 * `entry` is the last settled lookup for ONE service: { serviceId, status: 'ready'|'error', ids?, message? }.
 * The view is derived against the CURRENTLY selected service, so a response that belongs to a previously selected
 * service can never be read as current (it is reported as 'loading') and can never unlock a patient.
 *
 *  idle     – no service chosen (nothing to check, nothing to submit)
 *  loading  – lookup for the current service has not settled; submission is blocked
 *  error    – lookup failed (database/Auth/RLS/malformed); submission is blocked and a retry is offered.
 *             This is NOT the same as an empty mapping and never claims the service is unsupported.
 *  ready    – RLS-filtered species ids for this service (an empty list is a valid "no species offered")
 */
export function serviceSpeciesView(serviceId, entry) {
  if (!serviceId) return { status: 'idle', ids: null, message: '' }
  if (!entry || entry.serviceId !== serviceId) return { status: 'loading', ids: null, message: '' }
  if (entry.status === 'ready' && Array.isArray(entry.ids)) return { status: 'ready', ids: entry.ids, message: '' }
  return { status: 'error', ids: null, message: typeof entry.message === 'string' ? entry.message : '' }
}

/** Only a settled mapping can mark a globally eligible patient as not offered for this service. */
export function applyServiceSpecies(pets, view) {
  if (!view || view.status !== 'ready') return pets ?? []
  const offered = new Set(view.ids)
  return (pets ?? []).map(p => p.eligibility === 'eligible' && !(typeof p.species_id === 'string' && offered.has(p.species_id)) ? { ...p, eligibility: 'service' } : p)
}

/** Single submit gate used by both booking interfaces: global eligibility AND a settled, matching service mapping. */
export function canBookPet(pet, view) {
  return Boolean(pet) && pet.eligibility === 'eligible' && view?.status === 'ready'
    && typeof pet.species_id === 'string' && view.ids.includes(pet.species_id)
}

/** Safe, non-technical message; the raw database/Auth error is never shown. */
export function serviceSpeciesErrorText(view) {
  return /login required/i.test(view?.message ?? '')
    ? 'Please sign in with a verified account so we can check which animals this service is offered for. Nothing was submitted.'
    : 'We could not check which animals this service is offered for, so nothing can be submitted right now.'
}
