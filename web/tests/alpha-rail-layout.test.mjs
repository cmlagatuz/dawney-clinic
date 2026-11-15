import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/alpha/alpha.css', import.meta.url), 'utf8')
const tsx = readFileSync(new URL('../src/alpha/AlphaApp.tsx', import.meta.url), 'utf8')
function rule(selector, from = css) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = from.match(new RegExp('(?:^|\\n)[ \\t]*' + escaped + '\\s*\\{([^}]+)\\}'))
  assert.ok(m, `CSS rule ${selector} must exist`)
  return m[1]
}
const mobile = css.slice(css.indexOf('@media (max-width: 900px)'))

/*
 * Structural guard for the app-shell layout. The real scrolling behaviour (banner, header and rail do not move while the
 * workspace scrolls) is verified in Chromium — see docs/alpha-preview/README.md; CSS text alone cannot prove it, so these
 * assertions pin the properties that make it true and forbid the hardcoded offsets that broke when the banner wrapped.
 */
test('page never scrolls: .alpha is one viewport-high flex column with hidden overflow', () => {
  const r = rule('.alpha')
  assert.match(r, /height:\s*100dvh;/); assert.match(r, /display:\s*flex;/); assert.match(r, /flex-direction:\s*column;/); assert.match(r, /overflow:\s*hidden;/)
})
test('banner and header are non-shrinking flow items (no hardcoded offsets)', () => {
  assert.match(rule('.alpha-banner'), /flex:\s*none;/)
  assert.match(rule('.alpha-head'), /flex:\s*none;/)
  assert.doesNotMatch(css, /top:\s*34px|calc\(100dvh\s*-\s*34px\)|bottom:\s*5\.5rem|padding-bottom:\s*6\.5rem/, 'no magic banner/nav heights')
  assert.doesNotMatch(rule('.alpha-banner'), /position:\s*(sticky|fixed)/)
  assert.doesNotMatch(rule('.alpha-head'), /position:\s*(sticky|fixed)/)
})
test('exactly one internal scroll region carries the workspace; the rail never scrolls', () => {
  const s = rule('.alpha-scroll'); assert.match(s, /overflow-y:\s*auto;/); assert.match(s, /min-height:\s*0;/); assert.match(s, /flex:\s*1 1 auto;/)
  assert.match(rule('.alpha-shell'), /min-height:\s*0;/); assert.match(rule('.alpha-main'), /min-height:\s*0;/)
  assert.doesNotMatch(rule('.alpha-rail'), /overflow(?:-[xy])?:\s*(?:auto|scroll)/)
  assert.doesNotMatch(rule('.alpha-rail'), /position:\s*(fixed|sticky)/, 'rail is a grid/flex sibling, not offset-positioned')
  assert.match(rule('.alpha-shell'), /grid-template-columns:\s*84px/)
})
test('mobile: bottom nav is the last flex row beneath the scroll region (never overlays content)', () => {
  assert.match(rule('.alpha-shell', mobile), /flex-direction:\s*column;/)
  assert.match(rule('.alpha-rail', mobile), /order:\s*2;/); assert.match(rule('.alpha-main', mobile), /order:\s*1;/)
  assert.doesNotMatch(rule('.alpha-rail', mobile), /position:\s*fixed/)
})
test('component wiring: header sits outside the scroll region; toast lives inside <main> (no viewport offsets)', () => {
  const head = tsx.indexOf('className="alpha-head"'), scroll = tsx.indexOf('className="alpha-scroll"'), toast = tsx.indexOf('className="a-toast-region"'), end = tsx.lastIndexOf('</main>')
  assert.ok(head > 0 && scroll > head, 'header precedes (is a sibling of) the scroll region')
  assert.ok(tsx.slice(head, scroll).includes('</header>'), 'header closed before the scroll region')
  assert.ok(toast > scroll && toast < end, 'toast region inside main')
  assert.match(tsx, /role="region"[^>]*tabIndex=\{0\}|tabIndex=\{0\}[^>]*role="region"/, 'scroll region is keyboard focusable and labelled')
})
