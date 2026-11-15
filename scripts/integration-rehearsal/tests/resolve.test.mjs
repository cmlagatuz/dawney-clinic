import test from 'node:test'
import assert from 'node:assert/strict'
import { keepBoth, resolveApp, hunks } from '../resolve-41-48.mjs'

const APP = `a\n<<<<<<< HEAD\nfunction Root() { return <Navigate to="/app/overview" replace /> }\n/** Off by default */\nconst phase4PatientForm = import.meta.env.VITE_PHASE4_PATIENT_FORM === 'true'\n\n=======\n>>>>>>> refs/remotes/origin/r48\nexport function App() {}\n`
test('App.tsx: keeps the OFF-by-default flag, drops the obsolete Root()', () => {
  const out = resolveApp(APP)
  assert.match(out, /VITE_PHASE4_PATIENT_FORM === 'true'/); assert.doesNotMatch(out, /function Root\(/); assert.equal(hunks(out), 0)
  assert.doesNotMatch(out, /=======|<<<<<<<|>>>>>>>/)
})
test('App.tsx: fails closed if the flag block is missing', () => {
  assert.throws(() => resolveApp('<<<<<<< HEAD\nfunction Root() {}\n=======\n>>>>>>> x\n'), /flag block not found/)
  assert.throws(() => resolveApp('no conflict'), /expected one conflict hunk/)
})
test('additive files keep both sides', () => {
  const out = keepBoth('x\n<<<<<<< HEAD\nA\n=======\nB\n>>>>>>> theirs\ny\n')
  assert.match(out, /A\n\nB\n/); assert.equal(hunks(out), 0)
})
