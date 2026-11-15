import { canUndo, clock12, endOf, FLOW_COLUMNS, kpis, ROOMS, TODAY, TRANSITIONS, VETS, type AlphaAction, type AlphaState, type Appt } from './model.mjs'
import { AIcon } from './parts'

const vetName = (id: string) => VETS.find(v => v.id === id)?.name ?? id
const roomName = (id: string) => ROOMS.find(r => r.id === id)?.name ?? id

export function Kpis({ state }: { state: AlphaState }) {
  const k = kpis(state)
  const items: Array<[string, string | number, string]> = [
    ['Visits today', k.today, 'Demo schedule'], ['Waiting room', k.waiting, 'Checked in'], ['In consult', k.consult, `${k.roomsBusy}/${k.roomsTotal} rooms busy`],
    ['Seen', k.seen, 'Completed'], ['No-shows', k.noshow, 'Marked today'], ['Unread messages', k.unread, 'Simulated inbox']]
  return <ul className="a-kpis" aria-label="Today at a glance (synthetic)">{items.map(([l, v, s]) =>
    <li key={l} className="a-kpi"><span className="a-kpi-value">{v}</span><span className="a-kpi-label">{l}</span><small>{s}</small></li>)}</ul>
}

function Card({ ap, undoable, dispatch, say }: { ap: Appt; undoable: boolean; dispatch: (a: AlphaAction) => void; say: (m: string, undo?: string) => void }) {
  const acts = TRANSITIONS[ap.status]
  return <article className={`a-card tone-${VETS.find(v => v.id === ap.vetId)?.tone ?? 1}`} aria-label={`${ap.pet}, ${ap.owner}`}>
    <header><strong>{ap.pet}</strong><span className="a-time">{clock12(ap.start)}–{clock12(endOf(ap))}</span></header>
    <p className="a-sub">{ap.species} · {ap.owner}</p>
    <p className="a-sub">{ap.reason}</p>
    <p className="a-chips"><span className="a-chip">{vetName(ap.vetId)}</span><span className="a-chip a-chip-plain">{roomName(ap.roomId)}</span></p>
    <div className="a-actions">
      {acts.map((t, i) => <button key={t.to} type="button" className={i === 0 ? 'a-btn a-btn-primary' : 'a-btn'}
        onClick={() => { dispatch({ type: 'flow/move', id: ap.id, to: t.to }); say(`${ap.pet}: ${t.label.toLowerCase()} — ${t.to === 'noshow' ? 'marked no-show' : `moved to ${FLOW_COLUMNS.find(c => c.id === t.to)?.label}`}.`, ap.id) }}
        aria-label={`${t.label}: ${ap.pet}`}>{t.label}</button>)}
      {undoable && <button type="button" className="a-btn a-btn-ghost" aria-label={`Undo last move for ${ap.pet}`}
        onClick={() => { dispatch({ type: 'flow/undoCard', id: ap.id }); say(`${ap.pet}: last move undone.`) }}><AIcon name="undo" />Undo</button>}
    </div></article>
}

export function FlowBoard({ state, dispatch, say }: { state: AlphaState; dispatch: (a: AlphaAction) => void; say: (m: string, undoId?: string) => void }) {
  const today = state.appts.filter(a => a.day === TODAY).sort((a, b) => a.start.localeCompare(b.start))
  const noshow = today.filter(a => a.status === 'noshow')
  return <>
    <Kpis state={state} />
    <div className="a-toolbar"><p className="a-muted">Today · Wednesday <span className="a-chip a-chip-plain">demo day</span></p>
      <button type="button" className="a-btn" disabled={state.history.length === 0} onClick={() => { dispatch({ type: 'flow/undoLast' }); say('Last move undone.') }}><AIcon name="undo" />Undo last move</button></div>
    <div className="a-board">{FLOW_COLUMNS.map(col => {
      const cards = today.filter(a => a.status === col.id)
      return <section key={col.id} className="a-col" aria-labelledby={`col-${col.id}`}>
        <h2 id={`col-${col.id}`}>{col.label}<span className="a-count" aria-label={`${cards.length} patients`}>{cards.length}</span></h2>
        <p className="a-hint">{col.hint}</p>
        {cards.length === 0 ? <p className="a-empty">No patients here.</p> : cards.map(ap => <Card key={ap.id} ap={ap} undoable={canUndo(state, ap.id)} dispatch={dispatch} say={say} />)}
      </section>
    })}</div>
    {noshow.length > 0 && <section className="a-noshow" aria-labelledby="col-noshow"><h2 id="col-noshow">No-shows <span className="a-count">{noshow.length}</span></h2>
      <div className="a-noshow-list">{noshow.map(ap => <Card key={ap.id} ap={ap} undoable={canUndo(state, ap.id)} dispatch={dispatch} say={say} />)}</div></section>}
  </>
}
