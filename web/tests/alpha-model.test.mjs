import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { canUndo, initialState, reduce, kpis, audience, RECIPIENTS, alphaPreviewAllowed, visibleAppts, blocksFor, VETS, BLOCKS, TODAY, QUICK_REPLIES, toMin, endOf, clock12 } from '../src/alpha/model.mjs'

const S0 = initialState()
const by = (s, id) => s.appts.find(x => x.id === id)

test('flow: legal moves update KPIs; illegal moves are ignored', () => {
  const k0 = kpis(S0)
  const s1 = reduce(S0, { type: 'flow/move', id: 'a7', to: 'waiting' })
  assert.equal(by(s1, 'a7').status, 'waiting'); assert.equal(kpis(s1).waiting, k0.waiting + 1)
  assert.equal(reduce(S0, { type: 'flow/move', id: 'a7', to: 'seen' }), S0, 'expected→seen is not allowed')
  assert.equal(reduce(S0, { type: 'flow/move', id: 'a1', to: 'waiting' }), S0, 'only today’s visits can move')
  assert.equal(reduce(S0, { type: 'flow/move', id: 'nope', to: 'waiting' }), S0)
  const s2 = reduce(S0, { type: 'flow/move', id: 'a7', to: 'noshow' }); assert.equal(kpis(s2).noshow, k0.noshow + 1)
})
test('flow: per-card and global undo restore the exact previous state', () => {
  let s = reduce(S0, { type: 'flow/move', id: 'a7', to: 'waiting' })
  s = reduce(s, { type: 'flow/move', id: 'a7', to: 'consult' })
  s = reduce(s, { type: 'flow/undoLast' }); assert.equal(by(s, 'a7').status, 'waiting')
  assert.equal(canUndo(s, 'a7'), true)
  s = reduce(s, { type: 'flow/undoCard', id: 'a7' }); assert.equal(by(s, 'a7').status, 'expected', 'multi-step per-card undo')
  assert.equal(canUndo(s, 'a7'), false); assert.deepEqual(s, S0)
  assert.equal(reduce(S0, { type: 'flow/undoLast' }), S0)
})
test('room occupancy counts distinct rooms in consult', () => {
  assert.equal(kpis(S0).roomsBusy, 1)
  const s = reduce(S0, { type: 'flow/move', id: 'a6', to: 'consult' }) // a6 waiting→consult in r1
  assert.equal(kpis(s).roomsBusy, 2)
})
test('inbox: open clears unread, send is local and SIMULATED, empty ignored, assign allowlisted', () => {
  assert.equal(kpis(S0).unread, 7)
  const s1 = reduce(S0, { type: 'inbox/open', id: 't6' }); assert.equal(kpis(s1).unread, 4)
  const s2 = reduce(s1, { type: 'inbox/send', id: 't6', text: QUICK_REPLIES[0].text })
  const last = s2.threads.find(t => t.id === 't6').messages.at(-1); assert.equal(last.status, 'SIMULATED'); assert.equal(last.from, 'clinic')
  assert.equal(reduce(s1, { type: 'inbox/send', id: 't6', text: '   ' }), s1)
  assert.equal(reduce(s1, { type: 'inbox/assign', id: 't6', to: 'attacker' }).threads.find(t => t.id === 't6').assignedTo, null)
  assert.equal(reduce(s1, { type: 'inbox/send', id: 't6', text: 'x'.repeat(900) }).threads.find(t => t.id === 't6').messages.at(-1).text.length, 500)
})
test('quick replies are placeholders, never invented clinic facts', () => {
  for (const q of QUICK_REPLIES) assert.match(q.text, /^\[DEMO TEXT\]/)
})
test('campaign audience excludes opted-out and no-consent; counts reconcile', () => {
  for (const c of S0.campaigns) { const a = audience(c); assert.equal(a.included.length + a.optedOut.length + a.noConsent.length, a.total); assert.ok(a.included.every(r => r.consent === 'opted_in')) }
  assert.ok(RECIPIENTS.some(r => r.consent === 'opted_out') && RECIPIENTS.some(r => r.consent === 'none'))
})
test('campaign statuses are local only; there is no "sent" state', () => {
  let s = reduce(S0, { type: 'camp/schedule', id: 'k1' }); assert.equal(s.campaigns[0].status, 'scheduled')
  s = reduce(s, { type: 'camp/preview', id: 'k1' }); assert.equal(s.campaigns[0].status, 'preview')
  assert.ok(!JSON.stringify(s.campaigns).match(/"(sent|delivered|read)"/i))
})
test('schedule filtering and unavailable time', () => {
  assert.equal(visibleAppts(S0.appts, { vetIds: ['v1'], day: TODAY }).every(x => x.vetId === 'v1' && x.day === TODAY), true)
  assert.equal(visibleAppts(S0.appts, { vetIds: [], day: TODAY }).length, 0)
  assert.equal(blocksFor(BLOCKS, { vetIds: ['v1'], day: 'thu' }).some(b => b.id === 'blk-thu-v2'), false)
  assert.equal(blocksFor(BLOCKS, { vetIds: ['v2'], day: 'thu' }).some(b => b.id === 'blk-thu-v2'), true)
  assert.equal(clock12('13:05'), '1:05 PM'); assert.equal(endOf({ start: '09:30', dur: 45 }), '10:15')
  // no appointment overlaps lunch/blocks for the same vet
  for (const ap of S0.appts) for (const b of BLOCKS.filter(b => b.day === ap.day && (b.vetId === null || b.vetId === ap.vetId)))
    assert.ok(toMin(endOf(ap)) <= toMin(b.start) || toMin(ap.start) >= toMin(b.end), `${ap.id} overlaps ${b.id}`)
  // no vet double-booked
  for (const ap of S0.appts) for (const o of S0.appts) if (ap.id < o.id && ap.day === o.day && ap.vetId === o.vetId) assert.ok(toMin(endOf(ap)) <= toMin(o.start) || toMin(endOf(o)) <= toMin(ap.start), `${ap.id}/${o.id}`)
  assert.equal(VETS.length, 3)
})
test('production hosts are blocked; preview/local hosts allowed; fail closed', () => {
  assert.equal(alphaPreviewAllowed('dawney-clinic.pages.dev'), false)
  assert.equal(alphaPreviewAllowed('c489430b.dawney-clinic.pages.dev'), true)
  assert.equal(alphaPreviewAllowed('ai-claude-alpha-clinic-ops.dawney-clinic.pages.dev'), true)
  assert.equal(alphaPreviewAllowed('localhost'), true)
  for (const h of ['', null, undefined, 'dawney-clinic.pages.dev.evil.com', 'evildawney-clinic.pages.dev', 'clinic.example.com']) assert.equal(alphaPreviewAllowed(h), false, String(h))
})
test('SAFETY: alpha source has no Supabase, lib/, network, storage or messaging code', () => {
  const dir = new URL('../src/alpha/', import.meta.url).pathname
  const bad = /supabase|from ['"]\.\.\/lib|from ['"]\.\.\/hooks|\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|localStorage|sessionStorage|indexedDB|navigator\.|api\.telegram|wa\.me|whatsapp\.com/i
  for (const f of readdirSync(dir).filter(f => /\.(mjs|ts|tsx)$/.test(f))) {
    const src = readFileSync(join(dir, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    assert.doesNotMatch(src, bad, `${f} contains a forbidden reference`)
  }
})
