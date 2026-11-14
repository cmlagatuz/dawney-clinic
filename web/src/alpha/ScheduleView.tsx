import { useMemo, useState, type CSSProperties } from 'react'
import { AIcon, Modal } from './parts'
import { BLOCKS, clock12, DAY_END, DAY_START, DAYS, endOf, FLOW_COLUMNS, pct, ROOMS, toMin, TODAY, TRANSITIONS, VETS, blocksFor, canUndo, visibleAppts, type AlphaAction, type AlphaState, type Appt, type Block } from './model.mjs'

const HOURS = Array.from({ length: (DAY_END - DAY_START) / 60 + 1 }, (_, i) => DAY_START / 60 + i)
const statusLabel = (s: string) => s === 'noshow' ? 'No-show' : FLOW_COLUMNS.find(c => c.id === s)?.label ?? s
const vet = (id: string) => VETS.find(v => v.id === id)
const pos = (start: string, end: string) => ({ top: `${pct(toMin(start))}%`, height: `${pct(toMin(end)) - pct(toMin(start))}%` })

export function ScheduleView({ state, dispatch, say }: { state: AlphaState; dispatch: (a: AlphaAction) => void; say: (m: string) => void }) {
  const [mode, setMode] = useState<'day' | 'week'>('day')
  const [day, setDay] = useState(TODAY)
  const [vetIds, setVetIds] = useState<string[]>(VETS.map(v => v.id))
  const [openId, setOpenId] = useState<string | null>(null)
  const open = state.appts.find(a => a.id === openId) ?? null
  const cols = mode === 'day' ? [{ key: day, label: DAYS.find(d => d[0] === day)?.[1] ?? day, day }] : DAYS.map(([d, l]) => ({ key: d, label: l, day: d }))
  const inView = useMemo(() => visibleAppts(state.appts, { vetIds, day: mode === 'day' ? day : undefined }), [state.appts, vetIds, mode, day])
  const blocksInView = useMemo(() => blocksFor(BLOCKS, { vetIds, day: mode === 'day' ? day : undefined }), [vetIds, mode, day])
  const lanes = VETS.filter(v => vetIds.includes(v.id))
  const toggleVet = (id: string) => setVetIds(cur => cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id])

  const laneStyle = (vetId: string | null) => {
    if (vetId === null || lanes.length === 0) return { left: '0%', width: '100%' }
    const i = lanes.findIndex(v => v.id === vetId); const w = 100 / lanes.length
    return { left: `${i * w}%`, width: `${w}%` }
  }
  // Day view: one column per vet; week view: one column per weekday with vets side by side.
  const columns: Array<{ key: string; label: string; sub?: string; day: string; vetId?: string }> = mode === 'day'
    ? (lanes.length ? lanes.map(v => ({ key: v.id, label: v.name, day, vetId: v.id })) : [])
    : cols.map(c => ({ key: c.key, label: c.label, sub: c.day === TODAY ? 'Today' : undefined, day: c.day }))

  return <>
    <ul className="a-kpis a-kpis-4" aria-label="Schedule summary (synthetic)">
      <li className="a-kpi"><span className="a-kpi-value">{inView.length}</span><span className="a-kpi-label">Visits in view</span></li>
      <li className="a-kpi"><span className="a-kpi-value">{lanes.length}/{VETS.length}</span><span className="a-kpi-label">Veterinarians shown</span></li>
      <li className="a-kpi"><span className="a-kpi-value">{blocksInView.filter(b => b.kind === 'blocked').length}</span><span className="a-kpi-label">Blocked periods</span></li>
      <li className="a-kpi"><span className="a-kpi-value">{inView.filter(a => a.status === 'waiting' || a.status === 'consult').length}</span><span className="a-kpi-label">Active now</span></li></ul>
    <div className="a-toolbar a-toolbar-wrap">
      <div role="group" aria-label="View" className="a-seg">{(['day', 'week'] as const).map(m => <button key={m} type="button" aria-pressed={mode === m} onClick={() => { setMode(m); say(`${m === 'day' ? 'Day' : 'Week'} view`) }}>{m === 'day' ? 'Day' : 'Week'}</button>)}</div>
      {mode === 'day' && <div role="group" aria-label="Day" className="a-seg">{DAYS.map(([d, l]) => <button key={d} type="button" aria-pressed={day === d} onClick={() => setDay(d)}>{l}{d === TODAY && <span className="visually-hidden"> (today)</span>}</button>)}</div>}
      <div role="group" aria-label="Filter veterinarians" className="a-filters">{VETS.map(v => <button key={v.id} type="button" className={`a-filter tone-${v.tone}`} aria-pressed={vetIds.includes(v.id)} onClick={() => toggleVet(v.id)}><span className="a-swatch" aria-hidden="true" />{v.name}</button>)}</div>
    </div>
    <p className="a-muted a-small">Demo hours 08:00–18:00 — <strong>not the clinic’s real hours</strong>. Hatched areas are unavailable time.</p>
    {lanes.length === 0 ? <p className="a-empty a-empty-box">Select at least one veterinarian to see the schedule.</p> :
    <div className="a-cal" role="region" aria-label={`${mode === 'day' ? 'Day' : 'Week'} schedule, scrollable`} tabIndex={0}>
      <div className={mode === 'week' ? 'a-cal-inner is-week' : 'a-cal-inner'} style={{ '--cols': columns.length } as CSSProperties}>
        <div className="a-axis" aria-hidden="true"><div className="a-axis-head" />{HOURS.slice(0, -1).map(h => <span key={h} style={{ top: `${pct(h * 60)}%` }}>{clock12(`${h}:00`).replace(':00', '')}</span>)}</div>
        {columns.map(c => <div key={c.key} className="a-day" role="group" aria-label={c.label}>
          <div className="a-day-head"><strong>{c.label}</strong>{c.sub && <small>{c.sub}</small>}</div>
          <div className="a-day-body">
            {HOURS.slice(1, -1).map(h => <i key={h} className="a-hline" style={{ top: `${pct(h * 60)}%` }} aria-hidden="true" />)}
            {BLOCKS.filter(b => b.day === c.day && (mode === 'day' ? (b.vetId === null || b.vetId === c.vetId) : (b.vetId === null || vetIds.includes(b.vetId)))).map((b: Block) =>
              <div key={b.id} className={`a-block a-block-${b.kind}`} style={{ ...pos(b.start, b.end), ...(mode === 'day' ? { left: 0, width: '100%' } : laneStyle(b.vetId)) }} role="img" aria-label={`${b.label}, ${clock12(b.start)} to ${clock12(b.end)}`}><span>{b.label}</span></div>)}
            {inView.filter(a => a.day === c.day && (mode === 'week' || a.vetId === c.vetId)).map((a: Appt) =>
              <button key={a.id} type="button" className={`a-appt tone-${vet(a.vetId)?.tone ?? 1} st-${a.status}`} style={{ ...pos(a.start, endOf(a)), ...(mode === 'day' ? { left: '4%', width: '92%' } : laneStyle(a.vetId)) }}
                onClick={() => setOpenId(a.id)} aria-label={`${a.pet}, ${a.species}, ${clock12(a.start)} to ${clock12(endOf(a))}, ${vet(a.vetId)?.name}, ${statusLabel(a.status)}. Open details`}>
                <b>{a.pet}</b><span>{clock12(a.start)}</span></button>)}
          </div></div>)}
      </div></div>}
    <Modal open={!!open} onClose={() => setOpenId(null)} title="Appointment details" side>
      {open && <dl className="a-dl">
        <dt>Patient</dt><dd>{open.pet} · {open.species}</dd><dt>Owner</dt><dd>{open.owner}</dd><dt>When</dt><dd>{DAYS.find(d => d[0] === open.day)?.[1]} · {clock12(open.start)}–{clock12(endOf(open))}</dd>
        <dt>Veterinarian</dt><dd>{vet(open.vetId)?.name}</dd><dt>Room</dt><dd>{ROOMS.find(r => r.id === open.roomId)?.name}</dd><dt>Reason</dt><dd>{open.reason}</dd>
        <dt>Status</dt><dd><span className={`a-status st-${open.status}`}>{statusLabel(open.status)}</span></dd></dl>}
      {open && open.day === TODAY && TRANSITIONS[open.status].length > 0 && <div className="a-actions">{TRANSITIONS[open.status].map((t, i) => <button key={t.to} type="button" className={i === 0 ? 'a-btn a-btn-primary' : 'a-btn'}
        onClick={() => { dispatch({ type: 'flow/move', id: open.id, to: t.to }); say(`${open.pet}: ${t.label.toLowerCase()}.`) }}>{t.label}</button>)}</div>}
      {open && canUndo(state, open.id) && <button type="button" className="a-btn a-btn-ghost" onClick={() => { dispatch({ type: 'flow/undoCard', id: open.id }); say(`${open.pet}: last move undone.`) }}><AIcon name="undo" />Undo last move</button>}
      <p className="a-muted a-small">Synthetic record. Nothing here is saved or sent.</p>
    </Modal>
  </>
}
