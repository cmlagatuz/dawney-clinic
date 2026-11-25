// CLOUD: exact ASTRA #126 RPC names on localhost Vite + REAL Chromium.
// Every remote HTTP request is synthetic intercepted PostgREST; NO hosted writes.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {fileURLToPath} from 'node:url'
import {withChromium} from '../../scripts/browser/cdp.mjs'
import {releaseClinicFixture} from './fixtures/release-clinic-http.mjs'
import {operationalHttpFixture} from './fixtures/operational-http.mjs'
const root=fileURLToPath(new URL('../',import.meta.url))
const uuid=n=>'40000000-0000-4000-8000-'+String(n).padStart(12,'0')
async function withOperatorBrowser(fn){
 process.env.VITE_SUPABASE_URL='https://issue51-fixtures.supabase.co'
 process.env.VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_issue51_offline'
 process.env.VITE_STAFF_APPROVAL_WRITES_ENABLED='true' // TEST PROCESS ONLY; production defaults remain OFF.
 process.env.VITE_INVENTORY_WRITES_ENABLED='true'
 process.env.VITE_PHASE5B_PHARMACY_UI='false'
 const vite=await createServer({root,server:{host:'127.0.0.1',port:0,strictPort:false},logLevel:'error'})
 try{
  await vite.listen()
  const origin='http://127.0.0.1:'+vite.httpServer.address().port
  await withChromium(async browser=>{
   await browser.send('Page.addScriptToEvaluateOnNewDocument',{
    source:'('+releaseClinicFixture.toString()+')();('+operationalHttpFixture.toString()+')()'
   })
   await fn(browser,origin)
  })
 }finally{await vite.close()}
}
function css(s){return JSON.stringify(s)}
async function setValue(browser,selector,value){
 const js='(()=>{const e=document.querySelector('+css(selector)+');'+
  'if(!e)throw Error("Synthetic selector missing: "+'+css(selector)+');'+
  'const proto=e.tagName==="SELECT"?HTMLSelectElement.prototype:e.tagName==="TEXTAREA"?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;'+
  'Object.getOwnPropertyDescriptor(proto,"value").set.call(e,'+css(value)+');'+
  'e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}));return e.value})()'
 assert.equal(await browser.value(js),value,'controlled form field '+selector)
}
async function click(browser,selector){
 assert.equal(await browser.value('(()=>{const e=document.querySelector('+css(selector)+');if(!e)throw Error("Synthetic button missing");e.click();return true})()'),true)
}
async function waitState(browser,expression,timeout){
  try{await browser.until(expression,timeout)}
  catch(error){
   const state=await browser.value('({text:document.querySelector("#main-content")?.textContent?.slice(0,2200),operations:window.__operationalMock?.calls?.slice(-10),db:window.__operationalMock?.getDb?.(),unexpected:window.__cloudIntegrated?.unexpected})')
   throw Error('Synthetic operational UI missing state: '+JSON.stringify(state).slice(0,4500),{cause:error})
  }
}
// Exercise the same readiness contract in both lost-ACK paths, even on a fast runner.
async function retryAfterFocus(b,label,details,otherHeading,rpc){
 const before=await b.value('window.__operationalMock.getDb()')
 const original=before.calls.filter(x=>x.rpc===rpc)
 assert.equal(original.length,1)
 await b.value('window.__operationalMock.holdCatalog();window.dispatchEvent(new Event("focus"));true')
 const button='[...document.querySelectorAll("button")].find(x=>x.textContent?.trim()==='+css(label)+')'
 await waitState(b,'('+button+')?.disabled===true',15000)
 for(const detail of [...details,original[0].args.p_request_id])
  assert.equal(await b.value('document.querySelector(\'[aria-label="Unresolved inventory operation"]\')?.textContent.includes('+css(detail)+')'),true)
 assert.equal(await b.value('document.querySelector("#operator-branch").disabled'),true)
 assert.equal(await b.value('document.querySelector('+css('section[aria-labelledby="'+otherHeading+'"] button[type=submit]')+').disabled'),true)
 assert.equal(await b.value('(()=>{const e=new Event("beforeunload",{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented})()'),true)
 await b.value('('+button+').click();true')
 assert.equal((await b.value('window.__operationalMock.getDb()')).calls.filter(x=>x.rpc===rpc).length,1)
 await b.value('window.__operationalMock.releaseCatalog();true')
 await waitState(b,'('+button+')?.disabled===false',15000)
 assert.equal(await b.value('(()=>{const e='+button+';if(!e||e.disabled)return false;e.click();return true})()'),true)
}
async function createItem(browser,expected='saved'){
 await waitState(browser,'!!document.querySelector("#add-item-heading")&&!!document.querySelector("[aria-label^=Live] select")',15000)
 const prefix='section[aria-labelledby="add-item-heading"] '
 await setValue(browser,prefix+'input[placeholder="MED-001"]','QA-NEW-1')
 await setValue(browser,prefix+'input[placeholder="Item name"]','Synthetic Test Medicine')
 await setValue(browser,prefix+'input[placeholder="each"]','vial')
 await setValue(browser,prefix+'input[placeholder="tablet, vial, solution"]','solution')
 await setValue(browser,prefix+'input[placeholder="5 mg"]','2 mg')
 await setValue(browser,prefix+'input[placeholder="10"]','2')
 await click(browser,prefix+'button[type=submit]')
 if(expected==='uncertain'){
  await waitState(browser,'document.querySelector("#main-content")?.textContent.includes("result is uncertain")',14000)
  return
 }
 await waitState(browser,'document.querySelector("#add-item-heading").closest("section")?.textContent.includes("Item saved and confirmed on server")',14000)
 const s=await browser.value('window.__operationalMock.getDb()')
 assert.equal(s.products.length,1)
 assert.equal(s.products[0].stock,0)
 assert.equal(s.products[0].catalog.product_code,'QA-NEW-1')
}
async function receiptTen(browser){
 const prefix='section[aria-labelledby="receive-heading"] '
 await waitState(browser,'!!document.querySelector('+css(prefix+'select')+')&&[...document.querySelectorAll('+css(prefix+'select option')+')].some(x=>x.value==="QA-NEW-1")',12000)
 assert.equal(await browser.value('document.querySelector('+css(prefix+'select')+').value'),'QA-NEW-1',
  'a freshly created item is selected by its authoritative item UUID')
 await waitState(browser,'document.querySelector('+css(prefix+'input[type=date]')+')?.value==="2026-11-20"',9000)
 await setValue(browser,prefix+'input[maxlength="80"]','LOT-TEST-10')
 await setValue(browser,prefix+'input[inputmode=numeric]','10')
 await setValue(browser,prefix+'input[type=date]:not([disabled])','2027-12-01')
 await click(browser,prefix+'button[type=submit]')
}
test('self registered verified owner sees none -> submits branch-only request -> actual pending readback and refresh',{timeout:160000},async()=>withOperatorBrowser(async(browser,origin)=>{
 await browser.goto(origin+'/auth/signup?actor=owner&resetOps=1')
 await waitState(browser,'document.querySelector("#auth-title")?.textContent==="Create an account"',12000)
 assert.equal(await browser.value('!!document.querySelector("input[type=password]")'),true)
 assert.equal(await browser.value('!!document.querySelector("[name=role]")'),false)
 await browser.goto(origin+'/auth/verify?actor=owner')
 await waitState(browser,'document.querySelector("#auth-title")?.textContent==="Verify your email"',12000)
 await browser.goto(origin+'/app/staff-access?actor=owner')
 await waitState(browser,'document.querySelector("#request-heading")?.textContent==="Request clinic access"',12000)
 await waitState(browser,'document.querySelector("#main-content")?.textContent.includes("No staff request")',12000)
 await setValue(browser,'section:has(#request-heading) select',uuid(1))
 await click(browser,'section:has(#request-heading) button.button-primary')
 await waitState(browser,'document.querySelector("#main-content")?.textContent.includes("Pending Approval")',12000)
 const s=await browser.value('window.__operationalMock.getDb()')
 assert.equal(s.ownRequest.state,'pending')
 const request=s.calls.find(x=>x.rpc==='request_staff_access')
 assert.deepEqual(Object.keys(request.args).sort(),['p_branch','p_note'])
 assert.equal(request.args.p_branch,uuid(1))
 assert.equal(JSON.stringify(request.args).includes('p_role'),false)
 await browser.goto(origin+'/app/staff-access?actor=owner')
 await waitState(browser,'document.querySelector("#main-content")?.textContent.includes("Pending Approval")',12000)
 assert.equal(await browser.value('!!document.querySelector("#main-content a[href=\\"/app/ops\\"]")'),false)
 await browser.goto(origin+'/app/staff-management?actor=owner')
 await waitState(browser,'document.querySelector("#main-content")?.textContent.includes("Administrator approval required")',12000)
 assert.equal(await browser.value('!!document.querySelector("#pending-heading")'),false)
}))
test('administrator branch-scoped staff review supports approval, role change, revoke, accountant isolation',{timeout:170000},async()=>withOperatorBrowser(async(browser,origin)=>{
 await browser.goto(origin+'/app/staff-management?actor=staff&case=administrator&resetOps=1')
 await waitState(browser,'!!document.querySelector("#pending-heading")&&!!document.querySelector("button.button-small")',13000)
 await click(browser,'button.button-small')
 await waitState(browser,'document.querySelector("#main-content")?.textContent.includes("Review selected account")',11000)
 await setValue(browser,'section:has(#pending-heading) .operator-review .operator-form-grid label:first-child select','approve')
 await setValue(browser,'section:has(#pending-heading) .operator-review .operator-form-grid label:nth-child(2) select','accountant')
 await click(browser,'section:has(#pending-heading) .operator-review button.button-primary')
 await waitState(browser,'document.querySelector("#main-content")?.textContent.includes("Staff decision confirmed")',12000)
 let s=await browser.value('window.__operationalMock.getDb()')
 assert.equal(s.staffRequest.state,'approved')
 let review=s.calls.find(x=>x.rpc==='review_staff_access')
 assert.equal(review.args.p_target,uuid(7))
 assert.equal(review.args.p_role,'accountant')
 assert.deepEqual(review.args.p_branches,[uuid(1)])
 assert.equal(review.args.p_expected_revision,1)
 assert.match(review.args.p_request_id,/^[0-9a-f-]{36}$/)
 await click(browser,'button.button-small')
 await waitState(browser,'!!document.querySelector(".operator-review")',11000)
 await setValue(browser,'section:has(#pending-heading) .operator-review .operator-form-grid label:first-child select','revoke')
 await click(browser,'section:has(#pending-heading) .operator-review button.button-primary')
 await waitState(browser,'document.querySelector("#main-content")?.textContent.includes("Staff decision confirmed")',12000)
 s=await browser.value('window.__operationalMock.getDb()')
 assert.equal(s.staffRequest.state,'revoked')
 await browser.goto(origin+'/app/inventory?actor=staff&case=accountant')
 await waitState(browser,'document.querySelector("#main-content")?.textContent.includes("Inventory operations denied")',12000)
 assert.equal(await browser.value('!!document.querySelector("#receive-heading")'),false)
 await browser.goto(origin+'/app/staff-management?actor=staff&case=receptionist')
 await waitState(browser,'document.querySelector("#main-content")?.textContent.includes("Administrator approval required")',12000)
 assert.equal(await browser.value('!!document.querySelector("#pending-heading")'),false)
}))
test('receptionist Add Item then Receive Stock 10, exact event and persistent server-confirmed quantity after refresh',{timeout:210000},async()=>withOperatorBrowser(async(browser,origin)=>{
 await browser.goto(origin+'/app/inventory?actor=staff&case=receptionist&resetOps=1')
 await waitState(browser,'!!document.querySelector("#receive-heading")',14000)
 await createItem(browser)
 await receiptTen(browser)
 await waitState(browser,'document.querySelector("#main-content")?.textContent.includes("Received 10 units")',14000)
 let s=await browser.value('window.__operationalMock.getDb()')
 assert.equal(s.products[0].stock,10)
 assert.equal(s.events.length,1)
 assert.equal(s.events[0].delta_on_hand,10)
 const receive=s.calls.find(x=>x.rpc==='receive_branch_inventory_stock')
 assert.deepEqual(Object.keys(receive.args).sort(),
  ['p_branch','p_expiry','p_lot','p_medicine','p_quantity','p_request_id','p_supplier'])
 assert.equal(receive.args.p_medicine,uuid(600))
 assert.equal(receive.args.p_quantity,10)
 assert.equal(s.events[0].event_id,receive.args.p_request_id)
 await browser.goto(origin+'/app/inventory?actor=staff&case=receptionist')
 await waitState(browser,'!!document.querySelector('+css('[aria-label^=Live] option[value="'+uuid(600)+'"]')+')',12000)
 await setValue(browser,'section[aria-label="Live branch inventory catalog"] select',uuid(600))
 await waitState(browser,'document.querySelector(".operator-balances strong")?.textContent==="10"',12000)
 assert.equal(await browser.value('document.querySelector(".operator-balances").textContent.includes("10")'),true)
 const next=await browser.value('window.__operationalMock.getDb()')
 assert.equal(next.events.length,1,'reload cannot add a duplicate movement')
 assert.equal(next.products[0].stock,10)
}))
test('lost receipt acknowledgement retries EXACT SAME UUID and never receives twenty',{timeout:190000},async()=>withOperatorBrowser(async(browser,origin)=>{
 await browser.goto(origin+'/app/inventory?actor=staff&case=receptionist&ops=timeout-once&resetOps=1')
 await waitState(browser,'!!document.querySelector("#receive-heading")',14000)
 await createItem(browser)
 await receiptTen(browser)
 await waitState(browser,'document.querySelector("#main-content")?.textContent.includes("result is uncertain")',12000)
 let state=await browser.value('window.__operationalMock.getDb()')
 assert.equal(state.products[0].stock,10,'server may already have committed despite lost ACK')
 assert.equal(state.events.length,1)
 await click(browser,'section[aria-labelledby="receive-heading"] .operator-actions button:nth-of-type(2)')
 await waitState(browser,'document.querySelector("#main-content")?.textContent.includes("Received 10 units")',14000)
 state=await browser.value('window.__operationalMock.getDb()')
 const calls=state.calls.filter(x=>x.rpc==='receive_branch_inventory_stock')
 assert.equal(calls.length,2)
 assert.equal(calls[0].args.p_request_id,calls[1].args.p_request_id)
 assert.deepEqual(calls[0].args,calls[1].args)
 assert.equal(state.products[0].stock,10)
 assert.equal(state.events.length,1)
}))

test('trusted bootstrapped administrator with no applicant row retains verified branch, cannot self-request',{timeout:150000},async()=>withOperatorBrowser(async(b,origin)=>{
 await b.goto(origin+'/app/staff-access?actor=staff&case=administrator&ops=bootstrap&resetOps=1')
 await waitState(b,'document.querySelector("#main-content")?.textContent.includes("Verified existing staff access")',13000)
 const body=await b.value('document.querySelector("#main-content")?.textContent')
 assert.match(body,/Administrator|administrator/)
 assert.match(body,/No separate staff application is required/)
 assert.equal(await b.value('document.querySelector("section:has(#request-heading) button.button-primary")?.disabled'),true)
 assert.equal((await b.value('window.__operationalMock.getDb()')).calls.some(x=>x.rpc==='request_staff_access'),false)
 await b.goto(origin+'/app/staff-management?actor=staff&case=administrator&ops=bootstrap')
 await waitState(b,'!!document.querySelector("#pending-heading")',12000)
}))
test('Add Item nonce survives focus revalidation and form remount after a committed lost ACK',{timeout:175000},async()=>withOperatorBrowser(async(b,origin)=>{
 await b.goto(origin+'/app/inventory?actor=staff&case=receptionist&ops=create-timeout-once&resetOps=1')
 await waitState(b,'!!document.querySelector("#receive-heading")',14000)
 await createItem(b,'uncertain')
 await retryAfterFocus(b,'Retry original Add Item ID',['QA-NEW-1','Synthetic Test Medicine'],'receive-heading','create_branch_inventory_item')
 await waitState(b,'document.querySelector("#main-content")?.textContent.includes("Item saved and confirmed on server")',14000)
 const s=await b.value('window.__operationalMock.getDb()')
 const calls=s.calls.filter(x=>x.rpc==='create_branch_inventory_item')
 assert.equal(calls.length,2)
 assert.deepEqual(calls[0].args,calls[1].args)
 assert.equal(s.products.length,1)
 assert.equal(s.products[0].stock,0)
 assert.equal(s.events.length,0)
 assert.equal(Object.keys(s.receipts).length,1)
}))
test('Receive Stock nonce survives focus revalidation and never doubles committed stock',{timeout:175000},async()=>withOperatorBrowser(async(b,origin)=>{
 await b.goto(origin+'/app/inventory?actor=staff&case=receptionist&ops=timeout-once&resetOps=1')
 await waitState(b,'!!document.querySelector("#receive-heading")',14000)
 await createItem(b)
 await receiptTen(b)
 await waitState(b,'document.querySelector("#main-content")?.textContent.includes("result is uncertain")',12000)
 await retryAfterFocus(b,'Retry original receipt ID',['LOT-TEST-10','10 units'],'add-item-heading','receive_branch_inventory_stock')
 await waitState(b,'document.querySelector("#main-content")?.textContent.includes("Received 10 units")',14000)
 const s=await b.value('window.__operationalMock.getDb()')
 const calls=s.calls.filter(x=>x.rpc==='receive_branch_inventory_stock')
 assert.equal(calls.length,2)
 assert.deepEqual(calls[0].args,calls[1].args)
 assert.equal(s.products[0].stock,10)
 assert.equal(s.events.length,1)
}))
test('wrong-role, revoked, failed RPC, account switch and all widths/themes remain fail-closed',{timeout:200000},async()=>withOperatorBrowser(async(browser,origin)=>{
 for(const width of [360,768,1440]){
  await browser.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false})
  for(const theme of ['light','dark']){
   await browser.goto(origin+'/app/inventory?actor=staff&case=receptionist&theme='+theme)
   await waitState(browser,'!!document.querySelector("#receive-heading")',12000)
   assert.equal(await browser.value('document.documentElement.scrollWidth>innerWidth'),false,width+'/'+theme+' overflow')
   assert.equal(await browser.value('document.documentElement.getAttribute("data-theme")'),theme)
   await browser.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9})
   await browser.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9})
   await waitState(browser,'(()=>{const el=document.querySelector("#operator-branch");if(!el)return false;el.focus();return document.activeElement===el&&el.matches(":focus-visible")})()',12000)
  }
 }
 for(const link of [
  '/app/inventory?actor=owner',
  '/app/inventory?actor=staff&case=normal',
  '/app/inventory?actor=staff&case=accountant',
  '/app/inventory?actor=staff&case=revoked',
  '/app/inventory?actor=staff&case=denied'
 ]){
  await browser.goto(origin+link)
  await waitState(browser,'document.querySelector("#main-content")?.textContent.includes("Inventory operations denied")',12000)
  assert.equal(await browser.value('!!document.querySelector("#receive-heading")'),false)
 }
 await browser.goto(origin+'/app/staff-access?actor=owner&ops=unavailable')
 await waitState(browser,'document.querySelector("#main-content")?.textContent.includes("Access check unavailable")',12000)
 assert.equal(await browser.value('!!document.querySelector("#request-heading")'),false)
}))
