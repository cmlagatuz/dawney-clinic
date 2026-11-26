// Local-only mandatory TAP gate. No shell evaluation, provider calls or publishing.
import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export function assertCompleteTap(output, expected, label) {
  if (!Number.isSafeInteger(expected) || expected <= 0)
    throw Error(label + ': expected count must be a positive integer')
  for (const [key, value] of Object.entries({
    tests: expected, pass: expected, fail: 0, cancelled: 0, skipped: 0, todo: 0,
  })) {
    const matches = [...output.matchAll(new RegExp('^# ' + key + ' ([0-9]+)\\r?$', 'gm'))]
    if (matches.length !== 1 || Number(matches[0][1]) !== value)
      throw Error(label + ': invalid mandatory TAP total ' + key + ' (expected ' + value + ')')
  }
}

export function runMandatory({ cwd, command, args, expected, label }) {
  // A fresh test process must not inherit Node's internal nested-test context.
  const env = { ...process.env, FORCE_COLOR: '0' }
  delete env.NODE_TEST_CONTEXT
  const result = spawnSync(command, args, {
    cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
    timeout: 8 * 60 * 1000, shell: false,
    env,
  })
  process.stdout.write(result.stdout || '')
  process.stderr.write(result.stderr || '')
  if (result.error || result.signal || result.status !== 0)
    throw Error(label + ': command failed (exit=' + result.status + ', signal=' + result.signal + ')')
  assertCompleteTap(result.stdout, expected, label)
  console.log('PASS: ' + label + ' exact ' + expected + '/' + expected + ', no failed/skipped/cancelled/todo tests')
}

export function runFrontend(root, expected) {
  runMandatory({ cwd: join(root, 'web'), command: 'npm', args: ['test'],
    expected, label: 'frontend' })
}

export function runRelease(root, expected) {
  const dir = join(root, 'scripts/release/tests')
  const files = readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.test.mjs'))
    .map(entry => join(dir, entry.name)).sort()
  if (!files.length) throw Error('release: missing mandatory test files')
  runMandatory({ cwd: root, command: process.execPath, args: ['--test', '--test-reporter=tap', ...files],
    expected, label: 'release' })
}

export function runReleaseGate(root, frontendCount, releaseCount) {
  runFrontend(root, frontendCount)
  runRelease(root, releaseCount)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
    const [mode, frontend, release, ...extra] = process.argv.slice(2)
    if (extra.length || !/^[1-9][0-9]*$/.test(frontend || '')) throw Error('invalid mandatory count')
    if (mode === 'all' && /^[1-9][0-9]*$/.test(release || ''))
      runReleaseGate(root, Number(frontend), Number(release))
    else if (mode === 'frontend' && release === undefined)
      runFrontend(root, Number(frontend))
    else throw Error('invalid mandatory gate mode')
  } catch (error) {
    console.error('MANDATORY_GATE_BLOCKED: ' + error.message)
    process.exitCode = 1
  }
}
