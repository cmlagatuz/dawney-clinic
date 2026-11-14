import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyBookingMode, isMissingPolicyTable, SAFE_BOOKING_MESSAGE, POLICY_CHANGED } from '../src/public-site/booking-mode.mjs'

const policy = { timezone: 'Asia/Manila', weekly_hours: { mon: [{ open: '09:00', close: '12:00' }] }, holidays: [], lead_minutes: 60, max_advance_days: 30, slot_step_minutes: 30, revision: 1 }
const svc = [{ id: 's' }]

test('legacy only when table missing or policy unapproved', () => {
  assert.equal(classifyBookingMode({ schedule: null, services: [] }), 'legacy')
  assert.equal(classifyBookingMode({ policyError: { code: 'PGRST205', message: "Could not find the table 'public.clinic_booking_policy'" } }), 'legacy')
  assert.equal(classifyBookingMode({ policyError: { code: '42P01', message: 'relation "clinic_booking_policy" does not exist' } }), 'legacy')
})
test('policy read failures fail closed (never legacy)', () => {
  for (const e of [new Error('network'), { code: '42501', message: 'permission denied for clinic_booking_policy' }, { code: 'PGRST205', message: "table 'public.other'" }, 'x'])
    assert.equal(classifyBookingMode({ policyError: e }), 'unknown')
  assert.equal(isMissingPolicyTable(null), false)
})
test('approved policy: service / no-services / incomplete / unknown', () => {
  assert.equal(classifyBookingMode({ schedule: policy, services: svc }), 'service')
  assert.equal(classifyBookingMode({ schedule: policy, services: [] }), 'no-services')
  assert.equal(classifyBookingMode({ schedule: policy, servicesError: new Error('x'), services: [] }), 'unknown')
  assert.equal(classifyBookingMode({ schedule: { ...policy, timezone: '' }, services: svc }), 'incomplete')
  assert.equal(classifyBookingMode({ schedule: { ...policy, weekly_hours: {} }, services: svc }), 'incomplete')
})
test('only allowlisted adapter messages are shown; policy flips are detected', () => {
  assert.ok(SAFE_BOOKING_MESSAGE.test('Clinic scheduling now requires an approved service; use service-aware booking'))
  assert.ok(POLICY_CHANGED.test('Clinic scheduling now requires an approved service; use service-aware booking'))
  assert.ok(!SAFE_BOOKING_MESSAGE.test('duplicate key value violates unique constraint "appointments_x"'))
  assert.ok(!SAFE_BOOKING_MESSAGE.test('JWT expired'))
})
