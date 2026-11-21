import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanProfile, safeAuthReturnPath, isVerifiedUser, isValidNewPassword } from '../src/domain.mjs'

test('profile field validation trims and forbids owner_id injection', () => {
  assert.deepEqual(cleanProfile({ first_name: ' A ', last_name: ' B ', owner_id: 'attack', user_id: 'attack' }),
    { first_name: 'A', last_name: 'B', phone: null, address: null })
  assert.throws(() => cleanProfile({first_name:'',last_name:'B'}), /first and last/)
  assert.throws(() => cleanProfile({first_name:'A',last_name:'B',phone:'x'.repeat(41)}), /too long/)
})
test('redirect target is restricted to internal application paths', () => {
  assert.equal(safeAuthReturnPath('//evil.test'), '/app/profile')
  assert.equal(safeAuthReturnPath('/app/profile'), '/app/profile')
  assert.equal(safeAuthReturnPath('https://evil.test'), '/app/profile')
  assert.equal(safeAuthReturnPath('/app//evil'), '/app/profile')
})
test('verified users must have confirmation and may not be anonymous', () => {
  assert.equal(isVerifiedUser({ id: 'uuid', email_confirmed_at:'2026-11-13', is_anonymous: false }), true)
  assert.equal(isVerifiedUser({ id: 'uuid', email_confirmed_at: null }), false)
  assert.equal(isVerifiedUser({ id: 'uuid', email_confirmed_at: 'x', is_anonymous: true }), false)
})
test('new-account password policy accepts eight letters/digits, rejects weak values', () => {
  assert.equal(isValidNewPassword('Alpha123'), true)
  assert.equal(isValidNewPassword('A1b2c3d4'), true)
  assert.equal(isValidNewPassword('Stronger_Example123!'), true)
  for(const password of ['Alpha12', 'abcdefgh', '12345678', '', 'x'.repeat(1025), null, 12345678]) {
    assert.equal(isValidNewPassword(password), false)
  }
})
