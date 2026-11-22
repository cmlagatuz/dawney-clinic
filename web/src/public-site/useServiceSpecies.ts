import { useCallback, useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { listServiceSpeciesIds } from '../lib/public-booking'
import { serviceSpeciesView, type ServiceSpeciesEntry, type ServiceSpeciesView } from './service-eligibility.mjs'

/**
 * Authenticated, RLS-filtered species offered for the selected service. Anonymous visitors never trigger a read.
 * Refetches on service change; the view is derived against the current service so stale responses cannot apply.
 */
export function useServiceSpecies(user: User | null, serviceId: string): ServiceSpeciesView & { reload: () => void } {
  const [entry, setEntry] = useState<(ServiceSpeciesEntry & { accountId: string; revision: number }) | null>(null)
  const [n, setN] = useState(0)
  const uid = user?.id ?? null // see usePatientEligibility: key on the account, not the object
  useEffect(() => {
    setEntry(null)
    if (!user || !serviceId) return
    let live = true
    listServiceSpeciesIds(serviceId)
      .then(ids => { if (live) setEntry({ accountId: uid!, revision: n, serviceId, status: 'ready', ids }) })
      .catch(err => { if (live) setEntry({ accountId: uid!, revision: n, serviceId, status: 'error', message: err instanceof Error ? err.message : '' }) })
    return () => { live = false }
  }, [uid, serviceId, n])
  const reload = useCallback(() => setN(v => v + 1), [])
  const signedIn = Boolean(user)
  return useMemo(() => ({ ...serviceSpeciesView(signedIn ? serviceId : '', entry?.accountId === uid && entry.revision === n ? entry : null), reload }), [signedIn, uid, n, serviceId, entry, reload])
}
