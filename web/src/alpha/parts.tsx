import { useEffect, useRef, type ReactNode } from 'react'

const P: Record<string, ReactNode> = {
  flow: <><rect x="3" y="4" width="4.5" height="16" rx="1.5" /><rect x="9.75" y="4" width="4.5" height="10" rx="1.5" /><rect x="16.5" y="4" width="4.5" height="13" rx="1.5" /></>,
  schedule: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4M8 14h3" /></>,
  inbox: <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4h0A2.5 2.5 0 0 1 4 13.5v-7Z" />,
  campaigns: <path d="M4 10v4l11 5V5L4 10Zm11-3.5c2.2.7 3.5 2.9 3.5 5.5s-1.3 4.8-3.5 5.5M7 14.5l1.2 4.5" />,
  undo: <path d="M9 7 4.5 11.5 9 16M5 11.5h9.5a4.5 4.5 0 0 1 0 9H11" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  back: <path d="m14.5 6-6 6 6 6" />,
  globe: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.5 2.6 3.7 5.4 3.7 8.5s-1.2 5.9-3.7 8.5c-2.5-2.6-3.7-5.4-3.7-8.5S9.5 6.1 12 3.5Z" /></>,
}
export function AIcon({ name }: { name: keyof typeof P | string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{P[name]}</svg>
}

/** Native <dialog>: focus trap, Escape and focus return come from the platform. */
export function Modal({ open, onClose, title, side = false, children }: { open: boolean; onClose: () => void; title: string; side?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return <dialog ref={ref} className={side ? 'a-dialog a-drawer' : 'a-dialog'} aria-label={title} onClose={onClose}
    onClick={e => { if (e.target === ref.current) onClose() }}>
    {open && <div className="a-dialog-body">
      <div className="a-dialog-head"><h2>{title}</h2><button type="button" className="a-icon-btn" onClick={onClose} aria-label="Close"><AIcon name="close" /></button></div>
      {children}</div>}
  </dialog>
}
