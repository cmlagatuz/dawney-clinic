import { Link } from 'react-router'
import { usePageMeta } from '../../public-site/usePageMeta'
import { usePublicCatalog } from '../../public-site/usePublicCatalog'
import { ContactDetails, DirectionsButton } from '../../components/SiteLayout'
import { Icon } from '../../components/ui'
import { CLINIC_LOCATION } from '../../public-site/clinic-info.mjs'

const steps = [
  { t: 'Choose a service', d: 'Pick from the services the clinic has approved for online requests.' },
  { t: 'Sign in or create an account', d: 'Browsing is open to everyone. An account is only needed to request a time for your animal.' },
  { t: 'Request a time', d: 'Select your registered patient and a time the clinic can accept.' },
  { t: 'Wait for confirmation', d: 'Your request shows as “Requested” until the clinic confirms it.' },
]

export function HomePage() {
  usePageMeta('Dawney Animal Clinic — General Trias, Cavite', 'Dawney Animal Clinic in General Trias, Cavite, Philippines. Browse services, get directions and request an appointment online.')
  const catalog = usePublicCatalog()
  return <>
    <section className="hero" aria-labelledby="home-heading">
      <div className="hero-copy">
        <span className="eyebrow">{CLINIC_LOCATION}</span>
        <h1 id="home-heading">Your animal clinic in General Trias, Cavite</h1>
        <p className="subtitle">Browse our services, find us on the map and send an appointment request online. No account is needed just to look around.</p>
        <div className="cta-row">
          <Link className="button button-primary" to="/book">Book an appointment</Link>
          <Link className="button button-secondary" to="/services">Our services</Link>
          <DirectionsButton secondary />
          <Link className="button button-secondary" to="/about#contact">Contact</Link>
        </div>
      </div>
      <div className="hero-art"><img src="/brand/dawney-logo.webp" width={512} height={512} alt="Dawney Animal Clinic logo" /></div>
    </section>

    <section className="section" aria-labelledby="how-heading">
      <h2 id="how-heading">How online requests work</h2>
      <ol className="step-cards">{steps.map((s, i) => <li key={s.t} className="card"><span className="step-num" aria-hidden="true">{i + 1}</span><h3>{s.t}</h3><p>{s.d}</p></li>)}</ol>
      <p className="alert alert-info"><Icon name="shield" width={18} height={18} /><span><strong>Requested is not confirmed.</strong> The clinic confirms each request; we never show a request as confirmed until then.</span></p>
    </section>

    <section className="section" aria-labelledby="svc-heading">
      <div className="section-heading"><h2 id="svc-heading">Services</h2><Link to="/services">All services</Link></div>
      {catalog.status === 'loading' && <p role="status" className="subtitle">Loading services…</p>}
      {catalog.status === 'error' && <p role="alert" className="alert alert-error">Services could not be loaded right now. <button type="button" className="button-quiet" onClick={catalog.reload}>Try again</button></p>}
      {catalog.status === 'ready' && (catalog.services.length === 0
        ? <p className="card card-muted">The clinic is finalizing its list of online services. Please check back soon or use the contact details below.</p>
        : <ul className="service-grid">{catalog.services.slice(0, 3).map(s => <li key={s.id} className="card"><h3>{s.display_name}</h3>{s.summary && <p>{s.summary}</p>}<p className="field-help">About {s.duration_minutes} minutes</p></li>)}</ul>)}
    </section>

    <section className="section find-us" aria-labelledby="find-heading">
      <h2 id="find-heading">Find us</h2>
      <div className="card"><ContactDetails /><div className="cta-row"><DirectionsButton /><Link className="button button-secondary" to="/about#contact">Contact details</Link></div></div>
    </section>
  </>
}
