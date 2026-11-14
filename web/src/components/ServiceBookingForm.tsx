import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { freshBookingRequestNonce, listPublishedServiceResources, type ApprovedClinicSchedule, type PublicClinicService, type PublishedServiceResource, type RequestedBooking } from '../lib/public-booking'
import { submitOwnerAppointment } from '../lib/owner-booking-transition'
import { formatClinicDate, formatClockTime, generateSlots } from '../public-site/slots.mjs'
import { POLICY_CHANGED, SAFE_BOOKING_MESSAGE } from '../public-site/booking-mode.mjs'
import { Spinner } from './ui'
import { PatientSelect } from './PatientSelect'
import { usePatientEligibility } from '../public-site/usePatientEligibility'
import { firstEligibleId } from '../public-site/eligibility.mjs'

const generic = 'We could not save this request. The time may no longer be available, or this service may not be offered for the selected animal. Please choose another time or contact the clinic.'

/** Owner-portal service-aware request (approved policy only). Submits through Astra's transition adapter → authenticated RPC; status shown is the persisted one. */
export function ServiceBookingForm({ user, services, policy, onBooked, onPolicyChanged }: {
  user: User; services: PublicClinicService[]; policy: ApprovedClinicSchedule
  onBooked: (b: RequestedBooking) => void; onPolicyChanged: () => void
}) {
  const elig = usePatientEligibility(user)
  const [petId, setPetId] = useState('')
  useEffect(() => { setPetId(cur => elig.pets.some(p => p.id === cur && p.eligibility === 'eligible') ? cur : firstEligibleId(elig.pets)) }, [elig.pets])
  const chosen = elig.pets.find(p => p.id === petId)
  const [serviceId, setServiceId] = useState('')
  const [resources, setResources] = useState<PublishedServiceResource[] | null>(null)
  const [resourceId, setResourceId] = useState('')
  const [date, setDate] = useState('')
  const [startsAtUtc, setStartsAtUtc] = useState('')
  const [concern, setConcern] = useState('')
  const [details, setDetails] = useState('')
  const [nonce, setNonce] = useState(freshBookingRequestNonce)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const touch = () => { setNonce(freshBookingRequestNonce()); setError(null) }
  const service = services.find(s => s.id === serviceId) ?? null
  const days = useMemo(() => service ? generateSlots(policy, service.duration_minutes) : [], [service, policy])
  const day = days.find(d => d.date === date) ?? null

  useEffect(() => {
    setResources(null); setResourceId(''); setDate(''); setStartsAtUtc('')
    if (!serviceId) return
    let live = true
    listPublishedServiceResources(serviceId).then(r => { if (live) { setResources(r); if (r.length === 1 && r[0]) setResourceId(r[0].resource_id) } }).catch(() => { if (live) setResources([]) })
    return () => { live = false }
  }, [serviceId])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (saving || !petId || chosen?.eligibility !== 'eligible' || !serviceId || !resourceId || !startsAtUtc) return
    setSaving(true); setError(null)
    try {
      const booking = await submitOwnerAppointment(user, { kind: 'service', booking: { petId, serviceId, resourceId, startsAtUtc, requestNonce: nonce, concern: concern.trim(), details: details.trim() || null } }) as RequestedBooking
      setNonce(freshBookingRequestNonce()); setStartsAtUtc(''); setConcern(''); setDetails('')
      onBooked(booking)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (POLICY_CHANGED.test(msg)) onPolicyChanged()
      setError(SAFE_BOOKING_MESSAGE.test(msg) ? msg : generic) // nonce kept: an identical retry is idempotent
    } finally { setSaving(false) }
  }

  if (elig.status === 'loading') return <p role="status" className="field-help"><Spinner /> Checking which patients can be booked online…</p>
  if (elig.status === 'error') return <p role="alert" className="alert alert-error">We could not check which patients can be booked online, so nothing was submitted. <button type="button" className="button-quiet" onClick={elig.reload}>Try again</button></p>
  return <form className="form-stack" onSubmit={e => void submit(e)} aria-label="Appointment request">
    <PatientSelect pets={elig.pets} value={petId} onChange={id => { setPetId(id); touch() }} />
    <label>Service<select required value={serviceId} onChange={e => { setServiceId(e.target.value); touch() }}>
      <option value="">Choose a service</option>{services.map(s => <option key={s.id} value={s.id}>{s.display_name} (about {s.duration_minutes} min)</option>)}</select></label>
    {service && (resources === null ? <p role="status" className="field-help"><Spinner /> Loading options…</p>
      : resources.length === 0 ? <p className="alert alert-info" role="note">No bookable options are published for this service yet. Please contact the clinic.</p> : <>
        {resources.length > 1 && <label>Option<select required value={resourceId} onChange={e => { setResourceId(e.target.value); touch() }}><option value="">Choose an option</option>{resources.map((r, i) => <option key={r.resource_id} value={r.resource_id}>{r.public_label ?? `Option ${i + 1}`}</option>)}</select></label>}
        {days.length === 0 ? <p className="alert alert-info" role="note">No times are available in the booking window right now. Please check back later or contact the clinic.</p> : <>
          <label>Date <small>(clinic time, {policy.timezone})</small><select required value={date} onChange={e => { setDate(e.target.value); setStartsAtUtc(''); touch() }}><option value="">Choose a date</option>{days.map(d => <option key={d.date} value={d.date}>{formatClinicDate(d.date)}</option>)}</select></label>
          {day && <div role="radiogroup" aria-label={`Times on ${formatClinicDate(day.date)}`} className="slot-grid">{day.slots.map(s => <label key={s.startsAtUtc} className={s.startsAtUtc === startsAtUtc ? 'slot is-selected' : 'slot'}>
            <input type="radio" name="slot" value={s.startsAtUtc} checked={s.startsAtUtc === startsAtUtc} onChange={() => { setStartsAtUtc(s.startsAtUtc); touch() }} /><span>{formatClockTime(s.time)}</span></label>)}</div>}</>}</>)}
    <label>Reason for visit<input required maxLength={300} value={concern} placeholder="e.g. Annual health check" onChange={e => { setConcern(e.target.value); touch() }} /></label>
    <label>Details (optional)<textarea rows={3} maxLength={3000} value={details} onChange={e => { setDetails(e.target.value); touch() }} /></label>
    <p className="small-help">A request is <strong>not confirmed</strong> until the clinic confirms it. Times are clinic time.</p>
    {error && <p role="alert" className="alert alert-error">{error}</p>}
    <button className="button button-primary" disabled={saving || chosen?.eligibility !== 'eligible' || !resourceId || !startsAtUtc || !concern.trim()}>{saving ? 'Sending…' : 'Request appointment'}</button>
  </form>
}
