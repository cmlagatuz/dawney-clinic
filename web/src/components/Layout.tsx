import { NavLink, Outlet, useNavigate } from 'react-router'
import { useState } from 'react'
import { useAuth } from '../hooks/AuthProvider'
import { supabase } from '../lib/supabase'

export function Brand({ compact = false }: { compact?: boolean }) {
  return <span className="brand" aria-label="Dawney Animal Clinic"><span className="brand-mark" aria-hidden="true">✚</span>
    {!compact && <span><strong>Dawney</strong><small>Animal Clinic</small></span>}
  </span>
}

export function PublicLayout() {
  return <div className="public-layout"><header className="public-header"><Brand /><NavLink to="/auth/signin">Sign in</NavLink></header>
    <main id="main-content" className="public-main"><Outlet /></main><footer className="public-footer">Dawney Animal Clinic · Secure account access</footer></div>
}

export function AppLayout() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [leaving, setLeaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [navOpen, setNavOpen] = useState(false)
  async function signOut() {
    if (!supabase) return
    setLeaving(true)
    setError(null)
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    setLeaving(false)
    if (error) { setError('Could not sign out completely. Please retry.'); return }
    navigate('/auth/signin', { replace: true })
  }
  return <div className="app-layout">
    <aside className={navOpen ? 'sidebar is-open' : 'sidebar'} aria-label="Main navigation">
      <Brand />
      <nav className="main-nav">
        <NavLink onClick={() => setNavOpen(false)} to="/app/profile">My profile</NavLink>
        <NavLink onClick={() => setNavOpen(false)} to="/app/pets">Patients</NavLink>
        <NavLink onClick={() => setNavOpen(false)} to="/app/appointments">Appointments</NavLink>
      </nav>
      <div className="sidebar-bottom"><small>Signed in as</small><span className="truncate">{user?.email}</span>
        <button type="button" className="button button-secondary" disabled={leaving} onClick={() => void signOut()}>{leaving ? 'Signing out…' : 'Sign out'}</button>
        {error && <p role="alert" className="error-text">{error}</p>}
      </div>
    </aside>
    <div className="app-content">
      <header className="topbar"><button className="mobile-toggle button-quiet" type="button" aria-label={navOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={navOpen} onClick={() => setNavOpen(!navOpen)}>☰</button>
        <span>Clinic workspace</span><span className="topbar-status"><span className="status-dot"/> Authenticated</span></header>
      <main id="main-content" className="workarea"><Outlet /></main>
      <footer className="app-footer">Patient information is protected by database access policies.</footer>
    </div>
  </div>
}