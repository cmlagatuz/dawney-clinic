import { Link } from 'react-router'
import { usePageMeta } from '../../public-site/usePageMeta'
import { BranchCard, DirectionsButton, MessageButton } from '../../components/SiteLayout'
import { Icon } from '../../components/ui'
import { release } from '../../release-mode'
import { CAVITE, NAGA, NAGA_SERVICE_CATEGORIES } from '../../public-site/clinic-info.mjs'

export function HomePage() {
  usePageMeta('Dawney Animal Clinic — Naga Branch, Camarines Sur', 'Dawney Animal Clinic, Naga Branch: 80 Perpetual Help Street, Peñafrancia Avenue, Naga, Camarines Sur. Monday–Saturday 8 AM–5 PM. Message us on Facebook or get directions. Cavite Main Branch also listed.')
  return <>
    <section className="hero" aria-labelledby="home-heading">
      <div className="hero-copy">
        <span className="eyebrow">{NAGA.area}</span>
        <h1 id="home-heading">Dawney Animal Clinic — Naga Branch</h1>
        <p className="subtitle">Veterinary care for your animals in Naga, Camarines Sur. Open Monday to Saturday, 8:00 AM to 5:00 PM. To reach us, message our Facebook page or find us on the map.</p>
        <div className="cta-row">
          <MessageButton />
          <DirectionsButton secondary />
          <Link className="button button-secondary" to="/services">Our services</Link>
        </div>
      </div>
      <div className="hero-art"><img src="/brand/dawney-logo.webp" width={512} height={512} alt="Dawney Animal Clinic logo" /></div>
    </section>

    <section className="section" aria-labelledby="svc-heading">
      <div className="section-heading"><h2 id="svc-heading">Services at our Naga Branch</h2><Link to="/services">All services</Link></div>
      <ul className="service-grid">{NAGA_SERVICE_CATEGORIES.map(c => <li key={c} className="card"><h3>{c}</h3></li>)}</ul>
      <p className="alert alert-info"><Icon name="shield" width={18} height={18} /><span>This is a list of the kinds of care offered. For details about your animal, please message our Facebook page. {release.mayCheckBooking ? 'Visit booking information to check whether the clinic has approved any online request options.' : 'Online appointment requests are not available on this informational website.'}</span></p>
    </section>

    <section className="section find-us" aria-labelledby="find-heading">
      <h2 id="find-heading">Find us</h2>
      <BranchCard branch={NAGA} primary headingLevel={3} />
    </section>

    <section className="section" aria-labelledby="cavite-heading">
      <h2 id="cavite-heading">Our other branch</h2>
      <p className="subtitle">The {CAVITE.name} is listed for information. Please contact each branch through its own Facebook page.</p>
      <BranchCard branch={CAVITE} headingLevel={3} />
    </section>
  </>
}
