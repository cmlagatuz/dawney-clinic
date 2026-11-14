import { useEffect } from 'react'
import { Link, useLocation } from 'react-router'
import { usePageMeta } from '../../public-site/usePageMeta'
import { ContactDetails, DirectionsButton } from '../../components/SiteLayout'
import { PageHeading } from '../../components/ui'

export function AboutPage() {
  usePageMeta('About & location — Dawney Animal Clinic', 'Dawney Animal Clinic is in General Trias, Cavite, Philippines. Get directions and contact details.')
  const { hash, pathname } = useLocation()
  useEffect(() => { if (hash === '#contact' || pathname === '/contact') document.getElementById('contact')?.scrollIntoView() }, [hash, pathname])
  return <div className="page">
    <PageHeading id="about-heading" eyebrow="Dawney Animal Clinic" title="About & location" actions={<DirectionsButton />}>A veterinary clinic in General Trias, Cavite, Philippines.</PageHeading>
    <div className="info-grid">
      <section className="card" aria-labelledby="loc-heading" id="location"><h2 id="loc-heading">Visit us</h2>
        <p>Use Get directions to open the clinic’s location in Google Maps. We do not embed a map, so nothing is sent to third parties until you choose to open it.</p><DirectionsButton /></section>
      <section className="card card-muted" aria-labelledby="contact-heading" id="contact" tabIndex={-1}><h2 id="contact-heading">Contact</h2><ContactDetails /></section>
    </div>
    <section className="section" aria-labelledby="req-heading"><h2 id="req-heading">Requesting an appointment</h2>
      <div className="card"><p>You can send an online request for a service the clinic has approved. Requests are sent for the clinic to review and are <strong>not confirmed</strong> until the clinic confirms them. Please do not send private medical details through public pages.</p>
        <Link className="button button-primary" to="/book">Book an appointment</Link></div></section>
  </div>
}
