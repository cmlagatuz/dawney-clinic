// CLOUD public-route acceptance: disposable browser + intercepted synthetic HTTP.
// No clinic account, clinical writes, screenshots or external network requests.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import { withChromium } from '../../scripts/browser/cdp.mjs'

function syntheticPublicSession() {
  const remote = 'https://issue51-fixtures.supabase.co'
  const uuid = n => '10000000-0000-4000-8000-' + String(n).padStart(12, '0')
  const naga = uuid(1)
  const theme = new URL(location.href).searchParams.get('theme') === 'dark' ? 'dark' : 'light'
  const failure = new URL(location.href).searchParams.get('case') === 'failure'
  localStorage.setItem('dawney-theme', theme)
  window.__cloudAcceptance = { writes: [], unexpected: [], failures: 0 }
  const original = window.fetch.bind(window)
  const reply = (value, status = 200) => new Response(JSON.stringify(value), {
    status, headers: { 'content-type': 'application/json' }
  })
  window.fetch = async (input, init) => {
    const request = new Request(input, init)
    const url = new URL(request.url)
    if (url.origin === location.origin) return original(input, init)
    if (url.origin !== remote) {
      window.__cloudAcceptance.unexpected.push('external origin')
      throw Error('Blocked non-fixture origin')
    }
    if (request.method !== 'GET') {
      window.__cloudAcceptance.writes.push(request.method)
      return reply({ message: 'Synthetic reads only' }, 403)
    }
    if (url.pathname === '/auth/v1/user') return reply({ message: 'No synthetic session' }, 401)
    if (url.pathname === '/rest/v1/clinic_branches') {
      const id = url.searchParams.get('id')?.replace(/^eq\./, '')
      if (id) return reply(id === naga ? [{ id: naga, booking_enabled: true }] : []) // policy remains unapproved
      return reply([
        { id: naga, slug: 'naga', display_name: 'Synthetic Naga' },
        { id: uuid(3), slug: 'cavite', display_name: 'Synthetic Cavite' }
      ])
    }
    if (url.pathname === '/rest/v1/branch_booking_policies') {
      if (failure && window.__cloudAcceptance.failures++ === 0) {
        return reply({ code: '08006', message: 'Synthetic policy read failure' }, 503)
      }
      return reply([]) // No owner-approved booking policy. Never fabricate slots.
    }
    window.__cloudAcceptance.unexpected.push(url.pathname)
    return reply({ message: 'Unimplemented synthetic endpoint' }, 404)
  }
}

test('CLOUD: public routes, Naga/Cavite, two themes and three widths, fail closed', { timeout: 180000 }, async () => {
  process.env.VITE_SUPABASE_URL = 'https://issue51-fixtures.supabase.co'
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_issue51_offline'
  const root = fileURLToPath(new URL('../', import.meta.url))
  const vite = await createServer({ root, server: { host: '127.0.0.1', port: 0, strictPort: false } })
  try {
    await vite.listen()
    const origin = 'http://127.0.0.1:' + vite.httpServer.address().port
    await withChromium(async browser => {
      await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: '(' + syntheticPublicSession.toString() + ')()' })
      const paths = ['/', '/services', '/location', '/book']
      for (const width of [360, 768, 1440]) {
        await browser.send('Emulation.setDeviceMetricsOverride', {
          width, height: 900, deviceScaleFactor: 1, mobile: false
        })
        for (const theme of ['light', 'dark']) {
          for (const path of paths) {
            await browser.goto(origin + path + '?theme=' + theme)
            await browser.until('!!document.querySelector("#main-content h1")')
            if (path === '/book' || path === '/services') {
              await browser.until('!document.querySelector("#main-content [role=status]")?.textContent.includes("Checking clinic booking")')
            }
            const actual = await browser.value('({width: innerWidth, theme: document.documentElement.getAttribute("data-theme"), overflow: document.documentElement.scrollWidth > innerWidth, heading: document.querySelector("#main-content h1")?.textContent.trim(), links: [...document.querySelectorAll("a[target=_blank]")].every(a => a.rel.includes("noopener") && a.rel.includes("noreferrer") && a.href.startsWith("https://")), writes: window.__cloudAcceptance.writes, unexpected: window.__cloudAcceptance.unexpected, forms: document.querySelectorAll("#main-content form").length, slots: document.querySelectorAll("input[name=slot]").length, branches: document.querySelectorAll(".branch-directory .branch-card").length, categories: document.querySelectorAll("#cat-heading + ul > li").length })')
            assert.equal(actual.width, width, path + ' viewport')
            assert.equal(actual.theme, theme, path + ' theme')
            assert.equal(actual.overflow, false, path + ' overflow at ' + width + '/' + theme)
            assert.ok(actual.heading, path + ' must have a primary heading')
            assert.equal(actual.links, true, path + ' safe external links')
            assert.deepEqual(actual.writes, [], 'no clinical writes')
            assert.deepEqual(actual.unexpected, [], 'no third-party requests')
            if (path === '/services') assert.equal(actual.categories, 8, 'eight informational Naga categories')
            if (path === '/location') assert.equal(actual.branches, 2, 'Naga plus contact-only Cavite')
            if (path === '/book') {
              assert.equal(actual.forms, 0, 'no booking form without approved policy')
              assert.equal(actual.slots, 0, 'no fabricated slots')
            }
          }
        }
      }

      // P1 regression: the mobile menu is BEFORE the toggle in DOM order.
      // Moving focus to its first link is required when opened with the keyboard.
      await browser.send('Emulation.setDeviceMetricsOverride', {
        width: 360, height: 900, deviceScaleFactor: 1, mobile: false
      })
      await browser.goto(origin + '/?theme=dark')
      await browser.until('!!document.querySelector("button.site-menu")')
      await browser.value('document.querySelector("button.site-menu").focus(); true')
      assert.equal(await browser.value('document.activeElement === document.querySelector("button.site-menu")'),
        true, 'mobile menu toggle receives keyboard focus')
      // CDP keyDown without the Enter text produces trusted keydown/keyup but
      // no keypress/native button click in headless Chromium. Send the actual
      // carriage return so the browser (not a synthetic DOM click) activates it.
      await browser.send('Input.dispatchKeyEvent', {
        type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13,
        text: '\r', unmodifiedText: '\r'
      })
      await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
      await browser.until('document.querySelector("#site-nav").classList.contains("is-open")')
      await browser.until('document.activeElement === document.querySelector("#site-nav a")', 3500)
      assert.equal(await browser.value('document.activeElement.matches(":focus-visible")'), true, 'open menu link has visible keyboard focus')
      await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
      await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
      await browser.until('document.querySelector("button.site-menu") === document.activeElement')
      assert.equal(await browser.value('document.querySelector("#site-nav").classList.contains("is-open")'), false, 'Escape closes menu')

      // Backend outage is distinguishable from a deliberately unapproved
      // service policy; pressing Try again must never submit any request.
      await browser.goto(origin + '/book?case=failure&theme=light')
      await browser.until('!!document.querySelector("#main-content [role=alert] button")')
      assert.equal(await browser.value('document.querySelector("#main-content form") === null'), true)
      await browser.value('document.querySelector("#main-content [role=alert] button").click(); true')
      await browser.until('document.querySelector("#main-content [role=status]")?.textContent.includes("not open yet")')
      assert.deepEqual(await browser.value('window.__cloudAcceptance.writes'), [], 'retry is read-only')
    })
  } finally {
    await vite.close()
  }
})
