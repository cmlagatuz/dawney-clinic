import test from 'node:test'
import assert from 'node:assert/strict'
import { attachmentKey, attachmentView, attachmentsForPet, canActOnAttachment, documentsLocked, attachmentErrorText } from '../src/attachment-load.mjs'

const U1 = 'u1', U2 = 'u2', A = 'pet-a', B = 'pet-b'
const row = (id, pet_id, category = 'health_card', version_no = 1) => ({ id, pet_id, category, version_no })
const ready = (key, list) => ({ key, status: 'ready', list })

test('key requires both account and patient; otherwise idle', () => {
  assert.equal(attachmentKey(U1, A), 'u1:pet-a')
  for (const [u, p] of [[null, A], [U1, null], ['', A], [U1, ''], [undefined, undefined]]) assert.equal(attachmentKey(u, p), '')
  assert.deepEqual(attachmentView('', ready('u1:pet-a', [])), { status: 'idle', list: [] })
})
test('true empty result is ready+empty and distinct from an error', () => {
  const v = attachmentView('u1:pet-a', ready('u1:pet-a', []))
  assert.equal(v.status, 'ready'); assert.deepEqual(v.list, [])
  const e = attachmentView('u1:pet-a', { key: 'u1:pet-a', status: 'error' })
  assert.equal(e.status, 'error'); assert.deepEqual(e.list, [])
  assert.notEqual(v.status, e.status)
})
test('denied/failed read is an error with no list; malformed ready entry also fails closed', () => {
  assert.equal(attachmentView('u1:pet-a', { key: 'u1:pet-a', status: 'error', list: [row('x', A)] }).list.length, 0)
  assert.equal(attachmentView('u1:pet-a', { key: 'u1:pet-a', status: 'ready' }).status, 'error')
  assert.equal(attachmentView('u1:pet-a', { key: 'u1:pet-a', status: 'ready', list: 'nope' }).status, 'error')
})
test('rapid patient switching: a settled entry for patient A is never current for patient B', () => {
  const entryA = ready('u1:pet-a', [row('doc-a', A)])
  const v = attachmentView('u1:pet-b', entryA)
  assert.equal(v.status, 'loading'); assert.deepEqual(v.list, [])
  assert.deepEqual(attachmentsForPet(v, B), [])
  // A -> B -> A before anything settles: only the final key's own entry can ever be read
  assert.equal(attachmentView('u1:pet-a', ready('u1:pet-b', [row('doc-b', B)])).status, 'loading')
})
test('account switching: the same patient id under another account is not current', () => {
  const v = attachmentView('u2:pet-a', ready('u1:pet-a', [row('doc-a', A)]))
  assert.equal(v.status, 'loading'); assert.deepEqual(v.list, [])
  assert.equal(attachmentView('u2:pet-a', { key: 'u1:pet-a', status: 'error' }).status, 'loading')
  assert.equal(attachmentView('', ready('u1:pet-a', [row('doc-a', A)])).status, 'idle') // signed out / form cancelled
})
test('rows that do not belong to the selected patient are filtered even from a ready list', () => {
  const v = attachmentView('u1:pet-a', ready('u1:pet-a', [row('ok', A), row('leak', B)]))
  assert.deepEqual(attachmentsForPet(v, A).map(r => r.id), ['ok'])
  assert.deepEqual(attachmentsForPet({ status: 'loading', list: [] }, A), [])
})
test('download/replace gate needs a settled list for the selected patient', () => {
  const doc = row('doc-a', A)
  const v = attachmentView('u1:pet-a', ready('u1:pet-a', [doc]))
  assert.equal(canActOnAttachment(v, A, doc), true)
  assert.equal(canActOnAttachment(v, B, doc), false)                          // selected patient changed
  assert.equal(canActOnAttachment(v, A, row('other', B)), false)              // foreign row
  assert.equal(canActOnAttachment(v, A, row('ghost', A)), false)              // not in the settled list
  assert.equal(canActOnAttachment(attachmentView('u1:pet-b', ready('u1:pet-a', [doc])), A, doc), false) // stale
  assert.equal(canActOnAttachment({ status: 'error', list: [] }, A, doc), false)
  assert.equal(canActOnAttachment(v, null, doc), false)
})
test('documents are locked for an existing patient until the read succeeds; new patient is unlocked', () => {
  assert.equal(documentsLocked(null, { status: 'idle', list: [] }), false)
  assert.equal(documentsLocked(A, { status: 'loading', list: [] }), true)
  assert.equal(documentsLocked(A, { status: 'error', list: [] }), true)
  assert.equal(documentsLocked(A, { status: 'ready', list: [] }), false)
})
test('retry: after an error a fresh settled entry for the same key becomes ready', () => {
  const k = 'u1:pet-a'
  assert.equal(attachmentView(k, { key: k, status: 'error' }).status, 'error')
  assert.equal(attachmentView(k, ready(k, [row('d', A)])).status, 'ready')
})
test('error text is safe: no technical detail, and does not claim there are no files', () => {
  const t = attachmentErrorText()
  assert.doesNotMatch(t, /permission|rls|42501|supabase|storage|policy|jwt/i)
  assert.doesNotMatch(t, /no (saved )?(files|documents)|nothing (saved|uploaded)/i)
})

import { metadataSynced } from '../src/attachment-load.mjs'
test('metadata is authoritative only after a settled, successful read with no refresh pending', () => {
  assert.equal(metadataSynced({ status: 'ready', list: [] }, false), true)
  assert.equal(metadataSynced({ status: 'ready', list: [] }, true), false)   // refreshing after an upload: old list is not yet current
  for (const status of ['idle', 'loading', 'error']) assert.equal(metadataSynced({ status, list: [] }, false), false)
})
