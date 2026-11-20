// CLOUD: one real Chromium journey crossing owner booking, authorized staff
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
    rows.push({actor,method,path:url.pathname,branch:filter(url,'branch_id')??null})
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
    const rpc=path==='/rest/v1/rpc/assert_staff_branch'||
      path==='/rest/v1/rpc/list_branch_medicine_alerts'||
      path==='/rest/v1/rpc/list_branch_medicine_fefo'
    if(rpc&&req.method==='POST'){
      const body=await req.json()
      if(actor!=='staff'||body.p_branch!==ids.naga||mode==='revoked'||window.__cloudIntegrated.denied)
        return response({code:'42501',message:'Branch access not authorized'},403)
      if(path.endsWith('/assert_staff_branch'))return response(ids.naga)
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
      if(actor!=='staff'||filter(url,'branch_id')!==ids.naga){
        window.__cloudIntegrated.unexpected.push('unscoped-staff-appointments')
        return response({code:'42501',message:'Branch filter required'},403)
      }
      if(mode==='network'&&!window.__cloudIntegrated.recovered)
        throw Error('Failed to fetch staff queue')
      const lower=url.searchParams.get('starts_at')?.replace(/^gte\./,'')??''
      const higher=url.searchParams.get('starts_at')?.replace(/^lt\./,'')??''
      return response(booking&&(!lower||booking.starts_at>=lower)?[booking]:[])
    }
    if(path==='/rest/v1/staff_memberships'){
      const role=actor==='staff'&&mode!=='denied'?'veterinarian':null
      return response(singular?(role?{user_id:ids.staffUser,role,is_active:true}:null):[])
    }
    if(path==='/rest/v1/staff_branch_memberships')
      return response(actor==='staff'&&mode!=='denied'
        ?[{user_id:ids.staffUser,branch_id:ids.naga,role:'veterinarian',is_active:true}]:[])
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

function rootDay(browser){
  return browser.value('localStorage.getItem("cloud.integrated.day")')
}
async function chooseNative(browser,selector,value){
  return browser.value('(()=>{const el=document.querySelector('+JSON.stringify(selector)+
    '); if(!el) return false; el.value='+JSON.stringify(value)+
    '; el.dispatchEvent(new Event("change",{bubbles:true}));return true})()')
}

test('CLOUD integrated owner request to staff queue/clinical chart/pharmacy with no unauthorized writes',
  {timeout:240000},async()=>{
  process.env.VITE_SUPABASE_URL='https://issue51-fixtures.supabase.co'
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_issue51_offline'
  process.env.VITE_CLINICAL_WORKSPACE_UI='true'
  process.env.VITE_PHASE5B_PHARMACY_UI='true'
  // Operations remains OFF: its unscoped legacy fallback requires a separately approved integration.
  process.env.VITE_PHASE5A_OPS_UI='false'
  const root=fileURLToPath(new URL('../',import.meta.url))
  const vite=await createServer({root,server:{host:'127.0.0.1',port:0,strictPort:false}})
  try{
    await vite.listen()
    const url='http://127.0.0.1:'+vite.httpServer.address().port
    await withChromium(async browser=>{
      await browser.send('Page.addScriptToEvaluateOnNewDocument',{
        source:'('+sharedJourneyFixture.toString()+')()'})
      for(const width of [360,768,1440]){
        await browser.send('Emulation.setDeviceMetricsOverride',
          {width,height:900,deviceScaleFactor:1,mobile:false})
        for(const theme of ['light','dark']){
          // Real owner route, approved synthetic policy, one deliberate 503 and same-nonce retry.
          await browser.goto(url+'/app/appointments?actor=owner&reset=1&theme='+theme)
          await browser.until('!!document.querySelector("form[aria-label=\'Appointment request\']")',9000)
          assert.equal(await browser.value('document.documentElement.getAttribute("data-theme")'),theme)
          const source=await browser.value('document.querySelector("form[aria-label=\'Appointment request\']").textContent')
          assert.match(source,/Patient/)
          assert.equal(await browser.value('document.querySelector("form select").value'),
            '40000000-0000-4000-8000-000000000009',"owner eligible patient selected")
          await browser.value('(()=>{const el=document.querySelectorAll("form[aria-label=\'Appointment request\'] select")[1];el.value="40000000-0000-4000-8000-000000000003";el.dispatchEvent(new Event("change",{bubbles:true}));return true})()')
          await browser.until('!!document.querySelector("form[aria-label=\'Appointment request\'] select option[value]:not([value=\'\'])")')
          await browser.until('document.querySelectorAll("form[aria-label=\'Appointment request\'] select").length>=3')
          const date=await browser.value('(()=>{const el=document.querySelectorAll("form[aria-label=\'Appointment request\'] select")[2];return [...el.options].map(o=>o.value).find(Boolean)??null})()')
          assert.ok(/^2026-11-2[0-9]$/.test(date),'published synthetic clinic date')
          await browser.value('localStorage.setItem("cloud.integrated.day",'+JSON.stringify(date)+');true')
          await browser.value('(()=>{const el=document.querySelectorAll("form[aria-label=\'Appointment request\'] select")[2];el.value='+JSON.stringify(date)+';el.dispatchEvent(new Event("change",{bubbles:true}));return true})()')
          await browser.until('!!document.querySelector("input[name=slot]")')
          await browser.value('document.querySelector("input[name=slot]").focus();true')
          await browser.send('Input.dispatchKeyEvent',
            {type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32,text:' ',unmodifiedText:' '})
          await browser.send('Input.dispatchKeyEvent',
            {type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32})
          await browser.until('!!document.querySelector("input[name=slot]:checked")')
          await browser.value('document.querySelector("form[aria-label=\'Appointment request\'] input[placeholder]").focus();true')
          await browser.send('Input.insertText',{text:'Synthetic cross-module appointment'})
          try {
            await browser.until('document.querySelector("form[aria-label=\'Appointment request\'] button[type=submit]")?.disabled===false',5000)
          } catch {
            const fields=await browser.value('(()=>{const f=document.querySelector("form[aria-label=\'Appointment request\']");return {selects:[...f.querySelectorAll("select")].map(x=>({value:x.value,options:x.options.length})),chosen:!!f.querySelector("input[name=slot]:checked"),reason:f.querySelector("input[placeholder]")?.value,disabled:f.querySelector("button[type=submit]")?.disabled,patientDisabled:f.querySelector("select")?.selectedOptions[0]?.disabled,radio:[...f.querySelectorAll("input[name=slot]")].map(x=>({value:x.value,checked:x.checked})),warnings:[...f.querySelectorAll("[role=alert],[role=status]")].map(x=>x.textContent),requests:JSON.parse(localStorage.getItem("cloud.integrated.syntheticAudit")||"[]").map(x=>x.path)}})()')
            assert.fail('Owner form remains blocked by current frontend eligibility: '+JSON.stringify(fields))
          }
          await browser.value('(()=>{const b=document.querySelector("form[aria-label=\'Appointment request\'] button[type=submit]");b.click();b.click();return true})()')
          await browser.until('document.querySelector("form[aria-label=\'Appointment request\'] [role=alert]")?.textContent.includes("We could not save")',9000)
          await browser.value('(()=>{const b=document.querySelector("form[aria-label=\'Appointment request\'] button[type=submit]");b.click();b.click();return true})()')
          await browser.until('document.querySelector("#main-content [role=status]")?.textContent.includes("Request received")',9000)
          const ownerState=await browser.value('({rpc:window.__cloudIntegrated.rpcs,booking:JSON.parse(localStorage.getItem("cloud.integrated.syntheticBooking")||"null"),violations:window.__cloudIntegrated.directWrites,unexpected:window.__cloudIntegrated.unexpected})')
          assert.equal(ownerState.rpc.length,2,'only 1 failed RPC + 1 same-nonce retry')
          assert.deepEqual(ownerState.rpc[0],ownerState.rpc[1],'idempotency token and payload reused')
          assert.equal(ownerState.booking.status,'requested','booking never claims confirmed')
          assert.deepEqual(ownerState.violations,[])
          assert.deepEqual(ownerState.unexpected,[])
          // Different authenticated actor sees the persisted synthetic appointment
          // ONLY through a current RLS/branch-asserted UTC staff queue.
          await browser.goto(url+'/app/clinical?actor=staff&theme='+theme)
          await browser.until('!!document.querySelector("#clinical-day")',9000)
          await browser.value('(()=>{const el=document.querySelector("#clinical-day");el.value=localStorage.getItem("cloud.integrated.day");el.dispatchEvent(new Event("change",{bubbles:true}));return true})()')
          await browser.until('!!document.querySelector(".clinical-patient")',9000)
          assert.equal(await browser.value('document.querySelectorAll(".clinical-patient").length'),1)
          const queue=await browser.value('document.querySelector(".clinical-patient").textContent')
          assert.match(queue,/requested/i)
          await browser.value('document.querySelector(".clinical-patient").click();true')
          await browser.until('document.activeElement===document.querySelector(".clinical-chart-head h2")',8000)
          assert.equal(await browser.value('document.querySelectorAll("[role=tab]").length'),7)
          await browser.value('document.querySelector("#clinical-tab-prescriptions").click();true')
          await browser.until('!!document.querySelector(".clinical-actions button[disabled]")')
          assert.equal(await browser.value('[...document.querySelectorAll(".clinical-actions button")].some(b=>b.textContent.includes("Save to patient chart")&&!b.disabled)'),false)
          const branchAudit=await browser.value('JSON.parse(localStorage.getItem("cloud.integrated.syntheticAudit")||"[]")')
          assert.ok(branchAudit.some(x=>x.actor==='staff'&&x.path==='/rest/v1/appointments'&&
            x.branch==='40000000-0000-4000-8000-000000000001'),'staff read explicitly filtered to Naga')
          assert.ok(!branchAudit.some(x=>x.actor==='staff'&&x.path==='/rest/v1/pets'),
            'clinical workspace cannot read unscoped patient table')
          // Move between real staff routes; pharmacy uses exactly the same authorized membership.
          await browser.goto(url+'/app/pharmacy?actor=staff&theme='+theme)
          await browser.until('!!document.querySelector(".pharmacy-medicine")',9000)
          assert.match(await browser.value('document.querySelector(".pharmacy-medicine").textContent'),/Synthetic medicine/)
          await browser.value('document.querySelector(".pharmacy-medicine").click();true')
          await browser.until('!!document.querySelector(".pharmacy-batches")',9000)
          assert.match(await browser.value('document.querySelector(".pharmacy-batches").textContent'),/QA-LOT-1/)
          await browser.value('document.querySelector("#pharmacy-tab-fefo").click();true')
          await browser.until('!!document.querySelector(".pharmacy-fefo li")')
          assert.equal(await browser.value('[...document.querySelectorAll(".pharmacy-actions-panel button")].every(b=>b.disabled)'),true)
          const state=await browser.value('({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,theme:document.documentElement.getAttribute("data-theme"),audit:JSON.parse(localStorage.getItem("cloud.integrated.syntheticAudit")||"[]"),denied:window.__cloudIntegrated.directWrites,unexpected:window.__cloudIntegrated.unexpected})')
          assert.equal(state.width,width)
          assert.equal(state.overflow,false,'no horizontal overflow at '+width+'/'+theme)
          assert.equal(state.theme,theme)
          assert.deepEqual(state.denied,[],'no clinical/inventory direct writes')
          assert.deepEqual(state.unexpected,[],'no unknown or forbidden resources')
          assert.equal(state.audit.filter(x=>x.path==='/rest/v1/rpc/request_service_appointment').length,2)
          assert.ok(!state.audit.some(x=>x.actor==='staff'&&x.path==='/rest/v1/appointments'&&!x.branch))
          assert.ok(!state.audit.some(x=>x.path==='/rest/v1/stock_movements'&&x.method!=='GET'))
        }
      }
      // Cross-account denial: another verified owner is NOT made staff by a URL.
      await browser.goto(url+'/app/clinical?actor=other')
      await browser.until('!!document.querySelector(".clinical-failure")',9000)
      assert.equal(await browser.value('!!document.querySelector(".clinical-chart")'),false)
      await browser.goto(url+'/app/pharmacy?actor=other')
      await browser.until('!!document.querySelector(".pharmacy-failure")',9000)
      assert.equal(await browser.value('!!document.querySelector(".pharmacy-medicine")'),false)
      // Revoked staff branch is fail closed even if a prior owner booking exists.
      await browser.goto(url+'/app/clinical?actor=staff&case=revoked')
      await browser.until('!!document.querySelector(".clinical-failure")',9000)
      assert.equal(await browser.value('!!document.querySelector(".clinical-patient")'),false)
      await browser.goto(url+'/app/pharmacy?actor=staff&case=inventory-missing')
      await browser.until('!!document.querySelector(".pharmacy-failure")',9000)
      assert.equal(await browser.value('!!document.querySelector(".pharmacy-medicine")'),false)
      await browser.goto(url+'/app/pharmacy?actor=staff&case=network')
      await browser.until('!!document.querySelector(".pharmacy-failure button")',9000)
      await browser.value('window.__cloudIntegrated.recovered=true;document.querySelector(".pharmacy-failure button").click();true')
      await browser.until('!!document.querySelector(".pharmacy-medicine")',9000)
      await browser.goto(url+'/app/clinical?actor=staff&case=expired')
      await browser.until('location.pathname==="/auth/signin"',9000)
      assert.equal(await browser.value('!!document.querySelector(".clinical-chart")'),false)
    })
  }finally{
    await vite.close()
    for(const name of ['VITE_CLINICAL_WORKSPACE_UI','VITE_PHASE5B_PHARMACY_UI','VITE_PHASE5A_OPS_UI'])
      delete process.env[name]
  }
})
