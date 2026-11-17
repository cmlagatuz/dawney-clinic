import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useAuth } from '../hooks/AuthProvider'
import { Brand } from './Layout'
import { Icon, ThemeToggle } from './ui'
import { CLINIC_HOURS, CLINIC_LOCATION, CLINIC_PHONE, DIRECTIONS_URL, telHref } from '../public-site/clinic-info.mjs'

/** Facts block shared by Home/About/footer. Unconfirmed values show an honest pending state, never a guess. */
export function ContactDetails({ headingLevel = 3 }: { headingLevel?: 2 | 3 }) {
  const H = `h${headingLevel}` as 'h2' | 'h3'
  const tel = telHref(CLINIC_PHONE)
  return <div className="contact-details">
    <H>Location</H><p>{CLINIC_LOCATION}</p>
    <H>Phone</H><p>{tel ? <a href={tel}>{CLINIC_PHONE}</a> : <span className="pending">Phone number to be confirmed by the clinic.</span>}</p>
    <H>Opening hours</H>{CLINIC_HOURS ? <ul className="plain-list">{CLINIC_HOURS.map(h => <li key={h}>{h}</li>)}</ul> : <p><span className="pending">Opening hours to be confirmed by the clinic.</span></p>}
  </div>
}
export function DirectionsButton({ secondary = false }: { secondary?: boolean }) {
  return <a className={secondary ? 'button button-secondary' : 'button button-primary'} href={DIRECTIONS_URL} target="_blank" rel="noopener noreferrer">
    Get directions<span className="visually-hidden"> (opens Google Maps in a new tab)</span></a>
}

const links = [{ to: '/', label: 'Home', end: true }, { to: '/services', label: 'Services' }, { to: '/about', label: 'About & location' }] as const

export function SiteLayout() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const toggle = useRef<HTMLButtonElement>(null)
  const first = useRef(true)
  const main = useRef<HTMLElement>(null)
  useEffect(() => { setOpen(false); if (first.current) { first.current = false; return } main.current?.focus() }, [pathname])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); toggle.current?.focus() } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])
  return <div className="site">
    <header className="site-header">
      <Link to="/" className="brand-link" aria-label="Dawney Animal Clinic — home"><Brand compact /></Link>
      <nav id="site-nav" className={open ? 'site-nav is-open' : 'site-nav'} aria-label="Main">
        {links.map(l => <NavLink key={l.to} to={l.to} end={'end' in l}>{l.label}</NavLink>)}
        <NavLink to="/book" className="button button-primary button-small nav-book">Book an appointment</NavLink>
      </nav>
      <div className="site-actions">
        <ThemeToggle />
        <Link className="site-account" to={user ? '/app/overview' : '/auth/signin'}>{user ? 'My account' : 'Sign in'}</Link>
        <button ref={toggle} type="button" className="icon-button site-menu" aria-expanded={open} aria-controls="site-nav" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen(!open)}><Icon name={open ? 'close' : 'menu'} /></button>
      </div>
    </header>
    <main id="main-content" tabIndex={-1} ref={main} className="site-main"><Outlet /></main>
    <footer className="site-footer">
      <div className="site-footer-grid">
        <div><strong>Dawney Animal Clinic</strong><p>{CLINIC_LOCATION}</p><DirectionsButton secondary /></div>
        <nav aria-label="Footer"><Link to="/services">Services</Link><Link to="/about">About & location</Link><Link to="/book">Book an appointment</Link><Link to="/auth/signin">Sign in</Link></nav>
        <p className="small-help">Online requests are not confirmed appointments until the clinic confirms them. Never enter private medical details in public pages.</p>
      </div>
    </footer>
  </div>
}
