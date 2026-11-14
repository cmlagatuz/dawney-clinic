import { clinicSlotToUtc, utcToClinicSlot } from '../booking-contract.mjs'

// Bookable-slot generation strictly from an OWNER-APPROVED policy (readApprovedPublicSchedule()).
// No default hours: a null/incomplete policy yields no slots. The server (RPC + RLS + exclusion constraint)
// remains the authority; these slots are only a convenience list of times the clinic could accept.

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const toMin = (t) => { const m = /^(\d{2}):(\d{2})/.exec(t); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN }
const pad = (n) => String(n).padStart(2, '0')
const hhmm = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
function addDays(date, n) { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }

export function isUsablePolicy(p) {
  return Boolean(p && typeof p.timezone === 'string' && p.timezone &&
    Number.isInteger(p.slot_step_minutes) && p.slot_step_minutes > 0 &&
    Number.isInteger(p.max_advance_days) && p.max_advance_days > 0 &&
    Number.isInteger(p.lead_minutes) && p.lead_minutes >= 0 && p.weekly_hours && typeof p.weekly_hours === 'object' &&
    DAY_KEYS.some(k => Array.isArray(p.weekly_hours[k]) && p.weekly_hours[k].length > 0))
}

/** @returns {{date:string,weekday:string,slots:{time:string,startsAtUtc:string}[]}[]} days that have at least one slot */
export function generateSlots(policy, durationMinutes, nowMs = Date.now()) {
  if (!isUsablePolicy(policy) || !Number.isInteger(durationMinutes) || durationMinutes <= 0) return []
  const today = utcToClinicSlot(new Date(nowMs).toISOString().replace(/\.\d{3}Z$/, 'Z'), policy.timezone).date
  const holidays = new Set((policy.holidays ?? []).map(String))
  const earliest = nowMs + policy.lead_minutes * 60000
  const days = []
  for (let i = 0; i <= policy.max_advance_days; i += 1) {
    const date = addDays(today, i)
    if (holidays.has(date)) continue
    const key = DAY_KEYS[new Date(`${date}T00:00:00Z`).getUTCDay()]
    const slots = []
    for (const w of policy.weekly_hours[key] ?? []) {
      const open = toMin(w.open), close = toMin(w.close)
      if (!Number.isFinite(open) || !Number.isFinite(close) || close <= open) continue
      for (let m = open; m + durationMinutes <= close; m += policy.slot_step_minutes) {
        let startsAtUtc
        try { startsAtUtc = clinicSlotToUtc(date, hhmm(m), policy.timezone) } catch { continue } // ambiguous/nonexistent wall time: fail closed
        if (Date.parse(startsAtUtc) >= earliest) slots.push({ time: hhmm(m), startsAtUtc })
      }
    }
    if (slots.length) days.push({ date, weekday: key, slots })
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
