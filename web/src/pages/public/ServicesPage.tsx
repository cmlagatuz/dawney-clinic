import { Link, useNavigate } from 'react-router'
import { usePageMeta } from '../../public-site/usePageMeta'
import { usePublicCatalog } from '../../public-site/usePublicCatalog'
import { ContactDetails, DirectionsButton } from '../../components/SiteLayout'
import { EmptyState, LoadingCard, PageHeading } from '../../components/ui'
import { saveBookingIntent } from '../../booking-contract.mjs'

export function ServicesPage() {
  usePageMeta('Services — Dawney Animal Clinic', 'Services offered for online appointment requests at Dawney Animal Clinic in General Trias, Cavite.')
  const catalog = usePublicCatalog()
  const navigate = useNavigate()
  function request(serviceId: string) {
    try { navigate(saveBookingIntent(window.sessionStorage, { serviceId })) } catch { navigate('/book') } // intent holds only a service id; storage failure just loses the preselection
  }
  return <div className="page">
    <PageHeading id="services-heading" eyebrow="Dawney Animal Clinic" title="Services">Services the clinic has approved for online requests. Prices and eligibility are shown only when the clinic has published them.</PageHeading>
    {catalog.status === 'loading' && <LoadingCard label="Loading services…" rows={4} />}
    {catalog.status === 'error' && <div role="alert" className="alert alert-error">Services could not be loaded right now. <button type="button" className="button-quiet" onClick={catalog.reload}>Try again</button></div>}
    {catalog.status === 'ready' && (catalog.services.length === 0
      ? <EmptyState icon="calendar" title="Our online services list is coming soon" action={<div className="cta-row"><DirectionsButton /><Link className="button button-secondary" to="/about#contact">Contact the clinic</Link></div>}>
          The clinic has not yet published services for online booking. We do not list services that have not been approved. Please use the contact details to ask about care for your animal.</EmptyState>
      : <ul className="service-grid">{catalog.services.map(s => <li key={s.id} className="card service-card">
          <h2>{s.display_name}</h2>{s.summary && <p>{s.summary}</p>}<p className="field-help">About {s.duration_minutes} minutes</p>
          <button type="button" className="button button-secondary" onClick={() => request(s.id)}>Request this service<span className="visually-hidden">: {s.display_name}</span></button></li>)}</ul>)}
    <section className="section" aria-labelledby="svc-contact"><h2 id="svc-contact">Questions about a service?</h2><div className="card"><ContactDetails /></div></section>
  </div>
}
