import { useCallback, useEffect, useState } from 'react'
import { listPublicClinicServices, readApprovedPublicSchedule, type ApprovedClinicSchedule, type PublicClinicService } from '../lib/public-booking'

export type PublicCatalog = { status: 'loading' | 'ready' | 'error'; services: PublicClinicService[]; schedule: ApprovedClinicSchedule | null; reload: () => void }

/** Read-only, anonymous-safe catalog: owner-approved services and the approved schedule (null until approved). Nothing is cached or invented. */
export function usePublicCatalog(): PublicCatalog {
  const [state, setState] = useState<Omit<PublicCatalog, 'reload'>>({ status: 'loading', services: [], schedule: null })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let live = true
    setState(s => ({ ...s, status: 'loading' }))
    Promise.all([listPublicClinicServices(), readApprovedPublicSchedule()])
      .then(([services, schedule]) => { if (live) setState({ status: 'ready', services, schedule }) })
      .catch(() => { if (live) setState({ status: 'error', services: [], schedule: null }) })
    return () => { live = false }
  }, [attempt])
  const reload = useCallback(() => setAttempt(n => n + 1), [])
  return { ...state, reload }
}
