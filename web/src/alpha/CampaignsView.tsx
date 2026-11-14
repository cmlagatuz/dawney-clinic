import { useState } from 'react'
import { Modal } from './parts'
import { audience, type AlphaAction, type AlphaState, type Campaign } from './model.mjs'

const STATUS: Record<string, string> = { draft: 'Draft', scheduled: 'Scheduled (simulated)', preview: 'Local preview run' }

function CampaignCard({ c, dispatch, say, onReview }: { c: Campaign; dispatch: (a: AlphaAction) => void; say: (m: string) => void; onReview: (id: string) => void }) {
    const a = audience(c)
    return <article className="a-camp" aria-labelledby={`camp-${c.id}`}>
      <header><h3 id={`camp-${c.id}`}>{c.name}</h3><span className={`a-status cs-${c.status}`}>{STATUS[c.status]}</span></header>
      <p className="a-muted">{c.blurb}</p>
      <dl className="a-counts"><div><dt>In segment</dt><dd>{a.total}</dd></div><div><dt>Would include</dt><dd>{a.included.length}</dd></div><div><dt>Excluded</dt><dd>{a.optedOut.length + a.noConsent.length}</dd></div></dl>
      <p className="a-small a-muted">Excluded: {a.optedOut.length} opted out · {a.noConsent.length} without consent. Delivery, read and reply metrics are not available — nothing is sent.</p>
      <div className="a-actions">
        {c.status === 'draft' && <button type="button" className="a-btn" onClick={() => { dispatch({ type: 'camp/schedule', id: c.id }); say(`${c.name} scheduled in this demo only.`) }}>Schedule (simulated)</button>}
        {c.status === 'scheduled' && <button type="button" className="a-btn" onClick={() => { dispatch({ type: 'camp/unschedule', id: c.id }); say(`${c.name} returned to draft.`) }}>Unschedule</button>}
        {c.status === 'preview' && <button type="button" className="a-btn" onClick={() => { dispatch({ type: 'camp/reset', id: c.id }); say(`${c.name} reset.`) }}>Reset</button>}
        <button type="button" className="a-btn a-btn-primary" onClick={() => onReview(c.id)}>Review &amp; send…</button>
      </div></article>
}

export function CampaignsView({ state, dispatch, say }: { state: AlphaState; dispatch: (a: AlphaAction) => void; say: (m: string) => void }) {
  const [tab, setTab] = useState<'templates' | 'scheduled'>('templates')
  const [reviewId, setReviewId] = useState<string | null>(null)
  const review = state.campaigns.find(c => c.id === reviewId) ?? null
  const list = state.campaigns.filter(c => tab === 'templates' || c.status !== 'draft')
  const ra = review ? audience(review) : null

  return <>
    <div className="a-callout" role="note"><strong>Sending is disabled in this preview.</strong> No messages are created, queued or delivered. Counts come from synthetic contacts.</div>
    <div className="a-toolbar"><div role="group" aria-label="Campaign list" className="a-seg">{([['templates', 'Templates'], ['scheduled', 'Scheduled & previews']] as const).map(([t, l]) =>
      <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)}>{l}</button>)}</div></div>
    {list.length === 0 ? <p className="a-empty a-empty-box">Nothing scheduled yet. Schedule a template (simulated) to see it here.</p> : <div className="a-camps">{list.map(c => <CampaignCard key={c.id} c={c} dispatch={dispatch} say={say} onReview={setReviewId} />)}</div>}
    <Modal open={!!review} onClose={() => setReviewId(null)} title={review ? `Review: ${review.name}` : 'Review'}>
      {review && ra && <>
        <p>This is a <strong>pre-send confirmation preview</strong>. Opted-out contacts and contacts without consent are always excluded.</p>
        <dl className="a-counts"><div><dt>Would receive</dt><dd>{ra.included.length}</dd></div><div><dt>Opted out</dt><dd>{ra.optedOut.length}</dd></div><div><dt>No consent</dt><dd>{ra.noConsent.length}</dd></div></dl>
        <details className="a-details"><summary>Excluded contacts ({ra.optedOut.length + ra.noConsent.length})</summary>
          <ul>{[...ra.optedOut.map(r => `${r.label} — opted out`), ...ra.noConsent.map(r => `${r.label} — no consent`)].map(x => <li key={x}>{x}</li>)}</ul></details>
        <div className="a-actions">
          <button type="button" className="a-btn a-btn-primary" disabled aria-describedby="send-off">Send to {ra.included.length} contacts</button>
          <button type="button" className="a-btn" onClick={() => { dispatch({ type: 'camp/preview', id: review.id }); say('Local preview recorded. No messages were created or sent.'); setReviewId(null) }}>Run local preview</button></div>
        <p id="send-off" className="a-small a-muted">Send is disabled: no messaging provider is connected and sending needs clinic approval. “Run local preview” only changes this page.</p></>}
    </Modal>
  </>
}
