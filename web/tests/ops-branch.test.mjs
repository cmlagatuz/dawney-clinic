import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync, readdirSync} from 'node:fs'
import {deriveBranches, isOfferedBranch, initialSelection, isBranchId, branchDenied} from '../src/ops/branch-model.mjs'
import {createBranchPortFor} from '../src/ops/port-adapter.mjs'
import {classifyOpsError} from '../src/ops/ops-model.mjs'

const NAGA = '11111111-0000-4000-8000-000000000077', CAV = '22222222-0000-4000-8000-000000000077', THIRD = '33333333-0000-4000-8000-000000000077'
const FORGED = '99999999-9999-4999-8999-999999999999', U = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', V = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const cat = [{id: NAGA, slug: 'naga', display_name: 'Dawney Animal Clinic — Naga'}, {id: CAV, slug: 'cavite', display_name: 'Dawney Animal Clinic — Cavite'}]
const mem = (branch, o = {}) => ({user_id: U, branch_id: branch, role: 'receptionist', is_active: true, ...o})

test('single membership: one branch offered and auto-selected', () => {
  const r = deriveBranches([mem(NAGA)], cat, U)
  assert.deepEqual(r.branches.map(b => [b.id, b.role]), [[NAGA, 'receptionist']]); assert.equal(initialSelection(r.branches), NAGA)
})
test('multiple memberships: all offered in catalog order, NO default selection', () => {
  const r = deriveBranches([mem(CAV, {role: 'administrator'}), mem(NAGA)], cat, U)
  assert.deepEqual(r.branches.map(b => b.id), [NAGA, CAV]); assert.equal(initialSelection(r.branches), null)
  assert.equal(r.branches[1].role, 'administrator')
})
test('no verified membership → nothing offered (denied); never manufactured', () => {
  assert.deepEqual(deriveBranches([], cat, U).branches, [])
  assert.deepEqual(deriveBranches([mem(NAGA, {is_active: false})], cat, U).branches, [])
})
test('forged / foreign / malformed rows are dropped and counted', () => {
  const rows = [mem(FORGED), mem(NAGA, {user_id: V}), mem('not-a-uuid'), mem(NAGA, {role: 'owner'}), mem(NAGA, {role: 'service_role'}),
    mem(CAV, {is_active: 'true'}), mem(CAV, {is_active: 1}), null, 'x', mem(THIRD)]
  const r = deriveBranches(rows, cat, U); assert.deepEqual(r.branches, []); assert.equal(r.dropped, rows.length)
})
test('duplicate rows for one branch (impossible server-side) are dropped entirely, others kept', () => {
  const r = deriveBranches([mem(NAGA), mem(NAGA, {role: 'administrator'}), mem(CAV)], cat, U)
  assert.deepEqual(r.branches.map(b => b.id), [CAV])
})
test('a membership for a branch missing from the public catalog is never offered', () => {
  assert.deepEqual(deriveBranches([mem(NAGA)], [cat[1]], U).branches, [])
  assert.deepEqual(deriveBranches([mem(NAGA)], [{id: NAGA, slug: 'Bad Slug', display_name: 'x'}, {id: NAGA, slug: 'naga', display_name: ' '}], U).branches, [])
})
test('non-array server answers fail (no empty-looking success)', () => {
  assert.throws(() => deriveBranches(null, cat, U)); assert.throws(() => deriveBranches({}, cat, U)); assert.throws(() => deriveBranches([], 'x', U))
  assert.deepEqual(deriveBranches([mem(NAGA)], cat, '').branches, [], 'empty uid matches nothing')
})
test('selection must be one of the offered ids', () => {
  const {branches} = deriveBranches([mem(NAGA)], cat, U)
  assert.ok(isOfferedBranch(branches, NAGA)); assert.ok(!isOfferedBranch(branches, CAV)); assert.ok(!isOfferedBranch(branches, FORGED)); assert.ok(!isOfferedBranch(branches, null)); assert.ok(!isOfferedBranch(branches, {}))
  assert.ok(isBranchId(NAGA) && !isBranchId('naga') && !isBranchId(''))
})

const deps = (o = {}) => ({calls: [],
  async listOwnBranchMemberships(u) { this.calls.push(['mem', u.id]); return o.mem ? o.mem(u) : [mem(NAGA)] },
  async listClinicBranches() { this.calls.push(['cat']); return o.cat ? o.cat() : cat },
  async assertStaffBranch(u, id) { this.calls.push(['assert', u.id, id]); return o.assert ? o.assert(u, id) : id },
  async listBranchQueueWindow(u, id, f, t) { this.calls.push(['window', u.id, id, f, t]); return o.window ? o.window(u, id) : {items: [], hasMore: false} },
  async getBranchDashboardCounts(u, id) { this.calls.push(['counts', u.id, id]); return {patients: 1, requestedAppointments: 2, confirmedAppointments: 3} }})
const user = id => ({id})

test('port: null without a user id; exposes exactly load/assertBranch/window/counts', () => {
  assert.equal(createBranchPortFor(deps(), null), null); assert.equal(createBranchPortFor(deps(), {}), null)
  assert.deepEqual(Object.keys(createBranchPortFor(deps(), user(U))).sort(), ['assertBranch', 'counts', 'load', 'window'])
})
test('port.load derives from server rows for THIS account only', async () => {
  const d = deps({mem: () => [mem(NAGA), mem(CAV, {user_id: V})]})
  const r = await createBranchPortFor(d, user(U)).load(); assert.deepEqual(r.branches.map(b => b.id), [NAGA]); assert.equal(r.dropped, 1)
})
test('assertBranch: server must echo the same id; forged shape never reaches the server', async () => {
  const d = deps(); const p = createBranchPortFor(d, user(U))
  assert.equal(await p.assertBranch(NAGA), NAGA)
  for (const bad of ['naga', '', null, undefined, '../x', NAGA + 'x']) await assert.rejects(p.assertBranch(bad), e => classifyOpsError(e) === 'denied')
  assert.equal(d.calls.filter(c => c[0] === 'assert').length, 1, 'only the well-formed id was sent')
  const p2 = createBranchPortFor(deps({assert: () => CAV}), user(U)); await assert.rejects(p2.assertBranch(NAGA), e => classifyOpsError(e) === 'denied')
})
test('denied branch (42501) and network errors pass through unchanged — never an empty list', async () => {
  const mk = (code, m) => Object.assign(Error(m), {code})
  const p = createBranchPortFor(deps({assert: () => { throw mk('42501', 'Branch access not authorized') }}), user(U))
  await assert.rejects(p.assertBranch(CAV), e => classifyOpsError(e) === 'denied')
  const p2 = createBranchPortFor(deps({window: () => { throw TypeError('Failed to fetch') }}), user(U))
  await assert.rejects(p2.window(NAGA, 'a', 'b'), e => classifyOpsError(e) === 'network')
  assert.equal(classifyOpsError(branchDenied()), 'denied')
})
test('window/counts are bound to one well-formed branch id; bad ids are denied before any request', async () => {
  const d = deps(); const p = createBranchPortFor(d, user(U))
  await p.window(NAGA, '2026-11-17T16:00:00.000Z', '2026-11-18T16:00:00.000Z'); await p.counts(CAV)
  assert.deepEqual(d.calls.map(c => c.slice(0, 3)), [['window', U, NAGA], ['counts', U, CAV]])
  assert.throws(() => p.window('x', 'a', 'b'), e => classifyOpsError(e) === 'denied'); assert.throws(() => p.counts(undefined), e => classifyOpsError(e) === 'denied')
  assert.equal(d.calls.length, 2)
})

test('static: ops code never derives authority from JWT/user metadata, URL or browser storage', () => {
  const dir = new URL('../src/ops/', import.meta.url)
  const files = [...readdirSync(dir).filter(f => /\.(ts|mjs)$/.test(f)).map(f => new URL(f, dir)), new URL('../src/pages/staff/OpsPage.tsx', import.meta.url)]
  for (const f of files) {
    const s = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
    assert.ok(!/user_metadata|app_metadata|getSession|localStorage|sessionStorage|useSearchParams|location\.(search|hash)|document\.cookie|active_branch/.test(s), f.pathname)
  }
})
test('static: production Operations is branch-only, no global queue/count fallback, flag OFF', () => {
  const rd = f => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')
  const source = rd('ops/port.ts').replace(/\/\*[\s\S]*?\*\//g, '')
  assert.match(source, /createBranchPortFor\(branchDeps, user\)/)
  for (const name of ['listOwnBranchMemberships','listClinicBranches','assertStaffBranch',
      'listBranchQueueWindow','getBranchDashboardCounts'])
    assert.match(source, new RegExp(name), name)
  assert.doesNotMatch(source, /\b(listClinicQueueWindow|getClinicDashboardCounts|createReadPortFor)\b/,
    'global queue/count adapters cannot be imported into active port')
  assert.match(source, /window:\s*unscopedDenied/)
  assert.match(source, /counts:\s*unscopedDenied/)
  assert.match(rd('ops/flag.ts'), /VITE_PHASE5A_OPS_UI === 'true'/)
  const page = rd('pages/staff/OpsPage.tsx')
  assert.match(page, /<OpsView key=\{\`\$\{uid \?\? 'none'\}:/)
  assert.match(page, /port=\{scope\.scoped\}/)
  assert.doesNotMatch(page, /legacy\s*\?|port=\{legacy/)
  assert.match(rd('ops/useBranchScope.ts'), /assertBranch\(active\)/)
  assert.ok(!/\.insert|\.update|\.upsert|\.rpc\(|\.from\(|supabase/.test(
    rd('ops/useBranchScope.ts') + rd('ops/branch-model.mjs') + rd('ops/port-adapter.mjs')))
})
