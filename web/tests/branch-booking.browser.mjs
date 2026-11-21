// Run against a local Vite preview built with VITE_SUPABASE_URL=https://issue51-fixtures.supabase.co
// and VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_issue51_offline. All API traffic is intercepted.
// From web: CHROMIUM_BIN=/usr/bin/chromium node --test tests/branch-booking.browser.mjs
// Requires Playwright in the test runner. CODEX_PRIMARY_RUNTIME_NODE_MODULES is used when available.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { preview } from 'vite'

const runtime = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
const { chromium } = await import(runtime ? pathToFileURL(join(runtime, 'playwright/index.mjs')).href : 'playwright')
let origin

const uuid = n => '10000000-0000-4000-8000-' + String(n).padStart(12, '0')
const ids = { naga: uuid(1), alternate: uuid(2), cavite: uuid(3), service: uuid(4), hiddenService: uuid(5),
  room: uuid(6), secondRoom: uuid(7), hiddenRoom: uuid(8), speciesMismatch: uuid(9), booking: uuid(10) }
const authKey = 'dawney.auth.v1'
const authUrl = 'https://issue51-fixtures.supabase.co'
const weeklyHours = Object.fromEntries(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  .map(day => [day, [{ open: '12:30', close: '14:00' }]]))
const stamp = '2025-01-01T00:00:00Z'
const accounts = Object.fromEntries(['A', 'B'].map((label, index) => {
  const user = { id: uuid(index + 90), aud: 'authenticated', role: 'authenticated',
    email: label.toLowerCase() + '@example.test', email_confirmed_at: stamp, created_at: stamp,
    app_metadata: {}, user_metadata: {} }
  const owner = { id: uuid(index + 92), user_id: user.id, first_name: 'Fixture', last_name: label }
  const pet = { id: uuid(index + 94), owner_id: owner.id, name: 'Fixture Patient ' + label, species: 'Dog',
    species_id: 'dog', taxonomy_review_needed: false }
  const expires_at = Math.floor(Date.now() / 1000) + 3600
  const access_token = ['{"alg":"HS256","typ":"JWT"}', JSON.stringify({ sub: user.id, exp: expires_at }), 'fixture']
    .map(part => Buffer.from(part).toString('base64url')).join('.')
  return [label, { owner, pet, session: { user, access_token, refresh_token: 'fixture-' + label, expires_at } }]
}))

async function fixture(browser, account, width = 768, theme = 'light') {
  const context = await browser.newContext({ viewport: { width, height: 920 }, colorScheme: theme })
  await context.addInitScript(({ authKey, session, theme }) => {
    localStorage.setItem('dawney-theme', theme)
    if (session && !localStorage.getItem(authKey)) localStorage.setItem(authKey, JSON.stringify(session))
  }, { authKey, session: accounts[account]?.session, theme })
  const page = await context.newPage()
  page.setDefaultTimeout(7000)
  const state = { mode: 'ready', failOnce: false, rpc: [], writes: [], reads: [], unexpected: [], saved: null, holdPolicy: null, schedule: null, durationMinutes: 30 }
  const json = (route, value, status = 200) => route.fulfill({
    status, json: value, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' }
  })
  await context.route('**/*', async route => {
    const req = route.request()
    const url = new URL(req.url())
    if (url.origin === origin.origin) return route.continue()
    if (url.origin !== authUrl) {
      state.unexpected.push(url.origin)
      return route.abort()
    }
    if (req.method() === 'OPTIONS') return json(route, {})
    const account = Object.values(accounts).find(data => req.headers().authorization === 'Bearer ' + data.session.access_token)
    const label = account?.owner.last_name
    const branch = label === 'B' ? ids.alternate : ids.naga
    const filter = key => url.searchParams.get(key)?.replace(/^eq\./, '')
    if (url.pathname === '/auth/v1/user' && account) return json(route, account.session.user)
    const endpoint = url.pathname.replace('/rest/v1/', '')
    if (req.method() === 'GET') state.reads.push({ endpoint, id: filter('id') ?? filter('branch_id'), label })
    if (req.method() !== 'GET' && endpoint !== 'rpc/request_service_appointment') {
      state.writes.push([req.method(), endpoint])
      return json(route, { message: 'Unexpected direct write' }, 403)
    }
    switch (endpoint) {
      case 'clinic_branches': {
        if (filter('id')) {
          return json(route, filter('id') === branch ? [{ id: branch, booking_enabled: state.mode !== 'off' }] : [])
        }
        if (state.mode === 'missing_table') return json(route, { code: 'PGRST205', message: 'Missing public.clinic_branches' }, 404)
        const cavite = { id: ids.cavite, slug: 'cavite', display_name: 'Fixture Cavite' }
        const naga = { id: branch, slug: 'naga', display_name: 'Fixture Naga' }
        return json(route, state.mode === 'no_mapping' ? [cavite] : [cavite, naga])
      }
      case 'branch_booking_policies':
        if (state.holdPolicy && label === 'A') await state.holdPolicy()
        if (state.failOnce) {
          state.failOnce = false
          return json(route, { code: '08006', message: 'Synthetic connection failure' }, 502)
        }
        if (state.mode === 'no_policy_table') return json(route, { code: '42P01', message: 'Missing branch_booking_policies' }, 404)
        return json(route, filter('branch_id') === branch ? [{
          branch_id: branch, is_approved: true, timezone: 'Asia/Manila',
          weekly_hours: state.schedule?.weekly_hours ?? weeklyHours, holidays: [],
          lead_minutes: state.schedule?.lead_minutes ?? 1440,
          max_advance_days: state.schedule?.max_advance_days ?? 4,
          slot_step_minutes: state.schedule?.slot_step_minutes ?? 30, revision: 1
        }] : [])
      case 'clinic_services':
        return json(route, [
          { id: ids.service, slug: 'fixture-care', display_name: 'Fixture care', duration_minutes: state.durationMinutes },
          { id: ids.hiddenService, slug: 'hidden-room-care', display_name: 'Hidden room care', duration_minutes: 30 }
        ].map(service => ({ ...service, branch_id: filter('branch_id'), summary: null, published_at: stamp })))
      case 'clinic_service_resources':
        if (!account && state.mode !== 'anon_ready') return json(route, { code: '42501', message: 'Resource access denied' }, 403)
        if (state.mode === 'hidden') return json(route, [])
        return json(route, [
          { service_id: ids.service, resource_id: ids.room, capacity: 1, public_label: 'Fixture Room One' },
          { service_id: ids.service, resource_id: ids.secondRoom, capacity: 1, public_label: 'Fixture Room Two' },
          { service_id: ids.service, resource_id: ids.hiddenRoom, capacity: 1, public_label: 'Hidden Room' },
          { service_id: ids.hiddenService, resource_id: ids.hiddenRoom, capacity: 1, public_label: 'Hidden Room' }
        ])
      case 'appointment_resources':
        return json(route, [ids.room, ids.secondRoom].map(id => ({ id, branch_id: filter('branch_id'), is_active: true })))
      case 'owners':
        return json(route, account && filter('user_id') === account.owner.user_id ? [account.owner] : [])
      case 'pets': {
        if (!account || filter('owner_id') !== account.owner.id) return json(route, [])
        if (filter('id')) return json(route, filter('id') === account.pet.id ? [account.pet] : [])
        return json(route, [account.pet, { ...account.pet, id: ids.speciesMismatch, name: 'Unsupported Fixture', species_id: 'cat' }])
      }
      case 'species_catalog':
        return json(route, ['dog', 'cat'].map(id => ({ id, clinic_supported: true, is_active: true, review_status: 'curated' })))
      case 'clinic_service_species':
        return json(route, account ? [{ species_id: 'dog' }] : [])
      case 'appointments': {
        const booking = state.saved?.owner_id === account?.owner.id ? state.saved : null
        const rows = booking ? [booking] : []
        return json(route, filter('id') ? rows[0] : rows)
      }
      case 'rpc/request_service_appointment': {
        const body = req.postDataJSON()
        state.rpc.push(body)
        assert.equal(body.p_pet_id, account?.pet.id)
        assert.equal(body.p_service_id, ids.service)
        assert.equal(body.p_resource_id, ids.room)
        assert.match(body.p_request_nonce, /^[a-f0-9-]{36}$/)
        if (state.rpc.length === 1) return json(route, { code: '08006', message: 'Synthetic RPC network failure' }, 503)
        assert.deepEqual(body, state.rpc[0], 'identical retry must reuse the exact RPC payload and nonce')
        state.saved = {
          id: ids.booking, status: 'requested', owner_id: account.owner.id, pet_id: account.pet.id,
          resource_id: body.p_resource_id, service_id: body.p_service_id, starts_at: body.p_starts_at,
          ends_at: new Date(Date.parse(body.p_starts_at) + 1_800_000).toISOString(), concern: body.p_concern
        }
        return json(route, ids.booking)
      }
      default:
        state.unexpected.push(endpoint)
        return json(route, { message: 'Unexpected API request' }, 404)
    }
  })
  async function done() {
    await context.close()
    assert.deepEqual(state.writes, [], 'no legacy appointment inserts or direct writes')
    assert.deepEqual(state.unexpected, [], 'no retired singleton or unexpected endpoints')
    assert.ok(state.reads.every(read => read.id !== ids.cavite), 'Cavite is contact-only')
  }
  return { page, context, state, done }
}

const routes = ['/book', '/app/appointments']
const limit = { timeout: 10000 }
const noForm = async page => {
  assert.equal(await page.locator('main form').count(), 0)
  assert.equal(await page.locator('main [name="slot"], main input[type="datetime-local"]').count(), 0)
}

async function selectByKeyboard(page, locator) {
  await locator.focus()
  await page.keyboard.press('ArrowDown')
  assert.equal(await locator.evaluate(element => element.matches(':focus-visible') && getComputedStyle(element).outlineStyle === 'solid'), true)
}

async function chooseSlot(page, path) {
  const form = page.getByRole('form', { name: 'Appointment request', exact: path !== '/book' })
  await form.waitFor(limit)
  if (path === '/book') {
    const service = form.getByRole('radio', { name: /Fixture care/ })
    await service.focus()
    await page.keyboard.press('Space')
    assert.equal(await service.isChecked(), true)
  } else {
    await selectByKeyboard(page, form.getByRole('combobox', { name: /^Service/ }))
  }
  await selectByKeyboard(page, form.getByRole('combobox', { name: /^Option/ }))
  assert.equal(await form.getByRole('combobox', { name: /^Option/ }).inputValue(), ids.room)
  assert.equal(await form.getByRole('option', { name: 'Hidden Room' }).count(), 0)
  assert.equal(await form.getByText('Hidden room care', { exact: true }).count(), 0)
  await selectByKeyboard(page, form.getByLabel(/^Date/))
  const slot = form.getByRole('radio', { name: '12:30 PM' })
  await slot.focus()
  await page.keyboard.press('Space')
  assert.equal(await slot.isChecked(), true)
  assert.equal(await form.getByRole('radio', { name: '8:00 AM' }).count(), 0)
  return form
}

test('Issue #51 in Chromium with intercepted synthetic HTTP', async t => {
  const server = await preview({ preview: { host: '127.0.0.1', port: 0, strictPort: true } })
  origin = new URL('http://127.0.0.1:' + server.httpServer.address().port)
  t.after(() => new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve())))
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN, args: ['--no-sandbox'] })
  t.after(() => browser.close())
  for (const path of routes) {
    await t.test(path + ' keyboard, responsive themes, and nonce-safe request', async () => {
      for (const width of [360, 768, 1440]) {
        for (const theme of ['light', 'dark']) {
          const { page, state, done } = await fixture(browser, 'A', width, theme)
          try {
            await page.goto(new URL(path, origin).href)
            const form = await chooseSlot(page, path)
            assert.equal(await page.locator('html').getAttribute('data-theme'), theme)
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, path + ' overflow at ' + width)
            const patient = form.getByRole('combobox', { name: /^Patient/ })
            const mismatch = patient.locator('option[value="' + ids.speciesMismatch + '"]')
            await page.waitForFunction(id => document.querySelector('option[value="' + id + '"]')?.disabled, ids.speciesMismatch, limit)
            assert.equal(await mismatch.evaluate(option => option.disabled), true)
            if (width === 768 && theme === 'dark') {
              await form.getByLabel('Reason for visit').fill('Synthetic wellness check')
              const submit = form.getByRole('button', { name: /request appointment|send appointment request/i })
              await submit.press('Enter')
              await form.getByRole('alert').filter({ hasText: 'We could not save this request' }).waitFor(limit)
              await submit.press('Enter')
              await page.getByText(/Request received/).first().waitFor(limit)
              assert.equal(state.saved.status, 'requested')
              assert.equal(state.rpc.length, 2)
            } else {
              assert.equal(state.rpc.length, 0)
            }
          } finally { await done() }
        }
      }
    })

    await t.test(path + ' fails closed and retries the reader', async () => {
      for (const [mode, message] of [
        ['missing_table', 'still being set up'], ['no_policy_table', 'still being set up'],
        ['no_mapping', 'could not verify booking options'], ['off', 'not open yet'],
        ['hidden', 'currently unavailable']
      ]) {
        const { page, state, done } = await fixture(browser, 'A')
        state.mode = mode
        try {
          await page.goto(new URL(path, origin).href)
          await page.getByText(new RegExp(message)).waitFor(limit)
          await noForm(page)
          assert.equal(state.rpc.length, 0)
          if (mode === 'no_mapping') assert.ok(state.reads.filter(read => read.endpoint === 'clinic_branches').every(read => !read.id))
        } finally { await done() }
      }

      const { page, state, done } = await fixture(browser, 'A')
      state.failOnce = true
      try {
        await page.goto(new URL(path, origin).href)
        const retry = page.getByRole('button', { name: 'Try again', exact: true })
        await retry.waitFor(limit)
        await noForm(page)
        await retry.press('Enter')
        await chooseSlot(page, path)
        assert.equal(state.rpc.length, 0)
      } finally { await done() }
    })

    await t.test(path + ' ignores an old account and branch response', async () => {
      const { page, state, done } = await fixture(browser, 'A')
      const finish = Promise.withResolvers()
      state.holdPolicy = () => finish.promise
      try {
        const pending = page.waitForRequest(request => request.url().includes('branch_booking_policies'), limit)
        await page.goto(new URL(path, origin).href)
        await pending
        await noForm(page)
        state.mode = 'hidden'
        await page.evaluate(({ authKey, session }) => {
          localStorage.setItem(authKey, JSON.stringify(session))
          const channel = new BroadcastChannel(authKey)
          channel.postMessage({ event: 'SIGNED_IN', session })
          channel.close()
        }, { authKey, session: accounts.B.session })
        await page.getByText(/currently unavailable/).waitFor(limit)
        assert.ok(state.reads.some(read => read.label === 'B' && read.id === ids.alternate))
        state.mode = 'ready'
        const obsolete = page.waitForResponse(response => {
          const url = new URL(response.url())
          return url.pathname.endsWith('/appointment_resources') && url.searchParams.get('branch_id') === 'eq.' + ids.naga
        }, limit)
        finish.resolve()
        await obsolete
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
        await page.getByText(/currently unavailable/).waitFor(limit)
        await noForm(page)
        assert.equal(state.rpc.length, 0)
      } finally { finish.resolve(); await done() }
    })
  }

  // Fixed-clock REAL Chromium: both routes render only the PostgreSQL-valid
  // midnight-grid times and the exact inclusive start horizon. All Supabase
  // HTTP stays intercepted by the fixture above; no clinical endpoints/writes.
  for (const path of routes) {
    await t.test(path + ' fixed-clock 09:05 grid and one-day instant horizon', async () => {
      const clock = new Date('2026-11-18T01:00:00Z') // Manila: Wednesday 09:00
      const allDays = (open, close) => Object.fromEntries(
        ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map(day => [day, [{ open, close }]])
      )
      for (const scenario of [
        {
          name: 'misaligned opening', open: '09:05', close: '10:00', lead: 0,
          today: ['2026-11-18T01:15:00.000Z', '2026-11-18T01:30:00.000Z'],
          tomorrow: null
        },
        {
          name: 'inclusive lead and horizon', open: '08:00', close: '10:00', lead: 15,
          today: ['2026-11-18T01:15:00.000Z', '2026-11-18T01:30:00.000Z'],
          tomorrow: [
            '2026-11-19T00:00:00.000Z', '2026-11-19T00:15:00.000Z',
            '2026-11-19T00:30:00.000Z', '2026-11-19T00:45:00.000Z',
            '2026-11-19T01:00:00.000Z'
          ]
        }
      ]) {
        const { page, state, done } = await fixture(browser, 'A')
        state.schedule = {
          weekly_hours: allDays(scenario.open, scenario.close),
          lead_minutes: scenario.lead, max_advance_days: 1, slot_step_minutes: 15
        }
        try {
          // Exact lead/horizon inclusivity must not drift by elapsed test time.
          // Keep Date.now() fixed while Playwright leaves page timers running.
          await page.clock.setFixedTime(clock)
          await page.goto(new URL(path, origin).href)
          const form = page.getByRole('form', {
            name: path === '/book' ? 'Naga appointment request' : 'Appointment request'
          })
          await form.waitFor(limit)
          if (path === '/book') await form.getByRole('radio', { name: /Fixture care/ }).check()
          else await form.getByRole('combobox', { name: /^Service/ }).selectOption(ids.service)
          const date = form.getByLabel(/^Date/)
          await date.waitFor(limit)
          await date.selectOption('2026-11-18')
          assert.equal(await page.evaluate(() => Date.now()), clock.getTime(),
            'boundary clock remains exact after rendering and selecting the date')
          const slots = () => form.locator('input[name="slot"]').evaluateAll(elements =>
            elements.map(element => element.value))
          assert.deepEqual(await slots(), scenario.today, path + ': ' + scenario.name + ' today')
          if (scenario.tomorrow === null) {
            assert.equal(await date.locator('option[value="2026-11-19"]').count(), 0,
              'a one-day horizon does not include the rest of the following day')
          } else {
            await date.selectOption('2026-11-19')
            assert.deepEqual(await slots(), scenario.tomorrow,
              path + ': inclusive exact horizon and no 09:15 overflow')
          }
          assert.deepEqual(state.rpc, [], 'the boundary test never submits a clinical request')
        } finally { await done() }
      }
    })
  }

  await t.test('/book anonymous resource denial and PII-free sign-in return', async () => {
    const { page, state, done } = await fixture(browser, null)
    try {
      await page.goto(new URL('/book', origin).href)
      const signIn = page.getByRole('link', { name: 'Sign in to check booking options' })
      await signIn.waitFor(limit)
      await noForm(page)
      assert.equal(await signIn.getAttribute('href'), '/auth/signin?next=%2Fbook')
      await signIn.press('Enter')
      assert.equal(new URL(page.url()).search, '?next=%2Fbook')
      assert.equal(await page.evaluate(() => sessionStorage.getItem('dawney.publicBookingIntent.v1')), null)
      assert.equal(state.rpc.length, 0)
    } finally { await done() }
  })
})
