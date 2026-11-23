// CLOUD: real localhost Chromium through existing /app/ops; all external HTTP intercepted.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {fileURLToPath} from 'node:url'
import {withChromium} from '../../scripts/browser/cdp.mjs'
import {releaseClinicFixture} from './fixtures/release-clinic-http.mjs'
import {staffLifecycleHttpFixture} from './fixtures/staff-lifecycle-http.mjs'
const root=fileURLToPath(new URL('../',import.meta.url))
const q=x=>JSON.stringify(x)
async function browserCase(flag,fn){
 process.env.VITE_SUPABASE_URL='https://issue51-fixtures.supabase.co'
 process.env.VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_issue51_offline'
 process.env.VITE_PHASE5A_OPS_UI='true'
 process.env.VITE_STAFF_APPOINTMENT_WRITES_ENABLED=flag?'true':'false'
 const vite=await createServer({root,server:{host:'127.0.0.1',port:0,strictPort:false},logLevel:'error'})
 try{
  await vite.listen()
  await withChromium(async b=>{
   await b.send('Page.addScriptToEvaluateOnNewDocument',{source:'('+releaseClinicFixture.toString()+')();('+staffLifecycleHttpFixture.toString()+')()'})
   await fn(b,'http://127.0.0.1:'+vite.httpServer.address().port)
  })
 }finally{
  await vite.close()
  for(const k of ['VITE_SUPABASE_URL','VITE_SUPABASE_PUBLISHABLE_KEY','VITE_PHASE5A_OPS_UI','VITE_STAFF_APPOINTMENT_WRITES_ENABLED'])delete process.env[k]
 }
}
async function wait(b,exp){
 try{await b.until(exp,16000)}
 catch(e){const s=await b.value('({text:document.querySelector("#main-content")?.textContent?.slice(0,1600),db:window.__staffLifecycle?.get(),unexpected:window.__cloudIntegrated?.unexpected})')
  throw Error('Synthetic lifecycle state: '+JSON.stringify(s),{cause:e})}
}
async function tap(b,label){
 const ok=await b.value('(()=>{const e=[...document.querySelectorAll(".appointment-lifecycle button")].find(b=>b.textContent?.trim()==='+q(label)+');if(!e||e.disabled)return false;e.click();return true})()')
 assert.equal(ok,true,'enabled button '+label)
}
async function select(b,origin,query){
 await b.goto(origin+'/app/ops?actor=staff&'+query)
 await wait(b,'!!document.querySelector(".ops-visit button[aria-label]")')
 assert.equal(await b.value('(()=>{document.querySelector(".ops-visit button[aria-label]").click();return true})()'),true)
 await wait(b,'!!document.querySelector("#lifecycle-title")')
}
const db=b=>b.value('window.__staffLifecycle.get()')
const status=(b,s)=>wait(b,'document.querySelector(".lifecycle-status")?.textContent.includes('+q(s)+')')
test('flag OFF: 360/768/1440 light+dark, keyboard, NO RPC or sensitive fallback',{timeout:220000},async()=>browserCase(false,async(b,url)=>{
 for(const width of [360,768,1440]){
  await b.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false})
  for(const theme of ['light','dark']){
   await select(b,url,'case=receptionist&theme='+theme+'&reset=1')
   await wait(b,'document.querySelector(".appointment-lifecycle")?.textContent.includes("Protected writes OFF")')
   assert.equal(await b.value('document.documentElement.scrollWidth>innerWidth'),false,'overflow '+width+'/'+theme)
   assert.equal(await b.value('document.documentElement.getAttribute("data-theme")'),theme)
   assert.equal((await db(b)).calls.length,0)
   assert.equal(await b.value('window.__cloudIntegrated.directWrites.length'),0)
   assert.equal(await b.value('document.querySelector(".appointment-lifecycle button:not([disabled])")===null'),true)
   await b.value('document.querySelector(".ops-visit button").focus();true')
   assert.equal(await b.value('document.activeElement?.getAttribute("aria-label")?.startsWith("Review appointment")'),true)
  }
 }
}))
test('actual staff route: requested -> confirmed -> checked in -> encounter-linked completed',{timeout:150000},async()=>browserCase(true,async(b,url)=>{
 await select(b,url,'case=encounter&reset=1')
 await status(b,'Requested')
 await tap(b,'Confirm request')
 await wait(b,'document.querySelector(".appointment-lifecycle")?.textContent.includes("Server confirmed confirmed at revision 2")')
 await status(b,'Confirmed')
 await tap(b,'Check in')
 await wait(b,'document.querySelector(".appointment-lifecycle")?.textContent.includes("Server confirmed checked in at revision 3")')
 await status(b,'Checked in')
 await wait(b,'document.querySelector(".appointment-lifecycle")?.textContent.includes("persisted, branch-matched encounter")')
 await tap(b,'Complete visit')
 await tap(b,'Apply Complete visit')
 await wait(b,'document.querySelector(".appointment-lifecycle")?.textContent.includes("Server confirmed completed at revision 4")')
 const s=await db(b)
 assert.equal(s.booking.status,'completed')
 assert.equal(s.booking.lifecycle_revision,4)
 assert.deepEqual(s.calls.map(c=>c.body.p_action),['confirm','check_in','complete'])
 for(let i=0;i<3;i++){
  const p=s.calls[i].body
  assert.equal(p.p_branch,'40000000-0000-4000-8000-000000000001')
  assert.equal(p.p_appointment,'40000000-0000-4000-8000-000000000011')
  assert.equal(p.p_expected_revision,i+1)
  assert.match(p.p_request_id,/^[0-9a-f-]{36}$/i)
 }
 assert.equal(await b.value('window.__cloudIntegrated.directWrites.length'),0)
 await b.goto(url+'/app/ops?actor=staff&case=encounter')
 await wait(b,'!!document.querySelector(".ops-visit button")')
 await b.value('document.querySelector(".ops-visit button").click();true')
 await status(b,'Completed')
 assert.equal((await db(b)).booking.lifecycle_revision,4)
}))
test('decline and no-show use persisted cancelled/no_show; receptionist cannot complete',{timeout:160000},async()=>browserCase(true,async(b,url)=>{
 await select(b,url,'case=receptionist&reset=1')
 await status(b,'Requested')
 await tap(b,'Decline request');await tap(b,'Apply Decline request')
 await wait(b,'document.querySelector(".appointment-lifecycle")?.textContent.includes("Server confirmed cancelled at revision 2")')
 assert.equal((await db(b)).booking.status,'cancelled')
 await select(b,url,'case=no-show&reset=1')
 await status(b,'Requested')
 await tap(b,'Confirm request');await status(b,'Confirmed')
 await tap(b,'Mark no-show');await tap(b,'Apply Mark no-show')
 await wait(b,'document.querySelector(".appointment-lifecycle")?.textContent.includes("Server confirmed no show")')
 assert.equal((await db(b)).booking.status,'no_show')
 await select(b,url,'case=receptionist&reset=1')
 await tap(b,'Confirm request');await status(b,'Confirmed')
 await tap(b,'Cancel appointment');await tap(b,'Apply Cancel appointment')
 await wait(b,'document.querySelector(".appointment-lifecycle")?.textContent.includes("Server confirmed cancelled")')
 assert.equal((await db(b)).booking.status,'cancelled')
 await select(b,url,'case=receptionist&reset=1')
 await tap(b,'Confirm request');await status(b,'Confirmed')
 await tap(b,'Check in');await status(b,'Checked in')
 assert.equal(await b.value('[...document.querySelectorAll(".appointment-lifecycle button")].some(x=>x.textContent==="Complete visit"&&!x.disabled)'),false)
}))
test('lost ACK: same nonce replay no second increment; conflict and denied clear context',{timeout:180000},async()=>browserCase(true,async(b,url)=>{
 await select(b,url,'case=timeout-once&reset=1')
 await status(b,'Requested')
 await tap(b,'Confirm request')
 await wait(b,'document.querySelector(".appointment-lifecycle")?.textContent.includes("Outcome is uncertain")')
 assert.equal((await db(b)).booking.lifecycle_revision,2)
 await wait(b,'document.querySelector(".appointment-lifecycle")?.textContent.includes("Retry same request")')
 await tap(b,'Retry same request')
 await wait(b,'document.querySelector(".appointment-lifecycle")?.textContent.includes("Server confirmed confirmed at revision 2")')
 const s=await db(b)
 assert.equal(s.calls.length,2)
 assert.deepEqual(s.calls[0].body,s.calls[1].body)
 assert.equal(Object.keys(s.receipts).length,1)
 assert.equal(s.booking.lifecycle_revision,2)
 await select(b,url,'case=conflict&reset=1')
 await status(b,'Requested')
 await tap(b,'Confirm request')
 await wait(b,'document.querySelector(".appointment-lifecycle")?.textContent.includes("Another change won the revision check")')
 assert.equal((await db(b)).booking.status,'requested')
 await select(b,url,'case=denied-transition&reset=1')
 await status(b,'Requested')
 await tap(b,'Confirm request')
 await wait(b,'!!document.querySelector(".ops-failure")')
 assert.equal(await b.value('!!document.querySelector(".ops-visit")'),false)
}))
test('missing revision, foreign response, incomplete encounter, branch and account switching denied',{timeout:170000},async()=>browserCase(true,async(b,url)=>{
 for(const mode of ['missing-revision','wrong-detail-branch']){
  await select(b,url,'case='+mode+'&reset=1')
  await wait(b,'document.querySelector(".appointment-lifecycle")?.textContent.includes("could not be verified")')
  assert.equal((await db(b)).calls.length,0)
 }
 await select(b,url,'case=encounter-unavailable&reset=1')
 await b.value('window.__staffLifecycle.forceStatus("checked_in");true')
 await tap(b,'Check latest server status')
 await wait(b,'document.querySelector(".appointment-lifecycle")?.textContent.includes("Unable to verify the encounter")')
 assert.equal(await b.value('[...document.querySelectorAll(".appointment-lifecycle button")].some(x=>x.textContent==="Complete visit"&&!x.disabled)'),false)
 await select(b,url,'case=missing-rpc&reset=1')
 await status(b,'Requested')
 await tap(b,'Confirm request')
 await wait(b,'document.querySelector(".appointment-lifecycle")?.textContent.includes("not installed")')
 assert.equal((await db(b)).booking.status,'requested')
 await b.goto(url+'/app/ops?actor=staff&case=multi&reset=1')
 await wait(b,'!!document.querySelector(\'[aria-label="Branch selection"] select\')')
 await b.value('(()=>{const e=document.querySelector(\'[aria-label="Branch selection"] select\');e.value="40000000-0000-4000-8000-000000000002";e.dispatchEvent(new Event("change",{bubbles:true}));return true})()')
 await wait(b,'document.querySelector("#main-content")?.textContent.includes("No appointments in this window")')
 assert.equal(await b.value('!!document.querySelector(".appointment-lifecycle")'),false)
 await b.goto(url+'/app/ops?actor=owner')
 await wait(b,'!!document.querySelector(".ops-failure")')
 assert.equal(await b.value('!!document.querySelector(".appointment-lifecycle")'),false)
 await b.goto(url+'/app/ops?actor=staff&case=accountant&reset=1')
 await wait(b,'!!document.querySelector(".ops-failure")')
 assert.equal(await b.value('!!document.querySelector(".appointment-lifecycle")'),false)
}))
