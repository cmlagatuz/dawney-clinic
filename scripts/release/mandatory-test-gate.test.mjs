// Disposable, local real Node/npm subprocesses. Never use app data or hosted services.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { assertCompleteTap, runReleaseGate } from './mandatory-test-gate.mjs'

const passing = "import test from 'node:test'; test('one',()=>{}); test('two',()=>{});\n"
const failing = "import test from 'node:test'; test('one',()=>{throw Error('synthetic failure')}); test('two',()=>{});\n"
const releaseMarker = "import {writeFileSync} from 'node:fs'; writeFileSync('release-ran','yes');\n"
function fixture(t, frontend=passing, release=passing) {
  const root = mkdtempSync(join(tmpdir(), 'dawney-release-gate-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, 'web/tests'), { recursive: true })
  mkdirSync(join(root, 'scripts/release/tests'), { recursive: true })
  writeFileSync(join(root, 'web/package.json'), JSON.stringify({private:true,scripts:{test:'node --test tests/*.test.mjs'}}))
  writeFileSync(join(root, 'web/tests/fixture.test.mjs'), frontend)
  if (release !== null) writeFileSync(join(root, 'scripts/release/tests/fixture.test.mjs'), releaseMarker+release)
  return root
}
test('RED: original AND-list masks failure and remains in web', t => {
  const root = fixture(t, failing)
  const result = spawnSync('bash',['-c','set -euo pipefail; cd web && npm test && cd ..; node --test scripts/release/tests/*.test.mjs; pwd'],{cwd:root,encoding:'utf8'})
  assert.equal(result.status,0)
  assert.match(result.stdout, /^# fail 1$/m)
  assert.match(result.stdout, /^# tests 0$/m)
  assert.ok(result.stdout.trimEnd().endsWith(join(root,'web')))
  assert.equal(existsSync(join(root,'release-ran')),false)
})
test('GREEN: failed frontend exits before release or later success', t => {
  const root=fixture(t,failing)
  assert.throws(()=>runReleaseGate(root,2,2),/frontend: command failed/)
  assert.equal(existsSync(join(root,'release-ran')),false)
})
test('missing release directory refuses', t => {
  const root=fixture(t)
  rmSync(join(root,'scripts/release/tests'),{recursive:true})
  assert.throws(()=>runReleaseGate(root,2,2),/ENOENT/)
})
test('empty release discovery refuses', t => {
  const root=fixture(t,passing,null)
  assert.throws(()=>runReleaseGate(root,2,2),/missing mandatory test files/)
})
test('empty frontend discovery refuses even if node exits zero', t => {
  const root=fixture(t)
  rmSync(join(root,'web/tests/fixture.test.mjs'))
  assert.throws(()=>runReleaseGate(root,2,2),/frontend: (invalid mandatory TAP total tests|command failed)/)
  assert.equal(existsSync(join(root,'release-ran')),false)
})
test('failed release guard refuses', t => {
  const root=fixture(t,passing,failing)
  assert.throws(()=>runReleaseGate(root,2,2),/release: command failed/)
})
test('frontend incorrect count refuses', t => {
  const root=fixture(t)
  assert.throws(()=>runReleaseGate(root,3,2),/frontend: invalid mandatory TAP total tests/)
  assert.equal(existsSync(join(root,'release-ran')),false)
})
test('release incorrect count refuses', t => {
  const root=fixture(t)
  assert.throws(()=>runReleaseGate(root,2,3),/release: invalid mandatory TAP total tests/)
})
test('complete suites run from exact directories', t => {
  const root=fixture(t)
  runReleaseGate(root,2,2)
  assert.equal(existsSync(join(root,'release-ran')),true)
  assert.equal(existsSync(join(root,'web/release-ran')),false)
})
const summary='# tests 2\n# pass 2\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n'
test('skipped mandatory result refuses',()=>assert.throws(()=>assertCompleteTap(summary.replace('# skipped 0','# skipped 1'),2,'fixture'),/skipped/))
test('cancelled mandatory result refuses',()=>assert.throws(()=>assertCompleteTap(summary.replace('# cancelled 0','# cancelled 1'),2,'fixture'),/cancelled/))
test('todo, absent, duplicate or zero summaries refuse',()=>{
  for(const bad of [summary.replace('# todo 0','# todo 1'),summary.replace('# pass 2\n',''),summary+summary,summary.replaceAll(' 2',' 0')])
    assert.throws(()=>assertCompleteTap(bad,2,'fixture'))
  assert.throws(()=>assertCompleteTap(summary,0,'fixture'))
})
