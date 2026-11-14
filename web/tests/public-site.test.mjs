import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CLINIC_HOURS, CLINIC_LOCATION, CLINIC_PHONE, DIRECTIONS_URL, isSafeExternalUrl, telHref } from '../src/public-site/clinic-info.mjs'
import { formatClockTime, generateSlots, isUsablePolicy } from '../src/public-site/slots.mjs'

// Fictitious policy used ONLY by these tests; it is not clinic data.
const policy = { timezone: 'Asia/Manila', weekly_hours: { sun: [], mon: [{ open: '09:00', close: '11:00' }], tue: [], wed: [], thu: [], fri: [], sat: [] },
  holidays: ['2026-11-23'], lead_minutes: 60, max_advance_days: 14, slot_step_minutes: 30, revision: 1 }

test('owner-supplied facts are used verbatim and unconfirmed facts stay null', () => {
  assert.equal(DIRECTIONS_URL, 'https://maps.app.goo.gl/JGCXR1H6sHN42aSo6')
  assert.equal(CLINIC_LOCATION, 'General Trias, Cavite, Philippines')
  assert.equal(CLINIC_PHONE, null); assert.equal(CLINIC_HOURS, null)
  assert.ok(isSafeExternalUrl(DIRECTIONS_URL)); assert.ok(!isSafeExternalUrl('http://x.test')); assert.ok(!isSafeExternalUrl('javascript:alert(1)'))
})
test('tel links are built only from plausible numbers', () => {
  assert.equal(telHref('0912 345 6789'), 'tel:09123456789'); assert.equal(telHref('+63 912 345 6789'), 'tel:+639123456789')
  assert.equal(telHref(null), null); assert.equal(telHref('call us'), null); assert.equal(telHref('123'), null)
})
test('no slots without an approved, complete policy (never default hours)', () => {
  assert.deepEqual(generateSlots(null, 30), [])
  assert.deepEqual(generateSlots({ ...policy, slot_step_minutes: null }, 30), [])
  assert.deepEqual(generateSlots({ ...policy, weekly_hours: { ...policy.weekly_hours, mon: [] } }, 30), [])
  assert.equal(isUsablePolicy(policy), true)
})
test('slots follow clinic-local weekday, duration, lead time, holidays and Asia/Manila → UTC', () => {
  // Fri 2026-11-20 00:00 UTC = Fri 08:00 Manila. Next Monday is 2026-11-23 (holiday) then 2026-11-30.
  const now = Date.parse('2026-11-20T00:00:00Z')
  const days = generateSlots(policy, 30, now)
  assert.ok(days.every(d => d.weekday === 'mon'))
  assert.ok(!days.some(d => d.date === '2026-11-23'), 'holiday excluded')
  const d = days.find(x => x.date === '2026-11-30')
  assert.deepEqual(d.slots.map(s => s.time), ['09:00', '09:30', '10:00', '10:30'])
  assert.equal(d.slots[0].startsAtUtc, '2026-11-30T01:00:00.000Z', '09:00 Manila = 01:00 UTC')
  assert.equal(generateSlots(policy, 90, now).find(x => x.date === '2026-11-30').slots.length, 2, 'slot must end by closing')
})
test('lead time removes slots that start too soon and the window is capped by max_advance_days', () => {
  const mondayMorning = Date.parse('2026-11-30T00:30:00Z') // 08:30 Manila
  const same = generateSlots({ ...policy, holidays: [] }, 30, mondayMorning).find(x => x.date === '2026-11-30')
  assert.deepEqual(same.slots.map(s => s.time), ['09:30', '10:00', '10:30']) // now 08:30 Manila + 60 min lead
  assert.ok(generateSlots({ ...policy, max_advance_days: 1 }, 30, Date.parse('2026-11-20T00:00:00Z')).length === 0)
})
test('12-hour clock labels', () => { assert.equal(formatClockTime('00:00'), '12:00 AM'); assert.equal(formatClockTime('13:30'), '1:30 PM'); assert.equal(formatClockTime('09:05'), '9:05 AM') })
test('public pages never contain invented services, prices, 24/7 or hours', () => {
  for (const f of ['HomePage', 'ServicesPage', 'AboutPage', 'BookPage']) {
    let src; try { src = readFileSync(new URL(`../src/pages/public/${f}.tsx`, import.meta.url), 'utf8') } catch { continue }
    assert.doesNotMatch(src, /24\s*\/\s*7|24 hours|₱|PHP\s?\d|\$\d|emergency|surgery|vaccin|grooming|boarding/i, f)
  }
})
