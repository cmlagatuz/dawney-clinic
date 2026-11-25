import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useAuth } from '../hooks/AuthProvider'
import { Brand } from './Layout'
import { Icon, ThemeToggle } from './ui'
import { BRANCHES, CAVITE, NAGA, SUNDAY_NOTE, telHref, CLINIC_PHONE, type Branch } from '../public-site/clinic-info.mjs'

function ExtLink({ href, children, secondary = true, hint }: { href: string; children: string; secondary?: boolean; hint: string }) {
  return <a className={secondary ? 'button button-secondary' : 'button button-primary'} href={href} target="_blank" rel="noopener noreferrer">
    {children}<span className="visually-hidden"> ({hint}, opens in a new tab)</span></a>
}
/** Contact facts for one branch (Naga by default). Hours are owner-supplied display hours; Sunday is never asserted. */
export function ContactDetails({ branch = NAGA, headingLevel = 3 }: { branch?: Branch; headingLevel?: 2 | 3 | 4 }) {
  const H = `h${headingLevel}` as 'h2' | 'h3' | 'h4'
  const tel = telHref(CLINIC_PHONE)
  return <div className="contact-details">
    <H>Address</H><p>{branch.address}</p>
    <H>Opening hours</H><ul className="plain-list">{branch.hours.map(h => <li key={h}>{h}</li>)}</ul><p className="small-help">{SUNDAY_NOTE}</p>
    <H>Contact</H><p>{tel ? <a href={tel}>{CLINIC_PHONE}</a> : <span>Please send us a message on our Facebook page. We have not listed a phone number.</span>}</p>
  </div>
}
export function DirectionsButton({ secondary = false, branch = NAGA }: { secondary?: boolean; branch?: Branch }) {
  return <ExtLink href={branch.mapsUrl} secondary={secondary} hint={`Google Maps, ${branch.shortName}`}>Get directions</ExtLink>
}
export function MessageButton({ branch = NAGA, secondary = false }: { branch?: Branch; secondary?: boolean }) {
  return <ExtLink href={branch.facebookUrl} secondary={secondary} hint={`Facebook page, ${branch.shortName}`}>{branch.messageLabel}</ExtLink>
}
/** One branch profile card. `primary` marks Naga; Cavite is a secondary, information-only profile (no booking). */
export function BranchCard({ branch, primary = false, headingLevel = 3 }: { branch: Branch; primary?: boolean; headingLevel?: 2 | 3 }) {
  const H = `h${headingLevel}` as 'h2' | 'h3'
  return <article className={primary ? 'card branch-card' : 'card card-muted branch-card'} aria-labelledby={`branch-${branch.id}`}>
    <span className="eyebrow">{primary ? 'Primary branch' : 'Secondary branch'}</span>
    <H id={`branch-${branch.id}`}>{branch.name}</H>
    <ContactDetails branch={branch} headingLevel={headingLevel === 2 ? 3 : 4} />
    <div className="cta-row"><MessageButton branch={branch} secondary={!primary} /><DirectionsButton branch={branch} secondary /></div>
  </article>
}
export function BranchDirectory({ headingLevel = 3 }: { headingLevel?: 2 | 3 }) {
  return <div className="info-grid branch-directory">{BRANCHES.map(b => <BranchCard key={b.id} branch={b} primary={b.id === NAGA.id} headingLevel={headingLevel} />)}</div>
}
export { CAVITE, NAGA }

const links = [{ to: '/', label: 'Home', end: true }, { to: '/services', label: 'Services' }, { to: '/about', label: 'About' }, { to: '/location', label: 'Locations' }, { to: '/contact', label: 'Contact' }] as const

export function SiteLayout() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const toggle = useRef<HTMLButtonElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const first = useRef(true)
  const main = useRef<HTMLElement>(null)
  useEffect(() => { setOpen(false); if (first.current) { first.current = false; return } main.current?.focus() }, [pathname])
  useEffect(() => {
    if (!open) return
    // On narrow screens the menu precedes its toggle in DOM order. Move
    // keyboard focus into the opened links; Escape returns it to the toggle.
    navRef.current?.querySelector<HTMLAnchorElement>('a')?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); toggle.current?.focus() } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])
  return <div className="site">
    <header className="site-header">
      <Link to="/" className="brand-link" aria-label="Dawney Animal Clinic, Naga Branch — home"><Brand compact /></Link>
      <nav ref={navRef} id="site-nav" className={open ? 'site-nav is-open' : 'site-nav'} aria-label="Main">
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
        <div><strong>{NAGA.name}</strong><p>{NAGA.address}</p><p className="small-help">{NAGA.hours[0]}</p><div className="cta-row"><MessageButton secondary /><DirectionsButton secondary /></div>
          <p className="small-help"><strong>Also:</strong> {CAVITE.name}, {CAVITE.address}. <a href={CAVITE.facebookUrl} target="_blank" rel="noopener noreferrer">Cavite Facebook page<span className="visually-hidden"> (opens in a new tab)</span></a> · <a href={CAVITE.mapsUrl} target="_blank" rel="noopener noreferrer">Cavite directions<span className="visually-hidden"> (opens Google Maps in a new tab)</span></a></p></div>
        <nav aria-label="Footer"><Link to="/services">Services</Link><Link to="/about">About</Link><Link to="/location">Locations</Link><Link to="/contact">Contact</Link><Link to="/book">Book an appointment</Link><Link to="/auth/signin">Sign in</Link></nav>
        <p className="small-help">Online requests are not confirmed appointments until the clinic confirms them. Never enter private medical details in public pages.</p>
      </div>
    </footer>
  </div>
}
