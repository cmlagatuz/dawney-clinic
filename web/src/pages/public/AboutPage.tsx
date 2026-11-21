import { useEffect } from 'react'
import { Link, useLocation } from 'react-router'
import { usePageMeta } from '../../public-site/usePageMeta'
import { BranchDirectory, DirectionsButton } from '../../components/SiteLayout'
import { PageHeading } from '../../components/ui'
import { NAGA } from '../../public-site/clinic-info.mjs'
import { release } from '../../release-mode'

export function AboutPage() {
  const { hash, pathname } = useLocation()
  const title = pathname === '/contact' ? 'Contact our branches' : pathname === '/location' ? 'Locations & directions' : 'About & locations'
  usePageMeta(title + ' — Dawney Animal Clinic', 'Naga and Cavite branch locations and Facebook contacts. These listings do not establish online booking availability.')
  useEffect(() => { if (hash === '#contact' || pathname === '/contact') document.getElementById('contact')?.scrollIntoView() }, [hash, pathname])
  return <div className="page">
    <PageHeading id="about-heading" eyebrow="Dawney Animal Clinic" title={title} actions={<DirectionsButton />}>Our Naga Branch is our primary public location. Our Cavite Main Branch is listed for information.</PageHeading>
    <section className="section" aria-labelledby="contact-heading" id="contact" tabIndex={-1}>
      <h2 id="contact-heading">Branches and contact</h2>
      <BranchDirectory headingLevel={3} />
      <p className="small-help">Directions and Facebook pages open in a new tab. We do not embed a map or a chat widget, so nothing is sent to third parties until you choose to open a link. Our Facebook pages are our contact channel; we do not list a phone number.</p>
    </section>
    <section className="section" aria-labelledby="req-heading"><h2 id="req-heading">Appointments</h2>
      <div className="card"><p>To ask about care for your animal at the {NAGA.shortName} Branch, message our Facebook page. {release.mayCheckBooking ? 'Check our booking page for currently approved Naga request options, if available.' : 'Online appointment requests are not available on this informational website.'} Please do not send private medical details through public pages.</p>
        <Link className="button button-secondary" to="/book">Booking status</Link></div></section>
  </div>
}
