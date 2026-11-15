import { useState } from 'react'
import { AIcon } from './parts'
import { ASSIGNEES, QUICK_REPLIES, type AlphaAction, type AlphaState } from './model.mjs'

const LABELS = ['Appointment', 'New enquiry', 'Reminder', 'Follow-up']
type Filter = 'all' | 'unread' | 'mine'

export function InboxView({ state, dispatch, say }: { state: AlphaState; dispatch: (a: AlphaAction) => void; say: (m: string) => void }) {
  const [sel, setSel] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [draft, setDraft] = useState('')
  const threads = state.threads.filter(t => filter === 'all' || (filter === 'unread' ? t.unread > 0 : t.assignedTo === 'you'))
  const cur = state.threads.find(t => t.id === sel) ?? null
  const open = (id: string) => { setSel(id); dispatch({ type: 'inbox/open', id }) }
  const assignee = (id: string | null) => ASSIGNEES.find(a => a.id === id)?.label

  return <div className={cur ? 'a-inbox has-thread' : 'a-inbox'}>
    <section className="a-list" aria-label="Conversations">
      <div role="group" aria-label="Filter conversations" className="a-seg">{([['all', 'All'], ['unread', 'Unread'], ['mine', 'Mine']] as const).map(([f, l]) =>
        <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>{l}</button>)}</div>
      {threads.length === 0 ? <p className="a-empty">No conversations match this filter.</p> : <ul>{threads.map(t => <li key={t.id}>
        <button type="button" className="a-thread-btn" aria-current={sel === t.id ? 'true' : undefined} onClick={() => open(t.id)}>
          <span className="a-avatar" aria-hidden="true">{t.owner.slice(-2)}</span>
          <span className="a-thread-main"><strong>{t.owner}</strong><small>{t.pet} · {t.messages.at(-1)?.text}</small>
            <span className="a-chips">{t.unread > 0 && <span className="a-chip a-chip-unread">{t.unread} unread</span>}{t.assignedTo ? <span className="a-chip a-chip-plain">{assignee(t.assignedTo)}</span> : <span className="a-chip a-chip-plain">Unassigned</span>}{t.labels.map(l => <span key={l} className="a-chip a-chip-plain">{l}</span>)}</span></span>
        </button></li>)}</ul>}
    </section>
    <section className="a-thread" aria-label="Conversation">
      {!cur ? <p className="a-empty a-empty-box">Choose a conversation to read it. Everything here is simulated.</p> : <>
        <header className="a-thread-head">
          <button type="button" className="a-btn a-btn-ghost a-back" onClick={() => setSel(null)}><AIcon name="back" />Conversations</button>
          <div><h2>{cur.owner}</h2><p className="a-muted a-small">Patient: {cur.pet}</p></div>
          <label className="a-assign">Assigned to<select value={cur.assignedTo ?? ''} onChange={e => { dispatch({ type: 'inbox/assign', id: cur.id, to: e.target.value || null }); say('Assignment updated (demo).') }}>
            <option value="">Unassigned</option>{ASSIGNEES.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}</select></label>
        </header>
        <div className="a-filters" role="group" aria-label="Labels">{LABELS.map(l => <button key={l} type="button" className="a-filter" aria-pressed={cur.labels.includes(l)} onClick={() => dispatch({ type: 'inbox/label', id: cur.id, label: l })}>{l}</button>)}</div>
        <div className="a-log" role="log" aria-label={`Messages with ${cur.owner}`} tabIndex={0}>{cur.messages.map(m => <div key={m.id} className={m.from === 'clinic' ? 'a-bubble out' : 'a-bubble in'}>
          <p>{m.text}</p>{m.status && <small className="a-sim">{m.status} — not sent</small>}</div>)}</div>
        <form className="a-composer" onSubmit={e => { e.preventDefault(); if (!draft.trim()) return; dispatch({ type: 'inbox/send', id: cur.id, text: draft }); setDraft(''); say('Reply added to this demo only. Nothing was sent.') }}>
          <div className="a-filters" role="group" aria-label="Quick replies">{QUICK_REPLIES.map(q => <button key={q.id} type="button" className="a-filter" onClick={() => setDraft(q.text)}>{q.label}</button>)}</div>
          <label className="visually-hidden" htmlFor="a-draft">Reply (simulated)</label>
          <textarea id="a-draft" rows={3} maxLength={500} value={draft} placeholder="Write a reply — it stays on this page" onChange={e => setDraft(e.target.value)} />
          <div className="a-composer-foot"><small className="a-muted">Demo only · no WhatsApp, Telegram or any provider is connected.</small>
            <button className="a-btn a-btn-primary" disabled={!draft.trim()}>Send (simulated)</button></div>
        </form></>}
    </section>
  </div>
}
