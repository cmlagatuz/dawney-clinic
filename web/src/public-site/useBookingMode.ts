import { useCallback, useEffect, useState } from 'react'
import { listPublicClinicServices, readApprovedPublicSchedule, type ApprovedClinicSchedule, type PublicClinicService } from '../lib/public-booking'
import { classifyBookingMode, type BookingMode } from './booking-mode.mjs'

export type BookingModeState = { loading: boolean; mode: BookingMode; schedule: ApprovedClinicSchedule | null; services: PublicClinicService[]; reload: () => void }

/** Read-only. Fails closed: only a missing policy table or an unapproved (null) policy selects the legacy flow. */
export function useBookingMode(): BookingModeState {
  const [s, setS] = useState<Omit<BookingModeState, 'reload'>>({ loading: true, mode: 'unknown', schedule: null, services: [] })
  const [n, setN] = useState(0)
  useEffect(() => {
    let live = true
    setS(x => ({ ...x, loading: true }))
    void (async () => {
      let schedule: ApprovedClinicSchedule | null = null, services: PublicClinicService[] = [], policyError: unknown, servicesError: unknown
      try { schedule = await readApprovedPublicSchedule() } catch (e) { policyError = e ?? new Error('policy read failed') }
      if (!policyError && schedule) { try { services = await listPublicClinicServices() } catch (e) { servicesError = e ?? new Error('services read failed') } }
      if (live) setS({ loading: false, mode: classifyBookingMode({ policyError, schedule, servicesError, services }), schedule, services })
    })()
    return () => { live = false }
  }, [n])
  const reload = useCallback(() => setN(v => v + 1), [])
  return { ...s, reload }
}
