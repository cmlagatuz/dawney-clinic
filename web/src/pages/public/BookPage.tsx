import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../hooks/AuthProvider'
import { readOwner } from '../../lib/owners'
import { freshBookingRequestNonce, listPublishedServiceResources, requestAuthenticatedServiceBooking, type PublishedServiceResource, type RequestedBooking } from '../../lib/public-booking'
import type { PublicBookingIntent } from '../../booking-contract.mjs'
import { clearBookingIntent, readBookingIntent, saveBookingIntent, signinForBooking, utcToClinicSlot } from '../../booking-contract.mjs'
import { formatClinicDate, formatClockTime, generateSlots, isUsablePolicy } from '../../public-site/slots.mjs'
import { usePageMeta } from '../../public-site/usePageMeta'
import { usePublicCatalog } from '../../public-site/usePublicCatalog'
import { ContactDetails, DirectionsButton } from '../../components/SiteLayout'
import { PatientSelect } from '../../components/PatientSelect'
import { usePatientEligibility } from '../../public-site/usePatientEligibility'
import { firstEligibleId } from '../../public-site/eligibility.mjs'
import { EmptyState, LoadingCard, PageHeading, Spinner, StatusBadge } from '../../components/ui'

const adapterMessage = /^(Complete owner profile|Select a registered patient|Verified customer login|A valid patient|Explicit UTC|Invalid booking)/
const genericFailure = 'We could not save this request. The time may no longer be available, or this service may not be offered for the selected animal. Please choose another time or contact the clinic.'

function safeIntent(): PublicBookingIntent | null {
  try { return readBookingIntent(window.sessionStorage) } catch { return null }
}

/** Public booking: browsing and intent need no login; a persisted request needs a verified account, profile and registered patient. */
export function BookPage() {
  usePageMeta('Book an appointment — Dawney Animal Clinic', 'Request an appointment at Dawney Animal Clinic in General Trias, Cavite. Requests are confirmed by the clinic.')
  const catalog = usePublicCatalog()
  const { user, checking } = useAuth()
  const navigate = useNavigate()
  const [serviceId, setServiceId] = useState('')
  const [resources, setResources] = useState<PublishedServiceResource[] | null>(null)
  const [resourceId, setResourceId] = useState('')
  const [date, setDate] = useState('')
  const [startsAtUtc, setStartsAtUtc] = useState('')
  const elig = usePatientEligibility(user)
  const pets = elig.status === 'ready' ? elig.pets : null
  const [hasOwner, setHasOwner] = useState<boolean | null>(null)
  const [petId, setPetId] = useState('')
  const [concern, setConcern] = useState('')
  const [details, setDetails] = useState('')
  const [nonce, setNonce] = useState(freshBookingRequestNonce)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<RequestedBooking | null>(null)
  const restored = useRef(false)
  const resultRef = useRef<HTMLDivElement>(null)

  const service = catalog.services.find(s => s.id === serviceId) ?? null
  const policy = catalog.schedule
  const bookable = isUsablePolicy(policy)
  const days = useMemo(() => service && bookable ? generateSlots(policy, service.duration_minutes) : [], [service, bookable, policy])
  const dayChoice = days.find(d => d.date === date) ?? null
  const touch = () => { setNonce(freshBookingRequestNonce()); setError(null) }

  // Restore the PII-free intent (service/resource/slot ids only) once the catalog is known; drop anything no longer valid.
  useEffect(() => {
    if (restored.current || catalog.status !== 'ready') return
    restored.current = true
    const intent = safeIntent()
    if (intent && catalog.services.some(s => s.id === intent.serviceId)) setServiceId(intent.serviceId)
  }, [catalog.status, catalog.services])

  // Resources follow the chosen service.
  useEffect(() => {
    setResources(null); setResourceId(''); setDate(''); setStartsAtUtc('')
    if (!serviceId) return
    let live = true
    listPublishedServiceResources(serviceId).then(r => { if (live) { setResources(r); if (r.length === 1 && r[0]) setResourceId(r[0].resource_id) } }).catch(() => { if (live) setResources([]) })
    return () => { live = false }
  }, [serviceId])

  // Apply a saved slot only if it is still one of the currently generated, valid slots.
  useEffect(() => {
    if (!service || !bookable) return
    const intent = safeIntent()
    if (!intent || intent.serviceId !== serviceId || !intent.startsAtUtc || startsAtUtc) return
    const match = days.find(d => d.slots.some(s => s.startsAtUtc === intent.startsAtUtc))
    if (match && resources?.some(r => r.resource_id === intent.resourceId)) { setDate(match.date); setStartsAtUtc(intent.startsAtUtc ?? ''); setResourceId(intent.resourceId ?? '') }
  }, [service, bookable, days, resources, serviceId, startsAtUtc])

  // Signed-in: load the owner's profile state and registered patients (RLS-scoped).
  useEffect(() => {
    if (!user) { setHasOwner(null); return }
    let live = true
    readOwner(user).then(o => { if (live) setHasOwner(Boolean(o)) }).catch(() => { if (live) setHasOwner(null) })
    return () => { live = false }
  }, [user])

  useEffect(() => { if (pets) setPetId(cur => pets.some(p => p.id === cur && p.eligibility === 'eligible') ? cur : firstEligibleId(pets)) }, [pets])
  const chosenOk = pets?.find(p => p.id === petId)?.eligibility === 'eligible'

  function continueToLogin(mode: 'signin' | 'signup') {
    if (!serviceId) return
    try { saveBookingIntent(window.sessionStorage, { serviceId, ...(resourceId ? { resourceId } : {}), ...(startsAtUtc && resourceId ? { startsAtUtc } : {}) }) } catch { /* continue without saved intent */ }
    navigate(signinForBooking(mode))
  }
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!user || !serviceId || !resourceId || !startsAtUtc || !petId || !chosenOk) return
    setSaving(true); setError(null)
    try {
      const booking = await requestAuthenticatedServiceBooking(user, { petId, serviceId, resourceId, startsAtUtc, requestNonce: nonce, concern: concern.trim(), details: details.trim() || null })
      try { clearBookingIntent(window.sessionStorage) } catch { /* ignore */ }
      setResult(booking); setNonce(freshBookingRequestNonce())
      setTimeout(() => resultRef.current?.focus(), 0)
    } catch (err) {
      setError(err instanceof Error && adapterMessage.test(err.message) ? err.message : genericFailure)
    } finally { setSaving(false) }
  }
  function startOver() { setResult(null); setServiceId(''); setConcern(''); setDetails(''); setPetId(''); setError(null) }

  const header = <PageHeading id="book-heading" eyebrow="Dawney Animal Clinic" title="Book an appointment">Send a request for a service the clinic offers online. The clinic reviews every request, and it is <strong>not confirmed</strong> until the clinic confirms it.</PageHeading>
  const contact = <div className="cta-row"><DirectionsButton /><Link className="button button-secondary" to="/about#contact">Contact the clinic</Link></div>

  if (catalog.status === 'loading') return <div className="page">{header}<LoadingCard label="Loading booking options…" rows={4} /></div>
  if (catalog.status === 'error') return <div className="page">{header}<div role="alert" className="alert alert-error">Booking options could not be loaded. <button type="button" className="button-quiet" onClick={catalog.reload}>Try again</button></div>{contact}</div>
  if (catalog.services.length === 0) return <div className="page">{header}
    <EmptyState icon="calendar" title="Online booking is not open yet" action={contact}>The clinic has not published services for online requests yet, so there is nothing to book here. Please contact the clinic directly.</EmptyState></div>

  if (result) {
    const slot = utcToClinicSlot(new Date(result.starts_at).toISOString().replace(/\.\d{3}Z$/, 'Z'), policy?.timezone ?? 'Asia/Manila')
    return <div className="page">{header}
      <div className="card form-card" ref={resultRef} tabIndex={-1} role="status" aria-live="polite">
        <h2>{result.status === 'confirmed' ? 'Appointment confirmed by the clinic' : 'Request received'}</h2>
        <p><StatusBadge status={result.status} /></p>
        <p>{formatClinicDate(slot.date)} · {formatClockTime(slot.time)} <small>(clinic time, {slot.timezone})</small></p>
        <p>{result.status === 'requested' ? 'This is a request only. It is not a confirmed appointment until the clinic confirms it. We have not sent an email or text message.' : 'The clinic has updated this booking.'}</p>
        <div className="form-actions"><Link className="button button-primary" to="/app/appointments">View my appointments</Link><button type="button" className="button button-secondary" onClick={startOver}>Request another</button></div>
      </div></div>
  }

  const step = (n: number) => <span className="step-num" aria-hidden="true">{n}</span>
  return <div className="page">{header}
    {!bookable && <p className="alert alert-info" role="note">Online time selection is not open yet because the clinic has not published its booking hours. You can still look at services below, and the clinic can help by contact.</p>}
    <form className="form-stack book-form" onSubmit={e => void submit(e)}>
      <fieldset className="card book-step"><legend>{step(1)}Choose a service</legend>
        <div className="radio-cards">{catalog.services.map(s => <label key={s.id} className={s.id === serviceId ? 'radio-card is-selected' : 'radio-card'}>
          <input type="radio" name="service" value={s.id} checked={s.id === serviceId} onChange={() => { setServiceId(s.id); touch() }} />
          <span><strong>{s.display_name}</strong>{s.summary && <small>{s.summary}</small>}<small>About {s.duration_minutes} minutes</small></span></label>)}</div>
      </fieldset>

      {service && bookable && <fieldset className="card book-step"><legend>{step(2)}Choose a time</legend>
        <p className="field-help">Times are in clinic time ({policy?.timezone}), not your device’s time zone.</p>
        {resources === null ? <p role="status" className="field-help"><Spinner /> Loading options…</p>
          : resources.length === 0 ? <p className="alert alert-info" role="note">No bookable options are published for this service yet. Please contact the clinic.</p> : <>
            {resources.length > 1 && <label>Option<select value={resourceId} onChange={e => { setResourceId(e.target.value); touch() }}><option value="">Choose an option</option>{resources.map((r, i) => <option key={r.resource_id} value={r.resource_id}>{r.public_label ?? `Option ${i + 1}`}</option>)}</select></label>}
            {days.length === 0 ? <p className="alert alert-info" role="note">There are no times available in the booking window right now. Please check back later or contact the clinic.</p> : <>
              <label>Date<select value={date} onChange={e => { setDate(e.target.value); setStartsAtUtc(''); touch() }}><option value="">Choose a date</option>{days.map(d => <option key={d.date} value={d.date}>{formatClinicDate(d.date)}</option>)}</select></label>
              {dayChoice && <div role="radiogroup" aria-label={`Times on ${formatClinicDate(dayChoice.date)}`} className="slot-grid">{dayChoice.slots.map(s => <label key={s.startsAtUtc} className={s.startsAtUtc === startsAtUtc ? 'slot is-selected' : 'slot'}>
                <input type="radio" name="slot" value={s.startsAtUtc} checked={s.startsAtUtc === startsAtUtc} onChange={() => { setStartsAtUtc(s.startsAtUtc); touch() }} /><span>{formatClockTime(s.time)}</span></label>)}</div>}
              <p className="field-help">Choosing a time requests it; it is not reserved until the clinic confirms.</p></>}</>}
      </fieldset>}

      {service && (!bookable ? <section className="card book-step"><h2>Next step</h2><p>Please contact the clinic to arrange a time for {service.display_name}.</p>{contact}<ContactDetails /></section> :
        !user ? <section className="card book-step"><h2>{step(3)}Sign in to send your request</h2>
          <p>Choosing a service and time does not need an account. To send a request for your animal, sign in or create an account. Only the service and time you picked are remembered for about 30 minutes in this browser tab — no personal or pet details.</p>
          <div className="form-actions"><button type="button" className="button button-primary" disabled={checking} onClick={() => continueToLogin('signin')}>Sign in to continue</button><button type="button" className="button button-secondary" disabled={checking} onClick={() => continueToLogin('signup')}>Create an account</button></div></section> :
        <section className="card book-step"><h2>{step(3)}Your patient and request</h2>
          {hasOwner === false && <p className="alert alert-info" role="note">Please complete your owner profile first. <Link to="/app/profile">Set up profile</Link></p>}
          {elig.status === 'error' && <p role="alert" className="alert alert-error">We could not check which patients can be booked online, so nothing can be submitted. <button type="button" className="button-quiet" onClick={elig.reload}>Try again</button></p>}
          {hasOwner && pets !== null && pets.length === 0 && <p className="alert alert-info" role="note">Register a patient before requesting an appointment. <Link to="/app/pets">Add a patient</Link></p>}
          <PatientSelect pets={pets ?? []} value={petId} onChange={id => { setPetId(id); touch() }} />
          <div className="form-row"><label>Reason for visit<input required maxLength={300} value={concern} onChange={e => { setConcern(e.target.value); touch() }} placeholder="Short reason" /></label></div>
          <label>Additional details (optional)<textarea maxLength={3000} value={details} onChange={e => { setDetails(e.target.value); touch() }} /></label>
          {error && <p role="alert" className="alert alert-error">{error}</p>}
          <div className="form-actions"><button className="button button-primary" disabled={saving || !hasOwner || !chosenOk || !resourceId || !startsAtUtc || !concern.trim()}>{saving ? <><Spinner /> Sending…</> : 'Send appointment request'}</button>
            {(!resourceId || !startsAtUtc) && <span className="field-help">Choose a time above to continue.</span>}</div></section>)}
    </form>
  </div>
}
