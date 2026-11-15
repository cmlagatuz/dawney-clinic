import type { Eligibility } from './eligibility.mjs'
export type ServiceSpeciesEntry = { serviceId: string; status: 'ready' | 'error'; ids?: string[]; message?: string }
export type ServiceSpeciesView =
  | { status: 'idle' | 'loading'; ids: null; message: '' }
  | { status: 'error'; ids: null; message: string }
  | { status: 'ready'; ids: string[]; message: '' }
export function serviceSpeciesView(serviceId: string, entry: ServiceSpeciesEntry | null): ServiceSpeciesView
export function applyServiceSpecies<P extends { eligibility: Eligibility; species_id?: string | null }>(pets: P[], view: ServiceSpeciesView): P[]
export function canBookPet(pet: { eligibility: Eligibility; species_id?: string | null } | null | undefined, view: ServiceSpeciesView): boolean
export function serviceSpeciesErrorText(view: ServiceSpeciesView): string
