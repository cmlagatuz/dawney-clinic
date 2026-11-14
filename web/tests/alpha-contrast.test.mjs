import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/alpha/alpha.css', import.meta.url), 'utf8')
const base = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
const tok = body => Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map(m => [m[1], m[2].toLowerCase()]))
const grab = (src, re) => { const m = src.match(re); assert.ok(m, String(re)); return tok(m[1]) }
const baseLight = grab(base, /\n:root \{([^}]*)\}/), baseDark = { ...baseLight, ...grab(base, /:root\[data-theme="dark"\] \{([^}]*)\}/) }
const aLight = { ...baseLight, ...grab(css, /\n\.alpha \{([^}]*)\}/) }
const aDark = { ...baseDark, ...grab(css, /:root\[data-theme="dark"\] \.alpha \{([^}]*)\}/) }
const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2] }
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05) }

const text = [
  ['a-rail-text', 'a-rail'], ['a-rail-text', 'a-rail-hover'], ['a-rail-text', 'a-rail-active'], ['a-rail-muted', 'a-rail'],
  ['a-banner-text', 'a-banner'], ['a-on-accent', 'a-accent'], ['text', 'a-canvas'], ['muted', 'a-canvas'], ['a-accent', 'a-canvas'], ['text', 'a-accent-soft'], ['a-accent', 'surface'],
  ['text', 't1-soft'], ['text', 't2-soft'], ['text', 't3-soft'], ['muted', 'surface-2'],
]
const nonText = [['a-rail-ring', 'a-rail'], ['t1', 'surface'], ['t2', 'surface'], ['t3', 'surface'], ['a-accent', 'surface']]
for (const [name, t] of [['light', aLight], ['dark', aDark]]) {
  test(`alpha ${name}: text pairs ≥ 4.5:1`, () => { for (const [f, b] of text) assert.ok(ratio(t[f], t[b]) >= 4.5, `${name} ${f} on ${b} = ${ratio(t[f], t[b]).toFixed(2)}`) })
  test(`alpha ${name}: borders/swatches ≥ 3:1`, () => { for (const [f, b] of nonText) assert.ok(ratio(t[f], t[b]) >= 3, `${name} ${f} on ${b} = ${ratio(t[f], t[b]).toFixed(2)}`) })
}
