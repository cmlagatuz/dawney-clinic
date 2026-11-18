import { Link, useNavigate } from 'react-router'
import { usePageMeta } from '../../public-site/usePageMeta'
import { usePublicCatalog } from '../../public-site/usePublicCatalog'
import { BranchCard, DirectionsButton, MessageButton } from '../../components/SiteLayout'
import { EmptyState, LoadingCard, PageHeading } from '../../components/ui'
import { saveBookingIntent } from '../../booking-contract.mjs'
import { NAGA, NAGA_SERVICE_CATEGORIES } from '../../public-site/clinic-info.mjs'

export function ServicesPage() {
  usePageMeta('Services — Dawney Animal Clinic', 'Service categories at Dawney Animal Clinic, Naga Branch. Message our Naga Facebook page to ask about care for your animal.')
  const catalog = usePublicCatalog()
  const navigate = useNavigate()
  function request(serviceId: string) {
    try { navigate(saveBookingIntent(window.sessionStorage, { serviceId })) } catch { navigate('/book') } // intent holds only a service id; storage failure just loses the preselection
  }
  return <div className="page">
    <PageHeading id="services-heading" eyebrow="Dawney Animal Clinic — Naga Branch" title="Services" actions={<MessageButton />}>The kinds of care offered at our Naga Branch. Please message our Facebook page about your animal. We do not list prices or appointment lengths here.</PageHeading>
    <section className="section" aria-labelledby="cat-heading"><h2 id="cat-heading">Service categories</h2>
      <ul className="service-grid">{NAGA_SERVICE_CATEGORIES.map(c => <li key={c} className="card service-card"><h3>{c}</h3></li>)}</ul>
      <p className="field-help">These categories are for information only. They are not bookable online, and availability is confirmed by the clinic.</p></section>
    <section className="section" aria-labelledby="online-heading"><h2 id="online-heading">Online booking</h2>
    {catalog.status === 'loading' && <LoadingCard label="Loading services…" rows={4} />}
    {catalog.status === 'error' && <div role="alert" className="alert alert-error">Services could not be loaded right now. <button type="button" className="button-quiet" onClick={catalog.reload}>Try again</button></div>}
    {catalog.status === 'ready' && (catalog.services.length === 0
      ? <EmptyState icon="calendar" title="Online booking is not open yet" action={<div className="cta-row"><MessageButton /><DirectionsButton secondary /></div>}>
          The clinic has not published services for online booking. Please message our Naga Facebook page to ask about care for your animal.</EmptyState>
      : <ul className="service-grid">{catalog.services.map(s => <li key={s.id} className="card service-card">
          <h3>{s.display_name}</h3>{s.summary && <p>{s.summary}</p>}<p className="field-help">About {s.duration_minutes} minutes</p>
          <button type="button" className="button button-secondary" onClick={() => request(s.id)}>Request this service<span className="visually-hidden">: {s.display_name}</span></button></li>)}</ul>)}
    </section>
    <section className="section" aria-labelledby="svc-contact"><h2 id="svc-contact">Questions about a service?</h2><BranchCard branch={NAGA} primary headingLevel={3} /></section>
  </div>
}
