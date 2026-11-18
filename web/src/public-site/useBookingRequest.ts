import { useLayoutEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  freshBookingRequestNonce, requestAuthenticatedServiceBooking, type RequestBookingInput, type RequestedBooking
} from '../lib/public-booking'
import { SAFE_BOOKING_MESSAGE } from './booking-mode.mjs'

type RequestFields = Omit<RequestBookingInput, 'requestNonce'>
const failed = 'We could not save this request. Try again, choose another time, or contact the clinic if the problem continues.'

/** The caller mounts this with a key scoped to the verified account and branch. */
export function useBookingRequest(user: User | null, onBooked: (booking: RequestedBooking) => void) {
  const active = useRef(false)
  const inFlight = useRef(false)
  const previous = useRef<{ fields: string; nonce: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useLayoutEffect(() => {
    active.current = true
    return () => { active.current = false }
  }, [])

  async function send(fields: RequestFields) {
    if (!user || !active.current || inFlight.current) return
    const fingerprint = JSON.stringify([
      fields.petId, fields.serviceId, fields.resourceId, fields.startsAtUtc, fields.concern, fields.details
    ])
    if (previous.current?.fields !== fingerprint) {
      previous.current = { fields: fingerprint, nonce: freshBookingRequestNonce() }
    }

    inFlight.current = true
    setSaving(true)
    setError(null)
    let booking: RequestedBooking
    try {
      booking = await requestAuthenticatedServiceBooking(user, { ...fields, requestNonce: previous.current.nonce })
    } catch (err) {
      if (active.current) {
        setError(err instanceof Error && SAFE_BOOKING_MESSAGE.test(err.message) ? err.message : failed)
      }
      return
    } finally {
      inFlight.current = false
      if (active.current) setSaving(false)
    }
    if (!active.current) return
    previous.current = null
    onBooked(booking)
  }

  return { send, saving, error, clearError: () => setError(null) }
}
