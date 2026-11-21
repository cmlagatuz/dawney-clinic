import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { listAnimalTypes, listCatalogPets, type CatalogPet } from '../lib/taxonomy'
import { annotatePets, type Eligibility } from './eligibility.mjs'

export type EligiblePet = CatalogPet & { eligibility: Eligibility }
export type PatientEligibility = { status: 'loading' | 'ready' | 'error'; pets: EligiblePet[]; reload: () => void }

type ScopedResult = { accountId: string; revision: number; status: 'ready' | 'error'; pets: EligiblePet[] }

/**
 * Derive the view against the CURRENT signed-in account and fetch revision.
 * An old owner's settled pets must never become visible for even one render
 * while React has not yet run the new account's cleanup effect.
 */
export function usePatientEligibility(user: User | null): PatientEligibility {
  const accountId = user?.id ?? null
  const [entry, setEntry] = useState<ScopedResult | null>(null)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (!user || !accountId) return
    let live = true
    Promise.all([listCatalogPets(user), listAnimalTypes()])
      .then(([pets, species]) => {
        if (live) setEntry({ accountId, revision, status: 'ready', pets: annotatePets(pets, species) as EligiblePet[] })
      })
      .catch(() => {
        if (live) setEntry({ accountId, revision, status: 'error', pets: [] })
      })
    return () => { live = false }
    // Auth token refresh may replace the User object; only the account ID scopes this lookup.
  }, [accountId, revision])
  const reload = useCallback(() => setRevision(n => n + 1), [])
  if (!accountId || entry?.accountId !== accountId || entry.revision !== revision) {
    return { status: 'loading', pets: [], reload }
  }
  return { status: entry.status, pets: entry.pets, reload }
}
