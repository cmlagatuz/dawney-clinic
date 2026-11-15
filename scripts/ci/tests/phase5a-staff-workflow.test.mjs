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
  const author = join(base, 'author')
  const origin = join(base, 'origin.git')
  mkdirSync(author)
  git(base, 'init', '--bare', '-q', origin)
  git(author, 'init', '-q')
  git(author, 'config', 'user.email', 'ci@example.invalid')
  git(author, 'config', 'user.name', 'Synthetic CI')

  function commitFile(path, content, message) {
    mkdirSync(dirname(join(author, path)), { recursive: true })
    writeFileSync(join(author, path), content)
    git(author, 'add', path)
    git(author, 'commit', '-q', '-m', message)
    return git(author, 'rev-parse', 'HEAD')
  }
  // All 4 synthetic commits exist on the *local* bare origin; never fetch
  // any real PR from this test or change a real repository's refs.
  const head40 = commitFile(guardPath40, '-- synthetic pinned PR40 migration\n', 'synthetic PR40 reviewed')
  const head43 = commitFile(guardPath43, '-- synthetic pinned PR43 migration\n', 'synthetic PR43 reviewed')
  const new43 = commitFile(guardPath43, '-- unreviewed PR43 migration\n', 'unreviewed PR43 head')
  const new40 = commitFile(guardPath40, '-- unreviewed PR40 migration\n', 'unreviewed PR40 head')
  git(author, 'remote', 'add', 'origin', origin)
  git(author, 'push', '-q', 'origin', new40 + ':refs/heads/synthetic-fixture-history')
  const localStep = step.replace(reviewed40, head40).replace(reviewed43, head43)
  assert.equal(localStep.split(head40).length, 2)
  assert.equal(localStep.split(head43).length, 2)

  function setHeads(sha40, sha43) {
    git(origin, 'update-ref', 'refs/pull/40/head', sha40)
    git(origin, 'update-ref', 'refs/pull/43/head', sha43)
  }
  function runScenario(name) {
    // Fresh repository for EACH scenario avoids unrelated shallow-fetch
    // remote-tracking ancestry failures, so a status 1 means source drift.
    const checkout = join(base, 'checkout-' + name)
    const runner = join(base, 'runner-' + name)
    mkdirSync(checkout)
    mkdirSync(runner)
    git(checkout, 'init', '-q')
    git(checkout, 'remote', 'add', 'origin', origin)
    const reader = 'web/src/staff-read-contract.mjs'
    mkdirSync(dirname(join(checkout, reader)), { recursive: true })
    copyFileSync(join(root, reader), join(checkout, reader))
    const result = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', localStep], {
      cwd: checkout,
      encoding: 'utf8',
      env: { ...process.env, RUNNER_TEMP: runner, GIT_TERMINAL_PROMPT: '0' },
    })
    return { checkout, runner, result }
  }
  setHeads(head40, head43)
  const ok = runScenario('reviewed')
  assert.equal(ok.result.status, 0, 'unchanged heads should pass: ' + ok.result.stderr)
  assert.equal(readFileSync(join(ok.runner, 'phase5a-integration/chowchow-guard.sql'), 'utf8'), '-- synthetic pinned PR40 migration\n')
  assert.equal(readFileSync(join(ok.runner, 'phase5a-integration/booking.sql'), 'utf8'), '-- synthetic pinned PR43 migration\n')

  setHeads(head40, new43)
  const bad43 = runScenario('advanced43')
  assert.equal(bad43.result.status, 1, 'PR43 SHA mismatch must stop the job: ' + bad43.result.stderr)
  assert.equal(git(bad43.checkout, 'rev-parse', 'refs/remotes/origin/phase5a-pr43'), new43)
  assert.equal(existsSync(join(bad43.runner, 'phase5a-integration')), false)

  setHeads(new40, head43)
  const bad40 = runScenario('advanced40')
  assert.equal(bad40.result.status, 1, 'PR40 SHA mismatch must stop the job: ' + bad40.result.stderr)
  assert.equal(git(bad40.checkout, 'rev-parse', 'refs/remotes/origin/phase5a-pr40'), new40)
  assert.equal(existsSync(join(bad40.runner, 'phase5a-integration')), false)
})
