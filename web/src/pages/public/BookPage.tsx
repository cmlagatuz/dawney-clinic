import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../hooks/AuthProvider'
import { readOwner } from '../../lib/owners'
import type { BranchBookingReadStatus } from '../../lib/branch-public-booking'
import type { RequestedBooking } from '../../lib/public-booking'
import type { PublicBookingIntent } from '../../booking-contract.mjs'
import { clearBookingIntent, readBookingIntent, saveBookingIntent, signinForBooking, utcToClinicSlot } from '../../booking-contract.mjs'
import { formatClinicDate, formatClockTime, generateSlots } from '../../public-site/slots.mjs'
import { usePageMeta } from '../../public-site/usePageMeta'
import { useBranchBooking } from '../../public-site/useBranchBooking'
import { useBookingRequest } from '../../public-site/useBookingRequest'
import { BranchBookingAvailability } from '../../components/BranchBookingAvailability'
import { DirectionsButton, MessageButton } from '../../components/SiteLayout'
import { PatientSelect } from '../../components/PatientSelect'
import { usePatientEligibility } from '../../public-site/usePatientEligibility'
import { firstEligibleId } from '../../public-site/eligibility.mjs'
import { applyServiceSpecies, canBookPet, serviceSpeciesErrorText } from '../../public-site/service-eligibility.mjs'
import { useServiceSpecies } from '../../public-site/useServiceSpecies'
import { PageHeading, Spinner, StatusBadge } from '../../components/ui'
import { release } from '../../release-mode'

function safeIntent(): PublicBookingIntent | null {
  try { return readBookingIntent(window.sessionStorage) } catch { return null }
}

const contact = <div className="cta-row"><MessageButton /><DirectionsButton secondary /><Link className="button button-secondary" to="/about#contact">All branches</Link></div>

export function BookPage() {
  usePageMeta('Booking information — Dawney Animal Clinic', 'Check clinic-approved Naga online requests when available, or use verified Naga and Cavite contact links.')
  return release.mayCheckBooking ? <ConnectedBookPage /> : <InformationalBookPage />
}
function InformationalBookPage() {
  return <div className="page">
    <PageHeading id="book-heading" eyebrow="Dawney Animal Clinic" title="Booking information">
      Online appointment requests are not available on this informational website. No appointment has been submitted, reserved or confirmed.
    </PageHeading>
    <section className="card" aria-labelledby="booking-contact-heading">
      <h2 id="booking-contact-heading">Contact a branch about a visit</h2>
      <p role="status">Please message our Naga Branch to check availability. Cavite Main Branch is contact-only. Neither branch offers online booking in this release profile.</p>
      {contact}
    </section>
  </div>
}
function ConnectedBookPage() {
  const { options, reload } = useBranchBooking()
  const { user } = useAuth()
  return <div className="page">
    <PageHeading id="book-heading" eyebrow="Dawney Animal Clinic — Naga Branch" title="Book an appointment">
      Check online booking for Naga. The clinic reviews every request before confirming it.
    </PageHeading>
    {options.kind === 'ready'
      ? <PublicBookingForm key={JSON.stringify([user?.id ?? null, options.branchId])} user={user} config={options} />
      : <>
        <BranchBookingAvailability options={options} onRetry={reload} />
        {options.kind === 'unavailable' && options.reason === 'eligible_resources_not_visible' && !user &&
          <p><Link to={signinForBooking('signin')}>Sign in to check booking options</Link></p>}
        {contact}
      </>}
  </div>
}

function PublicBookingForm({ user, config }: {
  user: User | null
  config: Extract<BranchBookingReadStatus, { kind: 'ready' }>
}) {
  const navigate = useNavigate()
  const [serviceId, setServiceId] = useState('')
  const [chosenResource, setChosenResource] = useState('')
  const [date, setDate] = useState('')
  const [startsAtUtc, setStartsAtUtc] = useState('')
  const elig = usePatientEligibility(user)
  const sp = useServiceSpecies(user, serviceId)
  const pets = useMemo(() => elig.status === 'ready' ? applyServiceSpecies(elig.pets, sp) : null, [elig.status, elig.pets, sp])
  const [owner, setOwner] = useState<'checking' | 'ready' | 'missing' | 'error'>('checking')
  const [ownerAttempt, setOwnerAttempt] = useState(0)
  const [petId, setPetId] = useState('')
  const [concern, setConcern] = useState('')
  const [details, setDetails] = useState('')
  const [result, setResult] = useState<RequestedBooking | null>(null)
  const restored = useRef(false)
  const resultRef = useRef<HTMLDivElement>(null)

  const service = config.services.find(s => s.id === serviceId) ?? null
  const resources = service?.resources ?? []
  const resourceId = resources.length === 1 ? (resources[0]?.resource_id ?? '') : chosenResource
  const policy = config.schedule
  const days = useMemo(() => service ? generateSlots(policy, service.duration_minutes) : [], [service, policy])
  const dayChoice = days.find(d => d.date === date) ?? null

  // Restore once and only if the saved service, resource and time still match approved options.
  useEffect(() => {
    if (restored.current) return
    restored.current = true
    const intent = safeIntent()
    const savedService = config.services.find(item => item.id === intent?.serviceId)
    if (!savedService) return
    setServiceId(savedService.id)
    if (!intent?.startsAtUtc || !savedService.resources.some(resource => resource.resource_id === intent.resourceId)) return
    const match = generateSlots(policy, savedService.duration_minutes)
      .find(day => day.slots.some(slot => slot.startsAtUtc === intent.startsAtUtc))
    if (match) {
      setDate(match.date)
      setStartsAtUtc(intent.startsAtUtc)
      setChosenResource(intent.resourceId ?? '')
    }
  }, [config.services, policy])

  useEffect(() => {
    if (!user) return
    let live = true
    setOwner('checking')
    void readOwner(user)
      .then(profile => { if (live) setOwner(profile ? 'ready' : 'missing') })
      .catch(() => { if (live) setOwner('error') })
    return () => { live = false }
  }, [user, ownerAttempt])

  useEffect(() => { if (result) resultRef.current?.focus() }, [result])

  useEffect(() => { if (pets) setPetId(cur => pets.some(p => p.id === cur && p.eligibility === 'eligible') ? cur : firstEligibleId(pets)) }, [pets])
  const chosenOk = canBookPet(pets?.find(p => p.id === petId), sp)

  function continueToLogin(mode: 'signin' | 'signup') {
    if (!serviceId) return
    try { saveBookingIntent(window.sessionStorage, { serviceId, ...(resourceId ? { resourceId } : {}), ...(startsAtUtc && resourceId ? { startsAtUtc } : {}) }) } catch { /* continue without saved intent */ }
    navigate(signinForBooking(mode))
  }
  const { send, saving, error, clearError } = useBookingRequest(user, booking => {
    try { clearBookingIntent(window.sessionStorage) } catch { /* storage is optional */ }
    setResult(booking)
  })
  const canSubmit = owner === 'ready' && chosenOk && service &&
    resources.some(resource => resource.resource_id === resourceId) &&
    dayChoice?.slots.some(slot => slot.startsAtUtc === startsAtUtc) && concern.trim()

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    void send({ petId, serviceId, resourceId, startsAtUtc, concern: concern.trim(), details: details.trim() || null })
  }

  function chooseService(id: string) {
    setServiceId(id); setChosenResource(''); setDate(''); setStartsAtUtc(''); clearError()
  }
  function startOver() {
    setResult(null); chooseService(''); setConcern(''); setDetails(''); setPetId(firstEligibleId(pets ?? []))
  }

  if (result) {
    const slot = utcToClinicSlot(new Date(result.starts_at).toISOString().replace(/\.\d{3}Z$/, 'Z'), policy.timezone)
    return <div className="card form-card" ref={resultRef} tabIndex={-1} role="status" aria-live="polite">
        <h2>{result.status === 'confirmed' ? 'Appointment confirmed by the clinic' : 'Request received'}</h2>
        <p><StatusBadge status={result.status} /></p>
        <p>{formatClinicDate(slot.date)} · {formatClockTime(slot.time)} <small>(clinic time, {slot.timezone})</small></p>
        <p>{result.status === 'requested' ? 'This is a request only. It is not a confirmed appointment until the clinic confirms it. We have not sent an email or text message.' : 'The clinic has updated this booking.'}</p>
        <div className="form-actions"><Link className="button button-primary" to="/app/appointments">View my appointments</Link><button type="button" className="button button-secondary" onClick={startOver}>Request another</button></div>
      </div>
  }

  const step = (n: number) => <span className="step-num" aria-hidden="true">{n}</span>
  return <form className="form-stack book-form" onSubmit={submit} aria-label="Naga appointment request">
      <fieldset className="card book-step"><legend>{step(1)}Choose a service</legend>
        <div className="radio-cards">{config.services.map(s => <label key={s.id} className={s.id === serviceId ? 'radio-card is-selected' : 'radio-card'}>
          <input type="radio" name="service" value={s.id} checked={s.id === serviceId} onChange={() => chooseService(s.id)} />
          <span><strong>{s.display_name}</strong>{s.summary && <small>{s.summary}</small>}<small>About {s.duration_minutes} minutes</small></span></label>)}</div>
      </fieldset>

      {service && <fieldset className="card book-step"><legend>{step(2)}Choose a time</legend>
        <p className="field-help">Times are in clinic time ({policy.timezone}), not your device’s time zone.</p>
            {resources.length > 1 && <label>Option<select value={resourceId} onChange={e => { setChosenResource(e.target.value); clearError() }}><option value="">Choose an option</option>{resources.map((r, i) => <option key={r.resource_id} value={r.resource_id}>{r.public_label ?? `Option ${i + 1}`}</option>)}</select></label>}
            {days.length === 0 ? <p className="alert alert-info" role="note">There are no times available in the booking window right now. Please check back later or contact the clinic.</p> : <>
              <label>Date<select value={date} onChange={e => { setDate(e.target.value); setStartsAtUtc(''); clearError() }}><option value="">Choose a date</option>{days.map(d => <option key={d.date} value={d.date}>{formatClinicDate(d.date)}</option>)}</select></label>
              {dayChoice && <div role="radiogroup" aria-label={`Times on ${formatClinicDate(dayChoice.date)}`} className="slot-grid">{dayChoice.slots.map(s => <label key={s.startsAtUtc} className={s.startsAtUtc === startsAtUtc ? 'slot is-selected' : 'slot'}>
                <input type="radio" name="slot" value={s.startsAtUtc} checked={s.startsAtUtc === startsAtUtc} onChange={() => { setStartsAtUtc(s.startsAtUtc); clearError() }} /><span>{formatClockTime(s.time)}</span></label>)}</div>}
              <p className="field-help">Choosing a time requests it; it is not reserved until the clinic confirms.</p></>}
      </fieldset>}

      {service && (!user ? <section className="card book-step"><h2>{step(3)}Sign in to send your request</h2>
          <p>Choosing a service and time does not need an account. To send a request for your animal, sign in or create an account. Only the service and time you picked are remembered for about 30 minutes in this browser tab — no personal or pet details.</p>
          <div className="form-actions"><button type="button" className="button button-primary" onClick={() => continueToLogin('signin')}>Sign in to continue</button><button type="button" className="button button-secondary" onClick={() => continueToLogin('signup')}>Create an account</button></div></section> :
        <section className="card book-step"><h2>{step(3)}Your patient and request</h2>
          {owner === 'missing' && <p className="alert alert-info" role="note">Please complete your owner profile first. <Link to="/app/profile">Set up profile</Link></p>}
          {owner === 'checking' && <p role="status" className="field-help"><Spinner /> Checking your owner profile…</p>}
          {owner === 'error' && <p role="alert" className="alert alert-error">We could not verify your owner profile. <button type="button" className="button-quiet" onClick={() => setOwnerAttempt(n => n + 1)}>Try again</button></p>}
          {elig.status === 'error' && <p role="alert" className="alert alert-error">We could not check which patients can be booked online, so nothing can be submitted. <button type="button" className="button-quiet" onClick={elig.reload}>Try again</button></p>}
          {sp.status === 'loading' && <p role="status" className="field-help"><Spinner /> Checking which animals this service is offered for…</p>}
          {sp.status === 'error' && <p role="alert" className="alert alert-error">{serviceSpeciesErrorText(sp)} <button type="button" className="button-quiet" onClick={sp.reload}>Try again</button></p>}
          {owner === 'ready' && pets !== null && pets.length === 0 && <p className="alert alert-info" role="note">Register a patient before requesting an appointment. <Link to="/app/pets">Add a patient</Link></p>}
          <PatientSelect pets={pets ?? []} value={petId} onChange={id => { setPetId(id); clearError() }} />
          <div className="form-row"><label>Reason for visit<input required maxLength={300} value={concern} onChange={e => { setConcern(e.target.value); clearError() }} placeholder="Short reason" /></label></div>
          <label>Additional details (optional)<textarea maxLength={3000} value={details} onChange={e => { setDetails(e.target.value); clearError() }} /></label>
          {error && <p role="alert" className="alert alert-error">{error}</p>}
          <div className="form-actions"><button className="button button-primary" disabled={saving || !canSubmit}>{saving ? <><Spinner /> Sending…</> : 'Send appointment request'}</button>
            {(!resourceId || !startsAtUtc) && <span className="field-help">Choose a time above to continue.</span>}</div></section>)}
    </form>
}
