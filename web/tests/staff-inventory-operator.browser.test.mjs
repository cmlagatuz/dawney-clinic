// CLOUD: real localhost Vite+Chromium; synthetic intercepted HTTP only.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {fileURLToPath} from 'node:url'
import {withChromium} from '../../scripts/browser/cdp.mjs'
import {releaseClinicFixture} from './fixtures/release-clinic-http.mjs'
const root=fileURLToPath(new URL('../',import.meta.url))
async function withOperatorBrowser(fn){
 process.env.VITE_SUPABASE_URL='https://issue51-fixtures.supabase.co'
 process.env.VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_issue51_offline'
 process.env.VITE_PHASE5B_PHARMACY_UI='false'
 const vite=await createServer({root,server:{host:'127.0.0.1',port:0,strictPort:false},logLevel:'error'})
 try{
  await vite.listen()
  const origin='http://127.0.0.1:'+vite.httpServer.address().port
  await withChromium(async browser=>{
   await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:'('+releaseClinicFixture.toString()+')()'})
   await fn(browser,origin)
  })
 }finally{await vite.close()}
}
const snapshot=b=>b.value('({heading:document.querySelector("#main-content h1")?.textContent,body:document.querySelector("#main-content")?.textContent,disabled:[...document.querySelectorAll("#main-content button")].filter(b=>b.textContent.includes("unavailable")).every(b=>b.disabled),overflow:document.documentElement.scrollWidth>innerWidth,mutations:window.__cloudIntegrated?.directWrites||[],unexpected:window.__cloudIntegrated?.unexpected||[]})')
test('verified signup/verification and pending staff status never grant staff privileges',{timeout:180000},async()=>withOperatorBrowser(async(browser,origin)=>{
 await browser.goto(origin+'/auth/signup?actor=owner')
 await browser.until('document.querySelector("#auth-title")?.textContent==="Create an account"',12000)
 assert.equal(await browser.value('!!document.querySelector("input[type=email]")'),true)
 assert.equal(await browser.value('!!document.querySelector("[name=role], [name=staff_role]")'),false)
 await browser.goto(origin+'/auth/verify?actor=owner')
 await browser.until('document.querySelector("#auth-title")?.textContent==="Verify your email"',12000)
 await browser.goto(origin+'/app/staff-access?actor=owner')
 await browser.until('!!document.querySelector("#request-heading")',12000)
 const pending=await snapshot(browser)
 assert.match(pending.body,/No approved staff access/)
 assert.match(pending.body,/request reader is not yet implemented/i)
 assert.equal(pending.disabled,true)
 assert.deepEqual(pending.mutations,[])
 await browser.goto(origin+'/app/staff-management?actor=owner')
 await browser.until('document.querySelector("#main-content")?.textContent.includes("Administrator approval required")',12000)
 assert.equal(await browser.value('!!document.querySelector("#pending-heading")'),false)
}))
test('administrator preview, receptionist/doctor/accountant denial and revocation are fail-closed',{timeout:200000},async()=>withOperatorBrowser(async(browser,origin)=>{
 await browser.goto(origin+'/app/staff-management?actor=staff&case=administrator')
 await browser.until('!!document.querySelector("#pending-heading")',12000)
 let data=await snapshot(browser)
 assert.match(data.body,/Request list unavailable/i)
 assert.equal(data.disabled,true)
 assert.deepEqual(data.mutations,[])
 await browser.goto(origin+'/app/staff-management?actor=staff&case=receptionist')
 await browser.until('document.querySelector("#main-content")?.textContent.includes("Administrator approval required")',12000)
 assert.equal(await browser.value('!!document.querySelector("#pending-heading")'),false)
 await browser.goto(origin+'/app/staff-access?actor=owner')
 await browser.until('!!document.querySelector("#request-heading")',12000)
 assert.equal(await browser.value('!!document.querySelector("select option[value=accountant]")'),true)
 for(const scenario of ['normal','revoked','denied']){
  await browser.goto(origin+'/app/inventory?actor=staff&case='+scenario)
  await browser.until('!!document.querySelector("#main-content [role=alert]")',12000)
  assert.equal(await browser.value('!!document.querySelector("#receive-heading")'),false)
 }
 await browser.goto(origin+'/app/inventory?actor=owner')
 await browser.until('!!document.querySelector("#main-content [role=alert]")',12000)
 assert.equal(await browser.value('!!document.querySelector("#receive-heading")'),false)
 assert.deepEqual((await snapshot(browser)).mutations,[])
}))
test('receptionist draft/receipt validation, no writes, responsive/dark, keyboard and refresh',{timeout:220000},async()=>withOperatorBrowser(async(browser,origin)=>{
 for(const width of [360,768,1440]){
  await browser.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false})
  for(const theme of ['light','dark']){
   await browser.goto(origin+'/app/inventory?actor=staff&case=receptionist&theme='+theme)
   await browser.until('!!document.querySelector("#receive-heading")',12000)
   const data=await snapshot(browser)
   assert.match(data.heading,/Inventory management/)
   assert.equal(data.overflow,false,'horizontal overflow '+width+'/'+theme)
   assert.equal(data.disabled,true)
   assert.deepEqual(data.mutations,[])
   assert.deepEqual(data.unexpected,[])
   assert.equal(await browser.value('document.documentElement.getAttribute("data-theme")'),theme)
  }
 }
 await browser.goto(origin+'/app/inventory?actor=staff&case=receptionist')
 await browser.until('!!document.querySelector("#receive-heading")',12000)
 await browser.value('document.querySelector("button[type=submit]").click();true')
 await browser.until('document.querySelector("#main-content")?.textContent.includes("Correct the highlighted item fields")',12000)
 assert.equal(await browser.value('[...document.querySelectorAll("#main-content button")].filter(b=>/Add Item · unavailable|Receive Stock · unavailable|Edit stock · unavailable/.test(b.textContent)).every(b=>b.disabled)'),true)
 await browser.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9})
 await browser.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9})
 await browser.value('document.querySelector("#operator-branch").focus();true')
 assert.equal(await browser.value('document.activeElement===document.querySelector("#operator-branch")&&document.activeElement.matches(":focus-visible")'),true)
 await browser.send('Page.reload',{ignoreCache:true})
 await browser.until('!!document.querySelector("#receive-heading")',12000)
 assert.deepEqual((await snapshot(browser)).mutations,[])
 await browser.goto(origin+'/app/inventory?actor=owner')
 await browser.until('document.querySelector("#main-content")?.textContent.includes("Inventory operations denied")',12000)
 assert.equal(await browser.value('!!document.querySelector("#receive-heading")'),false)
}))
