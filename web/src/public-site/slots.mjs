import { clinicSlotToUtc, utcToClinicSlot } from '../booking-contract.mjs'

// Bookable-slot generation strictly from an OWNER-APPROVED policy (readApprovedPublicSchedule()).
// No default hours: a null/incomplete policy yields no slots. The server (RPC + RLS + exclusion constraint)
// remains the authority; these slots are only a convenience list of times the clinic could accept.

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const MINUTE_MS = 60_000
const DAY_MS = 24 * 60 * MINUTE_MS
const toMin = (t) => {
  if (typeof t !== 'string' || !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(t)) return NaN
  return Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
}
const pad = (n) => String(n).padStart(2, '0')
const hhmm = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
function addDays(date, n) { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const utcIso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z')

// Retain the historical mode classifier's public policy-shape semantics.
// The server-exact stricter checks belong inside generateSlots only.
export function isUsablePolicy(p) {
  return Boolean(p && typeof p.timezone === 'string' && p.timezone &&
    Number.isInteger(p.slot_step_minutes) && p.slot_step_minutes > 0 &&
    Number.isInteger(p.max_advance_days) && p.max_advance_days > 0 &&
    Number.isInteger(p.lead_minutes) && p.lead_minutes >= 0 && p.weekly_hours && typeof p.weekly_hours === 'object' &&
    DAY_KEYS.some(k => Array.isArray(p.weekly_hours[k]) && p.weekly_hours[k].length > 0))
}

/** @returns {{date:string,weekday:string,slots:{time:string,startsAtUtc:string}[]}[]} days that have at least one slot */
export function generateSlots(policy, durationMinutes, nowMs = Date.now()) {
  // PostgreSQL checks starts_at against statement_timestamp() + lead/horizon,
  // inclusive at BOTH endpoints. The horizon is an instant, not a calendar day.
  if (!isUsablePolicy(policy) || !Number.isInteger(durationMinutes) ||
      durationMinutes < 5 || durationMinutes > 240 || durationMinutes % 5 !== 0 ||
      !Number.isFinite(nowMs) || policy.slot_step_minutes < 5 || policy.slot_step_minutes > 60 ||
      policy.lead_minutes > 10080 || policy.max_advance_days > 365 ||
      !DAY_KEYS.every(key => Array.isArray(policy.weekly_hours[key])) ||
      (policy.holidays != null && !Array.isArray(policy.holidays))) return []
  const timezone = policy.timezone
  try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }) } catch { return [] }
  const today = utcToClinicSlot(utcIso(nowMs), timezone).date
  const earliest = nowMs + policy.lead_minutes * MINUTE_MS
  const latest = nowMs + policy.max_advance_days * DAY_MS
  const lastDate = utcToClinicSlot(utcIso(latest), timezone).date
  const holidays = new Set((policy.holidays ?? []).map(String))
  const days = []
  // A DST-forward transition may make the exact 24-hour horizon land two
  // local dates after today; still compare every candidate to the UTC bound.
  for (let i = 0; i <= policy.max_advance_days + 1; i += 1) {
    const date = addDays(today, i)
    if (date > lastDate) break
    if (holidays.has(date)) continue
    const key = DAY_KEYS[new Date(`${date}T00:00:00Z`).getUTCDay()]
    const slots = []
    const seen = new Set()
    for (const w of policy.weekly_hours[key]) {
      const open = toMin(w?.open), close = toMin(w?.close)
      if (!Number.isFinite(open) || !Number.isFinite(close) || close <= open) continue
      // SQL uses EXTRACT(hour)*60 + EXTRACT(minute) modulo the step:
      // align to midnight, NEVER to the opening time (e.g. 09:05 => 09:15).
      const first = Math.ceil(open / policy.slot_step_minutes) * policy.slot_step_minutes
      for (let m = first; m < close; m += policy.slot_step_minutes) {
        let startsAtUtc, startMs, localEnd
        try {
          startsAtUtc = clinicSlotToUtc(date, hhmm(m), timezone)
          startMs = Date.parse(startsAtUtc)
          if (startMs < earliest || startMs > latest) continue
          // The server validates ends_at = starts_at + full duration, then
          // compares the ACTUAL timezone-converted end to the opening interval
          // and rejects any clinic-local midnight crossing (including DST).
          localEnd = utcToClinicSlot(utcIso(startMs + durationMinutes * MINUTE_MS), timezone)
        } catch { continue } // nonexistent/ambiguous wall time or invalid date: fail closed
        const endMinute = toMin(localEnd.time)
        if (localEnd.date !== date || endMinute < open || endMinute > close || seen.has(startsAtUtc)) continue
        seen.add(startsAtUtc)
        slots.push({ time: hhmm(m), startsAtUtc })
      }
    }
    if (slots.length) days.push({ date, weekday: key, slots: slots.sort((a, b) => a.time.localeCompare(b.time)) })
  }
  return days
}

export function formatClockTime(hhmmText) {
  const [h, m] = hhmmText.split(':').map(Number)
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}
export function formatClinicDate(date) {
  return new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
}
