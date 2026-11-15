import { useCallback, useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { listServiceSpeciesIds } from '../lib/public-booking'
import { serviceSpeciesView, type ServiceSpeciesEntry, type ServiceSpeciesView } from './service-eligibility.mjs'

/**
 * Authenticated, RLS-filtered species offered for the selected service. Anonymous visitors never trigger a read.
 * Refetches on service change; the view is derived against the current service so stale responses cannot apply.
 */
export function useServiceSpecies(user: User | null, serviceId: string): ServiceSpeciesView & { reload: () => void } {
  const [entry, setEntry] = useState<ServiceSpeciesEntry | null>(null)
  const [n, setN] = useState(0)
  useEffect(() => {
    setEntry(null)
    if (!user || !serviceId) return
    let live = true
    listServiceSpeciesIds(serviceId)
      .then(ids => { if (live) setEntry({ serviceId, status: 'ready', ids }) })
      .catch(err => { if (live) setEntry({ serviceId, status: 'error', message: err instanceof Error ? err.message : '' }) })
    return () => { live = false }
  }, [user, serviceId, n])
  const reload = useCallback(() => setN(v => v + 1), [])
  const signedIn = Boolean(user)
  return useMemo(() => ({ ...serviceSpeciesView(signedIn ? serviceId : '', entry), reload }), [signedIn, serviceId, entry, reload])
}
