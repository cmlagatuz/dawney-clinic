// Exercise the actual PR59 workflow source guard against synthetic local PR refs.
// No external GitHub calls, no real migrations, no hosted database or clinical data.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, copyFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { execFileSync, spawnSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const workflow = readFileSync(join(root, '.github/workflows/phase5a-staff-postgres.yml'), 'utf8')
const reviewed40 = '7f6b7b4b12c6d5c04a049f5427b77704d560e4f0'
const reviewed43 = '2749f810a2d5195e974949cb8e23d4495a8b0d11'
const guardPath40 = 'supabase/migrations/20261114072200_phase4_taxonomy_trigger_chow_chow_guard.sql'
const guardPath43 = 'supabase/migrations/20261114090000_phase4_public_booking_contract.sql'

function sourceStep() {
  const start = '      - name: Check exact Phase5A staff queue reader and fetch pinned booking/taxonomy commits\n        shell: bash\n        run: |\n'
  const end = '      - name: Install PostgreSQL client'
  assert.equal(workflow.split(start).length, 2, 'expected one real source integrity step')
  const tail = workflow.split(start)[1]
  assert.ok(tail.includes(end), 'source step must precede PostgreSQL setup')
  return tail.split(end)[0].trimEnd().split('\n').map(line => {
    assert.ok(line.startsWith('          '), 'expected YAML block shell indentation')
    return line.slice(10)
  }).join('\n') + '\n'
}

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

test('pull_request and master push both cover migration and source-guard changes', () => {
  const pr = workflow.match(/^  pull_request:\n    paths:\n([\s\S]*?)(?=^  push:)/m)
  const push = workflow.match(/^  push:\n    branches: \[master\]\n    paths:\n([\s\S]*?)(?=^permissions:)/m)
  assert.ok(pr && push, 'expected path-filtered pull_request and master push triggers')
  for (const [name, block] of [['pull_request', pr[1]], ['push', push[1]]]) {
    for (const path of [
      'supabase/migrations/**',
      '.github/workflows/phase5a-staff-postgres.yml',
      'supabase/tests/phase5a_staff_*.sql',
      'scripts/ci/tests/phase5a-staff-workflow.test.mjs',
    ]) {
      assert.ok(block.includes("      - '" + path + "'"), name + ' misses ' + path)
    }
  }
  assert.match(workflow, /staff-and-queue-rls-postgres17:/)
  assert.match(workflow, /booking-rpc-to-staff-queue-postgres17:/)
})

test('actual fetch + reviewed SHA checks accept pinned heads and stop on PR40/43 drift', (t) => {
  const step = sourceStep()
  assert.match(step, /refs\/pull\/40\/head:refs\/remotes\/origin\/phase5a-pr40/)
  assert.match(step, /refs\/pull\/43\/head:refs\/remotes\/origin\/phase5a-pr43/)
  assert.match(step, /git rev-parse refs\/remotes\/origin\/phase5a-pr40/)
  assert.match(step, /git rev-parse refs\/remotes\/origin\/phase5a-pr43/)
  assert.match(step, /git hash-object web\/src\/staff-read-contract\.mjs/)
  assert.ok(step.includes(guardPath40) && step.includes(guardPath43))
  assert.equal(step.split(reviewed40).length, 2, 'PR40 SHA must be checked exactly once')
  assert.equal(step.split(reviewed43).length, 2, 'PR43 SHA must be checked exactly once')

  const base = mkdtempSync(join(tmpdir(), 'phase5a-head-guard-'))
  t.after(() => rmSync(base, { recursive: true, force: true }))
  const checkout = join(base, 'checkout')
  const origin = join(base, 'origin.git')
  const runner = join(base, 'runner')
  mkdirSync(checkout)
  mkdirSync(runner)
  git(base, 'init', '--bare', '-q', origin)
  git(checkout, 'init', '-q')
  git(checkout, 'config', 'user.email', 'ci@example.invalid')
  git(checkout, 'config', 'user.name', 'Synthetic CI')

  const reader = 'web/src/staff-read-contract.mjs'
  mkdirSync(dirname(join(checkout, reader)), { recursive: true })
  copyFileSync(join(root, reader), join(checkout, reader))
  function commitFile(path, content, message) {
    mkdirSync(dirname(join(checkout, path)), { recursive: true })
    writeFileSync(join(checkout, path), content)
    git(checkout, 'add', path)
    git(checkout, 'commit', '-q', '-m', message)
    return git(checkout, 'rev-parse', 'HEAD')
  }
  const head40 = commitFile(guardPath40, '-- synthetic pinned PR40 migration\n', 'synthetic PR40 reviewed')
  const head43 = commitFile(guardPath43, '-- synthetic pinned PR43 migration\n', 'synthetic PR43 reviewed')
  git(checkout, 'remote', 'add', 'origin', origin)
  git(checkout, 'push', '-q', 'origin', head40 + ':refs/pull/40/head')
  git(checkout, 'push', '-q', 'origin', head43 + ':refs/pull/43/head')

  // Replace only expected commit literals to make a safe, local Git fixture.
  // The actual production workflow retains its immutable reviewed values.
  const localStep = step.replace(reviewed40, head40).replace(reviewed43, head43)
  assert.equal(localStep.split(head40).length, 2)
  assert.equal(localStep.split(head43).length, 2)
  const run = () => spawnSync('bash', ['-e', '-o', 'pipefail', '-c', localStep], {
    cwd: checkout,
    encoding: 'utf8',
    env: { ...process.env, RUNNER_TEMP: runner, GIT_TERMINAL_PROMPT: '0' },
  })
  const ok = run()
  assert.equal(ok.status, 0, 'unchanged source heads should pass: ' + ok.stderr)
  assert.equal(readFileSync(join(runner, 'phase5a-integration/chowchow-guard.sql'), 'utf8'), '-- synthetic pinned PR40 migration\n')
  assert.equal(readFileSync(join(runner, 'phase5a-integration/booking.sql'), 'utf8'), '-- synthetic pinned PR43 migration\n')

  // Advancing only PR43 must FAIL before SQL materialization, even though
  // the old reviewed commit remains fetchable by its immutable SHA.
  const new43 = commitFile(guardPath43, '-- unreviewed PR43 migration\n', 'unreviewed PR43 head')
  git(checkout, 'push', '-q', 'origin', new43 + ':refs/pull/43/head')
  rmSync(join(runner, 'phase5a-integration'), { recursive: true, force: true })
  assert.notEqual(run().status, 0, 'unreviewed PR43 head must be rejected')
  assert.equal(existsSync(join(runner, 'phase5a-integration')), false, 'drift must stop before SQL extraction')

  // Advancing PR40 must also FAIL CLOSED at its own exact-head comparison.
  const new40 = commitFile(guardPath40, '-- unreviewed PR40 migration\n', 'unreviewed PR40 head')
  // Local bare-repo ref mutation: no real remote push or forced branch update.
  // Shallow fetching inside this same synthetic checkout can obscure ancestry.
  git(origin, 'update-ref', 'refs/pull/40/head', new40)
  assert.notEqual(run().status, 0, 'unreviewed PR40 head must be rejected')
  assert.equal(existsSync(join(runner, 'phase5a-integration')), false)
})
