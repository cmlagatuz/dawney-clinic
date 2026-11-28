// Explicitly invoked connected acceptance. Never picked up by npm test.
// No HTTP fixture, intercepted backend response, Auth injection, provider SDK
// mutation, SQL, arbitrary endpoint, secret logging or production fallback.
import {readFile,mkdtemp,mkdir,writeFile,rm,readdir} from 'node:fs/promises'
import {randomBytes,createHash} from 'node:crypto'
import {setTimeout as sleep} from 'node:timers/promises'
import {tmpdir} from 'node:os'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
import assert from 'node:assert/strict'
import {BACKEND,RC2,WEB,flags,validatePacket,verifyLocalBackend,verifySource,outsideCheckout,privatePacket,requireEmptySignupMailbox,waitForSignupOtp,waitForSignupLink,requireEmptyRecoveryMailbox,waitForRecoveryLink,LINK_PORT} from './runtime-guard.mjs'
import {withChromium} from '../../../scripts/browser/cdp.mjs'
const root=fileURLToPath(new URL('../../../',import.meta.url))
const web=resolve(root,'web')
const q=JSON.stringify
const shortRef=id=>id.replace(/-/g,'').slice(0,6).toUpperCase()
const packetPath=process.env.DAWNEY_CONNECTED_PACKET
const outputPath=process.env.DAWNEY_CONNECTED_EVIDENCE
if(!packetPath||!outputPath){console.error('BLOCKED: ASTRA runtime packet and new private evidence directory required');process.exit(2)}
let p,out
try{
 p=validatePacket(JSON.parse(await readFile(privatePacket(root,packetPath),'utf8')),process.env.DAWNEY_CONNECTED_APPROVAL)
 verifySource(root)
 out=outsideCheckout(root,outputPath)
 await verifyLocalBackend(p)
}catch{console.error('BLOCKED: runtime/source/approval preflight failed; no browser started');process.exit(2)}
await mkdir(out,{mode:0o700})
const buildDir=await mkdtemp(resolve(tmpdir(),'dawney-connected-'))
const results=[]
const cases=['public','owner-register','owner-persistence','owner-isolation','staff-request','admin-review','staff-persistence','operations','owner-status','clinical','clinical-admin','clinical-role-denial','inventory','pharmacy','inventory-edit','accountant-denial','session-transition','network-retry','owner-cancel','finance-unavailable','private-attachment','attachment-owner-isolation','email-callback','email-recovery','accessibility-mobile','clinical-uncertain','controlled-late-response','additional-lifecycle']
const report=async()=>writeFile(resolve(out,'result.json'),JSON.stringify({sourceSha:RC2,webTree:WEB,runId:p.runId,runtimeEvidence:p.runtimeEvidence,evidenceClass:'isolated-synthetic-real-api-browser-not-hosted',results:cases.map(id=>results.find(x=>x.id===id)??{id,status:'NOT_RUN'})},null,2),{mode:0o600})
let previewServer,failed=false,blocked=false,origin,fileDir
const marker='Synthetic '+p.runId
const pet=marker+' patient',concern=marker+' appointment',draft=marker+' encounter'
const sku=('UAT-'+p.runId).toUpperCase(),medicine=marker+' supply',lot='LOT-'+p.runId
let applicantPrefix,bookDay,bookingStart,attachment,applicantVerifiedByLink=false
// Only DOM interactions. Never write authentication state or fixture data into browser storage.
function ui(b){
 const wait=(expr,ms=20000)=>b.until(expr,ms)
 const go=async path=>{assert.match(path,/^\/(?:app\/[a-z/-]+|auth\/[a-z]+|services|about|location|contact|book)?$/);await b.goto(origin+path);await wait('location.origin==='+q(origin)+'&&(location.pathname==='+q(path)+'||('+q(path.startsWith('/app/'))+'&&location.pathname==="/auth/signin"))&&!!document.querySelector("h1")')}
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
  await wait('!!('+expr+')&&!('+expr+').disabled&&(!('+expr+' instanceof HTMLSelectElement)||Array.from(('+expr+').options).some(o=>o.value==='+q(value)+'&&!o.disabled))')
  assert.equal(await b.value('(()=>{const e='+expr+';const proto=e instanceof HTMLSelectElement?HTMLSelectElement.prototype:e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;if(e instanceof HTMLSelectElement&&!Array.from(e.options).some(o=>o.value==='+q(value)+'&&!o.disabled))return false;Object.getOwnPropertyDescriptor(proto,"value").set.call(e,'+q(value)+');e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}));return e.value==='+q(value)+'})()'),true)
 }
 const fill=(label,value,scope)=>fillExpr(field(label,scope),value)
 const select=async(selector,value)=>{const expr='document.querySelector('+q(selector)+')';await wait('!!('+expr+')&&Array.from(('+expr+').options).some(o=>o.value==='+q(value)+'&&!o.disabled)');await fillExpr(expr,value)}
 const key=async(name,shift=false)=>{const code={Enter:13,Tab:9,Escape:27,ArrowRight:39}[name],modifiers=shift?8:0;await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:name,code:name,windowsVirtualKeyCode:code,modifiers,...(name==='Enter'?{text:'\r',unmodifiedText:'\r'}:{})});await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:name,code:name,windowsVirtualKeyCode:code,modifiers})}
 const viewport=async(w,h)=>{await b.send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:false});await wait('innerWidth==='+w+'&&innerHeight==='+h);assert.equal(await b.value('document.documentElement.scrollWidth<=innerWidth'),true)}
 const theme=async name=>{if(await b.value('document.documentElement.getAttribute("data-theme")')!==name){await clickSel('button[aria-label="Switch to '+name+' theme"]');await wait('document.documentElement.getAttribute("data-theme")==='+q(name))}}
 const shot=async(name)=>{
  assert.match(name,/^[a-z0-9-]+$/)
  assert.equal(await b.value('location.origin'),origin)
  assert.equal(await b.value('!!document.querySelector("input[type=password]")'),false)
  const png=await b.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})
  await writeFile(resolve(out,name+'.png'),Buffer.from(png.data,'base64'),{mode:0o600})
 }
 const requests=prefix=>b.value('performance.getEntriesByType("resource").filter(e=>e.name.startsWith('+q(BACKEND+prefix)+')).length')
 const realRequest=async prefix=>wait('performance.getEntriesByType("resource").some(e=>e.name.startsWith('+q(BACKEND+prefix)+'))')
 return {b,wait,go,has,click,clickExpr,clickSel,exactRow,fill,fillExpr,field,select,key,viewport,theme,shot,realRequest,requests,one}
}
async function browser(fn){return withChromium(async b=>{await b.send('Network.enable');return fn(ui(b))})}
async function signIn(u,role){
 await u.go('/auth/signin');await u.fill('Email address',p.accounts[role].email);await u.fill('Password',p.accounts[role].password)
 await u.click('Sign in');await u.wait('location.pathname==="/app/overview"&&!!document.querySelector(".sidebar")')
 await u.realRequest('/auth/v1/token')
 assert.equal(await u.b.value('document.querySelector(".sidebar-bottom").innerText.includes('+q(p.accounts[role].email)+')'),true)
}
async function beginSignup(u,role){
 // Recheck before the actual signup: a stale message cannot satisfy this case.
 await requireEmptySignupMailbox(p,role)
 await u.go('/auth/signup');await u.fill('First name','Synthetic');await u.fill('Last name',p.runId)
 await u.fill('Email address',p.accounts[role].email);await u.fill('Password',p.accounts[role].password)
 await u.click('Create account');await u.has('confirmation link','.auth-panel')
 await u.realRequest('/auth/v1/signup')
}
async function signup(u,role){
 await beginSignup(u,role)
 // Actual Auth sends mail to the verified isolated sink. Only read the exact
 // new recipient's message; no preverification, token minting or log output.
 const otp=await waitForSignupOtp(p,role,origin)
 await u.go('/auth/verify');await u.fill('Email address',p.accounts[role].email)
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
 const visit=await u.exactRow('.clinical-patient','Visit '+shortRef(p.checkedInVisitId))
 await u.clickExpr(visit);await u.wait('!!document.querySelector(".clinical-chart")')
 await u.has(shortRef(p.checkedInPetId),'.clinical-chart')
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
 previewServer=await preview({root:web,logLevel:'silent',build:{outDir:buildDir},preview:{host:'127.0.0.1',port:p.authLinks?LINK_PORT:0,strictPort:!!p.authLinks}})
 origin='http://127.0.0.1:'+previewServer.httpServer.address().port
 await run('public',()=>browser(async u=>{
  for(const [w,h] of [[360,740],[768,900],[1440,900]])for(const theme of ['light','dark']){
   await u.go('/');await u.viewport(w,h);await u.theme(theme)
   await u.has('Dawney Animal Clinic');await u.has('Monday to Saturday')
   await u.shot('public-'+w+'-'+theme)
   const mobile=await u.b.value('document.querySelector(".site-menu")?.getClientRects().length>0')
   if(mobile){await u.clickSel('.site-menu');await u.wait('document.querySelector(".site-menu").getAttribute("aria-expanded")==="true"');await u.key('Escape');await u.wait('document.activeElement===document.querySelector(".site-menu")');await u.clickSel('.site-menu')}
   await u.b.value('document.querySelector(\'.site-nav a[href="/services"]\').focus();true');await u.key('Enter');await u.wait('location.pathname==="/services"');await u.has('Service categories')
   await u.wait('document.activeElement===document.querySelector("#main-content")')
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
  await u.viewport(360,740);await signup(u,'ownerNew');await u.go('/app/profile')
  await u.wait('!!document.querySelector("form.form-stack input[autocomplete=given-name]")')
  await u.fill('First name','Synthetic');await u.fill('Last name',p.runId)
  const create=await u.b.value('Array.from(document.querySelectorAll("button")).some(e=>e.textContent.trim()==="Create owner profile")')
  await u.click(create?'Create owner profile':'Save changes');await u.has('Your profile was saved to the clinic database.')
  await u.go('/app/pets');await u.clickExpr(u.one('main button','Add patient'));await u.fill('Name',pet)
  await u.clickSel('input[role=combobox]');await u.fillExpr('document.querySelector("input[role=combobox]")',p.speciesLabel)
  await u.clickExpr(await u.exactRow('[role=option]',p.speciesLabel))
  await u.select('select[id$="-breed"]',p.breedId);await u.click('Save patient');await u.has(pet)
  await u.go('/app/pets');await u.has(pet);await u.realRequest('/rest/v1/pets');await u.viewport(360,740);await u.shot('owner-patient-mobile')
 }))

 // Same newly registered patient, no additional backend fixture. Generate
 // one harmless synthetic PNG document in private temporary storage.
 const docName='synthetic-'+p.runId+'-health-card.png'
 const docBytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAALUlEQVR4nGMMrZ3GQEvARFPTRy0YtWDUglELRi0YtWDUglELRi0YtWDUAioCAJsdAaiiHDv7AAAAAElFTkSuQmCC','base64')
 const docDigest=createHash('sha256').update(docBytes).digest('hex')
 fileDir=await mkdtemp(resolve(tmpdir(),'dawney-private-attachment-'))
 const downloadDir=resolve(fileDir,'downloads');await mkdir(downloadDir,{mode:0o700})
 const localDoc=resolve(fileDir,docName);await writeFile(localDoc,docBytes,{mode:0o600})
 async function editPatient(u,name){
  await u.go('/app/pets');const card=await u.exactRow('.patient-card',name)
  await u.clickExpr(card+'.querySelector("button")')
  await u.wait('!!document.querySelector("#patient-form-top .attachment")')
 }
 const health='Array.from(document.querySelectorAll("#patient-form-top fieldset.attachment")).find(e=>e.querySelector("legend")?.textContent.startsWith("Health card"))'
 // Supplement normal UI download with real actor-token GETs in the actual
 // browser; no tokens leave the evaluation context. Never write via this path.
 async function attachmentMetadata(u,filters){
  const query=new URLSearchParams({select:'id,pet_id,category,version_no,object_path,original_filename,mime_type,size_bytes',...filters})
  return u.b.value('(async()=>{const s=JSON.parse(localStorage.getItem("dawney.auth.v1"));if(!s?.access_token)throw Error("verified actor required");const r=await fetch('+q(BACKEND+'/rest/v1/pet_attachments?'+query)+',{redirect:"error",headers:{apikey:'+q(p.publishableKey)+',Authorization:"Bearer "+s.access_token}});if(!r.ok)throw Error("metadata read failed");return await r.json()})()')
 }
 async function attachmentBytes(u,row){
  const path=row.object_path
  assert.match(path,/^pets\/[0-9a-f-]{36}\/owners\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.png$/i)
  assert.ok(path.startsWith('pets/'+row.pet_id+'/owners/'))
  return u.b.value('(async()=>{const s=JSON.parse(localStorage.getItem("dawney.auth.v1"));if(!s?.access_token)throw Error("verified actor required");const r=await fetch('+q(BACKEND+'/storage/v1/object/authenticated/clinical-attachments/'+path)+',{redirect:"error",cache:"no-store",headers:{apikey:'+q(p.publishableKey)+',Authorization:"Bearer "+s.access_token}});if(r.ok){const bytes=await r.arrayBuffer();const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))).map(x=>x.toString(16).padStart(2,"0")).join("");return {status:r.status,size:bytes.byteLength,hash}}let denial=false;try{const e=await r.json();const text=[e.error,e.message,e.code].filter(x=>typeof x==="string").join(" ").toLowerCase();denial=[400,401,403,404].includes(r.status)&&/object not found|nosuchkey|not_found|not found|access denied|accessdenied|unauthorized|forbidden|permission denied/.test(text)}catch{}return {status:r.status,denial}})()')
 }
 await run('private-attachment',async()=>{
  await browser(async u=>{
   await u.viewport(360,740);await signIn(u,'ownerNew');await editPatient(u,pet)
   await u.wait('('+health+')?.innerText.includes("No document saved yet.")&&!('+health+').disabled')
   const doc=await u.b.send('DOM.getDocument',{depth:-1})
   const result=await u.b.send('DOM.querySelectorAll',{nodeId:doc.root.nodeId,selector:'#patient-form-top fieldset.attachment input[type=file]'})
   assert.equal(result.nodeIds.length,3)
   // Source orders profile photo, health card, vaccination card; verify label.
   assert.equal(await u.b.value('Array.from(document.querySelectorAll("#patient-form-top fieldset.attachment"))[1]===('+health+')'),true)
   await u.b.send('DOM.setFileInputFiles',{nodeId:result.nodeIds[1],files:[localDoc]})
   await u.wait('('+health+')?.innerText.includes('+q(docName)+')&&('+health+').innerText.includes("Ready — uploads when you save")')
   await u.click('Save patient changes');await u.has('Patient information updated successfully.')
   await u.realRequest('/storage/v1/object/clinical-attachments/')
   await u.realRequest('/rest/v1/pet_attachments')
  })
  await browser(async u=>{
   await signIn(u,'ownerNew');await editPatient(u,pet)
   await u.wait('('+health+')?.innerText.includes('+q(docName)+')&&('+health+').innerText.includes("version 1")')
   const rows=await attachmentMetadata(u,{original_filename:'eq.'+docName})
   assert.equal(rows.length,1);attachment=rows[0]
   assert.equal(attachment.category,'health_card');assert.equal(attachment.version_no,1)
   assert.equal(attachment.size_bytes,docBytes.length);assert.equal(attachment.mime_type,'image/png')
   assert.deepEqual(await attachmentBytes(u,attachment),{status:200,size:docBytes.length,hash:docDigest})
   await u.b.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloadDir})
   await u.clickExpr('('+health+').querySelector("button")')
   const deadline=Date.now()+20000
   let actual
   while(Date.now()<deadline){
    const names=await readdir(downloadDir)
    if(names.length===1&&names[0]===docName){actual=await readFile(resolve(downloadDir,docName));break}
    await sleep(200)
   }
   assert.ok(actual&&actual.equals(docBytes),'actual UI download must equal uploaded bytes')
   await u.viewport(360,740);await u.shot('private-attachment-mobile')
   await u.viewport(768,900);await u.theme('dark');await u.shot('private-attachment-tablet-dark')
  })
 })
 await run('attachment-owner-isolation',()=>browser(async u=>{
  assert.ok(attachment)
  await signIn(u,'ownerOther');await editPatient(u,p.otherOwnerPet)
  await u.wait('('+health+')?.innerText.includes("No document saved yet.")||('+health+')?.innerText.includes("version ")')
  assert.equal(await u.b.value('!document.body.innerText.includes('+q(docName)+')&&!document.body.innerText.includes('+q(pet)+')'),true)
  const hidden=await attachmentMetadata(u,{id:'eq.'+attachment.id,pet_id:'eq.'+attachment.pet_id})
  assert.deepEqual(hidden,[])
  const denied=await attachmentBytes(u,attachment)
  assert.equal(denied.denial,true,'known existing private object must be denied to unrelated owner')
  await u.viewport(360,740);await u.shot('unrelated-owner-documents-mobile')
 }))
 await run('owner-persistence',()=>browser(async u=>{
  await u.viewport(360,740);await signIn(u,'ownerNew');await u.go('/app/pets');await u.has(pet)
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
  assert.equal(Date.parse(await u.b.value(row+'.querySelector("time").dateTime')),Date.parse(bookingStart))
  await u.realRequest('/rest/v1/appointments');await u.shot('owner-requested')
 }))
 await run('owner-isolation',()=>browser(async u=>{
  await signIn(u,'ownerOther');await u.go('/app/pets');await u.has(p.otherOwnerPet)
  assert.equal(await u.b.value('!document.body.innerText.includes('+q(pet)+')'),true)
  await u.go('/app/appointments');await u.has('My bookings')
  assert.equal(await u.b.value('!document.body.innerText.includes('+q(concern)+')'),true)
  await u.go('/app/staff-management');await u.has('Administrator approval required')
 }))
 if(p.authLinks){
  await run('email-callback',()=>browser(async u=>{
   await beginSignup(u,'applicant')
   const link=await waitForSignupLink(p,'applicant',origin)
   // Real email link, same initiating PKCE browser profile. No token injection.
   await u.b.goto(link);await u.wait('location.origin==='+q(origin)+'&&location.pathname==="/auth/callback"')
   await u.has('Your account is verified.','.auth-panel')
   await u.wait('!location.search.includes("code=")&&!location.hash')
   await u.clickExpr(u.one('.auth-panel a','Continue to your overview'));await u.wait('location.pathname==="/app/overview"&&!!document.querySelector(".sidebar")')
   assert.equal(await u.b.value('document.querySelector(".sidebar-bottom").innerText.includes('+q(p.accounts.applicant.email)+')'),true)
   applicantVerifiedByLink=true;await u.shot('email-confirmed-overview')
  }))
 }else results.push({id:'email-callback',status:'BLOCKED',reason:'optional actual PKCE signup link runtime not approved; applicant OTP case retained'})
 await run('staff-request',()=>browser(async u=>{
  if(applicantVerifiedByLink)await signIn(u,'applicant');else await signup(u,'applicant')
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
  await u.viewport(768,900);await signIn(u,'administrator');await u.go('/app/staff-management');await u.fill('Manage requests in branch',p.branchId)
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
  await u.click('Schedule');await u.click('Week');await u.wait('document.querySelector(\'[aria-label="Schedule length"] button[aria-pressed=true]\').textContent==="Week"&&document.querySelectorAll(".ops-weekday").length===7&&!document.querySelector(".ops-weekday [role=status],.ops-weekday [role=alert]")')
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
   const count=await u.requests('/rest/v1/rpc/save_staff_clinical_encounter_draft')
   await u.fillExpr('document.querySelector(".clinical-encounter-editor textarea")',' ')
   await u.click('Save encounter DRAFT','.clinical-encounter-editor');await u.has('Correct the highlighted fields. Nothing was saved.','.clinical-encounter-editor')
   assert.equal(await u.requests('/rest/v1/rpc/save_staff_clinical_encounter_draft'),count,'invalid draft never submits')
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
  await u.wait('document.querySelector("#clinical-branch").value==='+q(p.otherBranchId)+'&&!document.querySelector(".clinical-chart")')
 }))
 await run('clinical-role-denial',()=>browser(async u=>{
  await signIn(u,'receptionist');await u.go('/app/clinical');await branch(u,'#clinical-branch')
  await u.fillExpr('document.querySelector("#clinical-day")',p.checkedInDay)
  await u.wait('!!document.querySelector(".clinical-patient")')
  await u.clickExpr(await u.exactRow('.clinical-patient',shortRef(p.checkedInPetId)))
  await u.wait('!!document.querySelector(".clinical-chart")');await u.clickSel('#clinical-tab-encounter');await u.has('Receptionists can view authorized appointments only.','.clinical-chart')
  assert.equal(await u.b.value('!Array.from(document.querySelectorAll(".clinical-encounter-editor button[type=submit]")).some(e=>!e.disabled)'),true)
  assert.equal(await u.b.value('!document.body.innerText.includes('+q(draft)+')'),true)
 }))
 await run('inventory',async()=>{
  await browser(async u=>{
   await signIn(u,'receptionist');await u.go('/app/inventory');await branch(u,'#operator-branch')
   const scope='[aria-labelledby="add-item-heading"]'
   await u.fill('Product type','supply',scope);await u.fill('Item code',sku,scope);await u.fill('Description / item name',medicine,scope);await u.fill('Stock unit','unit',scope);await u.fill('Reorder point','0',scope)
   await u.clickExpr('document.querySelector('+q(scope+' button[type=submit]')+')')
   await u.has('Item saved and confirmed on server: '+sku+' · on hand 0')
   const receive='[aria-labelledby="receive-heading"]'
   await u.fill('Existing item code',sku,receive);await u.fill('Batch / lot number',lot,receive);await u.fill('Quantity','0',receive);await u.fill('Expiry date',p.expiryDay,receive)
   const before=await u.requests('/rest/v1/rpc/receive_branch_inventory_stock');await u.click('Receive Stock',receive);await u.wait('!!document.querySelector('+q(receive+' [aria-invalid=true]')+')');assert.equal(await u.requests('/rest/v1/rpc/receive_branch_inventory_stock'),before)
   await u.fill('Quantity','10',receive);await u.click('Receive Stock',receive);await u.has('Received 10 units — server-confirmed stock event')
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
  for(const n of ['30','60','90']){await u.fill('Expiry preview horizon',n,'.pharmacy-panel');await u.has(lot,'.pharmacy-panel')}
  await u.b.value('document.querySelector("#pharmacy-tab-batches").focus();true');await u.key('ArrowRight');await u.wait('document.activeElement?.id==="pharmacy-tab-fefo"&&document.activeElement.getAttribute("aria-selected")==="true"');await u.has(lot,'.pharmacy-panel')
  await u.clickExpr(u.one('[role=tab]','Movement history'));await u.has('Change: +10','.pharmacy-panel')
  assert.equal(await u.b.value('(()=>{const a=Array.from(document.querySelectorAll("button")).filter(e=>["Receive stock","Adjust quantity","Dispense medicine","Transfer between branches"].some(t=>e.textContent.trim()===t+" — unavailable"));return a.length===4&&a.every(e=>e.disabled)})()'),true)
  await u.shot('pharmacy-ledger')
 }))
 await run('inventory-edit',()=>browser(async u=>{
  await signIn(u,'administrator');await u.go('/app/inventory');await branch(u,'#operator-branch')
  const f=u.field('Select an existing branch item')
  await u.wait('!!('+f+')&&Array.from(('+f+').options).some(o=>o.textContent.includes('+q(sku)+'))')
  const id=await u.b.value('Array.from(('+f+').options).find(o=>o.textContent.includes('+q(sku)+')).value')
  await u.fillExpr(f,id);await u.wait('!!document.querySelector("#edit-heading")')
  const scope='[aria-labelledby="edit-heading"]',renamed=medicine+' edited'
  await u.fill('Branch display name',renamed,scope);await u.fill('Reorder point','2',scope);await u.fill('Expiry warning days','60',scope)
  await u.click('Save branch item edit',scope);await u.has('Item change confirmed at server revision')
  await u.go('/app/inventory');await branch(u,'#operator-branch');await u.fillExpr(f,id)
  await u.wait('!!document.querySelector("#edit-heading")&&document.querySelector(".operator-balances strong")?.textContent==="10"')
  assert.equal(await u.b.value(u.field('Branch display name',scope)+'.value'),renamed)
  assert.equal(await u.b.value(u.field('Expiry warning days',scope)+'.value'),'60')
  await u.select('#operator-branch',p.otherBranchId)
  await u.wait('!!('+f+')&&document.querySelector("#operator-branch").value==='+q(p.otherBranchId))
  assert.equal(await u.b.value('!Array.from(('+f+').options).some(o=>o.value==='+q(id)+')'),true)
  assert.equal(await u.b.value('!document.querySelector(".operator-balances")'),true)
 }))
 await run('accountant-denial',()=>browser(async u=>{
  await signIn(u,'accountant');await u.go('/app/staff-access');await u.has('Restricted accountant')
  await u.go('/app/staff-management');await u.has('Administrator approval required')
  await u.go('/app/inventory');await u.wait('!!document.querySelector("main [role=alert]")')
  assert.equal(await u.b.value('!document.querySelector("#add-item-heading")'),true)
  await u.go('/app/clinical');await u.wait('!!document.querySelector(".clinical-failure")')
  assert.equal(await u.b.value('!document.querySelector(".clinical-chart")'),true)
  await u.go('/app/ops');await u.wait('!!document.querySelector(".ops-failure")')
  assert.equal(await u.b.value('!document.querySelector(".ops-visit")'),true)
  await u.go('/app/pharmacy');await u.wait('!!document.querySelector(".pharmacy-failure")')
  assert.equal(await u.b.value('!document.querySelector(".pharmacy-medicine")'),true)
 }))
 await run('session-transition',()=>browser(async u=>{
  await signIn(u,'ownerNew');await u.go('/app/appointments');await u.exactRow('.booking-item',concern)
  await u.viewport(1440,900)
  await u.click('Sign out','.sidebar');await u.wait('location.pathname==="/auth/signin"')
  await u.go('/app/appointments');await u.wait('location.pathname==="/auth/signin"')
  assert.equal(await u.b.value('!document.querySelector(".booking-item")'),true)
  await signIn(u,'ownerOther');await u.go('/app/pets');await u.has(p.otherOwnerPet)
  assert.equal(await u.b.value('!document.body.innerText.includes('+q(pet)+')'),true)
  await u.go('/app/appointments');await u.has('My bookings')
  assert.equal(await u.b.value('!document.body.innerText.includes('+q(concern)+')'),true)
 }))
 await run('network-retry',()=>browser(async u=>{
  await signIn(u,'receptionist');await ops(u,bookDay);await u.exactRow('.ops-visit',concern)
  // Browser transport disconnect, no response interception and no writes.
  // This is a real client network failure; it does NOT prove post-commit loss.
  await u.b.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0})
  try{
   await u.clickSel('button[aria-label="Refresh authorized branch appointments and counts"]')
   await u.wait('!document.querySelector(".ops-visit")&&!!document.querySelector(".ops-failure")',30000)
   assert.equal(await u.b.value('!document.body.innerText.includes('+q(concern)+')'),true)
   await u.shot('operations-network-unavailable')
  }finally{await u.b.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1})}
  const retry=await u.b.value('!!document.querySelector(".ops-failure button")')
  if(retry)await u.clickSel('.ops-failure button')
  else await u.click('Recheck staff permissions')
  await u.exactRow('.ops-visit',concern)
 }))
 await run('owner-cancel',()=>browser(async u=>{
  await signIn(u,'ownerNew');await u.go('/app/appointments');const row=await u.exactRow('.booking-item',concern)
  assert.equal(await u.b.value(row+'.innerText.toLowerCase().includes("confirmed")'),true)
  await u.clickExpr(row+'.querySelector("button")')
  await u.has('The clinic recorded the cancellation.')
  await u.go('/app/appointments');const saved=await u.exactRow('.booking-item',concern)
  assert.equal(await u.b.value(saved+'.innerText.toLowerCase().includes("cancelled")'),true)
 }))
 await run('finance-unavailable',()=>browser(async u=>{
  await signIn(u,'administrator');await u.go('/app/billing');await u.wait('!!document.querySelector("#billing-title")')
  await u.wait('!!document.querySelector(".billing-actions[aria-label] button")')
  assert.equal(await u.b.value('Array.from(document.querySelectorAll(".billing-actions[aria-label] button")).every(e=>e.disabled)'),true)
  await u.go('/app/communications');await u.has('Messaging unavailable')
  assert.equal(await u.b.value('Array.from(document.querySelectorAll("button")).filter(e=>/Send message|Schedule reminder/.test(e.textContent)).every(e=>e.disabled)'),true)
  await u.shot('communications-unavailable')
 }))

 // Representative contrast pairs mirror accepted professional UI checks;
 // not a blanket WCAG audit. Test actual computed colors, actual key input,
 // focus trap/restore, and essential connected owner/staff routes.
 const contrast=async(u,selector,background)=>{
  const ratio=await u.b.value('(()=>{const e=document.querySelector('+q(selector)+'),b=document.querySelector('+q(background)+');if(!e||!b)return null;const rgb=c=>{const a=c.match(/[\\d.]+/g)?.map(Number);if(!a||a.length<3||a.length===4&&a[3]!==1)return null;return a.slice(0,3).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4)};const f=rgb(getComputedStyle(e).color),v=rgb(getComputedStyle(b).backgroundColor);if(!f||!v)return null;const l=x=>.2126*x[0]+.7152*x[1]+.0722*x[2];return (Math.max(l(f),l(v))+.05)/(Math.min(l(f),l(v))+.05)})()')
  assert.ok(Number.isFinite(ratio)&&ratio>=4.5,'representative text contrast must be >=4.5')
 }
 await run('accessibility-mobile',async()=>{
  await browser(async u=>{
   for(const theme of ['light','dark']){
    await u.go('/');await u.viewport(360,740);await u.theme(theme);await contrast(u,'.hero h1','.site')
    await u.go('/auth/signin');await contrast(u,'.auth-panel label','.auth-panel')
    await u.b.value('document.querySelector(".auth-panel input[type=email]").focus();true');await u.key('Tab')
    assert.equal(await u.b.value('document.activeElement===document.querySelector(".auth-panel input[type=password]")&&document.activeElement.matches(":focus-visible")'),true)
    await u.key('Tab',true);assert.equal(await u.b.value('document.activeElement===document.querySelector(".auth-panel input[type=email]")'),true)
   }
   await signIn(u,'ownerNew');await u.go('/app/overview')
   for(const [w,h] of [[360,740],[768,900],[1440,600]])for(const theme of ['light','dark']){
    await u.viewport(w,h);await u.theme(theme);await contrast(u,'.stat-value','.stat')
    await u.shot('owner-overview-'+w+'-'+theme)
   }
   await u.viewport(360,740);await u.b.value('document.querySelector(".mobile-toggle").focus();true');await u.key('Enter')
   await u.wait('document.querySelector(".app-content").inert&&document.querySelector(".sidebar").getAttribute("aria-modal")==="true"')
   const ends='Array.from(document.querySelectorAll(".sidebar a[href],.sidebar button:not(:disabled)")).filter(e=>e.getClientRects().length)'
   await u.b.value('('+ends+').at(-1).focus();true');await u.key('Tab')
   assert.equal(await u.b.value('document.activeElement===('+ends+')[0]&&document.activeElement.matches(":focus-visible")'),true)
   await u.key('Tab',true);assert.equal(await u.b.value('document.activeElement===('+ends+').at(-1)'),true)
   await u.key('Escape');await u.wait('!document.querySelector(".app-content").inert&&document.activeElement===document.querySelector(".mobile-toggle")')
   await u.key('Enter');await u.wait('document.querySelector(".app-content").inert')
   await u.b.value('document.querySelector(".sidebar a[href=\'/app/pets\']").focus();true');await u.key('Enter')
   await u.wait('location.pathname==="/app/pets"&&!document.querySelector(".app-content").inert&&document.activeElement===document.querySelector("#main-content")');await u.has(pet)
   await u.viewport(360,740);await u.shot('owner-patients-keyboard-mobile')
   // Real latency (no fabricated response): load a private patient reader
   // and require a loading state before its authoritative result.
   await u.b.send('Network.emulateNetworkConditions',{offline:false,latency:1200,downloadThroughput:1000000,uploadThroughput:1000000})
   try{const card=await u.exactRow('.patient-card',pet);await u.clickExpr(card+'.querySelector("button")');await u.has('Checking this patient’s saved documents…','#patient-form-top');await u.wait('('+health+')?.innerText.includes('+q(docName)+')',30000)}
   finally{await u.b.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1})}
  })
  await browser(async u=>{
   await u.viewport(360,740);await signIn(u,'veterinarian');await clinical(u,'veterinarian')
   await u.wait('document.querySelector(".clinical-encounter-editor textarea")?.value==='+q(draft))
   for(const [w,h] of [[360,740],[768,900],[1440,900]])for(const theme of ['light','dark']){
    await u.viewport(w,h);await u.theme(theme);await u.shot('clinical-persisted-'+w+'-'+theme)
   }
  })
 })
 if(p.authLinks){
  await run('email-recovery',async()=>{
   const newPassword='SyntheticResetA1'+randomBytes(12).toString('hex')
   await browser(async u=>{
    await u.viewport(360,740);await u.go('/auth/recovery');await u.has('Recovery link has expired or has not been verified.','.auth-panel')
    await u.clickExpr(u.one('.auth-panel a','Request a new link'));await u.wait('location.pathname==="/auth/forgot"')
    await requireEmptyRecoveryMailbox(p)
    await u.fill('Email address',p.accounts.ownerOther.email);await u.click('Send recovery link')
    await u.has('If this account exists, a password-reset email will arrive shortly.','.auth-panel');await u.realRequest('/auth/v1/recover')
    const link=await waitForRecoveryLink(p,origin);await u.b.goto(link)
    await u.wait('location.origin==='+q(origin)+'&&location.pathname==="/auth/recovery"&&!!document.querySelector(".auth-panel input[type=password]")')
    await u.wait('!location.search.includes("code=")&&!location.hash')
    await u.fill('New password',newPassword);await u.click('Update password')
    await u.wait('location.pathname==="/auth/signin"');await u.realRequest('/auth/v1/user')
   })
   await browser(async u=>{
    await u.go('/auth/signin');await u.fill('Email address',p.accounts.ownerOther.email);await u.fill('Password',p.accounts.ownerOther.password);await u.click('Sign in')
    await u.has('Email or password is incorrect.','.auth-panel')
    assert.equal(await u.b.value('location.pathname'),'/auth/signin')
    await u.fill('Password',newPassword);await u.click('Sign in');await u.wait('location.pathname==="/app/overview"&&!!document.querySelector(".sidebar")')
    await u.go('/app/pets');await u.has(p.otherOwnerPet);assert.equal(await u.b.value('!document.body.innerText.includes('+q(pet)+')'),true)
    await u.viewport(360,740);await u.shot('recovered-owner-mobile')
   })
  })
 }else results.push({id:'email-recovery',status:'BLOCKED',reason:'optional actual PKCE recovery-link runtime not approved'})
 await run('additional-lifecycle',async()=>{
  if(!p.lifecycleVisits)throw Object.assign(Error('time-qualified visits required'),{blocked:true})
  // Time-dependent rows must be independently seeded by ASTRA. Never change
  // the application clock or pretend a future appointment can be checked in.
  for(const [fixture,role,before,action,after] of [
   ['checkIn','receptionist','Confirmed','Check in','Checked in'],
   ['noShow','receptionist','Confirmed','Mark no-show','No show'],
   ['decline','receptionist','Requested','Decline request','Cancelled'],
   ['cancel','receptionist','Confirmed','Cancel appointment','Cancelled'],
   ['complete','veterinarian','Checked in','Complete visit','Completed']
  ]){
   const v=p.lifecycleVisits[fixture],selector='button[aria-label="Review appointment '+shortRef(v.id)+'"]'
   await browser(async u=>{
    await signIn(u,role);await ops(u,v.day)
    await u.wait('document.querySelectorAll('+q(selector)+').length===1')
    const status=await u.b.value('document.querySelector('+q(selector)+').closest(".ops-visit").querySelector(".badge").textContent')
    assert.equal(status,before)
    await u.clickSel(selector);await u.click(action,'.appointment-lifecycle')
    await u.click('Apply '+action,'.appointment-lifecycle')
    // The verified selected detail must show the new status, not only a toast.
    await u.wait('document.querySelector(".lifecycle-status .badge")?.textContent==='+q(after))
   })
   await browser(async u=>{
    await signIn(u,role);await ops(u,v.day)
    if(after==='Cancelled'||after==='No show'){
     await u.wait('!!document.querySelector(".ops-closed summary")')
     if(!await u.b.value('document.querySelector(".ops-closed").open'))await u.clickSel('.ops-closed summary')
    }
    await u.wait('document.querySelectorAll('+q(selector)+').length===1')
    assert.equal(await u.b.value('document.querySelector('+q(selector)+').closest(".ops-visit").querySelector(".badge").textContent'),after)
   })
  }
 })
 // True committed-but-lost acknowledgement and delayed/denied reader require
 // ASTRA's independently controlled real server/proxy fault interface. Never
 // substitute an intercepted response or mark a theoretical scenario passed.
 results.push({id:'clinical-uncertain',status:'BLOCKED',reason:'real committed-response loss control not yet contracted'})
 results.push({id:'controlled-late-response',status:'BLOCKED',reason:'real held/denied response and account-switch control not yet contracted'})
} catch {failed=true;console.error('FAIL: connected runner build/runtime error; no raw data logged')}
finally{
 await report()
 if(previewServer)await new Promise(resolveClose=>previewServer.httpServer.close(resolveClose))
 if(fileDir)await rm(fileDir,{recursive:true,force:true})
 await rm(buildDir,{recursive:true,force:true})
}
process.exitCode=failed?1:2 // until all mandatory runtime fault cases are implemented and executed
