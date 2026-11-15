import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../hooks/AuthProvider'
import { supabase } from '../lib/supabase'
import { Icon, ThemeToggle, initials } from './ui'

/**
 * Owner-supplied Dawney Animal Clinic logo (original artwork, unmodified, 1:1 with built-in margin).
 * WebP is the optimized copy; the original PNG is the fallback. If both fail to load a plain wordmark
 * is shown — never a generic medical cross.
 */
export const LOGO_WEBP = '/brand/dawney-logo.webp'
export const LOGO_PNG = '/brand/dawney-logo-original.png'

export function Brand({ compact = false }: { compact?: boolean }) {
  const [missing, setMissing] = useState(false)
  if (!missing) {
    return <span className={compact ? 'brand brand-compact' : 'brand'}>
      <span className="brand-plate"><picture><source srcSet={LOGO_WEBP} type="image/webp" />
        <img className="brand-logo" src={LOGO_PNG} width={512} height={512} alt="Dawney Animal Clinic" onError={() => setMissing(true)} /></picture></span></span>
  }
  return <span className="brand" role="img" aria-label="Dawney Animal Clinic">
    <span className="brand-wordmark" aria-hidden="true"><strong>Dawney</strong>{!compact && <small>Animal Clinic</small>}</span></span>
}

export function PublicLayout() {
  return <div className="public-layout">
    <header className="public-header"><NavLink to="/auth/signin" className="brand-link" aria-label="Dawney Animal Clinic — sign in"><Brand compact /></NavLink>
      <div className="public-header-actions"><ThemeToggle /><NavLink to="/auth/signin">Sign in</NavLink></div></header>
    <main id="main-content" tabIndex={-1} className="public-main"><Outlet /></main>
    <footer className="public-footer">Dawney Animal Clinic · Secure account access</footer></div>
}

const nav = [
  { to: '/app/overview', label: 'Overview', icon: 'home' },
  { to: '/app/pets', label: 'My patients', icon: 'paw' },
  { to: '/app/appointments', label: 'Appointments', icon: 'calendar' },
  { to: '/app/profile', label: 'My profile', icon: 'user' },
] as const
const titles: Record<string, string> = Object.fromEntries(nav.map(n => [n.to, n.label]))

export function AppLayout() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [leaving, setLeaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [navOpen, setNavOpen] = useState(false)
  const [announce, setAnnounce] = useState('')
  const toggleRef = useRef<HTMLButtonElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const first = useRef(true)
  const pageTitle = titles[location.pathname] ?? 'Clinic workspace'

  async function signOut() {
    if (!supabase) return
    setLeaving(true)
    setError(null)
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    setLeaving(false)
    if (error) { setError('Could not sign out completely. Please retry.'); return }
    navigate('/auth/signin', { replace: true })
  }

  // Route change: close drawer, announce the page, move focus to the content (not on first load).
  useEffect(() => {
    setNavOpen(false)
    document.title = `${pageTitle} · Dawney Animal Clinic`
    if (first.current) { first.current = false; return }
    setAnnounce(`${pageTitle} page loaded`)
    mainRef.current?.focus({ preventScroll: false })
  }, [location.pathname, pageTitle])

  // Drawer: Escape closes and returns focus to the toggle; opening moves focus into the drawer.
  useEffect(() => {
    if (!navOpen) return
    sidebarRef.current?.querySelector<HTMLElement>('a')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setNavOpen(false); toggleRef.current?.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [navOpen])

  const email = user?.email ?? ''
  const name = [user?.user_metadata?.first_name, user?.user_metadata?.last_name].filter(Boolean).join(' ')
  return <div className="app-layout">
    <aside ref={sidebarRef} id="app-sidebar" className={navOpen ? 'sidebar is-open' : 'sidebar'} aria-label="Main navigation">
      <Brand />
      <nav className="main-nav" aria-label="Pet owner portal">
        <p className="nav-label">Pet owner portal</p>
        {nav.map(n => <NavLink key={n.to} to={n.to}><Icon name={n.icon} />{n.label}</NavLink>)}
      </nav>
      <div className="sidebar-bottom"><small>Signed in as</small><span className="truncate">{email}</span>
        <button type="button" className="button button-secondary" disabled={leaving} onClick={() => void signOut()}>{leaving ? 'Signing out…' : 'Sign out'}</button>
        {error && <p role="alert" className="error-text">{error}</p>}
      </div>
    </aside>
    <div className={navOpen ? 'nav-backdrop is-open' : 'nav-backdrop'} onClick={() => setNavOpen(false)} aria-hidden="true" />
    <div className="app-content">
      <header className="topbar">
        <div className="topbar-title">
          <button ref={toggleRef} className="icon-button mobile-toggle" type="button" aria-label={navOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={navOpen} aria-controls="app-sidebar" onClick={() => setNavOpen(!navOpen)}><Icon name={navOpen ? 'close' : 'menu'} /></button>
          <span>{pageTitle}</span></div>
        <div className="topbar-actions">
          <span className="topbar-status"><span className="status-dot" aria-hidden="true" />Signed in</span>
          <ThemeToggle />
          <span className="avatar" title={name || email} aria-hidden="true">{initials(user?.user_metadata?.first_name, user?.user_metadata?.last_name) === '?' ? initials(email) : initials(user?.user_metadata?.first_name, user?.user_metadata?.last_name)}</span>
        </div>
      </header>
      <main ref={mainRef} id="main-content" tabIndex={-1} className="workarea"><Outlet /></main>
      <p className="visually-hidden" role="status" aria-live="polite">{announce}</p>
      <footer className="app-footer">Patient information is protected by database access policies.</footer>
    </div>
  </div>
}
