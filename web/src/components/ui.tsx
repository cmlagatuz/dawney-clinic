import { useState, type ReactNode, type SVGProps } from 'react'

/* Presentation-only building blocks. No data access, no auth logic. */

type IconName = 'home' | 'user' | 'paw' | 'calendar' | 'menu' | 'close' | 'sun' | 'moon' | 'shield' | 'plus' | 'logout'
const paths: Record<IconName, ReactNode> = {
  home: <path d="M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10" />,
  user: <><circle cx="12" cy="8" r="3.6" /><path d="M5 20c.8-3.6 3.7-5.4 7-5.4s6.2 1.8 7 5.4" /></>,
  paw: <><circle cx="6.5" cy="10" r="1.9" /><circle cx="10.2" cy="5.8" r="1.9" /><circle cx="15" cy="5.8" r="1.9" /><circle cx="18.2" cy="10" r="1.9" /><path d="M12.5 11.5c-2.6 0-5 2.7-5 5 0 1.6 1.2 2.4 2.6 2.4 1 0 1.5-.4 2.4-.4s1.4.4 2.4.4c1.4 0 2.6-.8 2.6-2.4 0-2.3-2.4-5-5-5Z" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" /></>,
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z" />,
  shield: <path d="M12 3.2 4.8 6v5.6c0 4.4 3 7.6 7.2 9.2 4.2-1.6 7.2-4.8 7.2-9.2V6L12 3.2Zm-3 8.6 2.2 2.2 3.8-4" />,
  plus: <path d="M12 5v14M5 12h14" />,
  logout: <path d="M10 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H10M15 8l4 4-4 4M19 12H9.5" />,
}
export function Icon({ name, ...rest }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>{paths[name]}</svg>
}

export function PageHeading({ eyebrow, title, id, children, actions }: { eyebrow?: string; title: string; id: string; children?: ReactNode; actions?: ReactNode }) {
  return <div className="page-heading"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1 id={id}>{title}</h1>
    {children && <p className="subtitle">{children}</p>}</div>{actions && <div className="page-heading-actions">{actions}</div>}</div>
}

export function EmptyState({ icon = 'paw', title, children, action }: { icon?: IconName; title: string; children?: ReactNode; action?: ReactNode }) {
  return <div className="card empty"><span className="empty-art"><Icon name={icon} /></span><h2>{title}</h2>{children && <p>{children}</p>}{action}</div>
}

/** Accessible loading placeholder: one polite status, decorative skeleton shapes. */
export function LoadingCard({ label, rows = 3 }: { label: string; rows?: number }) {
  return <div className="card" role="status" aria-live="polite"><span className="visually-hidden">{label}</span>
    <span className="skeleton skeleton-title" aria-hidden="true" />
    {Array.from({ length: rows }, (_, i) => <span key={i} className="skeleton skeleton-line" style={{ width: `${92 - i * 14}%` }} aria-hidden="true" />)}</div>
}

const statusLabel: Record<string, string> = { requested: 'Requested', confirmed: 'Confirmed', checked_in: 'Checked in', completed: 'Completed', cancelled: 'Cancelled', no_show: 'No show' }
/** Status is conveyed by text plus a dot, never by colour alone. */
export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${status}`}>{statusLabel[status] ?? status.replace('_', ' ')}</span>
}

export function Spinner() { return <span className="spinner" aria-hidden="true" /> }

export function initials(...parts: Array<string | null | undefined>) {
  return parts.map(p => (p ?? '').trim().charAt(0)).join('').toUpperCase().slice(0, 2) || '?'
}

const THEME_KEY = 'dawney-theme'
function currentTheme(): 'light' | 'dark' {
  const attr = document.documentElement.getAttribute('data-theme')
  if (attr === 'light' || attr === 'dark') return attr
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>(currentTheme)
  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    try { localStorage.setItem(THEME_KEY, next) } catch { /* storage unavailable: theme still applies for this visit */ }
    setTheme(next)
  }
  return <button type="button" className="icon-button" onClick={toggle} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
    <Icon name={theme === 'dark' ? 'sun' : 'moon'} /><span className="icon-label">{theme === 'dark' ? 'Light' : 'Dark'}</span></button>
}
