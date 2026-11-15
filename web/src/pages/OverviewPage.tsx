import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../hooks/AuthProvider'
import { listAppointments, listPets, type Appointment, type Pet } from '../lib/clinical'
import { readOwner, type OwnerProfile } from '../lib/owners'
import { EmptyState, LoadingCard, PageHeading, StatusBadge } from '../components/ui'

type Data = { owner: OwnerProfile | null; pets: Pet[]; appointments: Appointment[] }
const when = (iso: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))

/** Pet-owner home. Every figure is computed from the signed-in owner's persisted records; nothing is sample data. */
export function OverviewPage() {
  const { user } = useAuth()
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!user) return
    let active = true
    void Promise.all([readOwner(user), listPets(user), listAppointments(user)])
      .then(([owner, pets, appointments]) => { if (active) setData({ owner, pets, appointments }) })
      .catch(() => { if (active) setError('Could not load your overview. Please refresh and try again.') })
    return () => { active = false }
  }, [user])

  const first = data?.owner?.first_name ?? String(user?.user_metadata?.first_name ?? '')
  const now = Date.now()
  const upcoming = (data?.appointments ?? []).filter(a => (a.status === 'requested' || a.status === 'confirmed') && new Date(a.ends_at).getTime() >= now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  const pending = upcoming.filter(a => a.status === 'requested').length
  const next = upcoming[0]
  const nextDate = next ? new Date(next.starts_at) : null
  const petName = (id: string) => data?.pets.find(p => p.id === id)?.name ?? 'Patient'

  return <section className="page" aria-labelledby="overview-heading">
    <PageHeading id="overview-heading" eyebrow="Pet owner portal" title={first ? `Welcome, ${first}` : 'Welcome'}
      actions={<Link className="button button-primary" to="/app/appointments">Request appointment</Link>}>
      A summary of your patients and visits at Dawney Animal Clinic.</PageHeading>
    {error && <p role="alert" className="alert alert-error">{error}</p>}
    {!data && !error && <LoadingCard label="Loading your overview…" rows={4} />}
    {data && <>
      <div className="stat-grid">
        <div className="stat"><span className="stat-value">{data.pets.length}</span><span className="stat-label">Registered patients</span></div>
        <div className="stat"><span className="stat-value">{upcoming.length}</span><span className="stat-label">Upcoming visits</span></div>
        <div className="stat"><span className="stat-value">{pending}</span><span className="stat-label">Awaiting clinic confirmation</span></div>
      </div>
      <div className="info-grid">
        <div className="card"><h2>Next visit</h2>
          {next && nextDate ? <div className="next-visit">
            <div className="date-block" aria-hidden="true"><strong>{nextDate.getDate()}</strong><span>{new Intl.DateTimeFormat(undefined, { month: 'short' }).format(nextDate)}</span></div>
            <div><p><strong>{petName(next.pet_id)}</strong> · <StatusBadge status={next.status} /></p>
              <p className="subtitle"><time dateTime={next.starts_at}>{when(next.starts_at)}</time> — {next.concern}</p>
              <Link className="button-quiet" to="/app/appointments">Manage bookings</Link></div></div>
            : <EmptyState icon="calendar" title="No upcoming visits" action={<Link className="button button-secondary" to="/app/appointments">Request an appointment</Link>}>
              When you request a visit it will appear here with its confirmation status.</EmptyState>}
        </div>
        <aside className="card card-muted"><h2>Getting started</h2>
          <ol className="steps">
            <li className={data.owner ? 'is-done' : ''}><span className="step-text">Owner profile<small>{data.owner ? 'Completed' : 'Required before registering patients'}</small></span>{!data.owner && <Link to="/app/profile">Set up</Link>}</li>
            <li className={data.pets.length ? 'is-done' : ''}><span className="step-text">Register a patient<small>{data.pets.length ? `${data.pets.length} registered` : 'Add your first animal'}</small></span>{!data.pets.length && data.owner && <Link to="/app/pets">Add</Link>}</li>
            <li className={data.appointments.length ? 'is-done' : ''}><span className="step-text">Request a visit<small>{data.appointments.length ? 'Booking history available' : 'Choose a slot for your patient'}</small></span>{!data.appointments.length && data.pets.length > 0 && <Link to="/app/appointments">Book</Link>}</li>
          </ol></aside>
      </div></>}
  </section>
}
