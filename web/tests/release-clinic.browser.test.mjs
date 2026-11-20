// CLOUD: real Chromium branch-safe staff Operations end-to-end acceptance
// appointment queue, patient chart and read-only branch pharmacy.
// All HTTP is synthetic and intercepted. No hosted Auth, medicine or clinical write.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {fileURLToPath} from 'node:url'
import {withChromium} from '../../scripts/browser/cdp.mjs'
import {releaseClinicFixture} from './fixtures/release-clinic-http.mjs'


/** Fixture is a copy of PR105's offline HTTP interceptor, augmented only in
 * this NEW staff test for #58 invoker counts, 250/251 and branch switching.
 * PR105's original source blobs and PR89's three QA files remain untouched.
 * All browser flags are temporary; checked-in production defaults remain OFF. */
test('CLOUD RELEASE: full clinic owner-to-operator route acceptance with source-gated finance and clinical',
  {timeout:300000},async()=>{
  process.env.VITE_SUPABASE_URL='https://issue51-fixtures.supabase.co'
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_issue51_offline'
  process.env.VITE_PHASE5A_OPS_UI='true'
  process.env.VITE_CLINICAL_WORKSPACE_UI='true'
  process.env.VITE_PHASE5B_PHARMACY_UI='true'
  process.env.VITE_PHASE5C_BILLING_UI='true'
  const root=fileURLToPath(new URL('../',import.meta.url))
  const vite=await createServer({root,server:{host:'127.0.0.1',port:0,strictPort:false}})
  try{
    await vite.listen()
    const url='http://127.0.0.1:'+vite.httpServer.address().port
    await withChromium(async browser=>{
      await browser.send('Page.addScriptToEvaluateOnNewDocument',
        {source:'('+releaseClinicFixture.toString()+')()'})
      // Use the existing real owner form to issue one request (not a staff-created appointment).
      await browser.send('Emulation.setDeviceMetricsOverride',
        {width:768,height:900,deviceScaleFactor:1,mobile:false})
      await browser.goto(url+'/app/appointments?actor=owner&theme=light&reset=1')
      await browser.until('!!document.querySelector("form[aria-label=\'Appointment request\']")',9000)
      assert.equal(await browser.value('document.querySelector("form select").value'),
        '40000000-0000-4000-8000-000000000009','owner verified pet selected')
      await browser.value('(()=>{const e=document.querySelectorAll("form[aria-label=\'Appointment request\'] select")[1];e.value="40000000-0000-4000-8000-000000000003";e.dispatchEvent(new Event("change",{bubbles:true}));return true})()')
      await browser.until('document.querySelectorAll("form[aria-label=\'Appointment request\'] select").length>=3')
      const date=await browser.value('(()=>[...document.querySelectorAll("form[aria-label=\'Appointment request\'] select")[2].options].map(e=>e.value).find(Boolean))()')
      assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(date))
      await browser.value('localStorage.setItem("cloud.integrated.day",'+JSON.stringify(date)+');true')
      await browser.value('(()=>{const e=document.querySelectorAll("form[aria-label=\'Appointment request\'] select")[2];e.value='+JSON.stringify(date)+';e.dispatchEvent(new Event("change",{bubbles:true}));return true})()')
      await browser.until('!!document.querySelector("input[name=slot]")')
      await browser.value('document.querySelector("input[name=slot]").click();true')
      await browser.value('document.querySelector("form[aria-label=\'Appointment request\'] input[placeholder]").focus();true')
      await browser.send('Input.insertText',{text:'Synthetic cross-module appointment'})
      await browser.until('document.querySelector("form[aria-label=\'Appointment request\'] button.button-primary")?.disabled===false')
      await browser.value('document.querySelector("form[aria-label=\'Appointment request\'] button.button-primary").click();true')
      await browser.until('document.querySelector("form[aria-label=\'Appointment request\'] [role=alert]")?.textContent.includes("We could not save")',9000)
      await browser.value('document.querySelector("form[aria-label=\'Appointment request\'] button.button-primary").click();true')
      await browser.until('document.querySelector("#main-content [role=status]")?.textContent.includes("Request received")',9000)
      const owner=await browser.value('({rpc:window.__cloudIntegrated.rpcs,booking:JSON.parse(localStorage.getItem("cloud.integrated.syntheticBooking")),writes:window.__cloudIntegrated.directWrites})')
      assert.equal(owner.rpc.length,2)
      assert.deepEqual(owner.rpc[0],owner.rpc[1],'retry is same nonce, status remains requested')
      assert.equal(owner.booking.status,'requested')
      assert.deepEqual(owner.writes,[])
      for(const width of [360,768,1440]){
        await browser.send('Emulation.setDeviceMetricsOverride',
          {width,height:900,deviceScaleFactor:1,mobile:false})
        for(const theme of ['light','dark']){
          // Real route and actual typed branch reader: no mock props mounted into React.
          await browser.goto(url+'/app/ops?actor=staff&theme='+theme)
          await browser.until('!!document.querySelector(".ops-toolbar input[type=date]")',9000)
          await browser.value('(()=>{const e=document.querySelector(".ops-toolbar input[type=date]");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,localStorage.getItem("cloud.integrated.day"));e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}));return true})()')
          try { await browser.until('!!document.querySelector(".ops-visit")',6500) }
          catch {
            const state=await browser.value('({main:document.querySelector("#main-content")?.textContent.slice(0,950),day:document.querySelector(".ops-toolbar input[type=date]")?.value,alerts:[...document.querySelectorAll("[role=alert]")].map(e=>e.textContent.slice(0,250)),audit:JSON.parse(localStorage.getItem("cloud.integrated.syntheticAudit")||"[]").slice(-24),unexpected:window.__cloudIntegrated?.unexpected})')
            assert.fail('Ops verified-branch appointment unavailable: '+JSON.stringify(state))
          }
          assert.equal(await browser.value('document.documentElement.getAttribute("data-theme")'),theme)
          assert.equal(await browser.value('document.documentElement.scrollWidth<=innerWidth'),
            true,'Operations board must not overflow at '+width+'/'+theme)
          const card=await browser.value('document.querySelector(".ops-visit").textContent')
          assert.match(card,/requested/i)
          assert.match(card,/Synthetic cross-module appointment/)
          const kpi=await browser.value('document.querySelector("#ops-kpi-h")?.parentElement?.textContent')
          assert.match(kpi,/Patients seen in this branch/)
          assert.match(kpi,/Requested \(all dates\)/)
          assert.ok(!kpi.includes('Registered patients'),'branch patient count must never imply global patients')
          const toolbar=await browser.value('({provider:[...document.querySelectorAll(".ops-field")].some(e=>e.textContent.includes("Provider")&&e.querySelector("select")?.disabled),actions:[...document.querySelectorAll("button[disabled]")].map(x=>x.textContent),nav:[...document.querySelectorAll("a")].map(a=>a.getAttribute("href")),audit:JSON.parse(localStorage.getItem("cloud.integrated.syntheticAudit")||"[]")})')
          assert.ok(toolbar.provider,'no unverified staff-provider filter')
          assert.ok(toolbar.actions.some(s=>s.includes('Confirm (not enabled)')))
          assert.ok(toolbar.actions.some(s=>s.includes('Reschedule (not enabled)')))
          assert.ok(toolbar.nav.includes('/app/ops'),'staff shortcut requires current membership')
          assert.ok(toolbar.audit.some(x=>x.actor==='staff'&&x.path==='/rest/v1/appointments'&&x.branch==='40000000-0000-4000-8000-000000000001'))
          assert.ok(!toolbar.audit.some(x=>x.actor==='staff'&&x.path==='/rest/v1/appointments'&&!x.branch),'zero unscoped fallback')
          await browser.value('(()=>{const e=document.querySelector("select[aria-label=\'Appointment status\']");e.focus();e.value="confirmed";e.dispatchEvent(new Event("change",{bubbles:true}));return true})()')
          await browser.until('!!document.querySelector("#main-content h2")')
          assert.equal(await browser.value('!!document.querySelector(".ops-visit")'),false,'only real confirmed rows allowed')
          await browser.value('(()=>{const e=document.querySelector("select[aria-label=\'Appointment status\']");e.value="requested";e.dispatchEvent(new Event("change",{bubbles:true}));return true})()')
          await browser.until('!!document.querySelector(".ops-visit")')
          await browser.value('(()=>{const b=[...document.querySelectorAll("button")].find(x=>x.textContent==="Schedule");b?.click();return !!b})()')
          await browser.until('!!document.querySelector("#ops-sched-h")')
          await browser.value('(()=>{const b=[...document.querySelectorAll("button")].find(x=>x.textContent==="Week");b?.click();return !!b})()')
          await browser.until('document.querySelectorAll(".ops-weekday").length===7',9000)
          await browser.until('[...document.querySelectorAll(".ops-mini li")].length>0',9000)
          // Server returns seven independent <=24h Manila days; no guessed public hours.
          assert.equal(await browser.value('document.documentElement.scrollWidth<=innerWidth'),
            true,'Operations week must not overflow at '+width+'/'+theme)
          const recent=await browser.value('JSON.parse(localStorage.getItem("cloud.integrated.syntheticAudit")||"[]").filter(x=>x.actor==="staff"&&x.path==="/rest/v1/appointments").slice(-10)')
          assert.ok(recent.every(x=>x.branch==='40000000-0000-4000-8000-000000000001'))
          const bounds=recent.filter(x=>x.bounds?.length===2)
          assert.ok(bounds.length>=7,'week issues bounded branch-only UTC SELECT for each day')
          assert.ok(bounds.every(x=>x.bounds.some(y=>y.startsWith('gte.'))&&x.bounds.some(y=>y.startsWith('lt.'))))
          // Verify a staff user can navigate, but chart independently revalidates the same branch.
          await browser.value('document.querySelector(\'a[href="/app/clinical"]\').click();true')
          await browser.until('!!document.querySelector("#clinical-day")',9000)
          await browser.value('(()=>{const e=document.querySelector("#clinical-day");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,localStorage.getItem("cloud.integrated.day"));e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}));return true})()')
          await browser.until('!!document.querySelector(".clinical-patient")',9000)
          await browser.value('document.querySelector(".clinical-patient").click();true')
          await browser.until('document.querySelectorAll("[role=tab]").length===7',9000)
          assert.equal(await browser.value('[...document.querySelectorAll("button")].some(x=>x.textContent.includes("Save to patient chart")&&!x.disabled)'),false)
          await browser.value('document.querySelector(\'a[href="/app/pharmacy"]\').click();true')
          await browser.until('!!document.querySelector(".pharmacy-medicine")',9000)
          assert.match(await browser.value('document.querySelector(".pharmacy-medicine").textContent'),/Synthetic medicine/)
          await browser.value('document.querySelector(".pharmacy-medicine").click();true')
          await browser.until('!!document.querySelector(".pharmacy-batches")',9000)
          assert.match(await browser.value('document.querySelector(".pharmacy-batches").textContent'),/QA-LOT-1/)
          assert.equal(await browser.value('document.documentElement.scrollWidth<=innerWidth'),
            true,'Pharmacy must not overflow at '+width+'/'+theme)

          // Real gated billing route: NO finance reader exists, so do not invent
          // invoices, balances, paid statuses, receipts or payment requests.
          await browser.goto(url+'/app/billing?actor=staff&theme='+theme)
          await browser.until('document.querySelector(".billing-workspace")?.textContent.includes("Billing read service not integrated")',9000)
          const finance=await browser.value('({title:document.querySelector("#billing-title")?.textContent,actions:[...document.querySelectorAll(".billing-actions[aria-label] button")].map(x=>x.disabled),cards:document.querySelectorAll(".billing-invoice").length,overflow:document.documentElement.scrollWidth>innerWidth})')
          assert.match(finance.title,/Billing & invoices/)
          assert.equal(finance.cards,0,'no fake invoice row')
          assert.equal(finance.actions.length>0,true)
          assert.equal(finance.actions.every(Boolean),true,'finance mutations stay unavailable')
          assert.equal(finance.overflow,false,'billing must not overflow at '+width+'/'+theme)

          const final=await browser.value('({writes:window.__cloudIntegrated.directWrites,unexpected:window.__cloudIntegrated.unexpected,log:JSON.parse(localStorage.getItem("cloud.integrated.syntheticAudit")||"[]")})')
          assert.deepEqual(final.writes,[],'zero unauthorized staff mutations')
          assert.deepEqual(final.unexpected,[],'zero unscoped patients or foreign branch reads')
          assert.ok(final.log.some(x=>x.path.endsWith('/rpc/get_branch_dashboard_counts')))
        }
      }
      // No memberships -> denial, not an empty verified queue; staff shortcuts hidden.
      // Owner B has their own synthetic patient; Owner A's requested booking
      // must never appear in Owner B's owner portal or staff workspace.
      await browser.goto(url+'/app/pets?actor=other')
      await browser.until('document.body.textContent.includes("Synthetic B Patient")',9000)
      assert.equal(await browser.value('document.body.textContent.includes("Synthetic Patient")'),false,
        'owner B cannot see owner A pet')
      await browser.goto(url+'/app/appointments?actor=other')
      await browser.until('!!document.querySelector("#main-content")',9000)
      assert.equal(await browser.value('document.body.textContent.includes("Synthetic cross-module appointment")'),false,
        'owner B cannot see owner A requested appointment')
      await browser.goto(url+'/app/ops?actor=other')
      await browser.until('!!document.querySelector(".ops-failure")',9000)
      assert.equal(await browser.value('!!document.querySelector(".ops-visit")'),false)
      assert.equal(await browser.value('!!document.querySelector(\'nav[aria-label="Clinic staff workspaces"]\')'),false)
      await browser.goto(url+'/app/ops?actor=staff&case=denied')
      await browser.until('!!document.querySelector(".ops-failure")',9000)
      assert.equal(await browser.value('!!document.querySelector(".ops-visit")'),false)
      // Network failure is visibly different from successful empty results, and retries.
      await browser.goto(url+'/app/ops?actor=staff&case=network')
      await browser.until('!!document.querySelector(".ops-failure button")',9000)
      await browser.value('window.__cloudIntegrated.recovered=true;document.querySelector(".ops-failure button").click();true')
      await browser.until('!!document.querySelector(".ops-toolbar input[type=date]")',9000)
      await browser.value('(()=>{const e=document.querySelector(".ops-toolbar input[type=date]");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,localStorage.getItem("cloud.integrated.day"));e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}));return true})()')
      await browser.until('!!document.querySelector(".ops-visit")',9000)
      await browser.goto(url+'/app/ops?actor=staff&case=empty')
      await browser.until('document.querySelector("#main-content")?.textContent.includes("No appointments in this window")',9000)
      assert.equal(await browser.value('!!document.querySelector(".ops-visit")'),false)
      // The branch invoker counts RPC is missing: show unavailable, never fabricate zero.
      await browser.goto(url+'/app/ops?actor=staff&case=counts-missing')
      await browser.until('document.querySelector("#main-content")?.textContent.includes("Branch patient and appointment counts are unavailable")',9000)
      assert.equal(await browser.value('document.querySelector("#main-content")?.textContent.includes("Registered patients")'),false)
      await browser.goto(url+'/app/ops?actor=staff&case=over250')
      await browser.until('!!document.querySelector(".ops-toolbar input[type=date]")',9000)
      await browser.value('(()=>{const e=document.querySelector(".ops-toolbar input[type=date]");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,localStorage.getItem("cloud.integrated.day"));e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}));return true})()')
      await browser.until('document.querySelector("#main-content")?.textContent.includes("Incomplete: more than 250 appointments matched")',9000)
      assert.equal(await browser.value('document.querySelectorAll(".ops-visit").length'),250)
      await browser.goto(url+'/app/ops?actor=staff&case=exact250')
      await browser.until('!!document.querySelector(".ops-toolbar input[type=date]")',9000)
      await browser.value('(()=>{const e=document.querySelector(".ops-toolbar input[type=date]");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,localStorage.getItem("cloud.integrated.day"));e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}));return true})()')
      await browser.until('document.querySelectorAll(".ops-visit").length===250',9000)
      assert.equal(await browser.value('document.querySelector("#main-content")?.textContent.includes("Incomplete: more than 250 appointments matched")'),false)
      // Multiple verified branches: choosing Cavite never yields the Naga appointment.
      await browser.goto(url+'/app/ops?actor=staff&case=multi')
      await browser.until('!!document.querySelector("select")&&document.querySelector("#main-content")?.textContent.includes("Choose a clinic branch")',9000)
      assert.equal(await browser.value('!!document.querySelector(".ops-visit")'),false)
      await browser.value('(()=>{const e=document.querySelector(\'[aria-label="Branch selection"] select\');e.focus();e.value="40000000-0000-4000-8000-000000000002";e.dispatchEvent(new Event("change",{bubbles:true}));return true})()')
      await browser.until('document.querySelector("#main-content")?.textContent.includes("No appointments in this window")',9000)
      assert.equal(await browser.value('!!document.querySelector(".ops-visit")'),false)
      const before=await browser.value('JSON.parse(localStorage.getItem("cloud.integrated.syntheticAudit")||"[]").filter(x=>x.path==="/rest/v1/appointments").slice(-1)[0]')
      assert.equal(before.branch,'40000000-0000-4000-8000-000000000002')
      await browser.value('(()=>{const e=document.querySelector(\'[aria-label="Branch selection"] select\');e.value="40000000-0000-4000-8000-000000000001";e.dispatchEvent(new Event("change",{bubbles:true}));return true})()')
      await browser.until('!!document.querySelector(".ops-toolbar input[type=date]")',9000)
      await browser.value('(()=>{const e=document.querySelector(".ops-toolbar input[type=date]");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,localStorage.getItem("cloud.integrated.day"));e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}));return true})()')
      await browser.until('!!document.querySelector(".ops-visit")',9000)
      await browser.value('window.__cloudIntegrated.denied=true;[...document.querySelectorAll("button")].find(x=>x.textContent==="Refresh branch data").click();true')
      await browser.until('!!document.querySelector(".ops-failure")',9000)
      assert.equal(await browser.value('!!document.querySelector(".ops-visit")'),false,'revocation clears row and appointment context')
      // Both a receptionist assignment and a stricter global receptionist
      // assignment must deny records/drafts even when branch metadata claims vet.
      for(const roleMode of ['receptionist','role-mismatch']){
        await browser.goto(url+'/app/clinical?actor=staff&case='+roleMode)
        await browser.until('!!document.querySelector("#clinical-day")',9000)
        await browser.value('(()=>{const e=document.querySelector("#clinical-day");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,localStorage.getItem("cloud.integrated.day"));e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}));return true})()')
        await browser.until('!!document.querySelector(".clinical-patient")',9000)
        await browser.value('document.querySelector(".clinical-patient").click();true')
        await browser.until('!!document.querySelector("#clinical-tab-history")')
        await browser.value('document.querySelector("#clinical-tab-history").click();true')
        await browser.until('document.body.textContent.includes("Receptionists can view authorized appointments only")',9000)
        assert.equal(await browser.value('!!document.querySelector(".clinical-chart-gateway .clinical-timeline")'),false)
        assert.equal(await browser.value('window.__cloudIntegrated.directWrites.length'),0)
      }
      // Administrator can inspect a branch but neither author a clinical
      // encounter nor create financial records while endpoints are unapproved.
      await browser.goto(url+'/app/clinical?actor=staff&case=administrator')
      await browser.until('!!document.querySelector("#clinical-day")',9000)
      await browser.value('(()=>{const e=document.querySelector("#clinical-day");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,localStorage.getItem("cloud.integrated.day"));e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}));return true})()')
      await browser.until('!!document.querySelector(".clinical-patient")',9000)
      await browser.value('document.querySelector(".clinical-patient").click();true')
      await browser.until('!!document.querySelector("#clinical-tab-encounter")')
      await browser.value('document.querySelector("#clinical-tab-encounter").click();true')
      assert.equal(await browser.value('[...document.querySelectorAll("button")].some(b=>b.textContent.includes("Save to patient chart")&&!b.disabled)'),false)
      await browser.goto(url+'/app/billing?actor=staff&case=administrator')
      await browser.until('document.body.textContent.includes("Billing read service not integrated")',9000)
      assert.equal(await browser.value('document.querySelectorAll(".billing-invoice").length'),0)
      await browser.goto(url+'/app/ops?actor=visitor')
      await browser.until('location.pathname==="/auth/signin"',9000)

      await browser.goto(url+'/app/ops?actor=staff&case=expired')
      await browser.until('location.pathname==="/auth/signin"',9000)
      assert.equal(await browser.value('!!document.querySelector(".ops-visit")'),false)
    })
  } finally {
    await vite.close()
    for(const key of ['VITE_SUPABASE_URL','VITE_SUPABASE_PUBLISHABLE_KEY',
      'VITE_PHASE5A_OPS_UI','VITE_CLINICAL_WORKSPACE_UI','VITE_PHASE5B_PHARMACY_UI','VITE_PHASE5C_BILLING_UI'])
      delete process.env[key]
  }
})


test('CLOUD RELEASE: real public discovery, 360/768/1440 light/dark and PII-free booking sign-in return',
  {timeout:180000},async()=>{
  process.env.VITE_SUPABASE_URL='https://issue51-fixtures.supabase.co'
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_issue51_offline'
  const vite=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),
    server:{host:'127.0.0.1',port:0,strictPort:false}})
  try{
    await vite.listen()
    const origin='http://127.0.0.1:'+vite.httpServer.address().port
    await withChromium(async browser=>{
      await browser.send('Page.addScriptToEvaluateOnNewDocument',
        {source:'('+releaseClinicFixture.toString()+')()'})
      for(const width of [360,768,1440]){
        await browser.send('Emulation.setDeviceMetricsOverride',
          {width,height:900,deviceScaleFactor:1,mobile:false})
        for(const theme of ['light','dark']){
          for(const route of ['/','/services','/location','/book']){
            await browser.goto(origin+route+'?actor=visitor&theme='+theme)
            await browser.until('!!document.querySelector("#main-content h1")',9000)
            const view=await browser.value('({theme:document.documentElement.getAttribute("data-theme"),h1:document.querySelector("#main-content h1")?.textContent,overflow:document.documentElement.scrollWidth>innerWidth,external:[...document.querySelectorAll("a[target=_blank]")].every(a=>a.rel.includes("noopener")&&a.rel.includes("noreferrer")&&a.href.startsWith("https://")),writes:window.__cloudIntegrated.directWrites,unknown:window.__cloudIntegrated.unexpected,categories:document.querySelectorAll("#cat-heading + ul > li").length,branches:document.querySelectorAll(".branch-directory .branch-card").length})')
            assert.equal(view.theme,theme,route+' theme')
            assert.ok(view.h1,route+' H1')
            assert.equal(view.overflow,false,route+' horizontal overflow '+width+'/'+theme)
            assert.equal(view.external,true,'safe external links')
            assert.deepEqual(view.writes,[],'public visitor no provider mutation')
            assert.deepEqual(view.unknown,[],'no unapproved external origin')
            if(route==='/services')assert.equal(view.categories,8,'informational categories only')
            if(route==='/location')assert.equal(view.branches,2,'Naga and contact-only Cavite')
          }
        }
      }
      // Start a real anonymous /book journey with an approved test-only schedule.
      await browser.send('Emulation.setDeviceMetricsOverride',
        {width:768,height:900,deviceScaleFactor:1,mobile:false})
      await browser.goto(origin+'/book?actor=visitor&theme=light')
      try{await browser.until('!!document.querySelector("form[aria-label=\"Naga appointment request\"] input[name=service]")',9000)}
      catch{
        const state=await browser.value('({main:document.querySelector("#main-content")?.textContent.slice(0,650),audit:JSON.parse(localStorage.getItem("cloud.integrated.syntheticAudit")||"[]").map(x=>x.path).slice(-14),unknown:window.__cloudIntegrated?.unexpected,auth:window.__cloudIntegrated?.authSubmits})')
        assert.fail('Guest booking form absent with synthetic approved test policy: '+JSON.stringify(state))
      }
      assert.equal(await browser.value('!!document.querySelector("[aria-label=\"Naga appointment request\"] button[type=submit]:not(:disabled)")'),false)
      await browser.value('document.querySelector("input[name=service]").click();true')
      await browser.until('!!document.querySelector("form[aria-label=\"Naga appointment request\"] label select")',9000)
      const options=await browser.value('[...document.querySelectorAll("form[aria-label=\"Naga appointment request\"] select")].at(-1)?.options.length')
      assert.ok(options>=2,'synthetic approved schedule dates exposed as choices, not guessed hours')
      const date=await browser.value('(()=>[...document.querySelectorAll("form[aria-label=\"Naga appointment request\"] select")].at(-1).options[1].value)()')
      await browser.value('(()=>{const el=[...document.querySelectorAll("form[aria-label=\"Naga appointment request\"] select")].at(-1);el.value="'+date+'";el.dispatchEvent(new Event("change",{bubbles:true}));return true})()')
      await browser.until('!!document.querySelector("form[aria-label=\"Naga appointment request\"] input[name=slot]")',9000)
      const slot=await browser.value('document.querySelector("form[aria-label=\"Naga appointment request\"] input[name=slot]").value')
      assert.ok(Number.isFinite(Date.parse(slot)))
      assert.equal(new Date(slot).getUTCMinutes()%15,0,'quarter-hour grid in synthetic Manila schedule')
      await browser.value('document.querySelector("form[aria-label=\"Naga appointment request\"] input[name=slot]").click();true')
      await browser.value('[...document.querySelectorAll("form[aria-label=\"Naga appointment request\"] button")].find(x=>x.textContent.includes("Sign in to continue")).click();true')
      await browser.until('location.pathname==="/auth/signin"',9000)
      assert.equal(await browser.value('new URLSearchParams(location.search).get("next")'),'/book')
      assert.equal(await browser.value('location.href.includes("40000000")||location.href.includes("20000000")'),false,
        'no patient IDs carried through login redirect')
      const intent=await browser.value('sessionStorage.getItem("dawney.publicBookingIntent.v1")')
      assert.equal(typeof intent,'string','only non-PII booking intent survives')
      assert.equal(intent.includes('Synthetic Patient'),false)
      await browser.value('document.querySelector("input[type=email]").focus();true')
      await browser.send('Input.insertText',{text:'synthetic-release-owner@example.test'})
      await browser.value('document.querySelector("input[type=password]").focus();true')
      await browser.send('Input.insertText',{text:'fixture-only-password'})
      await browser.value('document.querySelector("form button[type=submit],form button").click();true')
      await browser.until('location.pathname==="/book"',9000)
      assert.equal(await browser.value('window.__cloudIntegrated.authSubmits'),1)
      await browser.until('!!document.querySelector("form[aria-label=\"Naga appointment request\"]")',9000)
      assert.equal(await browser.value('document.body.textContent.includes("Your patient and request")'),true,
        'verified owner returns to intended booking with its patient step')
      assert.equal(await browser.value('window.__cloudIntegrated.directWrites.length'),0,
        'authentication navigation did not create an appointment')
    })
  }finally{
    await vite.close()
    delete process.env.VITE_SUPABASE_URL
    delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  }
})


test('CLOUD RELEASE: chart 50/51, creator versus editor, safe draft CAS and role privacy',
  {timeout:180000},async()=>{
  process.env.VITE_SUPABASE_URL='https://issue51-fixtures.supabase.co'
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_issue51_offline'
  const vite=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),
    server:{host:'127.0.0.1',port:0,strictPort:false}})
  try{
    await vite.listen()
    const origin='http://127.0.0.1:'+vite.httpServer.address().port
    await withChromium(async browser=>{
      await browser.send('Page.addScriptToEvaluateOnNewDocument',
        {source:'('+releaseClinicFixture.toString()+')()'})
      const fixture='/tests/fixtures/clinical-chart-fixture.html?case='
      const choose=async(mode)=>{
        await browser.value('(()=>{const el=document.querySelector("#qa-mode");el.value="'+mode+'";el.dispatchEvent(new Event("change",{bubbles:true}));return true})()')
      }
      // All three longitudinal sections use immutable 50-item cursor pages.
      for(const [section,mode] of [['appointments','visits'],['records','history'],['drafts','encounter']]){
        await browser.goto(origin+fixture+'pages')
        await choose(mode)
        await browser.until('document.querySelectorAll(".clinical-visit").length===50',9000)
        const first=await browser.value('window.__cloudIntegrated.clinicalReads')
        assert.equal(first.length,1)
        assert.equal(first[0].section,section)
        assert.equal(first[0].scope.ownerId,'20000000-0000-4000-8000-000000000004')
        if(section==='drafts')assert.equal(await browser.value('!!document.querySelector(".clinical-attribution")'),false,
          'page-one absence does not mean no draft exists for the appointment')
        await browser.value('document.querySelector(".clinical-chart-pagination button").click();true')
        await browser.until('document.querySelectorAll(".clinical-visit").length===51',9000)
        const result=await browser.value('({reads:window.__cloudIntegrated.clinicalReads,localWrites:window.__cloudIntegrated.clinicalWrites,overflow:document.documentElement.scrollWidth>innerWidth})')
        assert.equal(result.reads.length,2)
        assert.ok(result.reads[1].cursor,'second page uses server cursor, never offset guessing')
        assert.equal(result.localWrites.length,0)
        assert.equal(result.overflow,false)
        if(section==='drafts'){
          await browser.until('!!document.querySelector(".clinical-attribution")',9000)
          assert.equal(await browser.value('document.querySelector(".clinical-attribution").textContent.includes("Created by")&&document.querySelector(".clinical-attribution").textContent.includes("Last edited by")'),true)
        }
      }
      // Receptionist must never request protected notes or drafts in any branch.
      await browser.goto(origin+fixture+'pages&role=receptionist')
      await browser.until('!!document.querySelector(".clinical-verified-demographics")')
      await choose('history')
      await browser.until('document.body.textContent.includes("Receptionists can view authorized appointments only")')
      await choose('encounter')
      await browser.until('document.body.textContent.includes("Receptionists can view authorized appointments only")')
      assert.equal(await browser.value('window.__cloudIntegrated.clinicalReads.every(x=>x.section==="appointments")'),true)
      assert.equal(await browser.value('window.__cloudIntegrated.clinicalWrites.length'),0)
      for(const [caseName,notice] of [
        ['not-found','Patient context not found'],
        ['missing','Secure chart unavailable'],
        ['network','Network interruption'],
        ['wrong-owner','Invalid clinical response'],
        ['wrong-branch','Invalid clinical response'],
        ['wrong-patient','Invalid clinical response'],
        ['malformed','Invalid clinical response']
      ]){
        await browser.goto(origin+fixture+caseName)
        await browser.until('document.body.textContent.includes("'+notice+'")',9000)
        assert.equal(await browser.value('!!document.querySelector(".clinical-verified-demographics")'),false,
          'unverified chart cannot display demographics '+caseName)
      }
      await browser.goto(origin+fixture+'empty')
      await browser.until('document.body.textContent.includes("Verified empty appointments history")',9000)
      // Account and patient switches fully clear identity and stale rendered data.
      await browser.goto(origin+fixture+'pages')
      await browser.until('document.body.textContent.includes("Synthetic Chart Patient")',9000)
      await browser.value('document.querySelector("#qa-account").click();true')
      await browser.until('document.body.textContent.includes("Access revoked")',9000)
      assert.equal(await browser.value('document.body.textContent.includes("Synthetic Chart Patient")'),false)
      await browser.goto(origin+fixture+'pages')
      await browser.until('document.body.textContent.includes("Synthetic Chart Patient")',9000)
      await browser.value('document.querySelector("#qa-patient").click();true')
      await browser.until('document.body.textContent.includes("Access revoked")',9000)
      assert.equal(await browser.value('document.body.textContent.includes("Synthetic Chart Patient")'),false)
      await browser.goto(origin+fixture+'late')
      await browser.until('window.__cloudIntegrated.clinicalReads.length>0',9000)
      await browser.value('document.querySelector("#qa-branch").click();true')
      await browser.until('document.body.textContent.includes("Synthetic Other Branch Patient")',9000)
      await browser.value('new Promise(resolve=>setTimeout(resolve,340))')
      assert.equal(await browser.value('document.body.textContent.includes("Synthetic Chart Patient")'),false,
        'delayed old-branch response cannot restore stale patient identity')
      // All fake CAS acknowledgements are localhost; production chart Save stays OFF.
      await browser.goto(origin+fixture+'conflict')
      await choose('encounter')
      await browser.until('!!document.querySelector(".clinical-attribution")',9000)
      await browser.value('document.querySelector("form[aria-label=\"Persisted encounter draft form\"] textarea").focus();true')
      await browser.send('Input.insertText',{text:' fake second veterinarian revision'})
      await browser.until('document.querySelector(".clinical-encounter-editor button[type=submit]")?.disabled===false')
      await browser.value('document.querySelector(".clinical-encounter-editor button[type=submit]").click();true')
      await browser.until('document.body.textContent.includes("Revision or request-ID conflict")',9000)
      assert.equal(await browser.value('document.querySelector(".clinical-encounter-editor button[type=submit]").disabled'),true)
      assert.equal(await browser.value('window.__cloudIntegrated.clinicalWrites.length'),1)
      await browser.goto(origin+fixture+'uncertain')
      await choose('encounter')
      await browser.until('!!document.querySelector(".clinical-attribution")',9000)
      await browser.value('document.querySelector("form[aria-label=\"Persisted encounter draft form\"] textarea").focus();true')
      await browser.send('Input.insertText',{text:' uncertain localhost draft'})
      await browser.until('document.querySelector(".clinical-encounter-editor button[type=submit]")?.disabled===false')
      await browser.value('document.querySelector(".clinical-encounter-editor button[type=submit]").click();true')
      await browser.until('document.body.textContent.includes("Save was not verified")',9000)
      await browser.value('document.querySelector(".clinical-encounter-editor button[type=submit]").click();true')
      await browser.until('document.body.textContent.includes("Server-acknowledged DRAFT saved")',9000)
      const tickets=await browser.value('window.__cloudIntegrated.clinicalWrites')
      assert.equal(tickets.length,2)
      assert.equal(tickets[0].requestId,tickets[1].requestId,'same request UUID on uncertain unchanged retry')
      assert.equal(tickets.every(x=>x.localOnly),true,'no remotely persisted medical data')
    })
  }finally{
    await vite.close()
    delete process.env.VITE_SUPABASE_URL
    delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  }
})
