/**
 * Patient booking eligibility, derived ONLY from typed catalog data (pets.species_id / taxonomy_review_needed and
 * species_catalog.clinic_supported / is_active / review_status). Never inferred from the free-text species label.
 * The booking RPC/trigger remains the authority; this only prevents sending requests the server is known to refuse.
 *
 *  eligible    – species_id points at an active, clinic-supported, non-pending catalog species
 *  unsupported – catalog says the clinic does not (yet) treat this species, or its review is pending
 *  review      – legacy/uncategorised record (no species_id) or flagged taxonomy_review_needed: needs clinic review first
 *  unknown     – species_id not found in the active catalog (cannot verify)
 */
export function petEligibility(pet, speciesById) {
  if (!pet || typeof pet !== 'object') return 'unknown'
  if (!pet.species_id || pet.taxonomy_review_needed === true) return 'review'
  const sp = speciesById && typeof speciesById.get === 'function' ? speciesById.get(pet.species_id) : undefined
  if (!sp) return 'unknown'
  if (!sp.is_active || sp.clinic_supported !== true || sp.review_status === 'pending') return 'unsupported'
  return 'eligible'
}

const NOTE = {
  eligible: '',
  unsupported: 'not available for online booking',
  review: 'needs clinic review before online booking',
  unknown: 'cannot be checked right now',
}
export const eligibilityNote = status => NOTE[status] ?? NOTE.unknown

/** Visible explanation for the selected/blocked patients. Never promises treatment or availability. */
export function eligibilityHelp(status) {
  if (status === 'unsupported') return 'The clinic does not offer online booking for this type of animal yet. Please contact the clinic and we will tell you what is possible.'
  if (status === 'review') return 'This patient’s record was created before animal types were organised. The clinic needs to review it before online booking. Please contact the clinic; the record itself is unchanged.'
  if (status === 'unknown') return 'We could not check whether online booking is available for this patient. Try again, or contact the clinic.'
  return ''
}

export function annotatePets(pets, species) {
  const byId = new Map((species ?? []).map(s => [s.id, s]))
  return (pets ?? []).map(p => ({ ...p, eligibility: petEligibility(p, byId) }))
}
export const firstEligibleId = pets => pets.find(p => p.eligibility === 'eligible')?.id ?? ''
