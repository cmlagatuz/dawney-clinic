// REHEARSAL ONLY (never run against a real PR branch): deterministic, fail-closed resolution of the exact textual conflicts
// between PR #48 (public website/booking) and PR #41 (patient catalog/attachments) when #41 is merged into a throw-away CI checkout.
//   - web/src/App.tsx      : #48 removed `Root()` (the "/" redirect, now a public home page); #41 added the OFF-by-default flag next to it.
//                            Resolution = keep #41's flag constant, drop Root(). Nothing else.
//   - web/src/styles.css   : both append a new numbered section (12 patient form / 13 public website) → keep both.
//   - docs/AI_HANDOFF.md   : both append sections → keep both.
// Any other conflicted file, hunk count or leftover marker fails the rehearsal.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const EXPECTED = { 'web/src/App.tsx': 1, 'web/src/styles.css': 1, 'docs/AI_HANDOFF.md': 1 }
const OPEN = /^<<<<<<< .*\n/gm, MID = /^=======\n/gm, CLOSE = /^>>>>>>> .*\n/gm

export function conflictedFiles(cwd = process.cwd()) {
  return execFileSync('git', ['diff', '--name-only', '--diff-filter=U'], { cwd, encoding: 'utf8' }).split('\n').filter(Boolean).sort()
}
export function hunks(text) { return (text.match(/^<<<<<<< /gm) ?? []).length }

/** keep both sides of every hunk (additive appends) */
export function keepBoth(text) { return text.replace(OPEN, '').replace(MID, '\n').replace(CLOSE, '') }

/** App.tsx: HEAD side (= #48) vs theirs (= #41). Keep #41's flag block, drop the obsolete Root(). */
export function resolveApp(text) {
  const m = text.match(/<<<<<<< [^\n]*\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>> [^\n]*\n/)
  if (!m) throw new Error('App.tsx: expected one conflict hunk')
  const [whole, a, b] = m
  const side = [a, b].join('')
  if (!/VITE_PHASE4_PATIENT_FORM === 'true'/.test(side)) throw new Error('App.tsx: #41 feature flag block not found')
  const kept = side.replace(/^function Root\(\)[^\n]*\n/m, '')
  if (/function Root\(/.test(kept)) throw new Error('App.tsx: Root() not removed')
  return text.replace(whole, kept)
}

export function run(cwd = process.cwd()) {
  const files = conflictedFiles(cwd)
  const want = Object.keys(EXPECTED).sort()
  if (JSON.stringify(files) !== JSON.stringify(want)) throw new Error(`Unexpected conflict set: ${JSON.stringify(files)} (expected ${JSON.stringify(want)})`)
  for (const f of files) {
    const p = `${cwd}/${f}`
    const text = readFileSync(p, 'utf8')
    if (hunks(text) !== EXPECTED[f]) throw new Error(`${f}: ${hunks(text)} conflict hunks, expected ${EXPECTED[f]}`)
    const out = f === 'web/src/App.tsx' ? resolveApp(text) : keepBoth(text)
    if (/^(<<<<<<<|>>>>>>>) |^=======$/m.test(out)) throw new Error(`${f}: conflict markers remain`)
    writeFileSync(p, out)
    execFileSync('git', ['add', f], { cwd })
  }
  return files
}
if (import.meta.url === `file://${process.argv[1]}`) { console.log('resolved:', run().join(', ')) }
