import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
const block = (re) => { const m = css.match(re); assert.ok(m, `missing block ${re}`); return m[1] }
const tokens = (body) => Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map(m => [m[1], m[2].toLowerCase()]))
const light = tokens(block(/\n:root \{([^}]*)\}/))
const dark = { ...light, ...tokens(block(/:root\[data-theme="dark"\] \{([^}]*)\}/)) }
const osDark = { ...light, ...tokens(block(/:root:not\(\[data-theme\]\) \{([^}]*)\}/)) }

const lum = (hex) => { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2] }
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05) }

const text = [ // [foreground, background]
  ['text', 'bg'], ['text', 'surface'], ['text', 'surface-2'], ['muted', 'bg'], ['muted', 'surface'], ['muted', 'surface-2'], ['muted', 'surface-3'],
  ['primary-text', 'surface'], ['primary-text', 'bg'], ['primary-text', 'primary-soft'], ['on-primary', 'primary'], ['on-primary', 'primary-hover'],
  ['danger', 'danger-soft'], ['danger', 'surface'], ['success', 'success-soft'], ['success', 'surface'], ['warning', 'warning-soft'], ['info', 'info-soft'],
  ['side-text', 'side-bg'], ['side-muted', 'side-bg'], ['side-text', 'side-hover'], ['side-muted', 'side-hover'], ['side-active-text', 'side-active'],
]
const nonText = [['focus', 'bg'], ['focus', 'surface'], ['border-strong', 'surface'], ['border-strong', 'bg'], ['side-ring', 'side-bg'], ['primary', 'surface']]

for (const [name, t] of [['light', light], ['dark', dark]]) {
  test(`${name}: text pairs meet WCAG AA 4.5:1`, () => {
    for (const [f, b] of text) assert.ok(ratio(t[f], t[b]) >= 4.5, `${name} ${f} on ${b} = ${ratio(t[f], t[b]).toFixed(2)}`)
  })
  test(`${name}: focus ring, input borders and primary control meet 3:1`, () => {
    for (const [f, b] of nonText) assert.ok(ratio(t[f], t[b]) >= 3, `${name} ${f} on ${b} = ${ratio(t[f], t[b]).toFixed(2)}`)
  })
}
test('OS-preference dark fallback mirrors explicit dark theme', () => {
  const keys = Object.keys(tokens(block(/:root:not\(\[data-theme\]\) \{([^}]*)\}/)))
  for (const k of keys) assert.equal(osDark[k], dark[k], `fallback --${k} differs from data-theme=dark`)
  const explicit = Object.keys(tokens(block(/:root\[data-theme="dark"\] \{([^}]*)\}/)))
  for (const k of explicit) assert.ok(keys.includes(k), `fallback is missing --${k}`)
})
test('theme init is an external script (CSP forbids inline) and storage failure is handled', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  assert.match(html, /<script src="\/theme-init\.js"><\/script>/)
  assert.doesNotMatch(html, /<script(?![^>]*src=)[^>]*>/)
  const js = readFileSync(new URL('../public/theme-init.js', import.meta.url), 'utf8')
  assert.match(js, /try\s*\{/); assert.match(js, /catch/)
})
test('no generic medical cross is used as the clinic mark', () => {
  for (const f of ['components/Layout.tsx', 'pages/PetsPage.tsx', 'pages/AuthPages.tsx']) assert.ok(!readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8').includes('✚'), f)
})
test('owner logo assets are committed, square and wired into the Brand component', async () => {
  const { statSync } = await import('node:fs')
  for (const f of ['dawney-logo.webp', 'dawney-logo-original.png']) assert.ok(statSync(new URL(`../public/brand/${f}`, import.meta.url)).size > 1000, f)
  const png = readFileSync(new URL('../public/brand/dawney-logo-original.png', import.meta.url))
  assert.equal(png.readUInt32BE(16), png.readUInt32BE(20), 'PNG must stay 1:1')
  const layout = readFileSync(new URL('../src/components/Layout.tsx', import.meta.url), 'utf8')
  assert.match(layout, /dawney-logo\.webp/); assert.match(layout, /alt="Dawney Animal Clinic"/)
})
