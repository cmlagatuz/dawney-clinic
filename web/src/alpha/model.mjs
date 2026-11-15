/**
 * ALPHA DEMO MODEL — 100% synthetic, in-memory, no network, no storage, no Supabase.
 * Names are invented ("Demo Owner NN"); weekdays are generic (no real dates); all clinic wording is placeholder text.
 */

export const TODAY = 'wed'
export const DAYS = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat']]
export const VETS = [{ id: 'v1', name: 'Dr. Alder (demo)', tone: 1 }, { id: 'v2', name: 'Dr. Quill (demo)', tone: 2 }, { id: 'v3', name: 'Dr. Marsh (demo)', tone: 3 }]
export const ROOMS = [{ id: 'r1', name: 'Consult 1' }, { id: 'r2', name: 'Consult 2' }, { id: 'r3', name: 'Treatment' }]
export const DAY_START = 8 * 60
export const DAY_END = 18 * 60
export const FLOW_COLUMNS = [
  { id: 'expected', label: 'Expected', hint: 'Not yet arrived' },
  { id: 'waiting', label: 'Waiting room', hint: 'Checked in' },
  { id: 'consult', label: 'In consult', hint: 'With the veterinarian' },
  { id: 'seen', label: 'Seen', hint: 'Visit complete' },
]
/** Allowed demo transitions: from → [{to, label}] */
export const TRANSITIONS = {
  expected: [{ to: 'waiting', label: 'Check in' }, { to: 'noshow', label: 'Mark no-show' }],
  waiting: [{ to: 'consult', label: 'Call in' }],
  consult: [{ to: 'seen', label: 'Finish' }],
  seen: [], noshow: [],
}

const a = (id, day, start, dur, vetId, roomId, pet, species, owner, reason, status = 'expected') =>
  ({ id, day, start, dur, vetId, roomId, pet, species, owner, reason, status })
export const APPOINTMENTS = [
  a('a1', 'mon', '09:00', 30, 'v1', 'r1', 'Pepper', 'Dog', 'Demo Owner 01', 'Demo: routine check'),
  a('a2', 'mon', '10:30', 45, 'v2', 'r2', 'Mango', 'Cat', 'Demo Owner 02', 'Demo: vaccination'),
  a('a3', 'tue', '14:00', 30, 'v3', 'r1', 'Nori', 'Rabbit', 'Demo Owner 03', 'Demo: follow-up'),
  a('a4', 'wed', '08:30', 30, 'v1', 'r1', 'Tofu', 'Dog', 'Demo Owner 04', 'Demo: routine check', 'seen'),
  a('a5', 'wed', '09:00', 30, 'v2', 'r2', 'Waffles', 'Cat', 'Demo Owner 05', 'Demo: skin check', 'consult'),
  a('a6', 'wed', '09:30', 30, 'v1', 'r1', 'Kiko', 'Dog', 'Demo Owner 06', 'Demo: vaccination', 'waiting'),
  a('a7', 'wed', '10:00', 45, 'v3', 'r3', 'Luna', 'Cat', 'Demo Owner 07', 'Demo: dental review'),
  a('a8', 'wed', '10:30', 30, 'v2', 'r2', 'Bruno', 'Dog', 'Demo Owner 08', 'Demo: follow-up'),
  a('a9', 'wed', '11:00', 30, 'v1', 'r1', 'Coco', 'Rabbit', 'Demo Owner 09', 'Demo: routine check'),
  a('a10', 'wed', '14:00', 60, 'v3', 'r3', 'Pixel', 'Cat', 'Demo Owner 10', 'Demo: treatment visit'),
  a('a11', 'wed', '15:30', 30, 'v2', 'r2', 'Ziggy', 'Dog', 'Demo Owner 11', 'Demo: vaccination'),
  a('a12', 'thu', '09:30', 30, 'v1', 'r1', 'Mochi', 'Cat', 'Demo Owner 12', 'Demo: routine check'),
  a('a13', 'thu', '11:00', 60, 'v3', 'r3', 'Hazel', 'Dog', 'Demo Owner 13', 'Demo: treatment visit'),
  a('a14', 'fri', '10:00', 30, 'v2', 'r2', 'Biscotti', 'Dog', 'Demo Owner 14', 'Demo: follow-up'),
  a('a15', 'sat', '09:00', 30, 'v1', 'r1', 'Olive', 'Cat', 'Demo Owner 15', 'Demo: routine check'),
]
/** Unavailable time. vetId null = whole clinic. Demo hours only — NOT the clinic's real hours. */
export const BLOCKS = [
  ...DAYS.map(([d]) => ({ id: `lunch-${d}`, day: d, start: '12:00', end: '13:00', vetId: null, kind: 'lunch', label: 'Lunch break (demo)' })),
  { id: 'blk-thu-v2', day: 'thu', start: '14:00', end: '16:00', vetId: 'v2', kind: 'blocked', label: 'Training — unavailable (demo)' },
  { id: 'blk-sat-all', day: 'sat', start: '13:00', end: '18:00', vetId: null, kind: 'blocked', label: 'Closed afternoon (demo)' },
]

export const toMin = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }
export const fromMin = n => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`
export const endOf = ap => fromMin(toMin(ap.start) + ap.dur)
export const clock12 = hhmm => { const m = toMin(hhmm), h = Math.floor(m / 60); return `${h % 12 || 12}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}` }

const THREADS = [
  { id: 't1', owner: 'Demo Owner 05', pet: 'Waffles', unread: 2, assignedTo: 'you', labels: ['Appointment'], messages: [
    { id: 'm1', from: 'owner', text: 'Hi! Is it okay if we arrive a few minutes early?' }, { id: 'm2', from: 'owner', text: 'We are on our way.' }] },
  { id: 't2', owner: 'Demo Owner 02', pet: 'Mango', unread: 1, assignedTo: null, labels: ['New enquiry'], messages: [
    { id: 'm3', from: 'owner', text: 'Hello, how do I prepare for a vaccination visit?' }] },
  { id: 't3', owner: 'Demo Owner 11', pet: 'Ziggy', unread: 0, assignedTo: 'frontdesk', labels: ['Reminder'], messages: [
    { id: 'm4', from: 'clinic', text: '[DEMO TEXT] Reminder wording would appear here.', status: 'SIMULATED' }, { id: 'm5', from: 'owner', text: 'Thanks, noted!' }] },
  { id: 't4', owner: 'Demo Owner 08', pet: 'Bruno', unread: 1, assignedTo: null, labels: ['Appointment'], messages: [{ id: 'm6', from: 'owner', text: 'Can we move Bruno’s visit to later in the day?' }] },
  { id: 't5', owner: 'Demo Owner 14', pet: 'Biscotti', unread: 0, assignedTo: 'you', labels: [], messages: [{ id: 'm7', from: 'owner', text: 'Thank you for today!' }] },
  { id: 't6', owner: 'Demo Owner 03', pet: 'Nori', unread: 3, assignedTo: null, labels: ['New enquiry'], messages: [
    { id: 'm8', from: 'owner', text: 'Hi, where should I park?' }, { id: 'm9', from: 'owner', text: 'Also, what should I bring?' }, { id: 'm10', from: 'owner', text: 'Thanks!' }] },
]
export const ASSIGNEES = [{ id: 'you', label: 'You (demo)' }, { id: 'frontdesk', label: 'Front desk (demo)' }]
export const QUICK_REPLIES = [
  { id: 'parking', label: 'Parking', text: '[DEMO TEXT] Parking directions would be inserted here once the clinic approves the wording.' },
  { id: 'hours', label: 'Opening hours', text: '[DEMO TEXT] Opening hours would be inserted here once the clinic confirms them.' },
  { id: 'bring', label: 'What to bring', text: '[DEMO TEXT] A checklist of what to bring would be inserted here after clinic approval.' },
]

export const RECIPIENTS = Array.from({ length: 36 }, (_, i) => ({
  id: `c${i + 1}`, label: `Demo Owner ${String(i + 1).padStart(2, '0')}`,
  consent: i % 9 === 4 ? 'opted_out' : i % 7 === 3 ? 'none' : 'opted_in',
}))
const seg = (from, to) => RECIPIENTS.slice(from, to).map(r => r.id)
const CAMPAIGNS = [
  { id: 'k1', name: 'Vaccination reminder', blurb: 'Demo template: a gentle booster reminder.', segment: seg(0, 18), status: 'draft' },
  { id: 'k2', name: 'Deworming reminder', blurb: 'Demo template: a routine care reminder.', segment: seg(10, 30), status: 'scheduled' },
  { id: 'k3', name: 'Post-visit follow-up', blurb: 'Demo template: a check-in after a visit.', segment: seg(24, 36), status: 'draft' },
]

export function initialState() {
  return {
    appts: APPOINTMENTS.map(x => ({ ...x })),
    history: [], // [{id, from}] oldest→newest; powers per-card and global undo
    threads: THREADS.map(t => ({ ...t, labels: [...t.labels], messages: t.messages.map(m => ({ ...m })) })),
    campaigns: CAMPAIGNS.map(c => ({ ...c, segment: [...c.segment] })),
  }
}

/** Recipients split into included / excluded (opted out, no consent). Pure. */
export function audience(campaign, recipients = RECIPIENTS) {
  const ids = new Set(campaign.segment)
  const inSeg = recipients.filter(r => ids.has(r.id))
  return {
    total: inSeg.length,
    included: inSeg.filter(r => r.consent === 'opted_in'),
    optedOut: inSeg.filter(r => r.consent === 'opted_out'),
    noConsent: inSeg.filter(r => r.consent === 'none'),
  }
}

export function kpis(state) {
  const today = state.appts.filter(x => x.day === TODAY)
  const count = s => today.filter(x => x.status === s).length
  const busyRooms = new Set(today.filter(x => x.status === 'consult').map(x => x.roomId))
  return {
    today: today.length, waiting: count('waiting'), consult: count('consult'), seen: count('seen'), noshow: count('noshow'),
    unread: state.threads.reduce((n, t) => n + t.unread, 0), roomsBusy: busyRooms.size, roomsTotal: ROOMS.length,
  }
}

export const canUndo = (state, id) => state.history.some(h => h.id === id)
const mapAppt = (state, id, fn) => ({ ...state, appts: state.appts.map(x => x.id === id ? fn(x) : x) })
const mapThread = (state, id, fn) => ({ ...state, threads: state.threads.map(t => t.id === id ? fn(t) : t) })
const mapCamp = (state, id, fn) => ({ ...state, campaigns: state.campaigns.map(c => c.id === id ? fn(c) : c) })

export function reduce(state, act) {
  switch (act.type) {
    case 'flow/move': {
      const ap = state.appts.find(x => x.id === act.id)
      if (!ap || ap.day !== TODAY || !(TRANSITIONS[ap.status] ?? []).some(t => t.to === act.to)) return state // illegal → ignored
      return { ...mapAppt(state, act.id, x => ({ ...x, status: act.to })), history: [...state.history, { id: act.id, from: ap.status }] }
    }
    case 'flow/undoCard': {
      const i = state.history.map(h => h.id).lastIndexOf(act.id)
      if (i < 0) return state
      const { from } = state.history[i]
      return { ...mapAppt(state, act.id, x => ({ ...x, status: from })), history: state.history.filter((_, j) => j !== i) }
    }
    case 'flow/undoLast': {
      const last = state.history[state.history.length - 1]
      return last ? reduce(state, { type: 'flow/undoCard', id: last.id }) : state
    }
    case 'inbox/open': return mapThread(state, act.id, t => ({ ...t, unread: 0 }))
    case 'inbox/assign': return mapThread(state, act.id, t => ({ ...t, assignedTo: ASSIGNEES.some(s => s.id === act.to) ? act.to : null }))
    case 'inbox/label': return mapThread(state, act.id, t => ({ ...t, labels: t.labels.includes(act.label) ? t.labels.filter(l => l !== act.label) : [...t.labels, act.label] }))
    case 'inbox/send': {
      const text = String(act.text ?? '').trim().slice(0, 500)
      if (!text) return state
      return mapThread(state, act.id, t => ({ ...t, messages: [...t.messages, { id: `${t.id}-s${t.messages.length + 1}`, from: 'clinic', text, status: 'SIMULATED' }] }))
    }
    case 'camp/schedule': return mapCamp(state, act.id, c => c.status === 'draft' ? { ...c, status: 'scheduled' } : c)
    case 'camp/unschedule': return mapCamp(state, act.id, c => c.status === 'scheduled' ? { ...c, status: 'draft' } : c)
    case 'camp/preview': return mapCamp(state, act.id, c => ({ ...c, status: 'preview' }))
    case 'camp/reset': return mapCamp(state, act.id, c => ({ ...c, status: 'draft' }))
    default: return state
  }
}

/** Schedule helpers */
export function visibleAppts(appts, { vetIds, day }) {
  return appts.filter(x => vetIds.includes(x.vetId) && (!day || x.day === day))
}
export function blocksFor(blocks, { vetIds, day }) {
  return blocks.filter(b => (!day || b.day === day) && (b.vetId === null || vetIds.includes(b.vetId)))
}
export const pct = (min, base = DAY_START, span = DAY_END - DAY_START) => Math.max(0, Math.min(100, (min - base) / span * 100))

/** Preview is only allowed on non-production hosts (fail closed). */
const PRODUCTION_HOSTS = new Set(['dawney-clinic.pages.dev'])
export function alphaPreviewAllowed(hostname) {
  const h = String(hostname ?? '').toLowerCase()
  if (!h) return false
  if (h === 'localhost' || h === '127.0.0.1') return true
  if (PRODUCTION_HOSTS.has(h)) return false
  return h.endsWith('.dawney-clinic.pages.dev')
}
