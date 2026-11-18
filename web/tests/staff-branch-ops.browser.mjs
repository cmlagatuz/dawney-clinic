// From web, with Playwright and Chromium available:
// CHROMIUM_BIN=/usr/bin/chromium node --test tests/staff-branch-ops.browser.mjs
// The Vite test server substitutes the read-port factory only for OpsPage.
// Browser networking is restricted to the loopback server and intercepted fixtures.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createServer } from 'vite'

const runtime = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
const { chromium } = await import(runtime ? pathToFileURL(join(runtime, 'playwright/index.mjs')).href : 'playwright')
const root = fileURLToPath(new URL('../', import.meta.url))
const authOrigin = 'https://issue58-fixtures.supabase.co'
const authKey = 'dawney.auth.v1'
const date = new Date('2026-11-18T04:00:00.000Z')
const start = 'gte.2026-11-17T16:00:00.000Z'
const end = 'lt.2026-11-18T16:00:00.000Z'
const nextStart = 'gte.2026-11-18T16:00:00.000Z'
const timeout = { timeout: 10_000 }

const id = n => '58000000-0000-4000-8000-' + String(n).padStart(12, '0')
const naga = { id: id(1), slug: 'naga', display_name: 'Naga Fixture' }
const cavite = { id: id(2), slug: 'cavite', display_name: 'Cavite Fixture' }

function staff(name, number) {
  const user = {
    id: id(number), role: 'authenticated', aud: 'authenticated', email: name + '@example.test',
    email_confirmed_at: '2025-01-01T00:00:00.000Z', app_metadata: {}, user_metadata: {}
  }
  const expires_at = Math.floor(date.valueOf() / 1000) + 86_400
  const access_token = ['{"alg":"HS256","typ":"JWT"}', JSON.stringify({ sub: user.id, exp: expires_at }), 'fixture']
    .map(part => Buffer.from(part).toString('base64url')).join('.')
  return { user, access_token, expires_at, refresh_token: 'fixture-' + name }
}
const staffA = staff('staff-a', 3)
const staffB = staff('staff-b', 4)
const dashboard = (patients, requested, confirmed) => [{
  patients, requested_appointments: requested, confirmed_appointments: confirmed
}]

function queue(branch, prefix, count, from, rowBase) {
  return Array.from({ length: count }, (_, index) => {
    const startMs = Date.parse(from) + 60_000 * index
    return {
      id: id(rowBase + index), branch_id: branch.id, pet_id: id(9000),
      owner_id: id(9001), resource_id: id(9500 + index), status: 'requested',
      concern: prefix + ' visit ' + (index + 1), starts_at: new Date(startMs).toISOString(),
      ends_at: new Date(startMs + 30 * 60_000).toISOString()
    }
  })
}

async function serveFixture() {
  const server = await createServer({
    root,
    envDir: false,
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(authOrigin),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('sb_publishable_issue58_offline'),
      'import.meta.env.VITE_PHASE5A_OPS_UI': JSON.stringify('false'),
      'import.meta.env.VITE_PHASE4_PATIENT_FORM': JSON.stringify('false')
    },
    server: { host: '127.0.0.1', port: 0, hmr: false },
    plugins: [{
      name: 'issue58-staff-branch-fixture',
      enforce: 'pre',
      resolveId(source, importer) {
        if (source === '../../ops/port' && importer === join(root, 'src/pages/staff/OpsPage.tsx')) {
          return join(root, 'tests/fixtures/staff-branch-port.ts')
        }
      },
      configureServer(vite) {
        vite.middlewares.use('/app/ops', async (_request, response, next) => {
          try {
            const html = await vite.transformIndexHtml('/app/ops', `<!doctype html><html lang="en">
              <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
              <body><div id="root"></div><script type="module" src="/tests/fixtures/staff-branch-ops.tsx"></script></body>
              </html>`)
            response.setHeader('Content-Type', 'text/html')
            response.end(html)
          } catch (error) { next(error) }
        })
      }
    }]
  })
  await server.listen()
  return { server, origin: 'http://127.0.0.1:' + server.httpServer.address().port }
}

async function fixture(browser, origin, { width = 768, theme = 'light', branches = [naga, cavite] } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 920 }, colorScheme: theme })
  const queues = []
  const countReads = []
  const unscoped = []
  const unexpected = []
  const holds = new Map()
  const state = { mode: 'ready', hold, queues, countReads }

  function hold(kind, session, branch, requestStart = '') {
    const gate = Promise.withResolvers()
    holds.set([kind, session.user.id, branch.id, requestStart].join(':'), gate)
    return gate.resolve
  }
  async function waitForRelease(kind, session, branch, requestStart = '') {
    await holds.get([kind, session.user.id, branch.id, requestStart].join(':'))?.promise
  }

  await context.addInitScript(({ authKey, session }) => {
    localStorage.setItem(authKey, JSON.stringify(session))
  }, { authKey, session: staffA })
  await context.route('**/*', async route => {
    const req = route.request()
    const url = new URL(req.url())
    if (url.origin === origin) return route.continue()
    if (url.origin !== authOrigin) {
      unexpected.push('external ' + url.origin)
      return route.abort()
    }
    const method = req.method()
    const path = url.pathname
    const send = (value, status = 200) => route.fulfill({
      status, json: value, headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': '*' }
    })
    const denied = () => send({ code: '42501', message: 'Synthetic permission denied' }, 403)
    const failed = () => send({ code: 'XX000', message: 'Synthetic staff read failed' }, 502)
    if (method === 'OPTIONS') return send({})
    const session = [staffA, staffB].find(account => req.headers().authorization === 'Bearer ' + account.access_token)
    if (!session) {
      unexpected.push('unauthenticated ' + method + ' ' + path)
      return denied()
    }
    const membership = { user_id: session.user.id, role: 'receptionist', is_active: true }
    const allowed = session === staffA ? branches : [cavite]
    switch (method + ' ' + path) {
      case 'GET /auth/v1/user':
        return send(session.user)
      case 'GET /rest/v1/staff_memberships':
      case 'GET /rest/v1/staff_branch_memberships': {
        if (url.searchParams.get('user_id') !== 'eq.' + session.user.id) {
          unexpected.push('staff membership lookup without the current account filter')
          return denied()
        }
        return send(path.endsWith('/staff_memberships')
          ? [membership] : allowed.map(branch => ({ ...membership, branch_id: branch.id })))
      }
      case 'GET /rest/v1/clinic_branches':
        return send([cavite, naga])
      case 'POST /rest/v1/rpc/assert_staff_branch':
      case 'POST /rest/v1/rpc/get_branch_dashboard_counts': {
        const body = req.postDataJSON()
        const branch = allowed.find(item => item.id === body?.p_branch)
        if (!branch || Object.keys(body).join() !== 'p_branch') {
          unexpected.push('missing or unauthorized branch in ' + path)
          return denied()
        }
        if (path.endsWith('/assert_staff_branch')) return send(branch.id)
        countReads.push({ account: session, branch })
        await waitForRelease('counts', session, branch)
        if (state.mode === 'error') return failed()
        if (state.mode === 'empty') return send(dashboard(0, 0, 0))
        return send(session === staffB ? dashboard(3, 41, 2)
          : branch === naga ? dashboard(101, 400, 11) : dashboard(202, 503, 22))
      }
      case 'GET /rest/v1/appointments': {
        const filter = url.searchParams.get('branch_id')
        const branch = allowed.find(item => filter === 'eq.' + item.id)
        if (!branch) {
          unscoped.push(filter ?? '(missing branch_id)')
          return denied()
        }
        const bounds = url.searchParams.getAll('starts_at')
        const [from, to] = bounds
        queues.push({ account: session, branch, from, to, order: url.searchParams.get('order'), limit: url.searchParams.get('limit') })
        if (!from?.startsWith('gte.') || !to?.startsWith('lt.') ||
            !url.searchParams.get('select')?.split(',').includes('branch_id')) {
          unexpected.push('queue without half-open bounds or branch identity')
          return failed()
        }
        await waitForRelease('queue', session, branch, from)
        if (state.mode === 'denied') return denied()
        if (state.mode === 'error') return failed()
        if (state.mode === 'empty') return send([])
        const boundsStart = from.slice(4)
        return send(session === staffB ? queue(cavite, 'Staff B Cavite', 1, boundsStart, 5000)
          : branch === naga ? queue(naga, 'Naga', 250, boundsStart, 1000)
            : queue(cavite, 'Cavite', 251, boundsStart, 2000))
      }
      default:
        if ((path.endsWith('/appointments') || path.endsWith('/pets')) && method === 'HEAD') unscoped.push(method + ' ' + path)
        else unexpected.push(method + ' ' + path)
        return denied()
    }
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.setDefaultTimeout(timeout.timeout)
  await page.clock.setFixedTime(date)
  return {
    page, state, open: () => page.goto(origin + '/app/ops'),
    async done() {
      for (const gate of holds.values()) gate.resolve()
      await context.close()
      assert.deepEqual(unscoped, [], 'no unscoped queue or dashboard count fallback')
      assert.deepEqual(unexpected, [], 'only expected scoped reads and local assets')
      assert.deepEqual(errors, [], 'no uncaught page errors')
    }
  }
}

const picker = page => page.getByRole('combobox', { name: /^Clinic branch/ })
const cards = page => page.locator('.ops-visit')
const kpi = (page, label) => page.locator('.ops-kpi')
  .filter({ has: page.getByText(label, { exact: true }) }).locator('.ops-kpi-value')

async function expectKpi(page, label, value) {
  await kpi(page, label).getByText(value, { exact: true }).first().waitFor({ state: 'attached' })
}

async function cleared(page, markers) {
  assert.equal(await cards(page).count(), 0)
  for (const marker of markers) {
    assert.equal(await page.getByText(marker, { exact: true }).count(), 0, 'stale ' + marker)
  }
}

async function checkedQueue(page, prefix, rendered, incomplete) {
  await page.getByText(prefix + ' visit ' + rendered, { exact: true }).waitFor()
  assert.equal(await cards(page).count(), rendered)
  const notice = page.getByText('Incomplete: more than 250 appointments matched')
  assert.equal(await notice.count(), Number(incomplete))
  assert.equal(await page.getByText(prefix + ' visit ' + (rendered + 1), { exact: true }).count(), 0)
  await expectKpi(page, 'Appointments in view', incomplete ? 'at least ' + rendered : String(rendered))
}

function settledFrame(page) {
  return page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}

async function switchAccount(page) {
  await page.evaluate(({ authKey, session }) => {
    localStorage.setItem(authKey, JSON.stringify(session))
    const channel = new BroadcastChannel(authKey)
    channel.postMessage({ event: 'SIGNED_IN', session })
    channel.close()
  }, { authKey, session: staffB })
}

test('Issue #58 Operations selector and typed readers in Chromium', async t => {
  const { server, origin } = await serveFixture()
  t.after(() => server.close())
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN })
  t.after(() => browser.close())

  await t.test('keeps queue and counts scoped across branch changes and distinguishes 250 from 251', async () => {
    const viewports = [360, 768, 1440].flatMap(width => ['light', 'dark'].map(theme => ({ width, theme })))
    for (const { width, theme } of viewports) {
      const { page, state, open, done } = await fixture(browser, origin, { width, theme })
      try {
        await open()
        await page.getByRole('heading', { name: 'Choose a clinic branch' }).waitFor()
        assert.equal(await cards(page).count(), 0)
        assert.deepEqual(state.queues, [])
        assert.deepEqual(state.countReads, [])

        await picker(page).focus()
        // The real picker lists Cavite first by name, then Naga.
        await page.keyboard.press('End')
        assert.equal(await picker(page).inputValue(), naga.id)
        assert.equal(await picker(page).evaluate(select =>
          select.matches(':focus-visible') && getComputedStyle(select).outlineStyle === 'solid'), true)
        await checkedQueue(page, 'Naga', 250, false)
        await expectKpi(page, 'Registered patients', '101')
        await expectKpi(page, 'Requested (all dates)', '400')
        await expectKpi(page, 'Confirmed (all dates)', '11')
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
        assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme), theme)

        const releaseCaviteRows = state.hold('queue', staffA, cavite, start)
        const releaseCaviteCounts = state.hold('counts', staffA, cavite)
        await picker(page).selectOption(cavite.id)
        await page.getByRole('status').filter({ hasText: /Loading appointments/ }).waitFor()
        await cleared(page, ['Naga visit 1', '101', '400', '11'])
        releaseCaviteRows()
        releaseCaviteCounts()
        await checkedQueue(page, 'Cavite', 250, true)
        await expectKpi(page, 'Registered patients', '202')
        await expectKpi(page, 'Requested (all dates)', '503')
        await expectKpi(page, 'Confirmed (all dates)', '22')
        assert.equal(await page.getByText('Naga visit 1', { exact: true }).count(), 0)

        assert.deepEqual(state.queues.map(read => [read.account.user.id, read.branch.id, read.from, read.to, read.order, read.limit]), [
          [staffA.user.id, naga.id, start, end, 'starts_at.asc,id.asc', '251'],
          [staffA.user.id, cavite.id, start, end, 'starts_at.asc,id.asc', '251']
        ])
        assert.deepEqual(state.countReads.map(read => [read.account.user.id, read.branch.id]), [
          [staffA.user.id, naga.id], [staffA.user.id, cavite.id]
        ])

        if (width === 1440 && theme === 'dark') {
          const releaseNaga = state.hold('queue', staffA, naga, start)
          const nagaRequest = request => {
            const url = new URL(request.url())
            return url.pathname === '/rest/v1/appointments' && url.searchParams.get('branch_id') === 'eq.' + naga.id
          }
          await Promise.all([page.waitForRequest(nagaRequest), picker(page).selectOption(naga.id)])
          await picker(page).selectOption(cavite.id)
          await checkedQueue(page, 'Cavite', 250, true)
          const lateResponse = page.waitForResponse(response => nagaRequest(response.request()))
          releaseNaga()
          await lateResponse
          await settledFrame(page)
          await checkedQueue(page, 'Cavite', 250, true)
          assert.equal(await page.getByText('Naga visit 1', { exact: true }).count(), 0)
          await expectKpi(page, 'Requested (all dates)', '503')
        }
      } finally { await done() }
    }
  })

  await t.test('distinguishes successful empty reads, denied reads and errors with retry', async () => {
    const { page, state, open, done } = await fixture(browser, origin, { branches: [naga] })
    try {
      state.mode = 'empty'
      await open()
      await page.getByRole('heading', { name: 'No appointments in this window' }).waitFor()
      await expectKpi(page, 'Appointments in view', '0')
      await expectKpi(page, 'Requested (all dates)', '0')

      state.mode = 'error'
      await page.reload()
      await page.getByRole('heading', { name: 'The clinic data could not be loaded' }).waitFor()
      await expectKpi(page, 'Appointments in view', 'Not available')
      await expectKpi(page, 'Requested (all dates)', 'Not available')
      assert.equal(await page.getByRole('heading', { name: 'No appointments in this window' }).count(), 0)
      state.mode = 'ready'
      await page.getByRole('alert').filter({ hasText: 'The clinic data could not be loaded' })
        .getByRole('button', { name: 'Retry' }).press('Enter')
      await checkedQueue(page, 'Naga', 250, false)

      state.mode = 'denied'
      await page.getByRole('button', { name: 'Next day' }).press('Enter')
      await page.getByRole('heading', { name: 'Clinic staff access required' }).waitFor()
      await cleared(page, ['Naga visit 1', '400', 'No appointments in this window'])
      assert.equal(await page.getByRole('heading', { name: 'At a glance' }).count(), 0)
    } finally { await done() }
  })

  await t.test('clears old staff data and discards a delayed response after an account change', async () => {
    for (const inFlight of [false, true]) {
      const { page, state, open, done } = await fixture(browser, origin)
      try {
        await open()
        await picker(page).selectOption(naga.id)
        await checkedQueue(page, 'Naga', 250, false)
        await expectKpi(page, 'Requested (all dates)', '400')

        const oldRequest = request => request.url().includes('/rest/v1/appointments') &&
          new URL(request.url()).searchParams.get('starts_at') === nextStart
        const releaseOld = inFlight ? state.hold('queue', staffA, naga, nextStart) : null
        if (releaseOld) {
          await Promise.all([
            page.waitForRequest(oldRequest),
            page.getByRole('button', { name: 'Next day' }).press('Enter')
          ])
        }

        const releaseNewRows = state.hold('queue', staffB, cavite, start)
        const releaseNewCounts = state.hold('counts', staffB, cavite)
        await switchAccount(page)
        await page.getByRole('status').filter({ hasText: /Loading appointments/ }).waitFor()
        await cleared(page, ['Naga visit 1', '400'])
        await page.getByRole('group', { name: 'Branch selection' }).getByText('Cavite Fixture').waitFor()
        assert.equal(await picker(page).count(), 0, 'new account has only its Cavite branch')
        releaseNewRows()
        releaseNewCounts()
        await checkedQueue(page, 'Staff B Cavite', 1, false)
        await expectKpi(page, 'Requested (all dates)', '41')

        if (releaseOld) {
          const oldResponse = page.waitForResponse(response => oldRequest(response.request()))
          releaseOld()
          await oldResponse
          await settledFrame(page)
          assert.equal(await page.getByText('Naga visit 1', { exact: true }).count(), 0)
          assert.equal(await page.getByText('400', { exact: true }).count(), 0)
          await checkedQueue(page, 'Staff B Cavite', 1, false)
        }
        assert.deepEqual(state.queues.filter(read => read.account === staffB).map(read => read.branch.id), [cavite.id])
      } finally { await done() }
    }
  })
})
