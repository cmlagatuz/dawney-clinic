import type {ReactNode} from 'react'
import {Icon, StatusBadge} from '../ui'
import type {Read} from '../../ops/useOpsData'
import {buildFlow, durationMinutes, formatClinicTime, formatDayLabel, groupByResource, shortRef, windowState} from '../../ops/ops-model.mjs'
import type {OpsErrorKind, OpsKpi, OpsRow, OpsWindow} from '../../ops/ops-model.mjs'

/* Presentation only. Data arrives already verified by the read port and ops-model validators. */

const TRANSITION_REASON = 'Status changes are not enabled yet: they need an audited transition contract.'

export function Notice({tone, title, children, role}: {tone: 'warning' | 'danger' | 'info'; title: string; children?: ReactNode; role?: 'alert' | 'status'}) {
  return <div className={`ops-notice ops-notice-${tone}`} role={role ?? (tone === 'info' ? 'status' : 'alert')}>
    <strong>{title}</strong>{children && <p>{children}</p>}</div>
}

const failureCopy: Record<OpsErrorKind, {title: string; body: string}> = {
  denied: {title: 'Clinic staff access required', body: 'This account is not an approved, active clinic staff member, so no clinic data was requested. Pet-owner accounts cannot open Operations.'},
  unavailable: {title: 'Staff read contract not integrated', body: 'This preview is built against the typed staff read interface, which has not been connected to the backend yet. No clinic data is requested and no demo data is shown.'},
  network: {title: 'Cannot reach the clinic database', body: 'Check your connection and retry. Nothing is shown as zero because nothing was read.'},
  error: {title: 'The clinic data could not be loaded', body: 'The response was unavailable or could not be trusted, so it was not displayed. Retry, or contact the administrator if it continues.'},
}
export function FailureCard({kind, onRetry}: {kind: OpsErrorKind; onRetry?: () => void}) {
  const c = failureCopy[kind]
  const retry = kind === 'network' || kind === 'error'
  return <div className="card ops-failure" role={kind === 'unavailable' ? 'status' : 'alert'}>
    <span className="empty-art"><Icon name="shield" /></span><h2>{c.title}</h2><p>{c.body}</p>
    {retry && onRetry && <button type="button" className="button button-primary" onClick={onRetry}>Retry</button>}</div>
}

export function KpiGrid({kpis, loading}: {kpis: OpsKpi[]; loading: boolean}) {
  return <section aria-labelledby="ops-kpi-h" className="ops-section"><h2 id="ops-kpi-h" className="ops-h2">At a glance</h2>
    <ul className="ops-kpis">{kpis.map(k => {
      const na = k.state === 'unavailable'
      return <li key={k.key} className={na ? 'ops-kpi is-na' : 'ops-kpi'}>
        <span className="ops-kpi-label">{k.label}</span>
        <span className="ops-kpi-value">{loading && !na ? <span className="skeleton skeleton-line" aria-hidden="true" style={{width: '3ch'}} />
          : na ? <span>Not available</span>
          : <><span aria-hidden="true">{k.state === 'atLeast' ? '≥ ' : ''}{k.value}</span>
            <span className="visually-hidden">{k.state === 'atLeast' ? 'at least ' : ''}{k.value}</span></>}</span>
        <span className="ops-kpi-note">{k.note}</span></li>
    })}</ul></section>
}

export function VisitCard({row, lane, onSelect}: {row: OpsRow; lane?: string; onSelect?: (id:string)=>void}) {
  const mins = durationMinutes(row.starts_at, row.ends_at)
  return <li className="ops-visit">
    <div className="ops-visit-top"><time dateTime={row.starts_at}>{formatClinicTime(row.starts_at)}</time><StatusBadge status={row.status} /></div>
    <p className="ops-visit-ref">Patient ref <code>{shortRef(row.pet_id)}</code> · Owner ref <code>{shortRef(row.owner_id)}</code></p>
    <p className="ops-visit-meta">{mins} min · Resource <code>{shortRef(row.resource_id)}</code></p>
    <p className="ops-visit-concern">{row.concern}</p>
    {onSelect
      ? <button type="button" className="button button-secondary button-small" onClick={()=>onSelect(row.id)}
          aria-label={`Review appointment ${shortRef(row.id)}`}>Review appointment</button>
      : lane === 'expected' || lane === 'checked_in'
        ? <button type="button" className="button button-secondary button-small" disabled title={TRANSITION_REASON}>Staff status actions not enabled</button>
        : null}
  </li>
}

export function FlowBoard({win,onSelect}: {win: OpsWindow;onSelect?: (id:string)=>void}) {
  const flow = buildFlow(win.items)
  return <section aria-labelledby="ops-flow-h" className="ops-section"><h2 id="ops-flow-h" className="ops-h2">Appointment flow</h2>
    <p className="ops-help">{TRANSITION_REASON} Lanes show persisted appointment statuses only.</p>
    <div className="ops-board">{flow.lanes.map(l => <section key={l.key} className={l.persisted ? 'ops-lane' : 'ops-lane is-gap'} aria-labelledby={`lane-${l.key}`}>
      <header><h3 id={`lane-${l.key}`}>{l.label}</h3>{l.persisted && <span className="ops-count" aria-label={`${l.items.length}${win.hasMore ? ' or more' : ''} appointments`}>{win.hasMore ? '≥' : ''}{l.items.length}</span>}</header>
      {l.persisted
        ? l.items.length ? <ul className="ops-visits">{l.items.map(r => <VisitCard key={r.id} row={r} lane={l.key} onSelect={onSelect} />)}</ul>
          : <p className="ops-lane-empty">{l.hint}<br />None in this view.</p>
        : <p className="ops-lane-gap"><strong>Not available.</strong> {l.hint}</p>}
    </section>)}</div>
    {flow.closed.length > 0 && <details className="ops-closed"><summary>Cancelled and no-show ({win.hasMore ? 'at least ' : ''}{flow.closed.length})</summary>
      <ul className="ops-visits">{flow.closed.map(r => <VisitCard key={r.id} row={r} onSelect={onSelect} />)}</ul></details>}
  </section>
}

export function DayList({win,onSelect}: {win: OpsWindow;onSelect?: (id:string)=>void}) {
  const groups = groupByResource(win.items)
  return <ul className="ops-resources">{groups.map(g => <li key={g.id} className="ops-resource">
    <h4>Resource <code>{shortRef(g.id)}</code></h4>
    <ol className="ops-timeline">{g.rows.map(r => <li key={r.id} className={`ops-block ops-block-${r.status}`}>
      <time dateTime={r.starts_at}>{formatClinicTime(r.starts_at)}–{formatClinicTime(r.ends_at)}</time>
      <span className="ops-block-main">Patient <code>{shortRef(r.pet_id)}</code> · {r.concern}</span><StatusBadge status={r.status} />
      {onSelect&&<button type="button" className="button button-secondary button-small" onClick={()=>onSelect(r.id)}
        aria-label={`Review appointment ${shortRef(r.id)}`}>Review appointment</button>}</li>)}</ol></li>)}</ul>
}

export function WeekGrid({dates, week, onPick, onRetry}: {dates: string[]; week: Record<string, Read<OpsWindow>>; onPick: (d: string) => void; onRetry: () => void}) {
  return <ul className="ops-week">{dates.map(d => {
    const r = week[d] ?? {status: 'loading'} as Read<OpsWindow>
    return <li key={d} className="ops-weekday"><button type="button" className="ops-daybtn" onClick={() => onPick(d)} aria-label={`Open ${formatDayLabel(d)} day view`}>{formatDayLabel(d)}</button>
      {r.status === 'loading' && <p role="status" className="ops-help">Loading…</p>}
      {r.status === 'failed' && <div><p role="alert" className="error-text">{r.kind === 'network' ? 'Network error.' : 'Not loaded.'}</p><button type="button" className="button button-quiet button-small" onClick={onRetry}>Retry</button></div>}
      {r.status === 'ok' && <>
        {windowState(r.data) === 'incomplete' && <p className="ops-incomplete">Incomplete: more than 250. Open the day and narrow the time range.</p>}
        {windowState(r.data) === 'empty' ? <p className="ops-help">No appointments.</p>
          : <ul className="ops-mini">{r.data.items.map(i => <li key={i.id}><time dateTime={i.starts_at}>{formatClinicTime(i.starts_at)}</time> <span className={`dot dot-${i.status}`} aria-hidden="true" /><span>{i.status.replace('_', ' ')}</span></li>)}</ul>}
      </>}</li>
  })}</ul>
}
