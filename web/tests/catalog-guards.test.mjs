import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Source guards for review findings on PetsPageCatalog (behavioural coverage lives in the Chromium suite).
const src = readFileSync(new URL('../src/pages/PetsPageCatalog.tsx', import.meta.url), 'utf8')
const body = (name) => { const i = src.indexOf(`async function ${name}(`); assert.ok(i >= 0, name); return src.slice(i, src.indexOf('\n  }\n', i)) }

test('reload() captures the account and refuses to write patients after an account change', () => {
  const r = body('reload')
  assert.match(r, /const uid = user\.id/)
  assert.ok(r.indexOf('accountRef.current !== uid') > r.indexOf('await Promise.all'), 'guard must run after the awaits')
  assert.ok(r.indexOf('accountRef.current !== uid') < r.indexOf('setPets('), 'guard must precede setPets')
  assert.match(src, /accountRef\.current = userId/)
})
test('save() only clears "saving" for the account that started it', () => {
  assert.match(body('save'), /finally \{ if \(accountRef\.current === uid0\) setSaving\(false\) \}/)
})
test('retries finalise a retained object path via retryMode() instead of re-uploading', () => {
  const r = body('runUploads')
  assert.match(r, /retryMode\(u\) === 'finalize'/)
  assert.doesNotMatch(r, /u\.status === 'unindexed' && u\.objectPath/)
})
test('the form cannot be saved, closed or re-targeted while anything is uploading', () => {
  assert.match(src, /const busy = saving \|\| uploadBusy/)
  assert.ok((src.match(/disabled=\{busy\}/g) ?? []).length >= 5, 'Save, Close, Cancel, Add patient, Edit and the empty-state button')
  assert.match(body('save'), /busy \|\| uploadsBusy\(uploadsRef\.current\)/)
})
test('saved pending files are replaced by refreshed private metadata only once it is synced', () => {
  assert.match(src, /metadataSynced\(att, att\.refreshing\)/)
  assert.match(src, /savedToClear\(uploads, synced\)/)
  assert.match(body('runUploads'), /type: 'saved' \}\); attReload\(\)/)
})
