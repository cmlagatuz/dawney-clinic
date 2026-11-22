// CLOUD: one real-browser release bridge over the actual production routes.
// All provider HTTP intercepted by the inherited synthetic PR114 fixture.
// No live identities, stock writes, payments or delivered messages.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {fileURLToPath} from 'node:url'
import {withChromium} from '../../scripts/browser/cdp.mjs'
import {releaseClinicFixture} from './fixtures/release-clinic-http.mjs'
const root=fileURLToPath(new URL('../',import.meta.url))

async function clinicBrowser(action){
 process.env.VITE_SUPABASE_URL='https://issue51-fixtures.supabase.co'
 process.env.VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_issue51_offline'
 process.env.VITE_PHASE5A_OPS_UI='true'
 process.env.VITE_CLINICAL_WORKSPACE_UI='true'
 process.env.VITE_PHASE5B_PHARMACY_UI='true'
 process.env.VITE_PHASE5C_BILLING_UI='true'
 process.env.VITE_PHASE4_PATIENT_FORM='false'
 const vite=await createServer({root,server:{host:'127.0.0.1',port:0,strictPort:false},logLevel:'error'})
 try{
  await vite.listen()
  const origin='http://127.0.0.1:'+vite.httpServer.address().port
  await withChromium(async browser=>{
   await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:'('+releaseClinicFixture.toString()+')()'})
   await action(browser,origin)
  })
 }finally{await vite.close()}
}
const status=async b=>b.value('({head:document.querySelector("#main-content h1")?.textContent?.trim(),theme:document.documentElement.getAttribute("data-theme"),overflow:document.documentElement.scrollWidth>innerWidth,links:[...document.querySelectorAll("a")].map(a=>a.getAttribute("href")).filter(Boolean),unexpected:window.__cloudIntegrated?.unexpected||[],mutations:window.__cloudIntegrated?.directWrites||[],requests:window.__cloudIntegrated?.rpcs?.length||0,forms:document.querySelectorAll("#main-content form").length})')

test('CLOUD release bridge: six widths/themes, authorized branch module navigation and no message sends', {timeout:220000},async()=>{
 await clinicBrowser(async(browser,origin)=>{
  for(const width of [360,768,1440]){
   await browser.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false})
   for(const theme of ['light','dark']){
    await browser.goto(origin+'/app/clinic?actor=staff&case=administrator&theme='+theme)
    await browser.until('document.querySelectorAll(".clinic-release-module").length===5',11000)
    const s=await status(browser)
    assert.match(s.head,/Clinic workflow/)
    assert.equal(s.theme,theme)
    assert.equal(s.overflow,false,'hub horizontal overflow '+width+'/'+theme)
    for(const path of ['/app/ops','/app/clinical','/app/pharmacy','/app/billing','/app/communications'])
     assert.ok(s.links.includes(path),'staff module link '+path)
    assert.deepEqual(s.unexpected,[])
    assert.deepEqual(s.mutations,[])
    assert.equal(s.requests,0)
    await browser.goto(origin+'/app/communications?actor=staff&case=administrator&theme='+theme)
    await browser.until('!!document.querySelector(".clinic-communications-blocked")',11000)
    const c=await browser.value('({buttons:[...document.querySelectorAll(".clinic-communications-blocked button")].map(b=>b.disabled),forms:document.querySelectorAll("#main-content form").length,text:document.querySelector(".clinic-communications-blocked")?.textContent,overflow:document.documentElement.scrollWidth>innerWidth})')
    assert.deepEqual(c.buttons,[true,true,true])
    assert.equal(c.forms,0)
    assert.match(c.text,/no communications loaded/i)
    assert.equal(c.overflow,false,'communication overflow '+width+'/'+theme)
    assert.deepEqual((await status(browser)).mutations,[])
   }
  }
  await browser.send('Emulation.setDeviceMetricsOverride',{width:360,height:900,deviceScaleFactor:1,mobile:false})
  await browser.goto(origin+'/app/clinic?actor=staff&case=administrator&theme=dark')
  await browser.until('!!document.querySelector(".clinic-release-modules a")',10000)
  await browser.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9})
  await browser.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9})
  const focused=await browser.value('({tag:document.activeElement?.tagName,visible:document.activeElement?.matches(":focus-visible")})')
  assert.ok(['A','BUTTON'].includes(focused.tag))
  assert.equal(focused.visible,true)
  await browser.goto(origin+'/app/communications?actor=staff&case=administrator')
  await browser.send('Page.reload',{ignoreCache:true})
  await browser.until('!!document.querySelector(".clinic-communications-blocked")',10000)
  await browser.value('history.back();true')
  await browser.until('location.pathname==="/app/clinic"',10000)
  assert.deepEqual((await status(browser)).unexpected,[])
 })
})

test('CLOUD release bridge: owner A/B isolation, revoked and receptionist/vet/admin staff access across real links', {timeout:180000},async()=>{
 await clinicBrowser(async(browser,origin)=>{
  for(const [actor,name] of [['owner','Synthetic Patient'],['other','Synthetic B Patient']]){
   await browser.goto(origin+'/app/clinic?actor='+actor)
   await browser.until('document.querySelector(".clinic-release")?.textContent.includes("No verified clinic staff access")',10000)
   const s=await status(browser)
   for(const path of ['/app/ops','/app/clinical','/app/pharmacy','/app/billing','/app/communications'])
    assert.equal(s.links.includes(path),false,'owner cannot see staff navigation')
   await browser.goto(origin+'/app/pets?actor='+actor)
   await browser.until('document.querySelector("#main-content")?.textContent.includes('+JSON.stringify(name)+')',11000)
   const pets=await browser.value('document.querySelector("#main-content").textContent')
   assert.ok(pets.includes(name))
   if(actor==='other')assert.equal(pets.includes('Synthetic Patient'),false)
   await browser.goto(origin+'/app/communications?actor='+actor)
   await browser.until('!!document.querySelector(".clinic-release [role=alert]")',11000)
   assert.equal((await status(browser)).forms,0)
   assert.equal(await browser.value('!!document.querySelector(".clinic-communications-blocked")'),false)
   assert.deepEqual((await status(browser)).unexpected,[])
  }
  for(const [scenario,role] of [['receptionist','Receptionist'],['normal','Veterinarian'],['administrator','Administrator'],['multi','Veterinarian']]){
   await browser.goto(origin+'/app/clinic?actor=staff&case='+scenario)
   await browser.until('document.querySelectorAll(".clinic-release-module").length===5',12000)
   assert.match(await browser.value('document.querySelector(".clinic-release-branches").textContent'),new RegExp(role))
   if(scenario==='multi')assert.equal(await browser.value('document.querySelectorAll(".clinic-release-branches li").length'),2)
   assert.deepEqual((await status(browser)).unexpected,[])
  }
  for(const scenario of ['revoked','denied']){
   await browser.goto(origin+'/app/clinic?actor=staff&case='+scenario)
   await browser.until('!!document.querySelector(".clinic-release [role=alert]")',12000)
   const s=await status(browser)
   for(const path of ['/app/ops','/app/clinical','/app/pharmacy','/app/billing','/app/communications'])
    assert.equal(s.links.includes(path),false,'revoked staff cannot navigate to '+path)
   await browser.goto(origin+'/app/communications?actor=staff&case='+scenario)
   await browser.until('!!document.querySelector(".clinic-release [role=alert]")',12000)
   assert.equal(await browser.value('!!document.querySelector(".clinic-communications-blocked")'),false)
   assert.deepEqual((await status(browser)).mutations,[])
  }
 })
})

test('CLOUD release bridge: actual staff read-only modules, owner overview booking link, authentic 404 and anonymous sign-in', {timeout:135000},async()=>{
 await clinicBrowser(async(browser,origin)=>{
  await browser.goto(origin+'/app/overview?actor=owner')
  await browser.until('!!document.querySelector("#overview-heading")',11000)
  const links=(await status(browser)).links
  assert.equal(links.includes('/app/clinic'),true)
  assert.equal(links.includes('/book'),true)
  for(const [path,selector] of [['/app/ops','#ops-title'],['/app/clinical','#clinical-title'],['/app/pharmacy','#pharmacy-title'],['/app/billing','#main-content h1']]){
   await browser.goto(origin+path+'?actor=staff&case=normal')
   await browser.until('!!document.querySelector('+JSON.stringify(selector)+')',12000)
   const s=await status(browser)
   assert.deepEqual(s.unexpected,[],path)
   assert.deepEqual(s.mutations,[],path)
   assert.equal(s.requests,0,path)
  }
  await browser.until('document.querySelector("#main-content")?.textContent.includes("Billing read service not integrated")',11000)
  await browser.goto(origin+'/route-not-found?actor=visitor')
  await browser.until('!!document.querySelector("#not-found-heading")',11000)
  assert.match((await status(browser)).head,/Page not found/)
  await browser.goto(origin+'/app/clinic?actor=visitor')
  await browser.until('location.pathname==="/auth/signin"',11000)
  assert.equal(await browser.value('!!document.querySelector("form input[type=password]")'),true)
  assert.equal((await status(browser)).requests,0)
 })
})
