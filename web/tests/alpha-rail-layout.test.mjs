import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const css=readFileSync(new URL('../src/alpha/alpha.css',import.meta.url),'utf8')
function rule(selector,from=css){
 const escaped=selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
 const match=from.match(new RegExp(escaped+'\\s*\\{([^}]+)\\}'))
 assert.ok(match,`CSS rule ${selector} must exist`)
 return match[1]
}
test('desktop alpha navigation rail is fixed to the viewport, without an independent scrollbar',()=>{
 const r=rule('.alpha-rail')
 assert.match(r,/position:\\s*fixed;/)
 assert.match(r,/top:\\s*34px;/)
 assert.match(r,/bottom:\\s*0;/)
 assert.match(r,/width:\\s*84px;/)
 assert.doesNotMatch(r,/overflow(?:-[xy])?:\\s*(?:auto|scroll)/)
 assert.match(rule('.alpha-main'),/grid-column:\\s*2;/)
})
test('mobile nav remains fixed at bottom and main content occupies the one-column layout',()=>{
 const mobile=css.slice(css.indexOf('@media (max-width: 900px)'))
 assert.ok(mobile.length<css.length)
 assert.match(rule('.alpha-rail',mobile),/position:\\s*fixed;/)
 assert.match(rule('.alpha-rail',mobile),/bottom:\\s*0;/)
 assert.match(rule('.alpha-main',mobile),/grid-column:\\s*1;/)
})
