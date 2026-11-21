// CLOUD: separate process, DEFAULT PRIVATE FLAGS OFF. The route bridge must
// never turn on clinical/staff/pharmacy/billing from a valid staff JWT alone.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {fileURLToPath} from 'node:url'
import {withChromium} from '../../scripts/browser/cdp.mjs'
import {releaseClinicFixture} from './fixtures/release-clinic-http.mjs'
const root=fileURLToPath(new URL('../',import.meta.url))

test('CLOUD default-release: valid staff cannot activate hidden Ops, chart, stock, billing or message writes', {timeout:145000},async()=>{
 process.env.VITE_SUPABASE_URL='https://issue51-fixtures.supabase.co'
 process.env.VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_offline_default_flags'
 process.env.VITE_PHASE5A_OPS_UI='false'
 process.env.VITE_CLINICAL_WORKSPACE_UI='false'
 process.env.VITE_PHASE5B_PHARMACY_UI='false'
 process.env.VITE_PHASE5C_BILLING_UI='false'
 process.env.VITE_PHASE4_PATIENT_FORM='false'
 const vite=await createServer({root,server:{host:'127.0.0.1',port:0,strictPort:false},logLevel:'error'})
 try{
  await vite.listen()
  const origin='http://127.0.0.1:'+vite.httpServer.address().port
  await withChromium(async b=>{
   await b.send('Page.addScriptToEvaluateOnNewDocument',{source:'('+releaseClinicFixture.toString()+')()'})
   for(const width of [360,768,1440]){
    await b.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false})
    for(const theme of ['light','dark']){
     await b.goto(origin+'/app/clinic?actor=staff&case=administrator&theme='+theme)
     await b.until('document.querySelectorAll(".clinic-release-module").length===5',11500)
     const state=await b.value('({disabled:[...document.querySelectorAll(".clinic-release-module .clinic-release-disabled")].length,links:[...document.querySelectorAll(".clinic-release-module a")].map(x=>x.getAttribute("href")),over:document.documentElement.scrollWidth>innerWidth,theme:document.documentElement.getAttribute("data-theme"),mutations:window.__cloudIntegrated.directWrites,unexpected:window.__cloudIntegrated.unexpected})')
     assert.equal(state.disabled,4,'four private modules feature-OFF')
     assert.deepEqual(state.links,['/app/communications'],'only unavailable communications status accessible')
     assert.equal(state.over,false)
     assert.equal(state.theme,theme)
     assert.deepEqual(state.mutations,[])
     assert.deepEqual(state.unexpected,[])
    }
   }
   for(const route of ['/app/ops','/app/clinical','/app/pharmacy','/app/billing','/app/invoices']){
    await b.goto(origin+route+'?actor=staff&case=administrator')
    await b.until('!!document.querySelector("#main-content h1")',10000)
    assert.equal(await b.value('document.querySelector("#main-content")?.textContent.includes("Page not found")'),true,
      'Feature-OFF direct staff URL must render accessible 404, not a staff module')
    const page=await b.value('({h1:document.querySelector("#main-content h1")?.textContent,patient:!!document.querySelector(".clinical-chart-gateway"),stock:!!document.querySelector(".pharmacy-body"),finance:!!document.querySelector(".billing-workspace")})')
    assert.equal(page.patient,false,route)
    assert.equal(page.stock,false,route)
    assert.equal(page.finance,false,route)
    assert.match(page.h1,/Page not found|We couldn’t find that page|Clinic setup required/i)
   }
   await b.goto(origin+'/app/communications?actor=staff&case=administrator')
   await b.until('!!document.querySelector(".clinic-communications-blocked")',11000)
   const comm=await b.value('({buttons:[...document.querySelectorAll(".clinic-communications-blocked button")].map(x=>x.disabled),mutations:window.__cloudIntegrated.directWrites,requests:window.__cloudIntegrated.rpcs,unexpected:window.__cloudIntegrated.unexpected})')
   assert.deepEqual(comm.buttons,[true,true,true])
   assert.deepEqual(comm.requests,[])
   assert.deepEqual(comm.mutations,[])
   assert.deepEqual(comm.unexpected,[])
  })
 }finally{await vite.close()}
})
