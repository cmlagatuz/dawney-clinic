import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { generateSlots, isUsablePolicy } from '../src/public-site/slots.mjs'

const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const hours = (open, close) => Object.fromEntries(days.map(day => [day, [{ open, close }]]))
const policy = (overrides = {}) => ({
  timezone: 'Asia/Manila',
  weekly_hours: hours('08:00', '10:00'),
  holidays: [],
  lead_minutes: 0,
  max_advance_days: 1,
  slot_step_minutes: 15,
  ...overrides
})
const now = Date.parse('2026-11-18T01:00:00Z') // 09:00 on November 18 in Manila
const times = day => day?.slots.map(slot => slot.time) ?? []
const find = (p, duration, clock, date) => generateSlots(p, duration, clock).find(d => d.date === date)

test('REPRO: 09:05 opening on 15-minute midnight grid starts at 09:15, never 09:05/09:20/09:35', () => {
  const p = policy({ weekly_hours: hours('09:05', '10:00') })
  const slots = generateSlots(p, 15, Date.parse('2026-11-18T00:00:00Z'))
  assert.deepEqual(slots.map(d => d.date), ['2026-11-18'])
  assert.deepEqual(times(slots[0]), ['09:15', '09:30', '09:45'])
  assert.equal(slots[0].slots[0].startsAtUtc, '2026-11-18T01:15:00.000Z')
  // Close boundary inclusive for the service END, not for its start.
  assert.deepEqual(times(find(p, 30, Date.parse('2026-11-18T00:00:00Z'), '2026-11-18')), ['09:15', '09:30'])
})

test('REPRO: exact 24-hour upper horizon, not the whole next clinic day (inclusive endpoints)', () => {
  const p = policy({ lead_minutes: 15 })
  const result = generateSlots(p, 30, now)
  assert.deepEqual(result.map(d => d.date), ['2026-11-18', '2026-11-19'])
  assert.deepEqual(times(result[0]), ['09:15', '09:30'],
    'start exactly at now + lead (09:15) is valid; duration must finish by 10:00')
  assert.deepEqual(times(result[1]), ['08:00', '08:15', '08:30', '08:45', '09:00'],
    'the exact now + 1 day start is valid; 09:15 is past the horizon')
  assert.equal(result[1].slots.at(-1).startsAtUtc, '2026-11-19T01:00:00.000Z')
})

test('lead and horizon use exact UTC instants, including milliseconds', () => {
  const p = policy()
  const exact = find(p, 30, now, '2026-11-18')
  assert.equal(times(exact).includes('09:00'), true, 'zero lead is inclusive at current instant')
  const lateByMillisecond = find(p, 30, now + 1, '2026-11-18')
  assert.equal(times(lateByMillisecond).includes('09:00'), false, 'a previous start is never shown')
  assert.equal(times(find(p, 30, now + 1, '2026-11-19')).includes('09:00'), true,
    'an exact start before the horizon still fits when now is 1 ms later')
  // When now is 1 ms earlier, the next-day 09:00 exceeds the horizon.
  const before = find(p, 30, now - 1, '2026-11-19')
  assert.equal(times(before).includes('09:00'), false)
})

test('complete approved duration fits within one interval and does not cross clinic midnight', () => {
  const p = policy({ weekly_hours: hours('23:00', '23:59') })
  const clock = Date.parse('2026-11-18T14:00:00Z') // 22:00 Manila
  assert.deepEqual(generateSlots(p, 60, clock), [])
  assert.deepEqual(times(find(p, 45, clock, '2026-11-18')), ['23:00'])
  assert.deepEqual(times(find(policy({ weekly_hours: hours('09:05', '10:00') }), 60, now, '2026-11-18')), [])
})

test('timezone offset is clinic-local, independent of device timezone', () => {
  const kathmandu = policy({ timezone: 'Asia/Kathmandu', weekly_hours: hours('09:00', '09:45') })
  const clock = Date.parse('2026-11-18T03:00:00Z') // 08:45 Nepal
  const slots = find(kathmandu, 30, clock, '2026-11-18')
  assert.deepEqual(times(slots), ['09:00', '09:15'])
  assert.equal(slots.slots[0].startsAtUtc, '2026-11-18T03:15:00.000Z')
})

test('DST spring-forward uses actual UTC duration for local closing and skips nonexistent wall time', () => {
  const p = policy({ timezone: 'America/New_York', weekly_hours: hours('01:00', '03:00'), slot_step_minutes: 30 })
  const slots = find(p, 60, Date.parse('2027-03-14T04:00:00Z'), '2027-03-14')
  assert.deepEqual(times(slots), ['01:00'])
  assert.equal(slots.slots[0].startsAtUtc, '2027-03-14T06:00:00.000Z')
})

test('holidays, invalid or incomplete policies and malformed intervals fail closed', () => {
  const p = policy({ holidays: ['2026-11-18'] })
  assert.deepEqual(generateSlots(p, 30, now).map(d => d.date), ['2026-11-19'])
  for (const bad of [
    policy({ timezone: 'Invalid/Zone' }), policy({ slot_step_minutes: 1 }),
    policy({ slot_step_minutes: 61 }), policy({ lead_minutes: -1 }),
    policy({ max_advance_days: 366 }), policy({ weekly_hours: { mon: [{ open: '09:00', close: '10:00' }] } })
  ]) {
    assert.equal(isUsablePolicy(bad), false)
    assert.deepEqual(generateSlots(bad, 30, now), [])
  }
  assert.deepEqual(generateSlots(policy({ weekly_hours: hours('09:05XX', '10:00') }), 15, now), [])
  for (const duration of [0, 4, 7, 241, NaN]) assert.deepEqual(generateSlots(policy(), duration, now), [])
})

test('both production booking routes consume this same generator rather than duplicating local slot logic', () => {
  for (const file of ['src/pages/public/BookPage.tsx', 'src/components/ServiceBookingForm.tsx']) {
    const src = readFileSync(new URL('../' + file, import.meta.url), 'utf8')
    assert.match(src, /generateSlots\(policy, service\.duration_minutes\)/, file)
  }
  const owner = readFileSync(new URL('../src/pages/AppointmentsPage.tsx', import.meta.url), 'utf8')
  assert.match(owner, /<ServiceBookingForm /)
})
