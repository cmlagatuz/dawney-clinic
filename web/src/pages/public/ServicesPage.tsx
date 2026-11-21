import { Link, useNavigate } from 'react-router'
import { usePageMeta } from '../../public-site/usePageMeta'
import { useBranchBooking } from '../../public-site/useBranchBooking'
import { BranchBookingAvailability } from '../../components/BranchBookingAvailability'
import { BranchCard, MessageButton } from '../../components/SiteLayout'
import { PageHeading } from '../../components/ui'
import { saveBookingIntent } from '../../booking-contract.mjs'
import { NAGA, NAGA_SERVICE_CATEGORIES } from '../../public-site/clinic-info.mjs'

export function ServicesPage() {
  usePageMeta('Services — Dawney Animal Clinic', 'Service categories at Dawney Animal Clinic, Naga Branch. Message our Naga Facebook page to ask about care for your animal.')
  const { options, reload } = useBranchBooking()
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
    {options.kind !== 'ready'
      ? <><BranchBookingAvailability options={options} onRetry={reload} /><Link to="/book">Check booking status</Link></>
      : <ul className="service-grid">{options.services.map(s => <li key={s.id} className="card service-card">
          <h3>{s.display_name}</h3>{s.summary && <p>{s.summary}</p>}<p className="field-help">About {s.duration_minutes} minutes</p>
          <button type="button" className="button button-secondary" onClick={() => request(s.id)}>Request this service<span className="visually-hidden">: {s.display_name}</span></button></li>)}</ul>}
    </section>
    <section className="section" aria-labelledby="svc-contact"><h2 id="svc-contact">Questions about a service?</h2><BranchCard branch={NAGA} primary headingLevel={3} /></section>
  </div>
}
