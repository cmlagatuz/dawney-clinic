import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import type { ApprovedBranchSchedule, EligibleBranchService } from '../lib/branch-public-booking'
import type { RequestedBooking } from '../lib/public-booking'
import { useBookingRequest } from '../public-site/useBookingRequest'
import { formatClinicDate, formatClockTime, generateSlots } from '../public-site/slots.mjs'
import { Spinner } from './ui'
import { PatientSelect } from './PatientSelect'
import { usePatientEligibility } from '../public-site/usePatientEligibility'
import { firstEligibleId } from '../public-site/eligibility.mjs'
import { applyServiceSpecies, canBookPet, serviceSpeciesErrorText } from '../public-site/service-eligibility.mjs'
import { useServiceSpecies } from '../public-site/useServiceSpecies'

/** Owner-portal form for the approved branch service/resource pairs. */
export function ServiceBookingForm({ user, services, policy, onBooked }: {
  user: User; services: EligibleBranchService[]; policy: ApprovedBranchSchedule
  onBooked: (booking: RequestedBooking) => void
}) {
  const elig = usePatientEligibility(user)
  const [petId, setPetId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const sp = useServiceSpecies(user, serviceId)
  const pets = useMemo(() => applyServiceSpecies(elig.pets, sp), [elig.pets, sp])
  useEffect(() => { setPetId(cur => pets.some(p => p.id === cur && p.eligibility === 'eligible') ? cur : firstEligibleId(pets)) }, [pets])
  const chosen = pets.find(p => p.id === petId)
  const canBook = canBookPet(chosen, sp)
  const [chosenResource, setChosenResource] = useState('')
  const [date, setDate] = useState('')
  const [startsAtUtc, setStartsAtUtc] = useState('')
  const [concern, setConcern] = useState('')
  const [details, setDetails] = useState('')
  const service = services.find(s => s.id === serviceId) ?? null
  const resources = service?.resources ?? []
  const resourceId = resources.length === 1 ? (resources[0]?.resource_id ?? '') : chosenResource
  const days = useMemo(() => service ? generateSlots(policy, service.duration_minutes) : [], [service, policy])
  const day = days.find(d => d.date === date) ?? null
  const { send, saving, error, clearError } = useBookingRequest(user, booking => {
    setStartsAtUtc(''); setConcern(''); setDetails('')
    onBooked(booking)
  })
  const canSubmit = canBook && service && resources.some(resource => resource.resource_id === resourceId) &&
    day?.slots.some(slot => slot.startsAtUtc === startsAtUtc) && concern.trim()

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    void send({ petId, serviceId, resourceId, startsAtUtc, concern: concern.trim(), details: details.trim() || null })
  }

  if (elig.status === 'loading') return <p role="status" className="field-help"><Spinner /> Checking which patients can be booked online…</p>
  if (elig.status === 'error') return <p role="alert" className="alert alert-error">We could not check which patients can be booked online, so nothing was submitted. <button type="button" className="button-quiet" onClick={elig.reload}>Try again</button></p>
  return <form className="form-stack" onSubmit={submit} aria-label="Appointment request">
    <PatientSelect pets={pets} value={petId} onChange={id => { setPetId(id); clearError() }} />
    <label>Service<select required value={serviceId} onChange={e => { setServiceId(e.target.value); setChosenResource(''); setDate(''); setStartsAtUtc(''); clearError() }}>
      <option value="">Choose a service</option>{services.map(s => <option key={s.id} value={s.id}>{s.display_name} (about {s.duration_minutes} min)</option>)}</select></label>
    {service && sp.status === 'loading' && <p role="status" className="field-help"><Spinner /> Checking which animals this service is offered for…</p>}
    {service && sp.status === 'error' && <p role="alert" className="alert alert-error">{serviceSpeciesErrorText(sp)} <button type="button" className="button-quiet" onClick={sp.reload}>Try again</button></p>}
    {service && <>
        {resources.length > 1 && <label>Option<select required value={resourceId} onChange={e => { setChosenResource(e.target.value); clearError() }}><option value="">Choose an option</option>{resources.map((r, i) => <option key={r.resource_id} value={r.resource_id}>{r.public_label ?? `Option ${i + 1}`}</option>)}</select></label>}
        {days.length === 0 ? <p className="alert alert-info" role="note">No times are available in the booking window right now. Please check back later or contact the clinic.</p> : <>
          <label>Date <small>(clinic time, {policy.timezone})</small><select required value={date} onChange={e => { setDate(e.target.value); setStartsAtUtc(''); clearError() }}><option value="">Choose a date</option>{days.map(d => <option key={d.date} value={d.date}>{formatClinicDate(d.date)}</option>)}</select></label>
          {day && <div role="radiogroup" aria-label={`Times on ${formatClinicDate(day.date)}`} className="slot-grid">{day.slots.map(s => <label key={s.startsAtUtc} className={s.startsAtUtc === startsAtUtc ? 'slot is-selected' : 'slot'}>
            <input type="radio" name="slot" value={s.startsAtUtc} checked={s.startsAtUtc === startsAtUtc} onChange={() => { setStartsAtUtc(s.startsAtUtc); clearError() }} /><span>{formatClockTime(s.time)}</span></label>)}</div>}</>}</>}
    <label>Reason for visit<input required maxLength={300} value={concern} placeholder="e.g. Annual health check" onChange={e => { setConcern(e.target.value); clearError() }} /></label>
    <label>Details (optional)<textarea rows={3} maxLength={3000} value={details} onChange={e => { setDetails(e.target.value); clearError() }} /></label>
    <p className="small-help">A request is <strong>not confirmed</strong> until the clinic confirms it. Times are clinic time.</p>
    {error && <p role="alert" className="alert alert-error">{error}</p>}
    <button className="button button-primary" disabled={saving || !canSubmit}>{saving ? 'Sending…' : 'Request appointment'}</button>
  </form>
}
