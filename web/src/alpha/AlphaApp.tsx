import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { BrowserRouter, NavLink, Navigate, Route, Routes, useLocation } from 'react-router'
import { ThemeToggle } from '../components/ui'
import { AIcon } from './parts'
import { FlowBoard } from './FlowBoard'
import { ScheduleView } from './ScheduleView'
import { InboxView } from './InboxView'
import { CampaignsView } from './CampaignsView'
import { alphaPreviewAllowed, initialState, kpis, reduce } from './model.mjs'
import './alpha.css'

const BASE = '/alpha/clinic-ops'
const MODULES = [
  { path: '', label: 'Patient flow', icon: 'flow', title: 'Patient flow' },
  { path: 'schedule', label: 'Schedule', icon: 'schedule', title: 'Veterinary schedule' },
  { path: 'inbox', label: 'Inbox', icon: 'inbox', title: 'Unified inbox' },
  { path: 'campaigns', label: 'Campaigns', icon: 'campaigns', title: 'Campaigns & reminders' },
] as const

function Banner() {
  return <div className="alpha-banner" role="note"><strong>ALPHA DEMO</strong><span aria-hidden="true">·</span><strong>SYNTHETIC DATA</strong><span aria-hidden="true">·</span><strong>NO REAL MESSAGES SENT</strong></div>
}

function Blocked() {
  return <div className="alpha alpha-blocked"><Banner /><main id="main-content" tabIndex={-1}><h1>Alpha preview not available here</h1>
    <p>This synthetic clinic-operations demo only runs on preview deployments, never on the live clinic website.</p><a className="a-btn a-btn-primary" href="/">Go to the clinic website</a></main></div>
}

function Shell() {
  const [state, dispatch] = useReducer(reduce, undefined, initialState)
  const [toast, setToast] = useState<{ msg: string; undoId?: string } | null>(null)
  const loc = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const first = useRef(true)
  const unread = kpis(state).unread
  const slug = loc.pathname.replace(BASE, '').replace(/^\//, '').replace(/\/$/, '')
  const mod = MODULES.find(m => m.path === slug) ?? MODULES[0]
  const say = useCallback((msg: string, undoId?: string) => setToast({ msg, undoId }), [])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 9000); return () => clearTimeout(t) }, [toast])
  useEffect(() => {
    document.title = `${mod.title} · ALPHA DEMO · Dawney Animal Clinic`
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]')
    if (!robots) { robots = document.createElement('meta'); robots.name = 'robots'; document.head.appendChild(robots) }
    robots.content = 'noindex, nofollow'
    setToast(null)
    if (first.current) { first.current = false; return }
    mainRef.current?.focus({ preventScroll: false })
  }, [mod.title])

  return <div className="alpha">
    <Banner />
    <div className="alpha-shell">
      <aside className="alpha-rail" aria-label="Demo navigation">
        <a className="alpha-brand" href="/" aria-label="Dawney Animal Clinic — back to website"><picture><source srcSet="/brand/dawney-logo.webp" type="image/webp" /><img src="/brand/dawney-logo-original.png" width={44} height={44} alt="Dawney Animal Clinic" /></picture></a>
        <nav aria-label="Clinic operations modules">{MODULES.map(m => <NavLink key={m.path} to={m.path ? `${BASE}/${m.path}` : BASE} end className="alpha-nav">
          <AIcon name={m.icon} /><span>{m.label}</span>{m.path === 'inbox' && unread > 0 && <b className="alpha-badge" aria-label={`${unread} unread`}>{unread}</b>}</NavLink>)}</nav>
        <div className="alpha-rail-foot"><ThemeToggle /><a className="alpha-nav alpha-site" href="/"><AIcon name="globe" /><span>Website</span></a></div>
      </aside>
      <main ref={mainRef} id="main-content" tabIndex={-1} className="alpha-main">
        <header className="alpha-head"><div><span className="eyebrow">Clinic operations · demo</span><h1>{mod.title}</h1></div>
          <p className="alpha-note">Invented patients and owners. Changes live only in this tab.</p></header>
        {mod.path === '' && <FlowBoard state={state} dispatch={dispatch} say={say} />}
        {mod.path === 'schedule' && <ScheduleView state={state} dispatch={dispatch} say={say} />}
        {mod.path === 'inbox' && <InboxView state={state} dispatch={dispatch} say={say} />}
        {mod.path === 'campaigns' && <CampaignsView state={state} dispatch={dispatch} say={say} />}
      </main>
    </div>
    <div className="a-toast-region" role="status" aria-live="polite">{toast && <div className="a-toast"><span>{toast.msg}</span>
      {toast.undoId && <button type="button" className="a-btn" onClick={() => { dispatch({ type: 'flow/undoCard', id: toast.undoId as string }); setToast({ msg: 'Move undone.' }) }}>Undo</button>}
      <button type="button" className="a-icon-btn" onClick={() => setToast(null)} aria-label="Dismiss"><AIcon name="close" /></button></div>}</div>
  </div>
}

export default function AlphaApp() {
  if (!alphaPreviewAllowed(window.location.hostname)) return <Blocked />
  return <BrowserRouter><a className="skip-link" href="#main-content">Skip to main content</a><Routes>
    <Route path={`${BASE}/*`} element={<Shell />} /><Route path="*" element={<Navigate to={BASE} replace />} /></Routes></BrowserRouter>
}
