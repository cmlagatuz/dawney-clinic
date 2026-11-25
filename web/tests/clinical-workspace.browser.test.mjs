// CLOUD: real local Chromium + disposable synthetic HTTP clinical workspace gate.
// No live accounts, patient details, stored drafts, network writes or screenshots.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {fileURLToPath} from 'node:url'
import {withChromium} from '../../scripts/browser/cdp.mjs'

function installClinicalFixture(){
  const uuid=n=>'20000000-0000-4000-8000-'+String(n).padStart(12,'0')
  const ids={naga:uuid(1),cavite:uuid(2),pet:uuid(3),owner:uuid(4),
    appointment:uuid(5),resource:uuid(6),secondPet:uuid(7),secondAppointment:uuid(8),user:uuid(9),secondUser:uuid(10),caviteOwner:uuid(11),caviteAppointment:uuid(13)}
  const remote='https://issue51-fixtures.supabase.co'
  const RealDate=Date,now=Date.parse('2026-11-20T01:00:00Z')
  class FixedDate extends RealDate{
    constructor(...args){super(...(args.length?args:[now]))}
    static now(){return now}
  }
  window.Date=FixedDate
  const qs=new URL(location.href).searchParams
  const mode=qs.get('case')||'ok'
  const theme=qs.get('theme')==='dark'?'dark':'light'
  localStorage.setItem('dawney-theme',theme)
  let user={id:ids.user,aud:'authenticated',role:'authenticated',
    email:'synthetic-staff@example.test',email_confirmed_at:'2025-01-01T00:00:00Z',
    created_at:'2025-01-01T00:00:00Z',app_metadata:{},user_metadata:{}}
  const expiry=Math.floor(RealDate.now()/1000)+86400*365
  const sessionFor=account=>({user:account,access_token:['{"alg":"HS256","typ":"JWT"}',JSON.stringify({sub:account.id,exp:expiry}),'fixture']
    .map(x=>btoa(x).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')).join('.'),refresh_token:'synthetic-test',expires_at:expiry})
  localStorage.setItem('dawney.auth.v1',JSON.stringify(sessionFor(user)))
  window.__clinicalCalls={paths:[],mutations:[],assertions:[],unexpected:[],draftRequests:[],chartReads:[],released:0}
  const coverage=mode==='persist-coverage'
  let gate=null,readerFailure=null
  window.__clinicalControl={
    holdNext(){if(gate)throw Error('Fixture reader already held');let release;const promise=new Promise(resolve=>{release=resolve});gate={promise,release,started:false}},
    get held(){return gate?.started===true},
    release(){const current=gate;gate=null;current?.release()},
    failNext(kind){readerFailure=kind},
    switchAccount(){if(!coverage)throw Error('Unexpected fixture account change');user={...user,id:ids.secondUser,email:'second-synthetic-staff@example.test'};const session=sessionFor(user);localStorage.setItem('dawney.auth.v1',JSON.stringify(session));const channel=new BroadcastChannel('dawney.auth.v1');channel.postMessage({event:'SIGNED_IN',session});channel.close()}
  }
  let draft=null,receipt=null,receiptPayload=null
  const oldFetch=window.fetch.bind(window)
  const reply=(body,status=200)=>new Response(JSON.stringify(body),{
    status,headers:{'content-type':'application/json','access-control-allow-origin':'*'}
  })
  window.fetch=async(input,init)=>{
    const req=new Request(input,init),url=new URL(req.url)
    if(url.origin===location.origin)return oldFetch(input,init)
    if(url.origin!==remote){window.__clinicalCalls.unexpected.push('nonfixture origin');throw Error('Blocked remote endpoint')}
    if(req.method==='OPTIONS')return reply({})
    window.__clinicalCalls.paths.push(req.method+' '+url.pathname)
    const filter=name=>url.searchParams.get(name)?.replace(/^eq\./,'')
    if(url.pathname==='/rest/v1/rpc/assert_staff_branch'){
      const params=await req.json()
      window.__clinicalCalls.assertions.push(params.p_branch)
      if(mode==='revoked')return reply({code:'42501',message:'Branch access not authorized'},403)
      if(params.p_branch!==ids.naga&&params.p_branch!==ids.cavite)
        return reply({code:'42501',message:'Branch access not authorized'},403)
      return reply(params.p_branch)
    }
    if(mode.startsWith('persist')&&url.pathname==='/rest/v1/rpc/read_staff_patient_chart'){
      const p=await req.json()
      if(coverage){
        const account=user.id,branch=p.p_branch,pet=branch===ids.naga?ids.pet:ids.secondPet
        const owner=branch===ids.naga?ids.owner:ids.caviteOwner
        const label=branch===ids.naga?'Naga':account===ids.secondUser?'Second account Cavite':'Cavite'
        window.__clinicalCalls.chartReads.push({account,...p})
        if(![ids.naga,ids.cavite].includes(branch)||p.p_pet!==pet||p.p_limit!==50||
           p.p_after_at!==null||p.p_after_id!==null||!['appointments','records','drafts'].includes(p.p_section)||
           (account===ids.secondUser&&branch!==ids.cavite))return reply({code:'42501'},403)
        const startsAt='2026-11-20T02:00:00Z',endsAt='2026-11-20T02:30:00Z'
        const base={branchId:branch,petId:pet}
        const items=p.p_section==='appointments'?(branch===ids.naga?[
          {...base,id:ids.secondAppointment,startsAt:'2026-11-20T03:00:00Z',endsAt:'2026-11-20T03:30:00Z',status:'requested',concern:'Second synthetic fixture concern'},
          {...base,id:ids.appointment,startsAt,endsAt,status:'confirmed',concern:'Synthetic fixture concern'}
        ]:[{...base,id:ids.caviteAppointment,startsAt,endsAt,status:'confirmed',concern:'Synthetic Cavite concern'}]):
          p.p_section==='records'?[{...base,id:uuid(20),performedAt:startsAt,procedure:label+' synthetic history',comments:null,temperatureC:null,weightKg:null,authoredBy:ids.user}]:
          branch===ids.naga?[{...base,id:uuid(21),appointmentId:ids.secondAppointment,authorId:ids.user,editorId:ids.user,revision:2,status:'draft',complaint:'Second visit synthetic draft',examination:'Fixture exam',assessment:'Fixture assessment',plan:'Fixture plan',createdAt:startsAt,updatedAt:startsAt}]:[]
        const page={kind:'ok',accountId:account,branchId:branch,section:p.p_section,patient:{id:pet,ownerId:owner,name:label+' synthetic patient',species:'Dog',breed:null,sex:'unknown',birthDate:null,taxonomyReviewNeeded:false},items,hasMore:false,nextCursor:null}
        if(gate&&!gate.started){const current=gate;current.started=true;await current.promise;window.__clinicalCalls.released++}
        const failure=readerFailure;readerFailure=null
        if(failure==='missing')return reply({code:'PGRST202'},404)
        if(failure==='malformed')return reply({...page,patient:{...page.patient,ownerId:uuid(99)}})
        if(failure==='not-found')return reply({kind:'not_found'})
        return reply(page)
      }
      if(mode==='persist-denied'||p.p_branch!==ids.naga||p.p_pet!==ids.pet||p.p_limit!==50)return reply({code:'42501'},403)
      return reply({kind:'ok',accountId:ids.user,branchId:ids.naga,section:p.p_section,patient:{id:ids.pet,ownerId:ids.owner,name:'Synthetic clinical patient',species:'Dog',breed:null,sex:'unknown',birthDate:null,taxonomyReviewNeeded:false},items:p.p_section==='drafts'&&draft?[mode==='persist-mismatch'?{...draft,complaint:'Mismatched fixture readback'}:draft]:[],hasMore:false,nextCursor:null})
    }
    if(mode.startsWith('persist')&&url.pathname==='/rest/v1/rpc/save_staff_clinical_encounter_draft'){
      const p=await req.json();window.__clinicalCalls.draftRequests.push(p)
      if(coverage)return reply({code:'42501'},403)
      if(p.p_branch!==ids.naga||p.p_pet!==ids.pet||p.p_appointment!==ids.secondAppointment)return reply({code:'42501'},403)
      if(receiptPayload?.p_request_id===p.p_request_id){if(JSON.stringify(receiptPayload)!==JSON.stringify(p))return reply({code:'23505'},409);return reply(receipt)}
      if(p.p_expected_revision!==(draft?.revision??0))return reply({code:'40001'},409)
      const updatedAt='2026-11-20T01:00:00Z'
      draft={id:uuid(12),appointmentId:p.p_appointment,branchId:ids.naga,petId:ids.pet,authorId:ids.user,editorId:ids.user,revision:p.p_expected_revision+1,status:'draft',complaint:p.p_complaint,examination:p.p_examination,assessment:p.p_assessment,plan:p.p_plan,createdAt:updatedAt,updatedAt}
      receipt={kind:'saved',id:draft.id,appointmentId:draft.appointmentId,branchId:draft.branchId,petId:draft.petId,authorId:draft.authorId,editorId:draft.editorId,revision:draft.revision,status:'draft',updatedAt}
      receiptPayload=p
      if(mode==='persist'&&draft.revision===1)return reply({code:'500'},503)
      return reply(receipt)
    }
    if(req.method!=='GET'){
      window.__clinicalCalls.mutations.push(req.method+' '+url.pathname)
      return reply({message:'Synthetic writes prohibited'},403)
    }
    if(url.pathname==='/auth/v1/user')
      return mode==='expired'?reply({message:'JWT expired'},401):reply(user)
    if(url.pathname==='/rest/v1/staff_memberships'){
      if(mode==='denied')return reply([])
      return reply([{user_id:user.id,role:coverage?'administrator':mode==='reception'||mode==='role-mismatch'||mode==='persist-reception'?'receptionist':'veterinarian',is_active:true}])
    }
    if(url.pathname==='/rest/v1/staff_branch_memberships'){
      if(coverage)return reply((user.id===ids.secondUser?[ids.cavite]:[ids.naga,ids.cavite]).map(branch_id=>({user_id:user.id,branch_id,role:'administrator',is_active:true})))
      const rows=[{user_id:ids.user,branch_id:ids.naga,role:mode==='reception'||mode==='persist-reception'?'receptionist':'veterinarian',is_active:true}]
      if(mode==='two')rows.push({user_id:ids.user,branch_id:ids.cavite,role:'veterinarian',is_active:true})
      return reply(rows)
    }
    if(url.pathname==='/rest/v1/clinic_branches')
      return reply([{id:ids.naga,slug:'naga',display_name:'Fixture Naga'},
        {id:ids.cavite,slug:'cavite',display_name:'Fixture Cavite'}])
    if(url.pathname==='/rest/v1/appointments'){
      if(mode==='network')throw Error('Failed to fetch clinic appointments')
      if(coverage&&filter('branch_id')===ids.cavite)return reply([{id:ids.caviteAppointment,pet_id:ids.secondPet,owner_id:ids.caviteOwner,resource_id:ids.resource,branch_id:ids.cavite,starts_at:'2026-11-20T02:00:00Z',ends_at:'2026-11-20T02:30:00Z',status:'confirmed',concern:'Synthetic Cavite concern'}])
      if(filter('branch_id')!==ids.naga||coverage&&user.id===ids.secondUser)return reply([])
      const rows=[{
        id:ids.appointment,pet_id:ids.pet,owner_id:ids.owner,
        resource_id:ids.resource,branch_id:ids.naga,
        starts_at:'2026-11-20T02:00:00Z',ends_at:'2026-11-20T02:30:00Z',
        status:'confirmed',concern:'Synthetic fixture concern'
      }]
      if(mode==='patient-switch'||mode.startsWith('persist'))rows.push({
        id:ids.secondAppointment,pet_id:mode.startsWith('persist')?ids.pet:ids.secondPet,owner_id:ids.owner,
        resource_id:ids.resource,branch_id:ids.naga,
        starts_at:'2026-11-20T03:00:00Z',ends_at:'2026-11-20T03:30:00Z',
        status:'requested',concern:'Second synthetic fixture concern'
      })
      return reply(rows)
    }
    window.__clinicalCalls.unexpected.push(url.pathname)
    return reply({message:'No synthetic endpoint implemented'},404)
  }
}

test('CLOUD clinical browser: staff-scoped chart, themes/widths, keyboard, no writes', {timeout:180000},async()=>{
  process.env.VITE_SUPABASE_URL='https://issue51-fixtures.supabase.co'
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_issue51_offline'
  process.env.VITE_CLINICAL_WORKSPACE_UI='true'
  const root=fileURLToPath(new URL('../',import.meta.url))
  const vite=await createServer({root,server:{host:'127.0.0.1',port:0,strictPort:false}})
  try{
    await vite.listen()
    const origin='http://127.0.0.1:'+vite.httpServer.address().port
    await withChromium(async browser=>{
      await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:'('+installClinicalFixture.toString()+')()'})
      for(const width of [360,768,1440]){
        await browser.send('Emulation.setDeviceMetricsOverride',
          {width,height:900,deviceScaleFactor:1,mobile:false})
        for(const theme of ['light','dark']){
          await browser.goto(origin+'/app/clinical?theme='+theme)
          await browser.until('!!document.querySelector(".clinical-patient")')
          const facts=await browser.value(`({
            width:innerWidth,theme:document.documentElement.getAttribute('data-theme'),
            heading:document.querySelector('#clinical-title')?.textContent.trim(),
            patientButtons:document.querySelectorAll('.clinical-patient').length,
            overflow:document.documentElement.scrollWidth>innerWidth,
            noteSaved:[...document.querySelectorAll('button')].some(b=>/save to patient chart/i.test(b.textContent)&&!b.disabled),
            paths:window.__clinicalCalls.paths,mutations:window.__clinicalCalls.mutations,
            assertions:window.__clinicalCalls.assertions,unexpected:window.__clinicalCalls.unexpected
          })`)
          assert.equal(facts.width,width,'actual viewport')
          assert.equal(facts.theme,theme,'theme applied')
          assert.equal(facts.heading,'Patient charts & encounters')
          assert.equal(facts.patientButtons,1,'one branch-scoped patient from queue')
          assert.equal(facts.overflow,false,'no page overflow '+width+'/'+theme)
          assert.equal(facts.noteSaved,false,'no live clinical save')
          assert.deepEqual(facts.mutations,[],'zero clinical writes')
          assert.deepEqual(facts.unexpected,[],'no unexpected endpoint')
          assert.equal(facts.paths.some(x=>/\/pets|\/clinical_records/.test(x)),false,
            'no staff-wide unscoped profile/medical read')
          assert.ok(facts.assertions.length>0,'backend branch assertion executed')
          await browser.value('document.querySelector(".clinical-patient").click();true')
          await browser.until('!!document.querySelector(".clinical-chart")')
          await browser.until('document.activeElement === document.querySelector(".clinical-chart-head h2")')
          await browser.value('document.querySelector("#clinical-tab-overview").focus();true')
          await browser.send('Input.dispatchKeyEvent',
            {type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39})
          await browser.send('Input.dispatchKeyEvent',
            {type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39})
          await browser.until('document.querySelector("#clinical-tab-visits")?.getAttribute("aria-selected")==="true"')
          assert.equal(await browser.value('document.activeElement?.id'), 'clinical-tab-visits',
            'arrow navigation places focus on selected tab')
          await browser.value('document.querySelector("#clinical-tab-encounter").click();true')
          await browser.until('!!document.querySelector("form[aria-label=\'encounter local working draft\']")')
          const clinical=await browser.value(`({
            saveDisabled:[...document.querySelectorAll('.clinical-actions button')].some(b=>b.textContent.includes('Save to patient chart')&&b.disabled),
            profileNote:document.querySelector('.clinical-chart-head')?.textContent.includes('secure patient profile read is not connected'),
            noHistory:document.querySelectorAll('.clinical-visit').length===0
          })`)
          assert.equal(clinical.saveDisabled,true,'clinical writes disabled')
          assert.equal(clinical.profileNote,true,'missing scoped chart reader disclosed')
          await browser.value('document.querySelector("form[aria-label=\'encounter local working draft\'] button[type=submit]").click();true')
          await browser.until('!!document.querySelector(".clinical-validation")')
          assert.deepEqual(await browser.value('window.__clinicalCalls.mutations'),[],
            'even invalid local review never sends writes')
        }
      }
      // The local scratchpad must be physically unmounted when patient identity changes.
      await browser.goto(origin+'/app/clinical?case=patient-switch')
      await browser.until('document.querySelectorAll(".clinical-patient").length===2')
      await browser.value('document.querySelectorAll(".clinical-patient")[0].click();true')
      await browser.until('!!document.querySelector(".clinical-chart")')
      await browser.value('document.querySelector("#clinical-tab-encounter").click();true')
      try { await browser.until('!!document.querySelector(".clinical-form-shell textarea")', 5000) }
      catch {
        const snap=await browser.value(`({
          panels:[...document.querySelectorAll('.clinical-panel')].map(p=>p.textContent?.slice(0,80)),
          selected:[...document.querySelectorAll('[role=tab]')].filter(t=>t.getAttribute('aria-selected')==='true').map(t=>t.id)
        })`)
        assert.fail('No encounter field for synthetic selection: '+JSON.stringify(snap))
      }
      await browser.value('document.querySelector(".clinical-form-shell textarea").focus();true')
      await browser.send('Input.insertText',{text:'Unsaved fixture notes'})
      await browser.until('document.querySelector(".clinical-form-shell textarea")?.value==="Unsaved fixture notes"')
      await browser.value('document.querySelectorAll(".clinical-patient")[1].click();true')
      await browser.until('document.querySelector("#clinical-tab-overview")?.getAttribute("aria-selected")==="true"')
      await browser.value('document.querySelector("#clinical-tab-encounter").click();true')
      await browser.until('!!document.querySelector(".clinical-form-shell textarea")')
      assert.equal(await browser.value('document.querySelector(".clinical-form-shell textarea").value'),
        '','switching patients discards previous local draft')
      assert.equal(await browser.value('window.__clinicalCalls.mutations.length'),0)

      // Receptionist can read an authorized appointment but cannot draft medical orders.
      for(const roleCase of ['reception','role-mismatch']){
        // role-mismatch: global receptionist, branch claims veterinarian.
        // UI must apply the stricter role, not trust the branch alone.
        await browser.goto(origin+'/app/clinical?case='+roleCase)
      await browser.until('!!document.querySelector(".clinical-patient")')
      await browser.value('document.querySelector(".clinical-patient").click();true')
      await browser.until('!!document.querySelector(".clinical-chart")')
      await browser.value('document.querySelector("#clinical-tab-prescriptions").click();true')
      await browser.until('!!document.querySelector("form[aria-label=\'prescriptions local working draft\']")')
      assert.equal(await browser.value('[...document.querySelectorAll("form[aria-label=\'prescriptions local working draft\'] input,form[aria-label=\'prescriptions local working draft\'] textarea")].every(i=>i.disabled)'),true)
      assert.equal(await browser.value('[...document.querySelectorAll("form[aria-label=\'prescriptions local working draft\'] button")].every(b=>b.disabled)'),true)
      assert.deepEqual(await browser.value('window.__clinicalCalls.mutations'),[])
      }

      // The route is protected by verified active staff RLS membership.
      await browser.goto(origin+'/app/clinical?case=denied')
      await browser.until('!!document.querySelector(".clinical-failure")')
      assert.equal(await browser.value('!!document.querySelector(".clinical-chart")'),false)
      assert.equal(await browser.value('window.__clinicalCalls.paths.some(p=>["/appointments","/pets","/clinical_records"].some(endpoint=>p.includes(endpoint)))'),false)

      // No signed patient selection survives a branch change.
      await browser.goto(origin+'/app/clinical?case=two')
      await browser.until('!!document.querySelector("#clinical-branch option[value]")')
      await browser.value(`(()=>{const el=document.querySelector('#clinical-branch');
        el.value='20000000-0000-4000-8000-000000000001';
        el.dispatchEvent(new Event('change',{bubbles:true}));return true})()`)
      await browser.until('!!document.querySelector(".clinical-patient")')
      await browser.value('document.querySelector(".clinical-patient").click();true')
      await browser.until('!!document.querySelector(".clinical-chart")')
      await browser.value(`(()=>{const el=document.querySelector('#clinical-branch');
        el.value='20000000-0000-4000-8000-000000000002';
        el.dispatchEvent(new Event('change',{bubbles:true}));return true})()`)
      await browser.until('document.querySelector(".clinical-chart")===null')
      await browser.until('!!document.querySelector(".empty")')
      assert.equal(await browser.value('window.__clinicalCalls.mutations.length'),0)

      // An RLS denial on a subsequent branch assert hides the chart.
      await browser.goto(origin+'/app/clinical?case=revoked')
      await browser.until('!!document.querySelector(".clinical-failure")')
      assert.equal(await browser.value('!!document.querySelector(".clinical-chart")'),false)

      // A network failure is not silently converted to an empty patient list.
      await browser.goto(origin+'/app/clinical?case=network')
      await browser.until('!!document.querySelector("[role=alert] button")')
      assert.equal(await browser.value('!!document.querySelector(".clinical-chart")'),false)
      assert.equal(await browser.value('window.__clinicalCalls.mutations.length'),0)

      await browser.goto(origin+'/app/clinical?case=expired')
      await browser.until('location.pathname==="/auth/signin"')
      assert.equal(await browser.value('!!document.querySelector(".clinical-chart")'),false)
    })
  }finally{
    await vite.close()
    delete process.env.VITE_CLINICAL_WORKSPACE_UI
  }
})

test('CLOUD real clinical route: exact visit, lost ACK, same ID and authoritative draft revisions', {timeout:120000},async()=>{
 process.env.VITE_SUPABASE_URL='https://issue51-fixtures.supabase.co'
 process.env.VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_issue51_offline'
 process.env.VITE_CLINICAL_WORKSPACE_UI='true'
 process.env.VITE_CLINICAL_DRAFT_PERSISTENCE_UI='true'
 const vite=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),server:{host:'127.0.0.1',port:0,strictPort:false}})
 try{
  await vite.listen()
  await withChromium(async browser=>{
   await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:'('+installClinicalFixture.toString()+')()'})
   await browser.send('Emulation.setDeviceMetricsOverride',{width:360,height:900,deviceScaleFactor:1,mobile:false})
   const origin='http://127.0.0.1:'+vite.httpServer.address().port
   await browser.goto(origin+'/app/clinical?case=persist&theme=dark')
   await browser.until('document.querySelectorAll(".clinical-patient").length===2')
   await browser.value('document.querySelectorAll(".clinical-patient")[1].click();true')
   await browser.until('document.body.textContent.includes("Synthetic clinical patient")')
   await browser.value('document.querySelector("#clinical-tab-encounter").click();true')
   await browser.until('!!document.querySelector(".clinical-encounter-editor textarea")')
   await browser.value('document.querySelector(".clinical-encounter-editor textarea").focus();true')
   await browser.send('Input.insertText',{text:'Synthetic persistent complaint'})
   await browser.until('!!document.querySelector(".clinical-encounter-editor button[type=submit]:not(:disabled)")')
   await browser.value('document.querySelector(".clinical-encounter-editor button[type=submit]").click();true')
   await browser.until('document.querySelector(".clinical-encounter-editor button[type=submit]")?.textContent.includes("Retry same draft request")')
   assert.equal(await browser.value('document.querySelector("#clinical-branch").disabled&&document.querySelector("#clinical-day").disabled&&document.querySelector("#clinical-tab-history").disabled&&document.querySelector(".clinical-encounter-editor textarea").disabled'),true)
   await browser.value('document.querySelector(".clinical-encounter-editor button[type=submit]").click();true')
   await browser.until('document.body.textContent.includes("Authoritative draft revision 1")')
   const calls=await browser.value('window.__clinicalCalls.draftRequests')
   assert.equal(calls.length,2);assert.deepEqual(calls[0],calls[1])
   assert.equal(calls[0].p_appointment,'20000000-0000-4000-8000-000000000008')
   assert.equal(calls[0].p_expected_revision,0)
   await browser.value('document.querySelector(".clinical-encounter-editor textarea").focus();true')
   await browser.send('Input.insertText',{text:' revised'})
   await browser.until('!!document.querySelector(".clinical-encounter-editor button[type=submit]:not(:disabled)")')
   await browser.value('document.querySelector(".clinical-encounter-editor button[type=submit]").click();true')
   await browser.until('document.body.textContent.includes("Authoritative draft revision 2")')
   assert.equal(await browser.value('window.__clinicalCalls.draftRequests[2].p_expected_revision'),1)
   await browser.value('document.querySelector("#clinical-tab-history").click();true')
   await browser.value('document.querySelector("#clinical-tab-encounter").click();true')
   await browser.until('document.body.textContent.includes("Authoritative draft revision 2")')
   assert.equal(await browser.value('document.documentElement.scrollWidth<=innerWidth'),true)
   assert.deepEqual(await browser.value('window.__clinicalCalls.mutations'),[])
   assert.deepEqual(await browser.value('window.__clinicalCalls.unexpected'),[])
   await browser.goto(origin+'/app/clinical?case=persist-denied')
   await browser.until('document.querySelectorAll(".clinical-patient").length===2')
   await browser.value('document.querySelector(".clinical-patient").click();true')
   await browser.until('!!document.querySelector(".clinical-failure")')
   assert.equal(await browser.value('window.__clinicalCalls.draftRequests.length'),0)
   assert.equal(await browser.value('!!document.querySelector(".clinical-chart")'),false)
   await browser.goto(origin+'/app/clinical?case=persist-reception')
   await browser.until('document.querySelectorAll(".clinical-patient").length===2')
   await browser.value('document.querySelector(".clinical-patient").click();true')
   await browser.until('document.body.textContent.includes("Synthetic clinical patient")')
   await browser.value('document.querySelector("#clinical-tab-encounter").click();true')
   await browser.until('document.body.textContent.includes("Receptionists can view")')
   assert.equal(await browser.value('window.__clinicalCalls.draftRequests.length'),0)
   assert.equal(await browser.value('!!document.querySelector(".clinical-encounter-editor")'),false)
   await browser.goto(origin+'/app/clinical?case=persist-mismatch')
   await browser.until('document.querySelectorAll(".clinical-patient").length===2')
   await browser.value('document.querySelectorAll(".clinical-patient")[1].click();true')
   await browser.until('document.body.textContent.includes("Synthetic clinical patient")')
   await browser.value('document.querySelector("#clinical-tab-encounter").click();true')
   await browser.until('!!document.querySelector(".clinical-encounter-editor textarea")')
   await browser.value('document.querySelector(".clinical-encounter-editor textarea").focus();true')
   await browser.send('Input.insertText',{text:'Mismatch fixture original'})
   await browser.until('!!document.querySelector(".clinical-encounter-editor button[type=submit]:not(:disabled)")')
   await browser.value('document.querySelector(".clinical-encounter-editor button[type=submit]").click();true')
   await browser.until('document.querySelector(".clinical-encounter-editor button[type=submit]")?.textContent.includes("Retry same draft request")')
   assert.equal(await browser.value('document.body.textContent.includes("Verified persisted DRAFT saved")'),false)
   assert.equal(await browser.value('window.__clinicalCalls.draftRequests.length'),1)
   assert.equal(await browser.value('document.querySelector(".clinical-encounter-editor textarea").disabled'),true)
  })
 }finally{await vite.close();delete process.env.VITE_CLINICAL_DRAFT_PERSISTENCE_UI}
})

test('CLOUD connected clinical route: administrator, responsive keyboard, read retry and stale branch/account responses', {timeout:120000},async()=>{
 process.env.VITE_SUPABASE_URL='https://issue51-fixtures.supabase.co'
 process.env.VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_issue51_offline'
 process.env.VITE_CLINICAL_WORKSPACE_UI='true'
 process.env.VITE_CLINICAL_DRAFT_PERSISTENCE_UI='true'
 const vite=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),server:{host:'127.0.0.1',port:0,strictPort:false}})
 try{
  await vite.listen()
  await withChromium(async browser=>{
   await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:'('+installClinicalFixture.toString()+')()'})
   const origin='http://127.0.0.1:'+vite.httpServer.address().port
   const id=n=>'20000000-0000-4000-8000-'+String(n).padStart(12,'0')
   const selectBranch=async n=>{
    await browser.until('Array.from(document.querySelectorAll("#clinical-branch option")).some(o=>o.value==='+JSON.stringify(id(n))+')')
    await browser.value('(()=>{const e=document.querySelector("#clinical-branch");e.value='+JSON.stringify(id(n))+';e.dispatchEvent(new Event("change",{bubbles:true}));return true})()')
   }
   const choose=async n=>{await browser.until('document.querySelectorAll(".clinical-patient").length>'+n);await browser.value('document.querySelectorAll(".clinical-patient")['+n+'].click();true')}
   const tab=async name=>{await browser.value('document.querySelector("#clinical-tab-'+name+'").click();true')}
   const has=async phrase=>browser.until('document.body.textContent.includes('+JSON.stringify(phrase)+')')
   const clean=async()=>{
    const calls=await browser.value('window.__clinicalCalls')
    assert.deepEqual(calls.draftRequests,[],'administrator never dispatches draft RPC')
    assert.deepEqual(calls.mutations,[],'no unsupported clinical writes')
    assert.deepEqual(calls.unexpected,[])
    assert.equal(calls.paths.some(x=>/\/rest\/v1\/(pets|clinical_records)(?:$|\?)/.test(x)),false,'no unscoped reader')
   }
   const released=async n=>{
    await browser.value('window.__clinicalControl.release();true')
    await browser.until('window.__clinicalCalls.released==='+n)
    await browser.value('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))')
   }
   for(const [width,theme] of [[360,'light'],[768,'dark'],[1440,'light']]){
    await browser.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false})
    await browser.goto(origin+'/app/clinical?case=persist-coverage&theme='+theme)
    await selectBranch(1);await choose(1);await has('Naga synthetic patient')
    assert.equal(await browser.value('document.documentElement.getAttribute("data-theme")'),theme)
    assert.equal(await browser.value('innerWidth'),width)
    assert.equal(await browser.value('document.documentElement.scrollWidth<=innerWidth'),true)
    assert.equal(await browser.value('document.activeElement===document.querySelector(".clinical-chart-head h2")'),true)
    assert.equal(await browser.value('document.querySelector("#clinical-branch").labels.length>0&&document.querySelector("#clinical-day").labels.length>0'),true)
    await browser.value('document.querySelector("#clinical-tab-overview").focus();true')
    for(const name of ['visits','history','encounter']){
     await browser.send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39})
     await browser.send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39})
     await browser.until('document.activeElement?.id==="clinical-tab-'+name+'"&&document.activeElement.getAttribute("aria-selected")==="true"')
     assert.equal(await browser.value('document.querySelector("[role=tabpanel]").getAttribute("aria-labelledby")==="clinical-tab-'+name+'"'),true)
     if(name==='history')await has('Naga synthetic history')
    }
    await has('Authoritative draft revision 2')
    assert.equal(await browser.value('document.querySelector(".clinical-encounter-editor textarea").value'),'Second visit synthetic draft')
    assert.equal(await browser.value('[...document.querySelectorAll(".clinical-encounter-editor textarea")].every(t=>t.disabled&&t.labels.length>0)&&document.querySelector(".clinical-encounter-editor button[type=submit]").disabled'),true)
    assert.equal(await browser.value('document.documentElement.scrollWidth<=innerWidth'),true)
    await choose(0);await has('Naga synthetic patient');await tab('encounter')
    await has('No saved draft for this appointment has been verified')
    assert.equal(await browser.value('document.querySelector(".clinical-encounter-editor textarea").value'),'')
    assert.equal(await browser.value('document.querySelector(".clinical-encounter-editor button[type=submit]").disabled'),true)
    await tab('prescriptions')
    await browser.until('!!document.querySelector(".clinical-form-shell")')
    assert.equal(await browser.value('[...document.querySelectorAll(".clinical-form-shell button")].some(b=>b.disabled&&b.textContent.includes("Save to patient chart"))'),true)
    await tab('overview');await has('Naga synthetic patient')
    await has('Not verified — do not infer absence')
    assert.equal(await browser.value('[...document.querySelectorAll(".clinical-chart-context [aria-disabled=true]")].some(e=>e.textContent.includes("Pharmacy unavailable"))'),true)
    await clean()
   }
   // Reader is explicitly unavailable, malformed, or genuinely empty; never substitute empty on error.
   await browser.value('window.__clinicalControl.holdNext();window.__clinicalControl.failNext("missing");true')
   await tab('history')
   await browser.until('window.__clinicalControl.held')
   await has('Verifying patient identity and chart access')
   assert.equal(await browser.value('!!document.querySelector("[aria-label=\'Verified records history\']")'),false)
   await released(1);await has('Secure chart unavailable')
   assert.equal(await browser.value('document.body.textContent.includes("Verified empty records history")'),false)
   const retry='[...document.querySelectorAll(".clinical-chart-gateway button")].find(b=>b.textContent.includes("Retry secure chart read"))'
   await browser.value('window.__clinicalControl.failNext("malformed");'+retry+'.click();true')
   await has('Invalid clinical response')
   assert.equal(await browser.value('!!document.querySelector("[aria-label=\'Verified records history\']")'),false)
   await browser.value(retry+'.focus();true')
   await browser.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13})
   await browser.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13})
   await has('Naga synthetic history')
   // Hold a scoped Naga response, switch to a permitted Cavite patient, release the old response.
   await tab('overview');await has('Naga synthetic patient')
   await browser.value('window.__clinicalControl.holdNext();true');await tab('history')
   await browser.until('window.__clinicalControl.held')
   await selectBranch(2)
   await browser.until('!document.querySelector(".clinical-chart")')
   await choose(0);await has('Cavite synthetic patient')
   await released(2)
   assert.equal(await browser.value('document.body.textContent.includes("Naga synthetic history")||document.body.textContent.includes("Naga synthetic patient")'),false)
   await tab('history');await has('Cavite synthetic history')
   await tab('encounter');await has('Verified empty drafts history')
   assert.equal(await browser.value('document.querySelector(".clinical-encounter-editor button[type=submit]").disabled'),true)
   // Account change via the SDK's real cross-tab Auth notification with synthetic session storage.
   await selectBranch(1);await choose(0);await has('Naga synthetic patient')
   await browser.value('window.__clinicalControl.holdNext();true');await tab('history')
   await browser.until('window.__clinicalControl.held')
   await browser.value('window.__clinicalControl.switchAccount();true')
   await browser.until('document.querySelector("#clinical-branch")?.value==='+JSON.stringify(id(2))+'&&document.querySelectorAll("#clinical-branch option").length===2&&!document.querySelector(".clinical-chart")')
   await choose(0);await has('Second account Cavite synthetic patient')
   await released(3)
   assert.equal(await browser.value('document.body.textContent.includes("Naga synthetic history")||document.body.textContent.includes("Naga synthetic patient")'),false)
   await tab('history');await has('Second account Cavite synthetic history')
   const reads=await browser.value('window.__clinicalCalls.chartReads')
   assert.ok(reads.some(x=>x.account===id(9)&&x.p_branch===id(1)&&x.p_pet===id(3)&&x.p_section==='records'))
   assert.ok(reads.some(x=>x.account===id(9)&&x.p_branch===id(2)&&x.p_pet===id(7)&&x.p_section==='records'))
   assert.ok(reads.some(x=>x.account===id(10)&&x.p_branch===id(2)&&x.p_pet===id(7)&&x.p_section==='records'))
   assert.ok(reads.filter(x=>x.account===id(10)).every(x=>x.p_branch===id(2)&&x.p_pet===id(7)))
   await clean()
  })
 }finally{await vite.close();delete process.env.VITE_CLINICAL_DRAFT_PERSISTENCE_UI;delete process.env.VITE_CLINICAL_WORKSPACE_UI}
})
