import {useEffect, useMemo, useRef, useState, type ReactNode} from 'react'
import {Link} from 'react-router'
import {useAuth} from '../../hooks/AuthProvider'
import {EmptyState, LoadingCard, PageHeading} from '../../components/ui'
import {DayList, FailureCard, FlowBoard, KpiGrid, Notice, WeekGrid} from '../../components/ops/OpsParts'
import {createOpsReadPort} from '../../ops/port'
import {useOpsData} from '../../ops/useOpsData'
import {useBranchScope} from '../../ops/useBranchScope'
import type {OpsReadPort} from '../../ops/read-port'
import {AppointmentLifecyclePanel, type AppointmentTicket} from './AppointmentLifecyclePanel'
import {OPS_RANGES, OPS_STATUSES, OPS_TIME_ZONE, addDays, buildKpis, formatDayLabel, isIsoDate, shortRef, todayInZone, weekDates, windowState} from '../../ops/ops-model.mjs'

const ROLE_LABEL = {administrator: 'Administrator', veterinarian: 'Veterinarian', receptionist: 'Receptionist'} as const

export function OpsPage() {
  const {user} = useAuth()
  // Keyed by account id: a token refresh (new user object, same id) must not reset the page,
  // while a different account always gets a fresh port and fresh data.
  const uid = user?.id ?? null
  const userRef = useRef(user); userRef.current = user
  const port = useMemo(() => (uid && userRef.current ? createOpsReadPort(userRef.current) : null), [uid])
  const scope = useBranchScope(port)
  const heading0 = (extra?: ReactNode) => <PageHeading id="ops-title" eyebrow="Clinic staff · preview" title="Clinic operations">
    Verified, branch-scoped persisted appointments only. All times use the clinic timezone, not guessed opening hours.{extra}</PageHeading>
  if (scope.state.status === 'off') return <>{heading0()}<FailureCard kind="unavailable" /></>
  if (scope.state.status === 'loading') return <>{heading0()}<LoadingCard label="Verifying your clinic branches…" rows={3} /></>
  if (scope.state.status === 'failed') return <>{heading0()}<FailureCard kind={scope.state.kind} onRetry={scope.refresh} />
    {scope.state.kind === 'denied' && <div className="ops-toolbar"><button type="button" className="button button-secondary" onClick={scope.refresh}>Recheck staff permissions</button>
      <Link className="button button-quiet" to="/app/overview">Back to my overview</Link></div>}</>
  const picker = scope.state.status === 'ready' ? <BranchPicker branches={scope.branches} selected={scope.selected} onSelect={scope.select} /> : null
  if (!scope.selected && scope.hadDenial) return <>{heading0()}{picker}<FailureCard kind="denied" />
    <p className="ops-help">The clinic did not authorize that branch for your account. Choose another branch, or ask an administrator.</p></>
  if (!scope.selected) return <>{heading0()}{picker}
    <EmptyState icon="shield" title="Choose a clinic branch">You are authorized for more than one branch. Choose one to load its appointments. No branch data is shown until you do.</EmptyState></>
  // key: a different account or branch remounts the view, so no earlier data can show for even one frame.
  return <>{heading0()}{picker}<OpsView key={`${uid ?? 'none'}:${scope.selected}`} port={scope.scoped}
    accountId={uid ?? ''} branchId={scope.selected}
    branchName={scope.branches.find(b => b.id === scope.selected)?.name ?? null}
    onDenied={() => scope.markDenied(scope.selected)} /></>
}

function BranchPicker({branches, selected, onSelect}: {branches: {id: string; name: string}[]; selected: string | null; onSelect: (id: string | null) => void}) {
  return <div className="ops-toolbar" role="group" aria-label="Branch selection">
    {branches.length === 1 && selected
      ? <p className="ops-role">Branch: <strong>{branches[0]?.name}</strong></p>
      : <label className="ops-field"><span>Clinic branch</span>
          <select value={selected ?? ''} onChange={e => onSelect(e.target.value || null)}>
            <option value="">Choose a branch…</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>}
  </div>
}

function OpsView({port, branchName, branchId, accountId, onDenied}: {port: OpsReadPort | null; branchName: string | null; branchId: string; accountId: string; onDenied?: (() => void) | undefined}) {
  const onDeniedRef = useRef(onDenied); onDeniedRef.current = onDenied
  const [date, setDate] = useState(() => todayInZone(Date.now()))
  const [view, setView] = useState<'board' | 'schedule'>('board')
  const [mode, setMode] = useState<'day' | 'week'>('day')
  const [range, setRange] = useState('all')
  const [resource, setResource] = useState('all')
  const [status, setStatus] = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Retain an uncertain transition across verification/remount only inside this
  // account+branch-keyed view. Never replace its nonce with a new request.
  const [pendingTicket, setPendingTicket] = useState<AppointmentTicket|null>(null)
  const selectAppointment = (id: string) => {if (id !== selectedId) {setPendingTicket(null);setSelectedId(id)}}
  const clearSelection = () => {setPendingTicket(null);setSelectedId(null)}
  const weekMode = view === 'schedule' && mode === 'week'
  const {session, day, counts, week, reload} = useOpsData(port, date, range, weekMode)
  const lastAuthorizedRole = useRef<'administrator'|'veterinarian'|'receptionist'>('receptionist')
  if(session.status === 'ok') lastAuthorizedRole.current = session.role
  // Revocation seen on any read: re-derive branches from the server so a revoked branch disappears.
  const denied = session.status === 'failed' && session.kind === 'denied'
  useEffect(() => { if (denied) onDeniedRef.current?.() }, [denied])

  const win = day.status === 'ok' ? day.data : null
  const filtered = useMemo(() => win ? {...win, items: win.items.filter(i =>
    (resource === 'all' || i.resource_id === resource) &&
    (status === 'all' || i.status === status))} : null, [win, resource, status])
  const resources = useMemo(() => [...new Set((win?.items ?? []).map(i => i.resource_id))].sort(), [win])
  // Issue #58 branch counts measure distinct patients with branch appointments,
  // not the global count of registered clinic patients.
  const kpis = useMemo(() => buildKpis({win, counts: counts.status === 'ok' ? counts.data : null})
    .map(k => k.key === 'patients' ? {...k, label: 'Patients seen in this branch', note: 'Distinct patients with appointments here, all dates.'} : k), [win, counts])
  const setDay = (d: string) => { if (isIsoDate(d)) { setDate(d); setResource('all'); clearSelection() } }

  const heading = session.status === 'ok' ? <p className="ops-role">Signed in as {ROLE_LABEL[session.role]}{branchName ? ` · ${branchName}` : ''} · branch-scoped preview</p> : null

  if (session.status === 'verifying') return <><LoadingCard label="Verifying clinic staff access…" rows={4} />
    {selectedId && <AppointmentLifecyclePanel key={selectedId} row={null}
      role={lastAuthorizedRole.current} branchId={branchId} accountId={accountId}
      ticket={pendingTicket} setTicket={setPendingTicket} onRefresh={reload} onDenied={()=>onDeniedRef.current?.()} />}</>
  if (session.status === 'failed') return <><FailureCard kind={session.kind} onRetry={reload} />
    {session.kind === 'denied' && <p><Link className="button button-secondary" to="/app/overview">Back to my overview</Link></p>}</>

  const state = win ? windowState(win) : null
  const label = formatDayLabel(date)
  return <>{heading}
    <p className="visually-hidden" role="status" aria-live="polite">{win ? `${win.items.length}${win.hasMore ? ' or more' : ''} appointments loaded for ${label}.` : ''}</p>
    <div className="ops-toolbar" role="group" aria-label="Date and view">
      <button type="button" className="button button-secondary button-small" onClick={reload} aria-label="Refresh authorized branch appointments and counts">Refresh branch data</button>
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
      {!weekMode && <label className="ops-field"><span>Time range</span><select value={range} onChange={e => {setRange(e.target.value);clearSelection()}}>
        {OPS_RANGES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}</select></label>}
      {!weekMode && <label className="ops-field"><span>Status</span>
        <select aria-label="Appointment status" value={status} onChange={e => {setStatus(e.target.value);clearSelection()}}>
          <option value="all">All persisted statuses</option>
          {OPS_STATUSES.map(value => <option key={value} value={value}>{value.replaceAll('_',' ')}</option>)}
        </select></label>}
      {!weekMode && <label className="ops-field"><span>Resource</span><select value={resource} onChange={e => {setResource(e.target.value);clearSelection()}} disabled={resources.length === 0}>
        <option value="all">All resources</option>{resources.map(r => <option key={r} value={r}>Resource {shortRef(r)}</option>)}</select></label>}
      <label className="ops-field is-disabled"><span>Provider</span><select disabled aria-describedby="ops-prov"><option>Not available</option></select></label>
    </div>
    <p id="ops-prov" className="ops-help">Provider filter is disabled because the verified reader has no provider assignment. Appointment dates use {OPS_TIME_ZONE}; no clinic hours or available appointment slots are inferred.</p>
    <div className="ops-toolbar" aria-label="Unavailable clinical actions">
      <p className="ops-help">Select a verified appointment below to review its exact available staff lifecycle actions. Writes remain OFF by default.</p>
      <button type="button" className="button button-secondary button-small" disabled title="Appointment writes remain disabled until reviewed release approval">Confirm (not enabled)</button>
      <button type="button" className="button button-secondary button-small" disabled title="Audited rescheduling RPC and conflict verification required">Reschedule (not enabled)</button>
      <button type="button" className="button button-secondary button-small" disabled title="Audited clinical encounter transition contract required">Start treatment (not enabled)</button>
    </div>

    {!weekMode && <KpiGrid kpis={kpis} loading={day.status === 'loading' || counts.status === 'loading'} />}
    {counts.status === 'failed' && !weekMode && <Notice tone="warning" title="Branch patient and appointment counts are unavailable">They are shown as “Not available”, never zero. <button type="button" className="button button-quiet button-small" onClick={reload}>Retry</button></Notice>}

    {weekMode ? <section aria-labelledby="ops-week-h" className="ops-section"><h2 id="ops-week-h" className="ops-h2">Week of {formatDayLabel(weekDates(date)[0] ?? date)}</h2>
        <WeekGrid dates={weekDates(date)} week={week} onPick={d => { setDay(d); setMode('day') }} onRetry={reload} /></section>
      : day.status === 'loading' ? <LoadingCard label={`Loading appointments for ${label}…`} rows={5} />
      : day.status === 'failed' ? <FailureCard kind={day.kind} onRetry={reload} />
      : win && filtered && <>
        {state === 'incomplete' && <Notice tone="warning" title="Incomplete: more than 250 appointments matched">Only the first 250 by time are shown and every count is a lower bound (≥). Narrow the time range to see the rest.</Notice>}
        {state === 'empty' ? <EmptyState icon="calendar" title="No appointments in this window">The verified branch read returned no appointments for {label}{range !== 'all' ? ' in this time range' : ''}. Nothing is invented to fill the day.</EmptyState>
          : filtered.items.length === 0 ? <EmptyState icon="calendar" title="No matching appointments in the loaded rows">Choose a different status or resource{win.hasMore ? ', or narrow the time range: more records exist beyond this first 250-row window' : ''}.</EmptyState>
          : view === 'board' ? <FlowBoard win={filtered} onSelect={selectAppointment} />
          : <section aria-labelledby="ops-sched-h" className="ops-section"><h2 id="ops-sched-h" className="ops-h2">Schedule · {label}</h2>
              <p className="ops-help">Only booked appointments are drawn. No working hours, breaks or holidays are shown because none are published.</p><DayList win={filtered} onSelect={selectAppointment} /></section>}
      </>}
    {selectedId && session.status==='ok' &&
      <AppointmentLifecyclePanel key={selectedId} row={filtered?.items.find(i=>i.id===selectedId)??
        (pendingTicket&&day.status==='ok'&&pendingTicket.detail.id===selectedId?{
          id:pendingTicket.detail.id,pet_id:pendingTicket.detail.petId,
          owner_id:pendingTicket.detail.ownerId,resource_id:pendingTicket.detail.resourceId,
          starts_at:pendingTicket.detail.startsAt,ends_at:pendingTicket.detail.endsAt,
          status:pendingTicket.detail.status,concern:'Selected appointment requires fresh server read'
        }:null)}
        role={session.role} branchId={branchId} accountId={accountId}
        ticket={pendingTicket} setTicket={setPendingTicket} onRefresh={reload}
        onDenied={()=>onDeniedRef.current?.()} />}
    {!selectedId && day.status==='ok' && <p className="ops-help" role="status">Choose “Review appointment” on an authorized visit to inspect staff transitions.</p>}
    <section className="ops-section" aria-label="Related authorized staff workspaces">
      <h2 className="ops-h2">Continue staff workflow</h2>
      <p className="ops-help">Each workspace independently rechecks staff identity and branch membership. This selection does not transfer permission, and no patient chart is opened from an unverified appointment reference.</p>
      <div className="ops-toolbar">
        {import.meta.env.VITE_CLINICAL_WORKSPACE_UI === 'true'
          ? <Link className="button button-secondary" to="/app/clinical">Open patient charts</Link>
          : <button type="button" className="button button-secondary" disabled>Patient charts (not enabled)</button>}
        {import.meta.env.VITE_PHASE5B_PHARMACY_UI === 'true'
          ? <Link className="button button-secondary" to="/app/pharmacy">Open branch pharmacy</Link>
          : <button type="button" className="button button-secondary" disabled>Pharmacy (not enabled)</button>}
      </div>
    </section>
  </>
}
