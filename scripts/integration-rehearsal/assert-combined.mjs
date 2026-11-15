// Static compatibility assertions over the MERGED (#34 + #41 + #48) working tree. No network, no Supabase, no writes.
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'

const root = process.argv[2] ?? process.cwd()
const rd = p => readFileSync(`${root}/${p}`, 'utf8')
const ok = (name, fn) => { try { fn(); console.log('PASS', name) } catch (e) { console.log('FAIL', name, '-', e.message); process.exitCode = 1 } }

const app = rd('web/src/App.tsx')
function gitGrep(pattern, ...paths) {
  try { return execFileSync('git', ['grep', '-nE', pattern, '--', ...paths], { cwd: root, encoding: 'utf8' }).trim() } catch { return '' } // exit 1 = no match
}
ok('no merge markers in web/src, web/tests, docs', () => assert.equal(gitGrep('^(<<<<<<<|>>>>>>>) ', 'web/src', 'web/tests', 'docs'), ''))

ok('routes: Home, Services, Book, auth, owner appointments and patients all present exactly once', () => {
  for (const r of ['path="/"', 'path="/services"', 'path="/book"', 'path="/auth/signin"', 'path="/app/appointments"', 'path="/app/pets"', 'path="/app/overview"'])
    assert.equal(app.split(r).length - 1, 1, r)
  assert.doesNotMatch(app, /function Root\(/)
  assert.match(app, /<Guard\/>/)
})
ok('Phase 4 patient form flag stays OFF by default (only the literal string "true" enables it)', () => {
  assert.equal((app.match(/VITE_PHASE4_PATIENT_FORM/g) ?? []).length, 1)
  assert.match(app, /VITE_PHASE4_PATIENT_FORM === 'true'/)
  assert.match(app, /phase4PatientForm\?<PetsPageCatalog\/>:<PetsPage\/>/)
  assert.equal(gitGrep('VITE_PHASE4_PATIENT_FORM', '.github', 'web/.env', 'web/.env.production', 'web/vite.config.ts', 'web/package.json', 'web/index.html'), '')
})
const cat = rd('web/src/pages/PetsPageCatalog.tsx')
ok('#41 attachment read handling survives: hook-based, no swallowed-empty loadExisting/setExisting', () => {
  assert.match(cat, /usePatientAttachments\(/); assert.match(cat, /documentsLocked\(/); assert.match(cat, /canActOnAttachment\(/)
  assert.doesNotMatch(cat, /loadExisting|setExisting/)
  assert.match(rd('web/src/hooks/usePatientAttachments.ts'), /status: 'error'/)
})
ok('#48 service-specific eligibility is wired into BOTH booking interfaces', () => {
  for (const f of ['web/src/pages/public/BookPage.tsx', 'web/src/components/ServiceBookingForm.tsx']) {
    const t = rd(f)
    for (const n of ['useServiceSpecies', 'applyServiceSpecies', 'canBookPet']) assert.match(t, new RegExp(n), `${f} ${n}`)
  }
})
const be = process.env.BE_SHA
ok('#43 booking contract/reader/adapter files are byte-identical to the reviewed backend contract (no overwritten security fixes)', () => {
  assert.ok(be, 'BE_SHA must name the pinned #43 commit')
  for (const f of ['web/src/booking-contract.mjs', 'web/src/booking-contract.d.mts', 'web/src/lib/public-booking.ts', 'web/src/service-species-reader.mjs', 'web/src/service-species-reader.d.mts', 'web/src/booking-transition.mjs', 'web/src/booking-transition.d.mts', 'web/src/lib/owner-booking-transition.ts']) {
    const want = execFileSync('git', ['show', `${be}:${f}`], { cwd: root, encoding: 'utf8' })
    assert.equal(rd(f), want, f)
  }
})
ok('private Storage stays behind lib/pet-attachments: no public URLs, no UI/booking code touches storage', () => {
  assert.equal(gitGrep('getPublicUrl|\\.storage\\.from|createSignedUrl', 'web/src/pages', 'web/src/components', 'web/src/public-site', 'web/src/hooks'), '')
  assert.doesNotMatch(rd('web/src/lib/pet-attachments.ts'), /getPublicUrl/)
})
ok('feature isolation: public booking never imports patient-catalog/attachment code, and vice versa', () => {
  assert.equal(gitGrep("attachment|PetsPageCatalog|patient-form-logic", 'web/src/public-site', 'web/src/pages/public', 'web/src/components/PatientSelect.tsx', 'web/src/components/ServiceBookingForm.tsx').replace(/.*usePatientEligibility.*\n?/g, ''), '')
  assert.equal(gitGrep("public-site|public-booking|booking-contract|service-species", 'web/src/pages/PetsPageCatalog.tsx', 'web/src/components/AttachmentField.tsx', 'web/src/components/SpeciesBreedFields.tsx', 'web/src/hooks/usePatientAttachments.ts', 'web/src/attachment-load.mjs'), '')
})
ok('synthetic Alpha #56 is not part of the combined tree', () => { assert.equal(existsSync(`${root}/web/src/alpha`), false) })
ok('no secrets/credential markers in web sources', () => assert.equal(gitGrep('service_role|sb_secret_|SUPABASE_SERVICE_ROLE_KEY', 'web/src'), ''))
