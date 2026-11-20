// CLOUD: real Chromium branch-safe staff Operations end-to-end acceptance
// appointment queue, patient chart and read-only branch pharmacy.
// All HTTP is synthetic and intercepted. No hosted Auth, medicine or clinical write.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {fileURLToPath} from 'node:url'
import {withChromium} from '../../scripts/browser/cdp.mjs'

function sharedJourneyFixture(){
  const uuid=n=>'40000000-0000-4000-8000-'+String(n).padStart(12,'0')
  const ids={naga:uuid(1),cavite:uuid(2),service:uuid(3),resource:uuid(4),
    ownerUser:uuid(5),staffUser:uuid(6),otherUser:uuid(7),
    owner:uuid(8),pet:uuid(9),otherPet:uuid(10),booking:uuid(11),
    med:uuid(12),lot:uuid(13)}
  const remote='https://issue51-fixtures.supabase.co'
  const fakeNow=Date.parse('2026-11-20T01:00:00Z')
  const RealDate=Date
  class FixedDate extends RealDate{
    constructor(...args){super(...(args.length?args:[fakeNow]))}
    static now(){return fakeNow}
  }
  window.Date=FixedDate
  const qs=new URL(location.href).searchParams
  const actor=qs.get('actor')||'visitor'
  const mode=qs.get('case')||'normal'
  const theme=qs.get('theme')==='dark'?'dark':'light'
  localStorage.setItem('dawney-theme',theme)
  const bookingKey='cloud.integrated.syntheticBooking'
  const auditKey='cloud.integrated.syntheticAudit'
  if(qs.get('reset')==='1'){
    localStorage.removeItem(bookingKey)
    localStorage.removeItem('cloud.integrated.day')
    localStorage.setItem(auditKey,'[]')
  }
  const id=actor==='staff'?ids.staffUser:actor==='other'?ids.otherUser:ids.ownerUser
  const user={id,aud:'authenticated',role:'authenticated',email:'fixture-'+actor+'@example.test',
    created_at:'2025-01-01T00:00:00Z',email_confirmed_at:'2025-01-01T00:00:00Z',
    user_metadata:{},app_metadata:{}}
  const expires_at=Math.floor(RealDate.now()/1000)+86400*365
  const access_token=['{"alg":"HS256","typ":"JWT"}',JSON.stringify({sub:id,exp:expires_at}),'synthetic']
    .map(x=>btoa(x).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')).join('.')
  if(actor==='visitor')localStorage.removeItem('dawney.auth.v1')
  else localStorage.setItem('dawney.auth.v1',JSON.stringify({
    user,access_token,refresh_token:'integration-test',expires_at
  }))
  window.__cloudIntegrated={rpcs:[],unexpected:[],directWrites:[],denied:false,recovered:false}
  const weekly=Object.fromEntries(['sun','mon','tue','wed','thu','fri','sat']
    .map(x=>[x,[{open:'12:30',close:'14:00'}]]))
  const owner={id:ids.owner,user_id:ids.ownerUser,first_name:'Fixture',last_name:'Owner',
    phone:null,address:null}
  const pet={id:ids.pet,owner_id:ids.owner,name:'Synthetic Patient',
    species:'Dog',breed:'Mixed',sex:'unknown',color:null,birth_date:null,
    species_id:'dog',breed_id:null,taxonomy_review_needed:false}
  const service={id:ids.service,branch_id:ids.naga,slug:'fixture-care',
    display_name:'Fixture care',summary:null,duration_minutes:30,
    published_at:'2026-01-01T00:00:00Z'}
  const medicine={id:ids.med,product_code:'QA-INTEGRATION',generic_name:'Synthetic medicine',
    formulation:'vial',strength:'1 unit',stock_unit:'vial',
    minimum_shelf_life_days:0,requires_refrigeration:false,is_controlled:false,is_active:true}
  const rule={branch_id:ids.naga,medicine_id:ids.med,
    reorder_point_units:2,expiry_warning_days:30}
  const alert={medicine_id:ids.med,product_code:medicine.product_code,
    available_units:5,reorder_point_units:2,out_of_stock:false,low_stock:false,
    expiry_warning_days:30,near_expiry_batches:1,expired_batches:0,quarantined_batches:0}
  const batch={id:ids.lot,branch_id:ids.naga,medicine_id:ids.med,lot_number:'QA-LOT-1',
    received_on:'2026-11-01',expiry_date:'2026-12-10',
    disposition:'released',on_hand_units:5,reserved_units:0,quarantined_units:0}
  const fefo={batch_id:batch.id,lot_number:batch.lot_number,
    expiry_date:batch.expiry_date,available_units:5,received_on:batch.received_on}
  const originalFetch=window.fetch.bind(window)
  const response=(data,status=200)=>new Response(JSON.stringify(data),{
    status,headers:{'content-type':'application/json','access-control-allow-origin':'*'}
  })
  const filter=(url,name)=>url.searchParams.get(name)?.replace(/^eq\./,'')
  const saved=()=>{try{return JSON.parse(localStorage.getItem(bookingKey)||'null')}catch{return null}}
  const audit=(method,url)=>{
    const rows=JSON.parse(localStorage.getItem(auditKey)||'[]')
    rows.push({actor,method,path:url.pathname,branch:filter(url,'branch_id')??null,bounds:url.searchParams.getAll('starts_at')})
    localStorage.setItem(auditKey,JSON.stringify(rows))
  }
  window.fetch=async(input,init)=>{
    const req=new Request(input,init),url=new URL(req.url)
    if(url.origin===location.origin)return originalFetch(input,init)
    if(url.origin!==remote){
      window.__cloudIntegrated.unexpected.push('non-fixture origin')
      throw Error('Network not authorized')
    }
    if(req.method==='OPTIONS')return response({})
    audit(req.method,url)
    const path=url.pathname
    const singular=(req.headers.get('accept')||'').includes('application/vnd.pgrst.object+json')
    if(path==='/auth/v1/user')
      return mode==='expired'?response({message:'JWT expired'},401):response(user)
    if(path==='/rest/v1/rpc/request_service_appointment'){
      if(actor!=='owner')return response({code:'42501',message:'Unauthorized request'},403)
      const body=await req.json()
      window.__cloudIntegrated.rpcs.push(body)
      const consistent=body.p_pet_id===ids.pet&&body.p_service_id===ids.service&&
        body.p_resource_id===ids.resource&&
        /^[0-9a-f-]{36}$/i.test(body.p_request_nonce)&&
        body.p_concern==='Synthetic cross-module appointment'
      if(!consistent)return response({code:'42501',message:'Wrong patient or service'},403)
      if(window.__cloudIntegrated.rpcs.length===1)
        return response({code:'08006',message:'Synthetic network failure'},503)
      const first=window.__cloudIntegrated.rpcs[0]
      if(JSON.stringify(first)!==JSON.stringify(body))
        return response({code:'23505',message:'Retry nonce changed'},409)
      const previous=saved()
      if(previous)return response(previous.id)
      const created={id:ids.booking,branch_id:ids.naga,status:'requested',
        owner_id:ids.owner,pet_id:ids.pet,resource_id:ids.resource,
        service_id:ids.service,starts_at:body.p_starts_at,
        ends_at:new RealDate(RealDate.parse(body.p_starts_at)+1800000).toISOString(),
        concern:body.p_concern,details:null}
      localStorage.setItem(bookingKey,JSON.stringify(created))
      return response(created.id)
    }
    const rpc=path==='/rest/v1/rpc/get_branch_dashboard_counts'||
      path==='/rest/v1/rpc/assert_staff_branch'||
      path==='/rest/v1/rpc/list_branch_medicine_alerts'||
      path==='/rest/v1/rpc/list_branch_medicine_fefo'
    if(rpc&&req.method==='POST'){
      const body=await req.json()
      const multi=mode==='multi'||mode==='multi-stale'
      const allowed=body.p_branch===ids.naga||(multi&&body.p_branch===ids.cavite)
      if(actor!=='staff'||!allowed||mode==='revoked'||window.__cloudIntegrated.denied)
        return response({code:'42501',message:'Branch access not authorized'},403)
      if(path.endsWith('/assert_staff_branch'))return response(body.p_branch)
      if(path.endsWith('/get_branch_dashboard_counts')){
        if(mode==='counts-missing')return response({code:'PGRST202',message:'Missing invoker counts function'},404)
        const present=Boolean(saved())&&body.p_branch===ids.naga&&mode!=='empty'
        return response([{patients:present?1:0,requested_appointments:present?1:0,confirmed_appointments:0}])
      }
      if(mode==='inventory-missing')return response({code:'PGRST202',message:'Inventory RPC unavailable'},404)
      if(path.endsWith('/list_branch_medicine_alerts'))return response([alert])
      if(body.p_medicine!==ids.med)return response([])
      return response([fefo])
    }
    if(req.method!=='GET'){
      window.__cloudIntegrated.directWrites.push(req.method+' '+path)
      return response({code:'42501',message:'Direct writes forbidden'},403)
    }
    if((url.searchParams.get('select')||'').includes('unit_cost_minor')||
       (url.searchParams.get('select')||'').includes('currency_code')){
      window.__cloudIntegrated.unexpected.push('restricted-cost-query')
      return response({code:'42501',message:'Cost columns restricted'},403)
    }
    if(path==='/rest/v1/clinic_branches'){
      const branch=filter(url,'id')
      if(branch){
        const value={id:branch,slug:branch===ids.naga?'naga':'cavite',
          display_name:branch===ids.naga?'Synthetic Naga':'Synthetic Cavite',
          booking_enabled:branch===ids.naga,timezone:'Asia/Manila'}
        return response(singular?value:[value])
      }
      return response([
        {id:ids.naga,slug:'naga',display_name:'Synthetic Naga'},
        {id:ids.cavite,slug:'cavite',display_name:'Synthetic Cavite'}
      ])
    }
    if(path==='/rest/v1/branch_booking_policies'){
      return response({branch_id:ids.naga,is_approved:true,timezone:'Asia/Manila',
        weekly_hours:weekly,holidays:[],lead_minutes:1440,max_advance_days:4,
        slot_step_minutes:30,revision:1})
    }
    if(path==='/rest/v1/clinic_services')return response([service])
    if(path==='/rest/v1/clinic_service_resources')return response([
      {service_id:ids.service,resource_id:ids.resource,capacity:1,public_label:'Fixture room'}
    ])
    if(path==='/rest/v1/appointment_resources')return response([
      {id:ids.resource,branch_id:ids.naga,is_active:true}
    ])
    if(path==='/rest/v1/owners')
      return response(actor==='owner'?(singular?owner:[owner]):singular?null:[])
    if(path==='/rest/v1/pets'){
      if(actor!=='owner'){
        window.__cloudIntegrated.unexpected.push('staff-wide-patient-query')
        return response({code:'42501',message:'Staff patient query denied'},403)
      }
      const selected=filter(url,'id')
      if(selected)return response(singular?(selected===ids.pet?pet:null):selected===ids.pet?[pet]:[])
      return response([pet])
    }
    if(path==='/rest/v1/species_catalog')return response([
      {id:'dog',clinic_supported:true,is_active:true,review_status:'curated'}
    ])
    if(path==='/rest/v1/clinic_service_species')
      return response([{species_id:'dog'}])
    if(path==='/rest/v1/appointments'){
      const booking=saved()
      if(actor==='owner'){
        const own=booking?.owner_id===ids.owner?[booking]:[]
        return response(singular?(own[0]??null):own)
      }
      const branch=filter(url,'branch_id')
      const multi=mode==='multi'||mode==='multi-stale'
      if(actor!=='staff'||(branch!==ids.naga&&!(multi&&branch===ids.cavite))){
        window.__cloudIntegrated.unexpected.push('unscoped-or-foreign-staff-appointments')
        return response({code:'42501',message:'Branch filter required'},403)
      }
      if(mode==='network'&&!window.__cloudIntegrated.recovered)
        throw Error('Failed to fetch staff queue')
      if(mode==='multi-stale'&&branch===ids.naga&&!window.__cloudIntegrated.recovered)
        await new Promise(resolve=>{window.__cloudIntegrated.releaseQueue=resolve})
      const bounds=url.searchParams.getAll('starts_at')
      const lower=bounds.find(x=>x.startsWith('gte.'))?.slice(4)??''
      const higher=bounds.find(x=>x.startsWith('lt.'))?.slice(3)??''
      const rows=booking&&branch===ids.naga&&mode!=='empty'?[booking]:[]
      if(booking&&(mode==='exact250'||mode==='over250')){
        const extra=mode==='over250'?250:249
        for(let i=0;i<extra;i++){
          const starts_at=new RealDate(RealDate.parse(booking.starts_at)+(i+1)*60000).toISOString()
          rows.push({...booking,id:uuid(500+i),pet_id:uuid(900+i),resource_id:uuid(1300+i),
            starts_at,ends_at:new RealDate(RealDate.parse(starts_at)+30000).toISOString()})
        }
      }
      return response(rows.filter(x=>(!lower||x.starts_at>=lower)&&(!higher||x.starts_at<higher)))
    }
    if(path==='/rest/v1/staff_memberships'){
      const role=actor==='staff'&&mode!=='denied'?'veterinarian':null
      // PostgREST maybeSingle GET in this client version normalizes a JSON array.
      // The browser's existing staff fixture likewise supplies [row] or [].
      return response(role?[{user_id:ids.staffUser,role,is_active:true}]:[])
    }
    if(path==='/rest/v1/staff_branch_memberships'){
      const multi=mode==='multi'||mode==='multi-stale'
      return response(actor==='staff'&&mode!=='denied'
        ?[...[ids.naga,...(multi?[ids.cavite]:[])].map(branch_id=>({
          user_id:ids.staffUser,branch_id,role:'veterinarian',is_active:true}))]:[])
    }
    if(path==='/rest/v1/medicine_catalog'){
      if(mode==='network'&&!window.__cloudIntegrated.recovered)
        throw Error('Failed to fetch medicine catalog')
      return response([medicine])
    }
    if(path==='/rest/v1/branch_medicine_rules')
      return response(filter(url,'branch_id')===ids.naga?[rule]:[])
    if(path==='/rest/v1/branch_stock_batches')
      return response(filter(url,'branch_id')===ids.naga?[batch]:[])
    if(path==='/rest/v1/stock_movements')
      return response([])
    window.__cloudIntegrated.unexpected.push(path)
    return response({code:'PGRST202',message:'Unexpected synthetic endpoint'},404)
  }
}

/** Fixture is a copy of PR105's offline HTTP interceptor, augmented only in
 * this NEW staff test for #58 invoker counts, 250/251 and branch switching.
 * PR105's original source blobs and PR89's three QA files remain untouched.
 * All browser flags are temporary; checked-in production defaults remain OFF. */
test('CLOUD: owner requested booking enters branch-only Operations, clinical context and read-only pharmacy',
  {timeout:240000},async()=>{
  process.env.VITE_SUPABASE_URL='https://issue51-fixtures.supabase.co'
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_issue51_offline'
  process.env.VITE_PHASE5A_OPS_UI='true'
  process.env.VITE_CLINICAL_WORKSPACE_UI='true'
  process.env.VITE_PHASE5B_PHARMACY_UI='true'
  const root=fileURLToPath(new URL('../',import.meta.url))
  const vite=await createServer({root,server:{host:'127.0.0.1',port:0,strictPort:false}})
  try{
    await vite.listen()
    const url='http://127.0.0.1:'+vite.httpServer.address().port
    await withChromium(async browser=>{
      await browser.send('Page.addScriptToEvaluateOnNewDocument',
        {source:'('+sharedJourneyFixture.toString()+')()'})
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
          const final=await browser.value('({writes:window.__cloudIntegrated.directWrites,unexpected:window.__cloudIntegrated.unexpected,log:JSON.parse(localStorage.getItem("cloud.integrated.syntheticAudit")||"[]")})')
          assert.deepEqual(final.writes,[],'zero unauthorized staff mutations')
          assert.deepEqual(final.unexpected,[],'zero unscoped patients or foreign branch reads')
          assert.ok(final.log.some(x=>x.path.endsWith('/rpc/get_branch_dashboard_counts')))
        }
      }
      // No memberships -> denial, not an empty verified queue; staff shortcuts hidden.
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
      await browser.until('!!document.querySelector(".ops-visit")',9000)
      await browser.goto(url+'/app/ops?actor=staff&case=empty')
      await browser.until('!!document.querySelector(".empty-state")',9000)
      assert.equal(await browser.value('!!document.querySelector(".ops-visit")'),false)
      // The branch invoker counts RPC is missing: show unavailable, never fabricate zero.
      await browser.goto(url+'/app/ops?actor=staff&case=counts-missing')
      await browser.until('document.querySelector("#main-content")?.textContent.includes("Branch patient and appointment counts are unavailable")',9000)
      assert.equal(await browser.value('document.querySelector("#main-content")?.textContent.includes("Registered patients")'),false)
      await browser.goto(url+'/app/ops?actor=staff&case=over250')
      await browser.until('document.querySelector("#main-content")?.textContent.includes("Incomplete: more than 250 appointments matched")',9000)
      assert.equal(await browser.value('document.querySelectorAll(".ops-visit").length'),250)
      await browser.goto(url+'/app/ops?actor=staff&case=exact250')
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
      await browser.goto(url+'/app/ops?actor=staff&case=expired')
      await browser.until('location.pathname==="/auth/signin"',9000)
      assert.equal(await browser.value('!!document.querySelector(".ops-visit")'),false)
    })
  } finally {
    await vite.close()
    for(const key of ['VITE_SUPABASE_URL','VITE_SUPABASE_PUBLISHABLE_KEY',
      'VITE_PHASE5A_OPS_UI','VITE_CLINICAL_WORKSPACE_UI','VITE_PHASE5B_PHARMACY_UI'])
      delete process.env[key]
  }
})
