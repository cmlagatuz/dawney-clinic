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
    appointment:uuid(5),resource:uuid(6),user:uuid(9)}
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
  const user={id:ids.user,aud:'authenticated',role:'authenticated',
    email:'synthetic-staff@example.test',email_confirmed_at:'2025-01-01T00:00:00Z',
    created_at:'2025-01-01T00:00:00Z',app_metadata:{},user_metadata:{}}
  const expiry=Math.floor(RealDate.now()/1000)+86400*365
  const token=['{"alg":"HS256","typ":"JWT"}',JSON.stringify({sub:ids.user,exp:expiry}),'fixture']
    .map(x=>btoa(x).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')).join('.')
  localStorage.setItem('dawney.auth.v1',JSON.stringify({
    user,access_token:token,refresh_token:'synthetic-test',expires_at:expiry
  }))
  window.__clinicalCalls={paths:[],mutations:[],assertions:[],unexpected:[]}
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
    if(req.method!=='GET'){
      window.__clinicalCalls.mutations.push(req.method+' '+url.pathname)
      return reply({message:'Synthetic writes prohibited'},403)
    }
    if(url.pathname==='/auth/v1/user')
      return mode==='expired'?reply({message:'JWT expired'},401):reply(user)
    if(url.pathname==='/rest/v1/staff_memberships'){
      if(mode==='denied')return reply([])
      return reply([{user_id:ids.user,role:'veterinarian',is_active:true}])
    }
    if(url.pathname==='/rest/v1/staff_branch_memberships'){
      const rows=[{user_id:ids.user,branch_id:ids.naga,role:'veterinarian',is_active:true}]
      if(mode==='two')rows.push({user_id:ids.user,branch_id:ids.cavite,role:'veterinarian',is_active:true})
      return reply(rows)
    }
    if(url.pathname==='/rest/v1/clinic_branches')
      return reply([{id:ids.naga,slug:'naga',display_name:'Fixture Naga'},
        {id:ids.cavite,slug:'cavite',display_name:'Fixture Cavite'}])
    if(url.pathname==='/rest/v1/appointments'){
      if(mode==='network')throw Error('Failed to fetch clinic appointments')
      if(filter('branch_id')!==ids.naga)return reply([])
      return reply([{
        id:ids.appointment,pet_id:ids.pet,owner_id:ids.owner,
        resource_id:ids.resource,branch_id:ids.naga,
        starts_at:'2026-11-20T02:00:00Z',ends_at:'2026-11-20T02:30:00Z',
        status:'confirmed',concern:'Synthetic fixture concern'
      }])
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
