// CLOUD PR122 real localhost Chromium. Existing PR114 synthetic HTTP fixture
// intercepts every remote origin, forbids all unreviewed mutations.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {fileURLToPath} from 'node:url'
import {withChromium} from '../../scripts/browser/cdp.mjs'
import {releaseClinicFixture} from './fixtures/release-clinic-http.mjs'

async function run(callback){
  const root=fileURLToPath(new URL('../',import.meta.url))
  const vars=['VITE_SUPABASE_URL','VITE_SUPABASE_PUBLISHABLE_KEY','VITE_PHASE5A_OPS_UI',
    'VITE_CLINICAL_WORKSPACE_UI','VITE_PHASE5B_PHARMACY_UI','VITE_PHASE5C_BILLING_UI','VITE_PHASE4_PATIENT_FORM']
  const previous=Object.fromEntries(vars.map(v=>[v,process.env[v]]))
  process.env.VITE_SUPABASE_URL='https://issue51-fixtures.supabase.co'
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_issue51_offline'
  for(const v of vars.filter(x=>x.endsWith('_UI')))process.env[v]='true'
  process.env.VITE_PHASE4_PATIENT_FORM='false'
  const vite=await createServer({root,server:{host:'127.0.0.1',port:0,strictPort:false},logLevel:'error'})
  try{
    await vite.listen()
    const origin='http://127.0.0.1:'+vite.httpServer.address().port
    await withChromium(async browser=>{
      await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:'('+releaseClinicFixture.toString()+')()'})
      await callback(browser,origin)
    })
  }finally{
    await vite.close()
    for(const [k,v] of Object.entries(previous))if(v===undefined)delete process.env[k];else process.env[k]=v
  }
}
const view='({heading:document.querySelector("#main-content h1")?.textContent,theme:document.documentElement.getAttribute("data-theme"),overflow:document.documentElement.scrollWidth>innerWidth,staffLinks:[...document.querySelectorAll("a")].map(x=>x.getAttribute("href")).filter(x=>["/app/ops","/app/clinical","/app/pharmacy","/app/billing"].includes(x)),unexpected:window.__cloudIntegrated.unexpected,writes:window.__cloudIntegrated.directWrites})'

test('CLOUD integrated release: owner A/B journey, communication controls, direct deep links/back/forward and six theme-width cells',{timeout:180000},async()=>run(async(browser,origin)=>{
  for(const width of [360,768,1440]){
    await browser.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false})
    for(const theme of ['light','dark']){
      await browser.goto(origin+'/app/workflows?actor=owner&theme='+theme)
      await browser.until('!!document.querySelector("#clinic-journey-heading")',10000)
      await browser.until('document.body.textContent.includes("No active staff branch membership")',10000)
      const a=await browser.value(view)
      assert.match(a.heading,/Clinic journeys/)
      assert.equal(a.theme,theme)
      assert.equal(a.overflow,false,'owner journey overflow '+width+'/'+theme)
      assert.deepEqual(a.staffLinks,[],'owner cannot see staff links')
      assert.deepEqual(a.writes,[])
      assert.deepEqual(a.unexpected,[])
      const links=await browser.value('[...document.querySelectorAll("#main-content a")].map(x=>x.getAttribute("href"))')
      for(const route of ['/app/profile','/app/pets','/app/appointments','/app/communications'])
        assert.ok(links.includes(route),'owner workflow route '+route)
      await browser.value('document.querySelector("#main-content a[href=\\"/app/communications\\"]").click();true')
      await browser.until('!!document.querySelector("#communications-title")',9000)
      const messaging=await browser.value('({disabled:[...document.querySelectorAll("#main-content button")].map(b=>b.disabled),status:document.querySelector("#main-content [role=status]")?.textContent,overflow:document.documentElement.scrollWidth>innerWidth,writes:window.__cloudIntegrated.directWrites,unexpected:window.__cloudIntegrated.unexpected})')
      assert.deepEqual(messaging.disabled,[true,true,true],'send, remind, consent disabled')
      assert.match(messaging.status,/No message has been queued|no message has been queued/)
      assert.equal(messaging.overflow,false)
      assert.deepEqual(messaging.writes,[])
      assert.deepEqual(messaging.unexpected,[])
      await browser.value('history.back();true')
      await browser.until('location.pathname==="/app/workflows"',5000)
      await browser.value('history.forward();true')
      await browser.until('location.pathname==="/app/communications"',5000)
    }
  }
  await browser.goto(origin+'/app/overview?actor=owner&theme=light')
  await browser.until('document.querySelector(".stat-grid")?.textContent.includes("Registered patients")',10000)
  assert.equal(await browser.value('document.querySelector(".stat-grid .stat-value")?.textContent'), '1',
    'owner A overview count comes from actual owner-scoped patient rows')
  await browser.value('document.querySelector("#main-content a[href=\\"/app/workflows\\"]").click();true')
  await browser.until('!!document.querySelector("#clinic-journey-heading")',9000)
  await browser.send('Page.reload',{ignoreCache:true})
  await browser.until('!!document.querySelector("#clinic-journey-heading")',9000)
  await browser.goto(origin+'/app/overview?actor=other&theme=dark')
  await browser.until('document.querySelector(".stat-grid")?.textContent.includes("Registered patients")',10000)
  assert.equal(await browser.value('document.querySelector(".stat-grid .stat-value")?.textContent'), '1')
  await browser.goto(origin+'/app/pets?actor=other&theme=dark')
  await browser.until('document.body.textContent.includes("Synthetic B Patient")',10000)
  assert.equal(await browser.value('document.body.textContent.includes("Synthetic Patient")'),false,
    'owner B patient route cannot display owner A name')
  await browser.goto(origin+'/app/workflows?actor=visitor')
  await browser.until('location.pathname==="/auth/signin"',9000)
  assert.equal(await browser.value('!!document.querySelector("#clinic-journey-heading")'),false)
}))

test('CLOUD integrated release: verified staff roles, revoked staff links, billing unconnected and zero unauthorized finance/messages',{timeout:170000},async()=>run(async(browser,origin)=>{
  for(const width of [360,768,1440]){
    await browser.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false})
    for(const theme of ['light','dark']){
      await browser.goto(origin+'/app/workflows?actor=staff&theme='+theme)
      await browser.until('document.body.textContent.includes("Current staff membership was verified")',10000)
      const staff=await browser.value(view)
      assert.equal(staff.theme,theme)
      assert.equal(staff.overflow,false,'staff journey overflow '+width+'/'+theme)
      const distinct=[...new Set(staff.staffLinks)].sort()
      assert.deepEqual(distinct,['/app/billing','/app/clinical','/app/ops','/app/pharmacy'])
      assert.deepEqual(staff.writes,[])
      assert.deepEqual(staff.unexpected,[])
      await browser.goto(origin+'/app/workflows?actor=staff&case=denied&theme='+theme)
      await browser.until('document.body.textContent.includes("No active staff branch membership")',10000)
      const denied=await browser.value(view)
      assert.deepEqual(denied.staffLinks,[],'revoked staff navigation hidden')
      assert.deepEqual(denied.writes,[])
    }
  }
  for(const mode of ['receptionist','administrator','role-mismatch','revoked']){
    await browser.goto(origin+'/app/workflows?actor=staff&case='+mode)
    await browser.until('!!document.querySelector("#clinic-journey-heading")',9000)
    if(mode==='revoked')await browser.until('document.body.textContent.includes("No active staff branch membership")',9000)
    else await browser.until('document.body.textContent.includes("Current staff membership was verified")',9000)
    const current=await browser.value(view)
    if(mode==='revoked')assert.deepEqual(current.staffLinks,[])
    else assert.ok(current.staffLinks.includes('/app/ops'),'allowed staff role '+mode)
    assert.deepEqual(current.unexpected,[])
    assert.deepEqual(current.writes,[])
  }
  await browser.goto(origin+'/app/workflows?actor=staff')
  await browser.until('document.body.textContent.includes("Current staff membership was verified")',9000)
  await browser.value('document.querySelector("#main-content a[href=\\"/app/billing\\"]").click();true')
  await browser.until('document.body.textContent.includes("Billing read service not integrated")',9000)
  const finance=await browser.value('({invoices:document.querySelectorAll(".billing-invoice").length,buttons:[...document.querySelectorAll(".billing-actions[aria-label] button")].map(x=>x.disabled),writes:window.__cloudIntegrated.directWrites,unexpected:window.__cloudIntegrated.unexpected})')
  assert.equal(finance.invoices,0)
  assert.ok(finance.buttons.length>0&&finance.buttons.every(Boolean))
  assert.deepEqual(finance.writes,[])
  assert.deepEqual(finance.unexpected,[])
  await browser.goto(origin+'/app/communications?actor=staff')
  await browser.until('!!document.querySelector("#communications-title")',9000)
  assert.equal(await browser.value('document.querySelectorAll("#main-content button:enabled").length'),0)
  assert.deepEqual(await browser.value('window.__cloudIntegrated.directWrites'),[])
}))
