import { useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { Link } from 'react-router'
import { useAuth } from '../hooks/AuthProvider'
import { cancelAppointment, listAppointments, listPets, type Appointment, type Pet } from '../lib/clinical'
import { readOwner } from '../lib/owners'
import type { RequestedBooking } from '../lib/public-booking'
import { useBranchBooking } from '../public-site/useBranchBooking'
import { BranchBookingAvailability } from '../components/BranchBookingAvailability'
import { ServiceBookingForm } from '../components/ServiceBookingForm'
import { EmptyState, LoadingCard, PageHeading, StatusBadge } from '../components/ui'

const visitTime = (iso: string, timezone?: string) => new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium', timeStyle: 'short', timeZone: timezone
}).format(new Date(iso)) + (timezone ? ` (clinic time, ${timezone})` : '')
const activeStatuses = new Set(['requested', 'confirmed'])

type AppointmentList = { ownerReady: boolean; pets: Pet[]; appointments: Appointment[] }

export function AppointmentsPage() {
  const { user } = useAuth()
  return user ? <OwnerAppointments key={user.id} user={user} /> : null
}

function OwnerAppointments({ user }: { user: User }) {
  const { options, reload: retryBooking } = useBranchBooking()
  const [attempt, setAttempt] = useState(0)
  const [list, setList] = useState<AppointmentList | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [cancelBusy, setCancelBusy] = useState<string | null>(null)
  const userRef = useRef(user)
  userRef.current = user

  useEffect(() => {
    // Token refreshes may supply a new User object without changing the account.
    const account = userRef.current
    let active = true
    // A failed or revoked read cannot leave the previous history visible.
    // Only an authoritative new response can restore appointment rows.
    setLoading(true)
    setList(null)
    setLoadFailed(false)
    void Promise.all([readOwner(account), listPets(account), listAppointments(account)])
      .then(([owner, pets, appointments]) => { if (active) setList({ ownerReady: Boolean(owner), pets, appointments }) })
      .catch(() => { if (active) setLoadFailed(true) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [attempt])

  function booked(booking: RequestedBooking) {
    setError(null)
    setNotice(booking.status === 'requested'
      ? 'Request received. The clinic will review it before confirming.'
      : `This booking already exists with status: ${booking.status.replace('_', ' ')}.`)
    setAttempt(n => n + 1)
  }

  async function cancel(id: string) {
    setCancelBusy(id)
    setError(null)
    setNotice(null)
    try {
      const confirmed = await cancelAppointment(user, id)
      if (confirmed.id !== id || confirmed.status !== 'cancelled') {
        throw new Error('Cancellation not verified')
      }
      setAttempt(n => n + 1)
      setNotice('The clinic recorded the cancellation. Refreshing your appointment history…')
    } catch {
      setError('Unable to cancel this booking. Its status may have changed.')
    } finally {
      setCancelBusy(null)
    }
  }

  return <section className="page" aria-labelledby="appts-heading">
    <PageHeading id="appts-heading" eyebrow="Clinic visits" title="Appointments">
      View your bookings and request an appointment at Naga when online booking is available.
    </PageHeading>
    {error && <p role="alert" className="alert alert-error">{error}</p>}
    {notice && <p role="status" className="alert alert-success">{notice}</p>}
    {loading && !list && <LoadingCard label="Loading appointments…" rows={4} />}
    {loadFailed && <p role="alert" className="alert alert-error">
      Could not retrieve your appointments. <button type="button" className="button button-quiet" onClick={() => setAttempt(n => n + 1)}>Try again</button>
    </p>}
    {list && (!list.ownerReady
      ? <EmptyState icon="user" title="Set up your owner profile" action={<Link className="button button-primary" to="/app/profile">Owner profile</Link>}>You need a verified profile before requesting an appointment.</EmptyState>
      : <div className="info-grid">
        <div className="card"><h2>Request an appointment</h2>
          {options.kind !== 'ready' ? <>
            <BranchBookingAvailability options={options} onRetry={retryBooking} />
            <Link to="/about#contact">Clinic contact details</Link>
          </> : list.pets.length === 0 ? <p>No patients yet. <Link to="/app/pets">Register a patient</Link> before booking.</p>
            : <ServiceBookingForm key={options.branchId} user={user} services={options.services} policy={options.schedule} onBooked={booked} />}
        </div>
        <div className="card"><h2>My bookings</h2>
          {list.appointments.length === 0 ? <p className="subtitle">No appointments yet. You can see the status of your requests here.</p>
            : <div className="booking-list">{list.appointments.map(appointment => <article className="booking-item" key={appointment.id}>
              <div className="booking-item-top"><strong>{list.pets.find(pet => pet.id === appointment.pet_id)?.name ?? 'Patient'}</strong><StatusBadge status={appointment.status} /></div>
              <time dateTime={appointment.starts_at}>{visitTime(appointment.starts_at, options.kind === "ready" ? options.schedule.timezone : undefined)}</time><p>{appointment.concern}</p>
              {activeStatuses.has(appointment.status) && <button className="button button-secondary" type="button" disabled={cancelBusy !== null}
                onClick={() => void cancel(appointment.id)}>{cancelBusy === appointment.id ? 'Cancelling…' : 'Cancel booking'}</button>}
            </article>)}</div>}
        </div>
      </div>)}
  </section>
}
