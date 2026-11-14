export type Eligibility = 'eligible' | 'unsupported' | 'review' | 'unknown'
type PetLike = { id: string; species_id?: string | null; taxonomy_review_needed?: boolean }
type SpeciesLike = { id: string; is_active: boolean; clinic_supported: boolean; review_status: string }
export function petEligibility(pet: PetLike | null | undefined, speciesById: Map<string, SpeciesLike>): Eligibility
export function eligibilityNote(status: Eligibility): string
export function eligibilityHelp(status: Eligibility): string
export function annotatePets<P extends PetLike>(pets: P[], species: SpeciesLike[]): Array<P & { eligibility: Eligibility }>
export function firstEligibleId(pets: Array<{ id: string; eligibility: Eligibility }>): string
