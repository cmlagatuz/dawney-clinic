import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { BRANCHES, NAGA, CAVITE, DEFAULT_BRANCH_ID, NAGA_SERVICE_CATEGORIES, SUNDAY_NOTE, getBranch, isSafeExternalUrl, CLINIC_PHONE, CLINIC_TIME_ZONE } from '../src/public-site/clinic-info.mjs'

const src = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8')
const PUBLIC = ['src/pages/public/HomePage.tsx', 'src/pages/public/AboutPage.tsx', 'src/pages/public/ServicesPage.tsx', 'src/pages/public/BookPage.tsx', 'src/components/SiteLayout.tsx', 'index.html']

test('Naga is the default and primary branch; Cavite is secondary', () => {
  assert.equal(DEFAULT_BRANCH_ID, 'naga'); assert.equal(BRANCHES[0], NAGA); assert.equal(BRANCHES.length, 2)
  assert.equal(getBranch('naga'), NAGA); assert.equal(getBranch('cavite'), CAVITE); assert.equal(getBranch('x'), null)
  assert.equal(NAGA.name, 'Dawney Animal Clinic — Naga Branch'); assert.equal(CAVITE.name, 'Dawney Animal Clinic — Cavite Main Branch')
})
test('owner-approved addresses and links are exact (Issue #76)', () => {
  assert.equal(NAGA.address, '80 Perpetual Help Street, Peñafrancia Avenue, Naga, Camarines Sur, Philippines')
  assert.equal(NAGA.mapsUrl, 'https://maps.app.goo.gl/7LrLejjre332MyxT6')
  assert.equal(NAGA.facebookUrl, 'https://www.facebook.com/people/Dawney-Animal-Clinic-Naga/100057231318115/')
  assert.equal(CAVITE.address, 'Phase 5 Lot 14 Block 1, San Francisco, Brookside Lane, EBS BUILDING, Arnaldo Hwy, General Trias, Cavite, Philippines')
  assert.equal(CAVITE.mapsUrl, 'https://maps.app.goo.gl/6XWkKudFbJXay1GJA')
  assert.equal(CAVITE.facebookUrl, 'https://www.facebook.com/p/Dawney-Animal-Clinic-100063754752769/')
  assert.equal(NAGA.messageLabel, 'Message Naga on Facebook'); assert.equal(CAVITE.messageLabel, 'Message Cavite on Facebook')
})
test('every link is plain HTTPS on an allowed host, with no query, credentials or patient data', () => {
  for (const b of BRANCHES) {
    for (const u of [b.mapsUrl, b.facebookUrl]) assert.ok(isSafeExternalUrl(u), u)
    assert.equal(new URL(b.mapsUrl).host, 'maps.app.goo.gl'); assert.equal(new URL(b.facebookUrl).host, 'www.facebook.com')
  }
  assert.ok(!isSafeExternalUrl('https://x.test/?a=1')); assert.ok(!isSafeExternalUrl('https://u:p@x.test/'))
})
test('hours: Monday–Saturday 8–5 Asia/Manila only; Sunday never asserted; branch data is frozen', () => {
  assert.equal(CLINIC_TIME_ZONE, 'Asia/Manila')
  for (const b of BRANCHES) { assert.deepEqual([...b.hours], ['Monday–Saturday, 8:00 AM–5:00 PM (Philippine time)']); assert.ok(Object.isFrozen(b)) }
  assert.match(SUNDAY_NOTE, /not been confirmed/)
  for (const f of PUBLIC) assert.ok(!/Sunday\s*(:|open|closed|\d)/i.test(src(f).replace(SUNDAY_NOTE, '')), f + ' must not assert Sunday hours')
  assert.throws(() => { 'use strict'; NAGA.address = 'x' })
})
test('exactly the eight approved Naga categories, in order, as plain labels', () => {
  assert.deepEqual([...NAGA_SERVICE_CATEGORIES], ['Veterinary consultations', 'Vaccinations', 'Deworming', 'Diagnostic services', 'Surgical procedures', 'Dental care', 'Grooming', 'Hospitalization'])
  assert.ok(Object.isFrozen(NAGA_SERVICE_CATEGORIES))
})
test('no invented phone, price, duration, chat integration, or booking CTA on categories', () => {
  assert.equal(CLINIC_PHONE, null)
  const ui = src('src/pages/public/HomePage.tsx') + src('src/pages/public/ServicesPage.tsx') + src('src/public-site/clinic-info.mjs').split('\n').filter(l => !/digits/.test(l)).join('\n')
  assert.ok(!/wa\.me|whatsapp|messenger\.com|m\.me\/|tel:|₱|PHP\s?\d|\$\d|24\/7|24 hours|emergency/i.test(ui))
  const cat = src('src/pages/public/ServicesPage.tsx'), i = cat.indexOf('NAGA_SERVICE_CATEGORIES.map'), j = cat.indexOf('</ul>', i)
  assert.ok(!/button|Link|navigate|duration/.test(cat.slice(i, j)), 'category tiles are information only')
  assert.ok(!/NAGA_SERVICE_CATEGORIES/.test(src('src/pages/public/BookPage.tsx')))
})
test('Cavite appears only as an information/contact profile: no Cavite booking path', () => {
  const book = src('src/pages/public/BookPage.tsx')
  assert.ok(!/CAVITE|cavite/.test(book)); assert.ok(!/branch_id|branchId/.test(PUBLIC.map(src).join('')), 'no UI-only branch filtering of private data')
})
test('no General Trias / Cavite-only identity left as the primary title or SEO', () => {
  const html = src('index.html')
  assert.match(html, /<title>Dawney Animal Clinic — Naga Branch/); assert.match(html, /og:title" content="Dawney Animal Clinic — Naga Branch/)
  assert.ok(!/General Trias/.test(html))
  for (const f of ['src/pages/public/HomePage.tsx', 'src/pages/public/ServicesPage.tsx', 'src/pages/public/BookPage.tsx']) assert.ok(!/General Trias/.test(src(f)), f)
  assert.match(src('src/pages/public/HomePage.tsx'), /usePageMeta\('Dawney Animal Clinic — Naga Branch/)
})
test('external links open safely and announce the new tab; booking policy/flags untouched', () => {
  const l = src('src/components/SiteLayout.tsx')
  assert.ok(/target="_blank" rel="noopener noreferrer"/.test(l)); assert.ok((l.match(/target="_blank"/g) || []).length === (l.match(/rel="noopener noreferrer"/g) || []).length)
  assert.ok((l.match(/opens (in a new tab|Google Maps in a new tab)/g) || []).length >= 3)
  assert.ok(!/is_approved|clinic_booking_policy/.test(PUBLIC.map(src).join('')))
  assert.match(src('src/ops/flag.ts'), /VITE_PHASE5A_OPS_UI === 'true'/)
  assert.ok(!/VITE_PHASE[45]\w*\s*[:=]\s*['"]?true/.test(readdirSync(new URL('../', import.meta.url)).filter(f => f.startsWith('.env')).map(f => src(f)).join('')))
})
