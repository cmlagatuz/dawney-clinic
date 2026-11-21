// Real Chromium route coverage with synthetic fetch interception. Runs via
// npm test on the same CI runner as TypeScript/Vite; no Playwright dependency,
// clinical Supabase requests, patient data, screenshots or test-network writes.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import { withChromium } from '../../scripts/browser/cdp.mjs'

function installFixture() {
  const uuid = n => '10000000-0000-4000-8000-' + String(n).padStart(12, '0')
  const ids = { naga: uuid(1), cavite: uuid(3), service: uuid(4), hiddenService: uuid(5),
    room: uuid(6), secondRoom: uuid(7), hiddenRoom: uuid(8), patient: uuid(94),
    user: uuid(90), owner: uuid(92) }
  const fixtureOrigin = 'https://issue51-fixtures.supabase.co'
  const now = Date.parse('2026-11-18T01:00:00Z') // Manila 09:00, Wednesday
  const RealDate = Date
  class FixedDate extends RealDate {
    constructor(...args) { super(...(args.length ? args : [now])) }
    static now() { return now }
  }
  window.Date = FixedDate
  const user = { id: ids.user, aud: 'authenticated', role: 'authenticated',
    email: 'synthetic@example.test', email_confirmed_at: '2025-01-01T00:00:00Z',
    created_at: '2025-01-01T00:00:00Z', app_metadata: {}, user_metadata: {} }
  const expiry = Math.floor(RealDate.now() / 1000) + 86400 * 365
  const token = ['{"alg":"HS256","typ":"JWT"}', JSON.stringify({ sub: ids.user, exp: expiry }), 'fixture']
    .map(part => btoa(part).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')).join('.')
  const session = { user, access_token: token, refresh_token: 'synthetic-test',
    expires_at: expiry }
  localStorage.setItem('dawney.auth.v1', JSON.stringify(session))
  const scenario = new URL(location.href).searchParams.get('case') === 'grid' ? 'grid' : 'horizon'
  const weeklyHours = Object.fromEntries(['sun','mon','tue','wed','thu','fri','sat'].map(day => [
    day, [{ open: scenario === 'grid' ? '09:05' : '08:00', close: '10:00' }]
  ]))
  window.__slotWrites = []
  const originalFetch = window.fetch.bind(window)
  const json = (body, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }
  })
  window.fetch = async (input, init) => {
    const req = new Request(input, init)
    const url = new URL(req.url)
    if (url.origin === location.origin) return originalFetch(input, init)
    if (url.origin !== fixtureOrigin) throw Error('Unexpected third-party endpoint in synthetic browser test')
    if (req.method === 'OPTIONS') return json({})
    if (req.method !== 'GET') {
      window.__slotWrites.push(req.method + ' ' + url.pathname)
      return json({ message: 'Writes prohibited in slot UI test' }, 403)
    }
    const filter = key => url.searchParams.get(key)?.replace(/^eq\./, '')
    if (url.pathname === '/auth/v1/user') return json(user)
    const endpoint = url.pathname.replace('/rest/v1/', '')
    switch (endpoint) {
      case 'clinic_branches':
        if (filter('id')) return json(filter('id') === ids.naga ? [{ id: ids.naga, booking_enabled: true }] : [])
        return json([{ id: ids.cavite, slug: 'cavite', display_name: 'Fixture Cavite' },
          { id: ids.naga, slug: 'naga', display_name: 'Fixture Naga' }])
      case 'branch_booking_policies':
        return json(filter('branch_id') === ids.naga ? [{
          branch_id: ids.naga, is_approved: true, timezone: 'Asia/Manila',
          weekly_hours: weeklyHours, holidays: [], lead_minutes: scenario === 'grid' ? 0 : 15,
          max_advance_days: 1, slot_step_minutes: 15, revision: 1
        }] : [])
      case 'clinic_services':
        return json([
          { id: ids.service, slug: 'fixture-care', display_name: 'Fixture care', duration_minutes: 30 },
          { id: ids.hiddenService, slug: 'hidden-care', display_name: 'Hidden room care', duration_minutes: 30 }
        ].map(s => ({ ...s, branch_id: ids.naga, summary: null, published_at: '2025-01-01T00:00:00Z' })))
      case 'clinic_service_resources':
        return json([
          { service_id: ids.service, resource_id: ids.room, capacity: 1, public_label: 'Fixture Room One' },
          { service_id: ids.service, resource_id: ids.secondRoom, capacity: 1, public_label: 'Fixture Room Two' },
          { service_id: ids.hiddenService, resource_id: ids.hiddenRoom, capacity: 1, public_label: 'Hidden Room' }
        ])
      case 'appointment_resources':
        return json([ids.room, ids.secondRoom].map(id => ({ id, branch_id: ids.naga, is_active: true })))
      case 'owners':
        return json(filter('user_id') === ids.user
          ? [{ id: ids.owner, user_id: ids.user, first_name: 'Fixture', last_name: 'Owner' }] : [])
      case 'pets':
        return json(filter('owner_id') === ids.owner
          ? [{ id: ids.patient, owner_id: ids.owner, name: 'Fixture Animal', species: 'Dog',
            species_id: 'dog', taxonomy_review_needed: false }] : [])
      case 'species_catalog':
        return json([{ id: 'dog', clinic_supported: true, is_active: true, review_status: 'curated' }])
      case 'clinic_service_species':
        return json([{ species_id: 'dog' }])
      case 'appointments':
        return json([])
      default:
        throw Error('Unexpected fixture GET ' + endpoint)
    }
  }
}

test('real Chromium: both booking routes use only valid 09:05 grid and exact one-day horizon', { timeout: 120000 }, async () => {
  // This inert host is required by the app's public-key-only Supabase client.
  process.env.VITE_SUPABASE_URL = 'https://issue51-fixtures.supabase.co'
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_issue51_offline'
  const root = fileURLToPath(new URL('../', import.meta.url))
  const vite = await createServer({ root, server: { host: '127.0.0.1', port: 0, strictPort: false } })
  try {
    await vite.listen()
    const port = vite.httpServer.address().port
    const origin = 'http://127.0.0.1:' + port
    await withChromium(async browser => {
      await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: '(' + installFixture.toString() + ')()' })
      for (const path of ['/book', '/app/appointments']) {
        for (const scenario of ['grid', 'horizon']) {
          await browser.goto(origin + path + '?case=' + scenario)
          if (path === '/book') {
            await browser.until('!!document.querySelector(\'form[aria-label="Naga appointment request"] input[name="service"]\')')
            await browser.value('document.querySelector(\'form[aria-label="Naga appointment request"] input[name="service"]\').click()')
          } else {
            const serviceSelector = `[...document.querySelectorAll('form[aria-label="Appointment request"] label')].find(x=>x.textContent.trim().startsWith('Service'))?.querySelector('select')`
            await browser.until('!!(' + serviceSelector + ')')
            await browser.value(`(()=>{const el=${serviceSelector};el.value='10000000-0000-4000-8000-000000000004';el.dispatchEvent(new Event('change',{bubbles:true}));return true})()`)
          }
          const dateSelector = `[...document.querySelectorAll('form label')].find(x=>x.textContent.trim().startsWith('Date'))?.querySelector('select')`
          try {
            await browser.until('!!(' + dateSelector + ')', 5000)
          } catch {
            const snapshot = await browser.value(`({
              path: location.pathname,
              formNames: [...document.querySelectorAll('form')].map(x => x.getAttribute('aria-label')),
              labels: [...document.querySelectorAll('form label')].map(x => x.textContent?.trim().slice(0, 35)),
              statuses: [...document.querySelectorAll('[role="status"],[role="alert"]')].map(x => x.textContent?.trim().slice(0, 70)),
              selectedService: !!document.querySelector('input[name="service"]:checked')
            })`)
            throw Error('Synthetic date picker not available: ' + JSON.stringify(snapshot))
          }
          async function selectDate(date) {
            const changed = await browser.value(`(()=>{const el=${dateSelector};if(!el)return false;el.value='${date}';el.dispatchEvent(new Event('change',{bubbles:true}));return true})()`)
            assert.equal(changed, true)
            await browser.until("document.querySelectorAll('input[name=slot]').length > 0")
            return await browser.value("[...document.querySelectorAll('input[name=slot]')].map(el=>el.value)")
          }
          assert.deepEqual(await selectDate('2026-11-18'), [
            '2026-11-18T01:15:00.000Z', '2026-11-18T01:30:00.000Z'
          ], path + ' ' + scenario + ' today')
          if (scenario === 'grid') {
            assert.equal(await browser.value("!!document.querySelector('option[value=\\\"2026-11-19\\\"]')"), false,
              path + ' no next-day hours after horizon')
          } else {
            assert.deepEqual(await selectDate('2026-11-19'), [
              '2026-11-19T00:00:00.000Z', '2026-11-19T00:15:00.000Z',
              '2026-11-19T00:30:00.000Z', '2026-11-19T00:45:00.000Z',
              '2026-11-19T01:00:00.000Z'
            ], path + ' exact inclusive upper bound, no overflow')
          }
          assert.deepEqual(await browser.value('window.__slotWrites'), [], 'synthetic HTTP only')
        }
      }
    })
  } finally {
    await vite.close()
  }
})
