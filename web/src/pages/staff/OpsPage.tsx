import {useMemo, useRef, useState} from 'react'
import {Link} from 'react-router'
import {useAuth} from '../../hooks/AuthProvider'
import {EmptyState, LoadingCard, PageHeading} from '../../components/ui'
import {DayList, FailureCard, FlowBoard, KpiGrid, Notice, WeekGrid} from '../../components/ops/OpsParts'
import {createOpsReadPort} from '../../ops/port'
import {useOpsData} from '../../ops/useOpsData'
import {OPS_RANGES, OPS_TIME_ZONE, addDays, buildKpis, formatDayLabel, isIsoDate, shortRef, todayInZone, weekDates, windowState} from '../../ops/ops-model.mjs'

const ROLE_LABEL = {administrator: 'Administrator', veterinarian: 'Veterinarian', receptionist: 'Receptionist'} as const

export function OpsPage() {
  const {user} = useAuth()
  // Keyed by account id: a token refresh (new user object, same id) must not reset the page,
  // while a different account always gets a fresh port and fresh data.
  const uid = user?.id ?? null
  const userRef = useRef(user); userRef.current = user
  const port = useMemo(() => (uid && userRef.current ? createOpsReadPort(userRef.current) : null), [uid])
  const [date, setDate] = useState(() => todayInZone(Date.now()))
  const [view, setView] = useState<'board' | 'schedule'>('board')
  const [mode, setMode] = useState<'day' | 'week'>('day')
  const [range, setRange] = useState('all')
  const [resource, setResource] = useState('all')
  const weekMode = view === 'schedule' && mode === 'week'
  const {session, day, counts, week, reload} = useOpsData(port, date, range, weekMode)

  const win = day.status === 'ok' ? day.data : null
  const filtered = useMemo(() => win && resource !== 'all' ? {...win, items: win.items.filter(i => i.resource_id === resource)} : win, [win, resource])
  const resources = useMemo(() => [...new Set((win?.items ?? []).map(i => i.resource_id))].sort(), [win])
  const kpis = useMemo(() => buildKpis({win, counts: counts.status === 'ok' ? counts.data : null}), [win, counts])
  const setDay = (d: string) => { if (isIsoDate(d)) { setDate(d); setResource('all') } }

  const heading = <PageHeading id="ops-title" eyebrow="Clinic staff · preview" title="Clinic operations"
    actions={session.status === 'ok' ? <span className="ops-role">Signed in as {ROLE_LABEL[session.role]} · read-only</span> : undefined}>
    Persisted appointments only. Clinic hours and providers are not published, so none are shown.</PageHeading>

  if (session.status === 'verifying') return <>{heading}<LoadingCard label="Verifying clinic staff access…" rows={4} /></>
  if (session.status === 'failed') return <>{heading}<FailureCard kind={session.kind} onRetry={reload} />
    {session.kind === 'denied' && <p><Link className="button button-secondary" to="/app/overview">Back to my overview</Link></p>}</>

  const state = win ? windowState(win) : null
  const label = formatDayLabel(date)
  return <>{heading}
    <p className="visually-hidden" role="status" aria-live="polite">{win ? `${win.items.length}${win.hasMore ? ' or more' : ''} appointments loaded for ${label}.` : ''}</p>
    <div className="ops-toolbar" role="group" aria-label="Date and view">
      <div className="ops-seg" role="group" aria-label="View">
        <button type="button" className="button button-secondary button-small" aria-pressed={view === 'board'} onClick={() => setView('board')}>Flow board</button>
        <button type="button" className="button button-secondary button-small" aria-pressed={view === 'schedule'} onClick={() => setView('schedule')}>Schedule</button></div>
      <div className="ops-seg" role="group" aria-label="Day navigation">
        <button type="button" className="button button-secondary button-small" onClick={() => setDay(addDays(date, weekMode ? -7 : -1))} aria-label={weekMode ? 'Previous week' : 'Previous day'}>‹</button>
        <button type="button" className="button button-secondary button-small" onClick={() => setDay(todayInZone(Date.now()))}>Today</button>
        <button type="button" className="button button-secondary button-small" onClick={() => setDay(addDays(date, weekMode ? 7 : 1))} aria-label={weekMode ? 'Next week' : 'Next day'}>›</button>
        <label className="ops-field"><span className="visually-hidden">Date</span><input type="date" value={date} onChange={e => setDay(e.target.value)} /></label></div>
      {view === 'schedule' && <div className="ops-seg" role="group" aria-label="Schedule length">
        <button type="button" className="button button-secondary button-small" aria-pressed={mode === 'day'} onClick={() => setMode('day')}>Day</button>
        <button type="button" className="button button-secondary button-small" aria-pressed={mode === 'week'} onClick={() => setMode('week')}>Week</button></div>}
      {!weekMode && <label className="ops-field"><span>Time range</span><select value={range} onChange={e => setRange(e.target.value)}>
        {OPS_RANGES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}</select></label>}
      {!weekMode && <label className="ops-field"><span>Resource</span><select value={resource} onChange={e => setResource(e.target.value)} disabled={resources.length === 0}>
        <option value="all">All resources</option>{resources.map(r => <option key={r} value={r}>Resource {shortRef(r)}</option>)}</select></label>}
      <label className="ops-field is-disabled"><span>Provider</span><select disabled aria-describedby="ops-prov"><option>Not available</option></select></label>
    </div>
    <p id="ops-prov" className="ops-help">Provider filter is disabled: the staff read contract has no provider data. Times use {OPS_TIME_ZONE} for day boundaries; clinic hours are not published.</p>

    {!weekMode && <KpiGrid kpis={kpis} loading={day.status === 'loading' || counts.status === 'loading'} />}
    {counts.status === 'failed' && !weekMode && <Notice tone="warning" title="Registered-patient and all-date counts are unavailable">They are shown as “Not available”, not zero. <button type="button" className="button button-quiet button-small" onClick={reload}>Retry</button></Notice>}

    {weekMode ? <section aria-labelledby="ops-week-h" className="ops-section"><h2 id="ops-week-h" className="ops-h2">Week of {formatDayLabel(weekDates(date)[0] ?? date)}</h2>
        <WeekGrid dates={weekDates(date)} week={week} onPick={d => { setDay(d); setMode('day') }} onRetry={reload} /></section>
      : day.status === 'loading' ? <LoadingCard label={`Loading appointments for ${label}…`} rows={5} />
      : day.status === 'failed' ? <FailureCard kind={day.kind} onRetry={reload} />
      : win && filtered && <>
        {state === 'incomplete' && <Notice tone="warning" title="Incomplete: more than 250 appointments matched">Only the first 250 by time are shown and every count is a lower bound (≥). Narrow the time range to see the rest.</Notice>}
        {state === 'empty' ? <EmptyState icon="calendar" title="No appointments in this window">The read succeeded and returned no appointments for {label}{range !== 'all' ? ' in this time range' : ''}. Nothing is invented to fill the day.</EmptyState>
          : filtered.items.length === 0 ? <EmptyState icon="calendar" title="No appointments for this resource">Choose “All resources” to see the rest of the window.</EmptyState>
          : view === 'board' ? <FlowBoard win={filtered} />
          : <section aria-labelledby="ops-sched-h" className="ops-section"><h2 id="ops-sched-h" className="ops-h2">Schedule · {label}</h2>
              <p className="ops-help">Only booked appointments are drawn. No working hours, breaks or holidays are shown because none are published.</p><DayList win={filtered} /></section>}
      </>}
  </>
}
