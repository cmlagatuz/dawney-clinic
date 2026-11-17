import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { listAnimalTypes, listCatalogPets, type CatalogPet } from '../lib/taxonomy'
import { annotatePets, type Eligibility } from './eligibility.mjs'

export type EligiblePet = CatalogPet & { eligibility: Eligibility }
export type PatientEligibility = { status: 'loading' | 'ready' | 'error'; pets: EligiblePet[]; reload: () => void }

/** Owner-scoped (RLS) patients + the typed species catalog. Read-only; legacy records are annotated, never modified. */
export function usePatientEligibility(user: User | null): PatientEligibility {
  const [s, setS] = useState<{ status: 'loading' | 'ready' | 'error'; pets: EligiblePet[] }>({ status: 'loading', pets: [] })
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!user) { setS({ status: 'loading', pets: [] }); return }
    let live = true
    setS(x => ({ ...x, status: 'loading' }))
    Promise.all([listCatalogPets(user), listAnimalTypes()])
      .then(([pets, species]) => { if (live) setS({ status: 'ready', pets: annotatePets(pets, species) as EligiblePet[] }) })
      .catch(() => { if (live) setS({ status: 'error', pets: [] }) })
    return () => { live = false }
  }, [user, n])
  const reload = useCallback(() => setN(v => v + 1), [])
  return { ...s, reload }
}
