// Explicitly invoked connected acceptance. Never picked up by npm test.
// No HTTP fixture, intercepted backend response, Auth injection, provider SDK
// mutation, SQL, arbitrary endpoint, secret logging or production fallback.
import {readFile,mkdtemp,mkdir,writeFile,rm,chmod} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
import {createInterface} from 'node:readline/promises'
import assert from 'node:assert/strict'
import {BACKEND,RC2,WEB,flags,validatePacket,verifyLocalBackend,verifySource,outsideCheckout} from './runtime-guard.mjs'
import {withChromium} from '../../../scripts/browser/cdp.mjs'
const root=fileURLToPath(new URL('../../../',import.meta.url))
const web=resolve(root,'web')
const q=JSON.stringify
const packetPath=process.env.DAWNEY_CONNECTED_PACKET
const outputPath=process.env.DAWNEY_CONNECTED_EVIDENCE
if(!packetPath||!outputPath){console.error('BLOCKED: ASTRA runtime packet and new private evidence directory required');process.exit(2)}
let p,out
try{
 p=validatePacket(JSON.parse(await readFile(packetPath,'utf8')),process.env.DAWNEY_CONNECTED_APPROVAL)
 verifySource(root)
 out=outsideCheckout(root,outputPath)
 await verifyLocalBackend(p)
}catch{console.error('BLOCKED: runtime/source/approval preflight failed; no browser started');process.exit(2)}
await mkdir(out,{mode:0o700})
const buildDir=await mkdtemp(resolve(tmpdir(),'dawney-connected-'))
const results=[]
const cases=['public','owner-register','owner-persistence','owner-isolation','staff-request','admin-review','staff-persistence','operations','owner-status','clinical','clinical-admin','clinical-role-denial','inventory','pharmacy','finance-unavailable','clinical-uncertain','connected-reader-faults']
const report=async()=>writeFile(resolve(out,'result.json'),JSON.stringify({sourceSha:RC2,webTree:WEB,runId:p.runId,runtimeEvidence:p.runtimeEvidence,evidenceClass:'isolated-synthetic-real-api-browser-not-hosted',results:cases.map(id=>results.find(x=>x.id===id)??{id,status:'NOT_RUN'})},null,2),{mode:0o600})
let previewServer,failed=false,blocked=false,origin
const marker='Synthetic '+p.runId
const pet=marker+' patient',concern=marker+' appointment',draft=marker+' encounter'
const sku=('UAT-'+p.runId).toUpperCase(),medicine=marker+' supply',lot='LOT-'+p.runId
let applicantPrefix,bookDay,bookingStart
// Only DOM interactions. Never write authentication state or fixture data into browser storage.
function ui(b){
 const wait=(expr,ms=20000)=>b.until(expr,ms)
 const go=async path=>{assert.match(path,/^\/(?:app\/[a-z/-]+|auth\/[a-z]+|services|about|location|contact|book)?$/);await b.goto(origin+path);await wait('location.origin==='+q(origin)+'&&!!document.querySelector("h1")')}
 const has=(text,scope='#main-content')=>wait('document.querySelector('+q(scope)+')?.innerText.includes('+q(text)+')')
 const visible=expr=>'('+expr+')?.getClientRects().length>0'
 const element=(selector,text)=>'Array.from(document.querySelectorAll('+q(selector)+')).filter(e=>e.getClientRects().length&&'+(text===undefined?'true':'e.textContent.trim()==='+q(text))+')'
 const one=(selector,text)=>'('+element(selector,text)+')[0]'
 const clickExpr=async expr=>{
  await wait('!!('+expr+')&&!('+expr+').disabled&&'+visible(expr))
  assert.equal(await b.value('(()=>{const e='+expr+';if(!e||e.disabled)return false;e.scrollIntoView({block:"center"});e.click();return true})()'),true)
 }
 const click=(label,scope='main')=>clickExpr(one(scope+' button',label))
 const clickSel=selector=>clickExpr('document.querySelector('+q(selector)+')')
 const contains=(selector,text)=>'Array.from(document.querySelectorAll('+q(selector)+')).filter(e=>e.getClientRects().length&&e.innerText.includes('+q(text)+'))'
 const exactRow=async(selector,text)=>{
  await wait(contains(selector,text)+'.length===1')
  return '('+contains(selector,text)+')[0]'
 }
 const field=(label,scope='main')=>'Array.from(document.querySelectorAll('+q(scope+' label')+')).find(e=>e.textContent.trim().startsWith('+q(label)+'))?.querySelector("input,select,textarea")'
 const fillExpr=async(expr,value)=>{
  await wait('!!('+expr+')&&!('+expr+').disabled')
  assert.equal(await b.value('(()=>{const e='+expr+';const proto=e instanceof HTMLSelectElement?HTMLSelectElement.prototype:e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;if(e instanceof HTMLSelectElement&&!Array.from(e.options).some(o=>o.value==='+q(value)+'&&!o.disabled))return false;Object.getOwnPropertyDescriptor(proto,"value").set.call(e,'+q(value)+');e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}));return e.value==='+q(value)+'})()'),true)
 }
 const fill=(label,value,scope)=>fillExpr(field(label,scope),value)
 const select=async(selector,value)=>{const expr='document.querySelector('+q(selector)+')';await wait('!!('+expr+')&&Array.from(('+expr+').options).some(o=>o.value==='+q(value)+'&&!o.disabled)');await fillExpr(expr,value)}
 const key=async(name)=>{const code={Enter:13,Tab:9,Escape:27,ArrowRight:39}[name];await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:name,code:name,windowsVirtualKeyCode:code,...(name==='Enter'?{text:'\r',unmodifiedText:'\r'}:{})});await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:name,code:name,windowsVirtualKeyCode:code})}
 const viewport=async(w,h)=>{await b.send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:false});await wait('innerWidth==='+w+'&&innerHeight==='+h);assert.equal(await b.value('document.documentElement.scrollWidth<=innerWidth'),true)}
 const theme=async name=>{if(await b.value('document.documentElement.getAttribute("data-theme")')!==name){await clickSel('button[aria-label="Switch to '+name+' theme"]');await wait('document.documentElement.getAttribute("data-theme")==='+q(name))}}
 const shot=async(name)=>{
  assert.match(name,/^[a-z0-9-]+$/)
  assert.equal(await b.value('location.origin'),origin)
  assert.equal(await b.value('!!document.querySelector("input[type=password]")'),false)
  const png=await b.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})
  await writeFile(resolve(out,name+'.png'),Buffer.from(png.data,'base64'),{mode:0o600})
 }
 const realRequest=async prefix=>wait('performance.getEntriesByType("resource").some(e=>e.name.startsWith('+q(BACKEND+prefix)+'))')
 return {b,wait,go,has,click,clickExpr,clickSel,exactRow,fill,fillExpr,field,select,key,viewport,theme,shot,realRequest,one}
}
async function browser(fn){return withChromium(async b=>{await b.send('Network.enable');return fn(ui(b))})}
async function signIn(u,role){
 await u.go('/auth/signin');await u.fill('Email address',p.accounts[role].email);await u.fill('Password',p.accounts[role].password)
 await u.click('Sign in');await u.wait('location.pathname==="/app/overview"&&!!document.querySelector(".sidebar")')
 await u.realRequest('/auth/v1/token')
 assert.equal(await u.b.value('document.querySelector(".sidebar-bottom").innerText.includes('+q(p.accounts[role].email)+')'),true)
}
async function signup(u,role){
 if(!process.stdin.isTTY)throw Object.assign(Error('local mail operator required'),{blocked:true})
 await u.go('/auth/signup');await u.fill('First name','Synthetic');await u.fill('Last name',p.runId)
 await u.fill('Email address',p.accounts[role].email);await u.fill('Password',p.accounts[role].password)
 await u.click('Create account');await u.has('confirmation link','.auth-panel')
 await u.realRequest('/auth/v1/signup')
 // ASTRA must configure an actual local-only mail sink with OTP template.
 // Code is entered interactively from that sink, never preseeded or recorded.
 await u.go('/auth/verify');await u.fill('Email address',p.accounts[role].email)
 const rl=createInterface({input:process.stdin,output:process.stderr})
 let otp
 try{otp=(await rl.question('Local synthetic mail OTP for '+role+' (no external mail): ')).trim()}finally{rl.close()}
 assert.match(otp,/^[0-9]{6,8}$/)
 await u.fill('Confirmation code',otp);await u.click('Verify email')
 await u.wait('location.pathname==="/app/overview"&&!!document.querySelector(".sidebar")')
 await u.realRequest('/auth/v1/verify')
}
async function branch(u,selector){
 await u.wait('!!document.querySelector('+q(selector)+')')
 await u.select(selector,p.branchId)
}
async function ops(u,day){
 await u.go('/app/ops')
 await u.wait('!!document.querySelector(\'[aria-label="Branch selection"]\')')
 if(await u.b.value('!!document.querySelector(\'[aria-label="Branch selection"] select\')'))await u.select('[aria-label="Branch selection"] select',p.branchId)
 else await u.has(p.branchLabel,'[aria-label="Branch selection"]')
 await u.fillExpr('document.querySelector(".ops-toolbar input[type=date]")',day)
}
async function clinical(u,role){
 await u.go('/app/clinical');await branch(u,'#clinical-branch')
 await u.fillExpr('document.querySelector("#clinical-day")',p.checkedInDay)
 const visit=await u.exactRow('.clinical-patient','Visit '+p.checkedInVisitId.slice(0,8))
 await u.clickExpr(visit);await u.wait('!!document.querySelector(".clinical-chart")')
 await u.has(p.checkedInPetId.slice(0,8),'.clinical-chart')
 await u.clickSel('#clinical-tab-encounter');await u.wait('!!document.querySelector(".clinical-encounter-editor")')
}
async function run(id,fn){
 if(failed||blocked)return
 try{await fn();results.push({id,status:'PASS_BROWSER'});console.log(id+': PASS_BROWSER')}
 catch(e){blocked=e?.blocked===true;failed=!blocked;results.push({id,status:blocked?'BLOCKED':'FAIL',reason:blocked?'local runtime dependency unavailable':'browser assertion failed; inspect isolated runtime privately'});console.error(id+': '+(blocked?'BLOCKED':'FAIL')+' (no raw browser data logged)')}
 finally{await report()}
}
try{
 for(const f of flags)process.env[f]='true' // only ephemeral synthetic build, no default changes
 process.env.VITE_SUPABASE_URL=BACKEND;process.env.VITE_SUPABASE_PUBLISHABLE_KEY=p.publishableKey
 const {build,preview}=await import('vite')
 execFileSync(process.execPath,[resolve(web,'node_modules/typescript/bin/tsc'),'--noEmit'],{cwd:web,stdio:'ignore'})
 await build({root:web,logLevel:'silent',build:{outDir:buildDir,emptyOutDir:true}})
 previewServer=await preview({root:web,logLevel:'silent',build:{outDir:buildDir},preview:{host:'127.0.0.1',port:0}})
 origin='http://127.0.0.1:'+previewServer.httpServer.address().port
 await run('public',()=>browser(async u=>{
  for(const [w,h] of [[360,740],[768,900],[1440,900]])for(const theme of ['light','dark']){
   await u.go('/');await u.viewport(w,h);await u.theme(theme)
   await u.has('Dawney Animal Clinic');await u.has('Monday to Saturday')
   await u.shot('public-'+w+'-'+theme)
   if(w<768){await u.clickSel('.site-menu');await u.wait('document.querySelector(".site-menu").getAttribute("aria-expanded")==="true"');await u.key('Escape');await u.wait('document.activeElement===document.querySelector(".site-menu")')}
   await u.go('/services');await u.has('Service categories')
   for(const text of ['Veterinary consultations','Vaccinations','Deworming','Diagnostic services','Surgical procedures','Dental care','Grooming','Hospitalization'])await u.has(text)
   await u.go('/location');await u.has('80 Perpetual Help Street');await u.has('Brookside Lane');await u.has('Sunday hours have not been confirmed')
   assert.equal(await u.b.value('document.querySelectorAll(".branch-directory .branch-card").length'),2)
   assert.equal(await u.b.value('Array.from(document.querySelectorAll(".branch-directory a")).filter(a=>a.href.includes("facebook.com")||a.href.includes("maps.app.goo.gl")).length'),4)
   await u.viewport(w,h)
  }
  await u.go('/about');await u.go('/contact');await u.go('/book');await u.has('Book an appointment')
  await u.realRequest('/rest/v1/')
  // Anonymous booking may truthfully be unavailable until owner eligibility.
  assert.equal(await u.b.value('!Array.from(document.querySelectorAll("button")).some(e=>e.textContent.trim()==="Send appointment request"&&!e.disabled)'),true)
  await u.go('/app/overview');await u.wait('location.pathname==="/auth/signin"')
  assert.equal(await u.b.value('parseFloat(getComputedStyle(document.querySelector(".auth-panel input")).fontSize)>=16'),true)
 }))
 await run('owner-register',()=>browser(async u=>{
  await signup(u,'ownerNew');await u.go('/app/profile')
  await u.wait('!!document.querySelector("form.form-stack input[autocomplete=given-name]")')
  await u.fill('First name','Synthetic');await u.fill('Last name',p.runId)
  const create=await u.b.value('Array.from(document.querySelectorAll("button")).some(e=>e.textContent.trim()==="Create owner profile")')
  await u.click(create?'Create owner profile':'Save changes');await u.has('Your profile was saved to the clinic database.')
  await u.go('/app/pets');await u.click('Add patient');await u.fill('Name',pet)
  await u.clickSel('input[role=combobox]');await u.fillExpr('document.querySelector("input[role=combobox]")',p.speciesLabel)
  await u.clickExpr(await u.exactRow('[role=option]',p.speciesLabel))
  await u.select('select[id$="-breed"]',p.breedId);await u.click('Save patient');await u.has(pet)
  await u.go('/app/pets');await u.has(pet);await u.realRequest('/rest/v1/pets')
 }))
 await run('owner-persistence',()=>browser(async u=>{
  await signIn(u,'ownerNew');await u.go('/app/pets');await u.has(pet)
  await u.go('/app/appointments');await u.wait('!!document.querySelector(\'form[aria-label="Appointment request"]\')')
  const form='form[aria-label="Appointment request"]'
  const petExpr='document.querySelector(".patient-select select")'
  await u.wait('!!('+petExpr+')&&Array.from(('+petExpr+').options).some(o=>o.textContent.includes('+q(pet)+')&&!o.disabled)')
  const petId=await u.b.value('Array.from(('+petExpr+').options).find(o=>o.textContent.includes('+q(pet)+')).value')
  await u.fillExpr(petExpr,petId);await u.fill('Service',p.serviceId,form)
  // Fixture contract requires exactly one approved resource for this service.
  await u.wait('!!('+u.field('Date',form)+')&&('+u.field('Date',form)+').options.length>1')
  bookDay=await u.b.value('Array.from(('+u.field('Date',form)+').options).find(o=>o.value&&!o.disabled).value')
  await u.fill('Date',bookDay,form);await u.wait('!!document.querySelector("input[name=slot]:not(:disabled)")')
  bookingStart=await u.b.value('document.querySelector("input[name=slot]:not(:disabled)").value')
  await u.clickSel('input[name=slot]:not(:disabled)');await u.fill('Reason for visit',concern,form)
  await u.clickExpr('document.querySelector('+q(form+' button[type=submit],'+form+' button.button-primary')+')')
  await u.has('Request received');await u.go('/app/appointments')
  const row=await u.exactRow('.booking-item',concern)
  assert.equal(await u.b.value(row+'.innerText.toLowerCase().includes("requested")'),true)
  assert.equal(await u.b.value(row+'.querySelector("time").dateTime'),bookingStart)
  await u.realRequest('/rest/v1/appointments');await u.shot('owner-requested')
 }))
 await run('owner-isolation',()=>browser(async u=>{
  await signIn(u,'ownerOther');await u.go('/app/pets');await u.has(p.otherOwnerPet)
  assert.equal(await u.b.value('!document.body.innerText.includes('+q(pet)+')'),true)
  await u.go('/app/appointments');await u.has('My bookings')
  assert.equal(await u.b.value('!document.body.innerText.includes('+q(concern)+')'),true)
  await u.go('/app/staff-management');await u.has('Administrator approval required')
 }))
 await run('staff-request',()=>browser(async u=>{
  await signup(u,'applicant')
  // Read only the synthetic user's ID, not the session token; never emit it.
  applicantPrefix=await u.b.value('JSON.parse(localStorage.getItem("dawney.auth.v1")).user.id.slice(0,8)')
  assert.match(applicantPrefix,/^[0-9a-f]{8}$/)
  await u.go('/app/staff-access');await u.fill('Requested clinic branch',p.branchId);await u.fill('Interested staff role','receptionist')
  await u.fill('Additional note',marker+' staff request');await u.click('Submit staff access request')
  await u.has('Pending Approval — confirmed by the staff access server.')
  await u.go('/app/staff-access');await u.has('Pending Approval')
  await u.go('/app/staff-management');await u.has('Administrator approval required')
 }))
 await run('admin-review',()=>browser(async u=>{
  await signIn(u,'administrator');await u.go('/app/staff-management');await u.fill('Manage requests in branch',p.branchId)
  const row=await u.exactRow('tbody tr',applicantPrefix)
  assert.equal(await u.b.value(row+'.innerText.includes("Pending Approval")'),true)
  await u.clickExpr(row+'.querySelector("button")');await u.fill('Decision','approve');await u.fill('Assign role','receptionist')
  const box='Array.from(document.querySelectorAll(".operator-review label")).find(e=>e.textContent.trim()==='+q(p.branchLabel)+')?.querySelector("input[type=checkbox]")'
  await u.wait('!!('+box+')')
  if(!await u.b.value(box+'.checked'))await u.clickExpr(box)
  await u.click('Confirm approve');await u.has('Staff decision confirmed by the server and reloaded roster.')
  await u.go('/app/staff-management');await u.fill('Manage requests in branch',p.branchId)
  const persisted=await u.exactRow('tbody tr',applicantPrefix);assert.equal(await u.b.value(persisted+'.innerText.includes("Approved")'),true)
  await u.shot('administrator-roster')
 }))
 await run('staff-persistence',()=>browser(async u=>{
  await signIn(u,'applicant');await u.go('/app/staff-access');await u.has('Verified existing staff access:');await u.has('receptionist')
  await u.go('/app/ops');await u.has(p.branchLabel,'[aria-label="Branch selection"]')
  assert.equal(await u.b.value('!document.querySelector(".sidebar a[href=\'/app/staff-management\']")'),true)
  await u.viewport(360,740);await u.clickSel('.mobile-toggle');await u.wait('document.querySelector(".app-content").inert')
  await u.key('Escape');await u.wait('document.activeElement===document.querySelector(".mobile-toggle")')
  await u.viewport(1440,600);assert.equal(await u.b.value('(()=>{const s=document.querySelector(".sidebar"),e=s.querySelector(".sidebar-bottom button");e.focus();const r=e.getBoundingClientRect(),v=s.getBoundingClientRect();return r.bottom<=v.bottom+1&&document.activeElement===e})()'),true)
 }))
 await run('operations',()=>browser(async u=>{
  await signIn(u,'receptionist');await ops(u,bookDay)
  const row=await u.exactRow('.ops-visit',concern)
  await u.clickExpr(row+'.querySelector("button[aria-label]")');await u.click('Confirm request','.appointment-lifecycle');await u.click('Apply Confirm request','.appointment-lifecycle')
  await u.wait('Array.from(document.querySelectorAll(".ops-visit")).some(e=>e.innerText.includes('+q(concern)+')&&e.innerText.toLowerCase().includes("confirmed"))')
  await u.go('/app/ops');await ops(u,bookDay);const saved=await u.exactRow('.ops-visit',concern)
  assert.equal(await u.b.value(saved+'.innerText.toLowerCase().includes("confirmed")'),true)
  await u.click('Schedule');await u.click('Week');await u.wait('document.querySelector(\'[aria-label="Schedule length"] button[aria-pressed=true]\').textContent==="Week"')
  await u.click('Day');await u.click('Flow board')
  for(const [w,h] of [[360,740],[768,900],[1440,600]])for(const theme of ['light','dark']){await u.viewport(w,h);await u.theme(theme);await u.shot('operations-'+w+'-'+theme)}
 }))
 await run('owner-status',()=>browser(async u=>{
  await signIn(u,'ownerNew');await u.go('/app/appointments');const row=await u.exactRow('.booking-item',concern)
  assert.equal(await u.b.value(row+'.innerText.toLowerCase().includes("confirmed")'),true)
 }))
 await run('clinical',async()=>{
  await browser(async u=>{
   await signIn(u,'veterinarian');await clinical(u,'veterinarian')
   await u.fillExpr('document.querySelector(".clinical-encounter-editor textarea")',draft)
   await u.has('Unsaved local edits','.clinical-encounter-editor');await u.click('Save encounter DRAFT','.clinical-encounter-editor')
   await u.has('Verified persisted DRAFT saved.','.clinical-encounter-editor')
   await u.shot('clinical-saved')
  })
  await browser(async u=>{
   await signIn(u,'veterinarian');await clinical(u,'veterinarian')
   await u.wait('document.querySelector(".clinical-encounter-editor textarea")?.value==='+q(draft))
   await u.click('Find previous own receipt','.clinical-encounter-editor')
   await u.has('Previous own receipt found.','.clinical-encounter-editor')
   await u.click('Review and use current chart','.clinical-encounter-editor')
   await u.has('Authoritative draft revision','.clinical-encounter-editor')
   await u.shot('clinical-receipt')
  })
 })
 await run('clinical-admin',()=>browser(async u=>{
  await signIn(u,'administrator');await clinical(u,'administrator')
  assert.equal(await u.b.value('Array.from(document.querySelectorAll(".clinical-encounter-editor textarea")).every(e=>e.disabled)&&document.querySelector(".clinical-encounter-editor button[type=submit]").disabled'),true)
  await u.wait('document.querySelector(".clinical-encounter-editor textarea")?.value==='+q(draft))
  await u.select('#clinical-branch',p.otherBranchId);await u.has(p.otherBranchLabel)
  assert.equal(await u.b.value('!document.querySelector(".clinical-chart")'),true)
 }))
 await run('clinical-role-denial',()=>browser(async u=>{
  await signIn(u,'receptionist');await u.go('/app/clinical');await branch(u,'#clinical-branch')
  await u.fillExpr('document.querySelector("#clinical-day")',p.checkedInDay)
  await u.wait('!!document.querySelector(".clinical-patient")')
  await u.clickExpr(await u.exactRow('.clinical-patient',p.checkedInPetId.slice(0,8)))
  await u.wait('!!document.querySelector(".clinical-chart")')
  assert.equal(await u.b.value('!Array.from(document.querySelectorAll(".clinical-encounter-editor button[type=submit]")).some(e=>!e.disabled)'),true)
  assert.equal(await u.b.value('!document.body.innerText.includes('+q(draft)+')'),true)
 }))
 await run('inventory',async()=>{
  await browser(async u=>{
   await signIn(u,'receptionist');await u.go('/app/inventory');await branch(u,'#operator-branch')
   const scope='[aria-labelledby="add-item-heading"]'
   await u.fill('Product type','supply',scope);await u.fill('Item code',sku,scope);await u.fill('Description / item name',medicine,scope);await u.fill('Stock unit','unit',scope);await u.fill('Reorder point','0',scope)
   await u.clickExpr('document.querySelector('+q(scope+' button[type=submit]')+')')
   await u.has('Item saved and confirmed on server: '+sku)
   const receive='[aria-labelledby="receive-heading"]'
   await u.fill('Existing item code',sku,receive);await u.fill('Batch / lot number',lot,receive);await u.fill('Quantity','10',receive);await u.fill('Expiry date',p.expiryDay,receive)
   await u.click('Receive Stock',receive);await u.has('Received 10 units — server-confirmed stock event')
   await u.shot('inventory-receipt')
  })
  await browser(async u=>{
   await signIn(u,'administrator');await u.go('/app/inventory');await branch(u,'#operator-branch')
   const f=u.field('Select an existing branch item')
   await u.wait('!!('+f+')&&Array.from(('+f+').options).some(o=>o.textContent.includes('+q(sku)+'))')
   const id=await u.b.value('Array.from(('+f+').options).find(o=>o.textContent.includes('+q(sku)+')).value')
   await u.fillExpr(f,id);await u.wait('document.querySelector(".operator-balances strong")?.textContent==="10"')
  })
 })
 await run('pharmacy',()=>browser(async u=>{
  await signIn(u,'veterinarian');await u.go('/app/pharmacy');await branch(u,'#pharmacy-branch')
  await u.clickExpr(await u.exactRow('.pharmacy-medicine',sku));await u.has(lot,'.pharmacy-panel')
  await u.clickExpr(u.one('[role=tab]','FEFO candidates'));await u.has(lot,'.pharmacy-panel')
  await u.clickExpr(u.one('[role=tab]','Movement history'));await u.has('Change: +10','.pharmacy-panel')
  assert.equal(await u.b.value('Array.from(document.querySelectorAll("button")).filter(e=>["Receive stock","Adjust quantity","Dispense medicine","Transfer between branches"].includes(e.textContent.trim())).every(e=>e.disabled)'),true)
  await u.shot('pharmacy-ledger')
 }))
 await run('finance-unavailable',()=>browser(async u=>{
  await signIn(u,'administrator');await u.go('/app/billing');await u.wait('!!document.querySelector("#billing-title")')
  await u.wait('!!document.querySelector(".billing-actions[aria-label] button")')
  assert.equal(await u.b.value('Array.from(document.querySelectorAll(".billing-actions[aria-label] button")).every(e=>e.disabled)'),true)
  await u.go('/app/communications');await u.has('Messaging unavailable')
  assert.equal(await u.b.value('Array.from(document.querySelectorAll("button")).filter(e=>/Send message|Schedule reminder/.test(e.textContent)).every(e=>e.disabled)'),true)
  await u.shot('communications-unavailable')
 }))
 // True committed-but-lost acknowledgement and delayed/denied reader require
 // ASTRA's independently controlled real server/proxy fault interface. Never
 // substitute an intercepted response or mark a theoretical scenario passed.
 results.push({id:'clinical-uncertain',status:'BLOCKED',reason:'real committed-response loss control not yet contracted'})
 results.push({id:'connected-reader-faults',status:'BLOCKED',reason:'real delay/deny/retry control not yet contracted'})
} catch {failed=true;console.error('FAIL: connected runner build/runtime error; no raw data logged')}
finally{
 await report()
 if(previewServer)await new Promise(resolveClose=>previewServer.httpServer.close(resolveClose))
 await rm(buildDir,{recursive:true,force:true})
}
process.exitCode=failed?1:2 // until all mandatory runtime fault cases are implemented and executed
