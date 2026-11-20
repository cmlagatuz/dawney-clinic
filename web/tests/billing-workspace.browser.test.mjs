// CLOUD — real Vite/Chromium, intercepted synthetic HTTP; never accesses actual billing.
// Fixture mounts the same production BillingStaffWorkspace with an injectable TEST-only read port.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {fileURLToPath} from 'node:url'
import {withChromium} from '../../scripts/browser/cdp.mjs'

function installBillingFixture(){
 const id=n=>'30000000-0000-4000-8000-'+String(n).padStart(12,'0')
 const ids={naga:id(1),cavite:id(2),staff:id(3),owner:id(4),
   pet:id(5),appointment:id(6),n1:id(20),n2:id(21),c1:id(22)}
 const params=new URL(location.href).searchParams
 const actor=params.get('actor')||'staff'
 const mode=params.get('case')||'multi'
 const theme=params.get('theme')==='dark'?'dark':'light'
 localStorage.setItem('dawney-theme',theme)
 const user={id:actor==='staff'?ids.staff:ids.owner,
   aud:'authenticated',role:'authenticated',email:'qa-billing@example.test',
   email_confirmed_at:'2025-01-01T00:00:00Z',created_at:'2025-01-01T00:00:00Z',
   app_metadata:{},user_metadata:{}}
 const exp=Math.floor(Date.now()/1000)+86400
 const token=['{"alg":"HS256","typ":"JWT"}',JSON.stringify({sub:user.id,exp}),'synthetic']
   .map(x=>btoa(x).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')).join('.')
 if(actor==='guest')localStorage.removeItem('dawney.auth.v1')
 else localStorage.setItem('dawney.auth.v1',JSON.stringify({
   user,access_token:token,refresh_token:'synthetic-fixture',expires_at:exp
 }))
 window.__qaBilling={calls:[],unexpected:[],writes:[],recovered:false,revoked:false,releaseSlow:null}
 const header=(branch,n,status,minor,currency='PHP')=>({
   id:n,branch_id:branch,owner_id:ids.owner,pet_id:ids.pet,appointment_id:ids.appointment,
   invoice_no:n===ids.n1?'QA-NAGA-ISSUED':n===ids.n2?'QA-NAGA-PAID':'QA-CAVITE',
   kind:n===ids.c1?'estimate':'invoice',status,currency_code:currency,minor_scale:2,
   created_at:'2026-11-20T08:00:00Z',
   totals:{subtotal_minor:minor,discount_minor:0,tax_minor:0,total_minor:minor,
      paid_minor:status==='paid'?minor:0,refunded_minor:0,
      balance_minor:status==='paid'?0:minor},
   unit_cost_minor:999999,private_email:'SECRET_SHOULD_NOT_APPEAR'
 })
 const naga=[header(ids.naga,ids.n1,'issued',12000),header(ids.naga,ids.n2,'paid',23000)]
 const cavite=[header(ids.cavite,ids.c1,'draft',4500,'USD')]
 const originalFetch=window.fetch.bind(window)
 const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,
   headers:{'content-type':'application/json','access-control-allow-origin':'*'}})
 window.fetch=async(input,init)=>{
   const req=new Request(input,init),url=new URL(req.url)
   if(req.method==='OPTIONS')return reply({})
   const qa=url.origin===location.origin&&url.pathname.startsWith('/__qa_billing/')
   const remote=url.origin==='https://issue51-fixtures.supabase.co'
   if(!qa&&!remote){
     if(url.origin===location.origin)return originalFetch(input,init)
     window.__qaBilling.unexpected.push('foreign-origin')
     throw Error('External network forbidden in billing test')
   }
   window.__qaBilling.calls.push(req.method+' '+url.pathname+
      (qa?'?'+url.searchParams.toString():''))
   if(qa){
     if(req.method!=='GET'){window.__qaBilling.writes.push(req.method+' '+url.pathname);return reply({code:'42501'},403)}
     if(mode==='denied'||actor==='other'||window.__qaBilling.revoked)
       return reply({code:'42501',message:'Branch access not authorized'},403)
     if(url.pathname.endsWith('/branches')){
       return reply([{id:ids.naga,slug:'naga',name:'Synthetic Naga',role:'receptionist'},
         ...(mode==='naga-only'?[]:[{id:ids.cavite,slug:'cavite',name:'Synthetic Cavite',role:'receptionist'}])])
     }
     const branch=url.searchParams.get('branch')
     if(branch!==ids.naga&&branch!==ids.cavite)
       return reply({code:'42501',message:'Branch access not authorized'},403)
     if(mode==='unavailable')return reply({code:'BILLING_READER_NOT_INTEGRATED',message:'Billing reader not integrated'},404)
     if(mode==='network'&&!window.__qaBilling.recovered)throw TypeError('Failed to fetch')
     if(url.pathname.endsWith('/invoices')){
       if(mode==='slow'&&branch===ids.naga&&!window.__qaBilling.recovered)
         await new Promise(resolve=>{window.__qaBilling.releaseSlow=resolve})
       const items=mode==='empty'?[]:mode==='foreign'&&branch===ids.cavite?naga:
         branch===ids.naga?naga:cavite
       return reply({items,hasMore:mode==='more'})
     }
     if(url.pathname.endsWith('/detail')){
       const invoiceId=url.searchParams.get('invoice')
       const x=[...naga,...cavite].find(y=>y.id===invoiceId&&y.branch_id===branch)
       if(!x)return reply({code:'42501',message:'No authorized invoice'},403)
       const paid=x.status==='paid'
       const payment={id:id(41),invoice_id:x.id,occurred_at:'2026-11-20T09:00:00Z',
         amount_minor:x.totals.total_minor,status:'settled',method_label:'Synthetic tender'}
       const receipt={id:id(42),invoice_id:x.id,payment_id:payment.id,
         receipt_no:'QA-RECEIPT-TEST',issued_at:'2026-11-20T09:10:00Z',
         amount_minor:x.totals.total_minor}
       return reply({header:x,lines:[{id:id(43),invoice_id:x.id,category:'service',
         description:'Synthetic care service',quantity:1,unit_label:'visit',
         unit_price_minor:x.totals.total_minor,line_total_minor:x.totals.total_minor,
         unit_cost_minor:999999}],payments:paid?[payment]:[],receipts:paid?[receipt]:[]})
     }
     window.__qaBilling.unexpected.push(url.pathname)
     return reply({code:'PGRST202',message:'Unrecognized fixture'},404)
   }
   // Production route: only the actual, reviewed staff membership/branch readers
   // are allowed. There is intentionally NO billing finance API available.
   if(req.method!=='GET'&&!url.pathname.endsWith('/assert_staff_branch')){
     window.__qaBilling.writes.push(req.method+' '+url.pathname)
     return reply({code:'42501'},403)
   }
   if(url.pathname==='/auth/v1/user')return mode==='expired'
     ?reply({message:'JWT expired'},401):reply(user)
   if(url.pathname==='/rest/v1/staff_memberships')
     return reply(actor==='staff'?[{user_id:ids.staff,role:'receptionist',is_active:true}]:[])
   if(url.pathname==='/rest/v1/staff_branch_memberships')
     return reply(actor==='staff'?[{user_id:ids.staff,branch_id:ids.naga,
       role:'receptionist',is_active:true}]:[])
   if(url.pathname==='/rest/v1/clinic_branches')
     return reply([{id:ids.naga,slug:'naga',display_name:'Synthetic Naga'}])
   if(url.pathname==='/rest/v1/rpc/assert_staff_branch'){
     const body=await req.json()
     return actor==='staff'&&body.p_branch===ids.naga
       ?reply(ids.naga):reply({code:'42501',message:'Denied'},403)
   }
   window.__qaBilling.unexpected.push('unapproved-finance-or-other-query '+url.pathname)
   return reply({code:'PGRST202',message:'Not integrated'},404)
 }
}
const fixtures='/tests/fixtures/billing-fixture.html'
async function selectNative(browser,selector,value){
 return browser.value('(()=>{const e=document.querySelector('+JSON.stringify(selector)+
   ');if(!e)return false;e.value='+JSON.stringify(value)+
   ';e.dispatchEvent(new Event("change",{bubbles:true}));return true})()')
}
test('CLOUD billing: protected production routes never invent owner/staff financial data or send writes',
 {timeout:100000},async()=>{
 process.env.VITE_SUPABASE_URL='https://issue51-fixtures.supabase.co'
 process.env.VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_billing_fixture'
 process.env.VITE_PHASE5C_BILLING_UI='true'
 const vite=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),
   server:{host:'127.0.0.1',port:0}})
 try{
   await vite.listen()
   const base='http://127.0.0.1:'+vite.httpServer.address().port
   await withChromium(async browser=>{
     await browser.send('Page.addScriptToEvaluateOnNewDocument',
       {source:'('+installBillingFixture.toString()+')()'})
     await browser.goto(base+'/app/invoices?actor=owner&theme=light')
     await browser.until('document.querySelector("#main-content")?.textContent.includes("Owner billing records are not available yet")',9000)
     assert.equal(await browser.value('!!document.querySelector(\'a[href="/app/billing"]\')'),false)
     assert.equal(await browser.value('window.__qaBilling.calls.some(x=>x.includes("/invoice")||x.includes("/payment")||x.includes("/receipt"))'),false)
     await browser.goto(base+'/app/billing?actor=staff&theme=light')
     await browser.until('document.querySelector("#main-content")?.textContent.includes("Billing read service not integrated")',9000)
     assert.equal(await browser.value('document.querySelectorAll(".billing-invoice").length'),0)
     const snapshot=await browser.value('({calls:window.__qaBilling.calls,writes:window.__qaBilling.writes,unexpected:window.__qaBilling.unexpected,disabled:[...document.querySelectorAll(".billing-actions button")].every(e=>e.disabled)})')
     assert.ok(snapshot.calls.some(x=>x.includes('/rpc/assert_staff_branch')))
     assert.equal(snapshot.calls.some(x=>/\/invoices\b|\/payments\b|\/receipts\b/.test(x)),false)
     assert.deepEqual(snapshot.writes,[])
     assert.deepEqual(snapshot.unexpected,[])
     assert.equal(snapshot.disabled,true)
     await browser.goto(base+'/app/billing?actor=owner&theme=dark')
     await browser.until('document.querySelector("#main-content")?.textContent.includes("Financial access denied")',9000)
     assert.equal(await browser.value('!!document.querySelector(".billing-invoice")'),false)
   })
 }finally{
   await vite.close()
   delete process.env.VITE_PHASE5C_BILLING_UI
   delete process.env.VITE_SUPABASE_URL
   delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY
 }
})
test('CLOUD billing: synthetic branch invoice/detail/payment/receipt UI, responsive and fail-closed',
 {timeout:220000},async()=>{
 const vite=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),
   server:{host:'127.0.0.1',port:0}})
 try{
   await vite.listen()
   const base='http://127.0.0.1:'+vite.httpServer.address().port
   await withChromium(async browser=>{
     await browser.send('Page.addScriptToEvaluateOnNewDocument',
       {source:'('+installBillingFixture.toString()+')()'})
     const naga='30000000-0000-4000-8000-000000000001'
     const cavite='30000000-0000-4000-8000-000000000002'
     for(const width of [360,768,1440]){
       await browser.send('Emulation.setDeviceMetricsOverride',
         {width,height:900,deviceScaleFactor:1,mobile:false})
       for(const theme of ['light','dark']){
         await browser.goto(base+fixtures+'?actor=staff&case=multi&theme='+theme)
         await browser.until('!!document.querySelector("#billing-branch")',9000)
         assert.equal(await browser.value('document.querySelectorAll(".billing-invoice").length'),0,
           'two branches must require explicit choice')
         await selectNative(browser,'#billing-branch',naga)
         await browser.until('document.querySelectorAll(".billing-invoice").length===2',9000)
         assert.equal(await browser.value('document.documentElement.scrollWidth<=innerWidth'),true,
           'no billing overflow '+width+'/'+theme)
         assert.equal(await browser.value('document.documentElement.getAttribute("data-theme")'),theme)
         assert.equal(await browser.value('document.querySelectorAll(".billing-invoice").length'),2)
         await browser.value('document.querySelectorAll(".billing-invoice")[1].focus();true')
         await browser.send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowUp',code:'ArrowUp',windowsVirtualKeyCode:38})
         await browser.send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowUp',code:'ArrowUp',windowsVirtualKeyCode:38})
         assert.equal(await browser.value('document.activeElement===document.querySelectorAll(".billing-invoice")[0]'),true)
         const search=await selectNative(browser,'.billing-filters select','paid')
         assert.ok(search)
         await browser.until('document.querySelectorAll(".billing-invoice").length===1')
         await browser.value('document.querySelector(".billing-invoice").click();true')
         await browser.until('document.querySelector(".billing-history")?.textContent.includes("QA-RECEIPT-TEST")',9000)
         assert.match(await browser.value('document.querySelector(".billing-totals").textContent'),/PHP 230.00/)
         assert.equal(await browser.value('document.body.textContent.includes("999999")'),false)
         assert.equal(await browser.value('document.body.textContent.includes("SECRET_SHOULD_NOT_APPEAR")'),false)
         assert.equal(await browser.value('[...document.querySelectorAll(".billing-actions button")].every(x=>x.disabled)'),true)
         await selectNative(browser,'#billing-branch',cavite)
         assert.equal(await browser.value('document.body.textContent.includes("QA-RECEIPT-TEST")'),false,
           'Naga receipt must disappear on branch switch')
         await browser.until('document.querySelectorAll(".billing-invoice").length===1')
         assert.equal(await browser.value('document.body.textContent.includes("QA-NAGA-PAID")'),false)
         assert.match(await browser.value('document.querySelector(".billing-invoice").textContent'),/USD 45.00/)
         assert.equal(await browser.value('document.documentElement.scrollWidth<=innerWidth'),true)
         const q=await browser.value('window.__qaBilling')
         assert.deepEqual(q.writes,[])
         assert.deepEqual(q.unexpected,[])
       }
     }
     await browser.goto(base+fixtures+'?actor=other&case=denied')
     await browser.until('document.querySelector(".billing-failure")?.textContent.includes("Financial access denied")',9000)
     assert.equal(await browser.value('!!document.querySelector(".billing-invoice")'),false)
     await browser.goto(base+fixtures+'?actor=staff&case=empty')
     await browser.until('!!document.querySelector("#billing-branch")')
     await selectNative(browser,'#billing-branch',naga)
     await browser.until('document.querySelector("#root")?.textContent.includes("No invoices in this verified branch read")',9000)
     await browser.goto(base+fixtures+'?actor=staff&case=network')
     await browser.until('!!document.querySelector("#billing-branch")')
     await selectNative(browser,'#billing-branch',naga)
     await browser.until('document.querySelector(".billing-failure")?.textContent.includes("Unable to read financial records")',9000)
     await browser.value('window.__qaBilling.recovered=true;[...document.querySelectorAll("button")].find(x=>x.textContent==="Retry authorized read").click();true')
     await browser.until('document.querySelectorAll(".billing-invoice").length===2',9000)
     await browser.goto(base+fixtures+'?actor=staff&case=unavailable')
     await browser.until('!!document.querySelector("#billing-branch")')
     await selectNative(browser,'#billing-branch',naga)
     await browser.until('document.querySelector(".billing-failure")?.textContent.includes("Billing read service not integrated")',9000)
     await browser.goto(base+fixtures+'?actor=staff&case=foreign')
     await browser.until('!!document.querySelector("#billing-branch")')
     await selectNative(browser,'#billing-branch',cavite)
     await browser.until('document.querySelector(".billing-failure")?.textContent.includes("Unable to read financial records")',9000)
     assert.equal(await browser.value('!!document.querySelector(".billing-invoice")'),false)
     await browser.goto(base+fixtures+'?actor=staff&case=more')
     await browser.until('!!document.querySelector("#billing-branch")')
     await selectNative(browser,'#billing-branch',naga)
     await browser.until('document.querySelector(".billing-banner")?.textContent.includes("More financial records exist")',9000)
   })
 }finally{await vite.close()}
})
