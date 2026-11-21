// CLOUD PR117 — two distinct owner-selectable release profiles, using REAL
// Chromium and 127.0.0.1 Vite/static preview. No live provider or patient data.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer,build,preview} from 'vite'
import {fileURLToPath} from 'node:url'
import {mkdtemp,rm,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {withChromium} from '../../scripts/browser/cdp.mjs'
import {releaseClinicFixture} from './fixtures/release-clinic-http.mjs'

const root=fileURLToPath(new URL('../',import.meta.url))
const URL_FAKE='https://issue51-fixtures.supabase.co'
const KEY_FAKE='sb_publishable_offline_two_track_fixture'

function noProviderGuard(){
  const theme=new URL(location.href).searchParams.get('theme')==='dark'?'dark':'light'
  localStorage.setItem('dawney-theme',theme)
  const original=window.fetch.bind(window)
  window.__cloudPublicProfile={outbound:[],writes:[]}
  window.fetch=async(input,init)=>{
    const request=new Request(input,init),url=new URL(request.url)
    if(url.origin!==location.origin){
      window.__cloudPublicProfile.outbound.push('blocked-cross-origin')
      if(request.method!=='GET')window.__cloudPublicProfile.writes.push(request.method)
      throw Error('External HTTP forbidden in informational browser profile')
    }
    return original(input,init)
  }
}

function policyFault(){
  const mode=new URL(location.href).searchParams.get('case')
  const original=window.fetch.bind(window)
  window.__cloudReleasePolicyRecovered=false
  window.fetch=async(input,init)=>{
    const request=new Request(input,init),url=new URL(request.url)
    if(url.pathname==='/rest/v1/branch_booking_policies'&&!window.__cloudReleasePolicyRecovered){
      if(mode==='unapproved')return new Response('[]',{status:200,headers:{'content-type':'application/json'}})
      if(mode==='offline')throw new TypeError('Synthetic policy network disconnected')
    }
    return original(input,init)
  }
}

async function useLocalProfile(profile,configured,callback){
  const previous=Object.fromEntries(['VITE_RELEASE_PROFILE','VITE_SUPABASE_URL','VITE_SUPABASE_PUBLISHABLE_KEY',
    'VITE_PHASE4_PATIENT_FORM','VITE_PHASE5A_OPS_UI','VITE_CLINICAL_WORKSPACE_UI',
    'VITE_PHASE5B_PHARMACY_UI','VITE_PHASE5C_BILLING_UI'].map(k=>[k,process.env[k]]))
  if(profile===null)delete process.env.VITE_RELEASE_PROFILE
  else process.env.VITE_RELEASE_PROFILE=profile
  if(configured){process.env.VITE_SUPABASE_URL=URL_FAKE;process.env.VITE_SUPABASE_PUBLISHABLE_KEY=KEY_FAKE}
  else{delete process.env.VITE_SUPABASE_URL;delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY}
  for(const k of Object.keys(previous).filter(k=>k.startsWith('VITE_PHASE')||k==='VITE_CLINICAL_WORKSPACE_UI'))
    process.env[k]='false'
  // Vite's import.meta.env replacements are initialized per test runner.
  // Force the chosen local test profile in THIS server's build transform
  // rather than inheriting the npm test runner's connected default.
  const chosen=profile===null?'informational':profile
  const server=await createServer({root,
    define:{'import.meta.env.VITE_RELEASE_PROFILE':JSON.stringify(chosen)},
    server:{host:'127.0.0.1',port:0,strictPort:false},logLevel:'error'})
  try{
    await server.listen()
    const origin='http://127.0.0.1:'+server.httpServer.address().port
    await withChromium(async browser=>callback(browser,origin))
  }finally{
    await server.close()
    for(const [key,value] of Object.entries(previous)){
      if(value===undefined)delete process.env[key]
      else process.env[key]=value
    }
  }
}

test('CLOUD PROFILE A: all public deep links, Pages-style 404, route metadata, keyboard and six light/dark/width cells with NO provider', {timeout:260000},async()=>{
  await useLocalProfile(null,false,async(browser,origin)=>{
    await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:'('+noProviderGuard.toString()+')()'})
    const routes=['/','/services','/about','/location','/contact','/book','/not-a-real-public-page','/auth/signin','/app/appointments']
    for(const width of [360,768,1440]){
      await browser.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false})
      for(const theme of ['light','dark']){
        for(const path of routes){
          await browser.goto(origin+path+'?theme='+theme)
          await browser.until('!!document.querySelector("#main-content h1")',10000)
          const view=await browser.value('({heading:document.querySelector("#main-content h1")?.textContent.trim(),title:document.title,theme:document.documentElement.getAttribute("data-theme"),overflow:document.documentElement.scrollWidth>innerWidth,forms:document.querySelectorAll("#main-content form").length,signIn:[...document.querySelectorAll("a")].some(x=>x.getAttribute("href")==="/auth/signin"),remote:window.__cloudPublicProfile.outbound,writes:window.__cloudPublicProfile.writes,external:[...document.querySelectorAll("a[target=_blank]")].every(x=>x.rel.includes("noopener")&&x.rel.includes("noreferrer")&&x.protocol==="https:"),secret:!!document.querySelector("input[type=password]"),slots:document.querySelectorAll("input[name=slot]").length})')
          assert.ok(view.heading,path+' heading')
          assert.equal(view.theme,theme,path+' theme')
          assert.equal(view.overflow,false,path+' overflow '+width+'/'+theme)
          assert.equal(view.forms,0,path+' no connected booking/auth form')
          assert.equal(view.signIn,false,path+' no misleading sign-in shortcut')
          assert.equal(view.secret,false)
          assert.equal(view.slots,0,path+' no fabricated availability')
          assert.deepEqual(view.remote,[],path+' zero provider HTTP')
          assert.deepEqual(view.writes,[],path+' no data mutation')
          assert.equal(view.external,true,path+' safe links')
          if(path==='/not-a-real-public-page'){
            assert.match(view.heading,/page not found/i)
            assert.match(view.title,/page not found/i)
          }
          if(path==='/contact')assert.match(view.heading,/contact our branches/i)
          if(path==='/location')assert.match(view.heading,/locations.*directions/i)
          if(path==='/book')assert.match(view.heading,/booking information/i)
          if(path.startsWith('/app/')||path.startsWith('/auth/'))
            assert.match(view.heading,/online account access is unavailable/i)
        }
      }
    }
    await browser.send('Emulation.setDeviceMetricsOverride',{width:360,height:900,deviceScaleFactor:1,mobile:false})
    await browser.goto(origin+'/?theme=dark')
    await browser.until('!!document.querySelector("button.site-menu")')
    await browser.value('document.querySelector("button.site-menu").focus();true')
    await browser.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'})
    await browser.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13})
    await browser.until('document.activeElement===document.querySelector("#site-nav a")',4500)
    assert.equal(await browser.value('document.activeElement.matches(":focus-visible")'),true)
    await browser.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27})
    await browser.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27})
    await browser.until('document.activeElement===document.querySelector("button.site-menu")',4500)
    await browser.goto(origin+'/services?theme=dark')
    await browser.goto(origin+'/contact?theme=dark')
    await browser.value('history.back();true')
    await browser.until('location.pathname==="/services"',4500)
    await browser.value('history.forward();true')
    await browser.until('location.pathname==="/contact"',4500)
    await browser.send('Page.reload',{ignoreCache:true})
    await browser.until('document.querySelector("#main-content h1")?.textContent.includes("Contact")',9000)
    assert.deepEqual(await browser.value('window.__cloudPublicProfile.outbound'),[])
  })
})

test('CLOUD PROFILE A remains public-only when dummy backend env exists; missing connected backend FAILS CLOSED', {timeout:125000},async()=>{
  for(const [profile,configured] of [['informational',true],['connected',false]]){
    await useLocalProfile(profile,configured,async(browser,origin)=>{
      await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:'('+noProviderGuard.toString()+')()'})
      for(const path of ['/services','/book','/auth/signin','/app/pets']){
        await browser.goto(origin+path+'?theme=light')
        await browser.until('!!document.querySelector("#main-content h1")',9000)
        const state=await browser.value('({form:document.querySelectorAll("#main-content form").length,remote:window.__cloudPublicProfile.outbound,heading:document.querySelector("h1").textContent,links:[...document.querySelectorAll("a")].some(a=>a.href.includes("/auth/signin"))})')
        assert.equal(state.form,0)
        assert.deepEqual(state.remote,[])
        assert.equal(state.links,false,JSON.stringify({profile,configured,path,state}))
        if(path==='/book')assert.match(state.heading,/booking information/i)
      }
    })
  }
})

test('CLOUD PROFILE B: approved synthetic Naga only, guest safe sign-in, owner/patient history, no staff/private flags', {timeout:160000},async()=>{
  await useLocalProfile('connected',true,async(browser,origin)=>{
    await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:'('+releaseClinicFixture.toString()+')()'})
    await browser.goto(origin+'/book?actor=visitor&theme=dark&reset=1')
    await browser.until('!!document.querySelector("form.book-form")',12000)
    assert.equal(await browser.value('document.body.textContent.includes("Fixture care")'),true)
    assert.equal(await browser.value('document.querySelectorAll("input[name=slot]").length'),0,
      'no slots selected until a verified date is chosen')
    assert.equal(await browser.value('document.querySelector("#main-content button[type=submit]")?.disabled ?? true'),true,
      'guest cannot submit without a verified account and eligible patient')
    await browser.goto(origin+'/services?actor=visitor&theme=dark')
    await browser.until('document.querySelector("#main-content")?.textContent.includes("Fixture care")',12000)
    assert.equal(await browser.value('document.querySelectorAll("a[href*=cavite][href*=book]").length'),0)
    assert.deepEqual(await browser.value('window.__cloudIntegrated.unexpected'),[])
    await browser.goto(origin+'/auth/signin?actor=visitor&next=%2Fbook')
    await browser.until('!!document.querySelector("form input[name=email]")',9000)
    assert.equal(await browser.value('document.querySelector("#main-content h1")?.textContent.includes("Welcome back")'),true)
    await browser.goto(origin+'/app/pets?actor=owner')
    await browser.until('document.body.textContent.includes("Synthetic Patient")',10000)
    assert.equal(await browser.value('[...document.querySelectorAll("a")].filter(a=>["/app/ops","/app/clinical","/app/pharmacy","/app/billing","/app/invoices"].includes(a.getAttribute("href"))).length'),0)
    await browser.goto(origin+'/app/pets?actor=other')
    await browser.until('document.body.textContent.includes("Synthetic B Patient")',10000)
    assert.equal(await browser.value('document.body.textContent.includes("Synthetic Patient")'),false)
    await browser.goto(origin+'/app/appointments?actor=other')
    await browser.until('document.querySelector("#main-content")?.textContent.includes("My bookings")',10000)
    assert.equal(await browser.value('document.querySelectorAll(".booking-item").length'),0)
    await browser.goto(origin+'/app/ops?actor=staff')
    await browser.until('!!document.querySelector("#main-content h1")',9000)
    assert.match(await browser.value('document.querySelector("#main-content h1").textContent'),/Page not found/)
    assert.deepEqual(await browser.value('window.__cloudIntegrated.unexpected'),[])
    assert.deepEqual(await browser.value('window.__cloudIntegrated.directWrites'),[])
  })
})

test('CLOUD PROFILE B: unapproved schedule and offline policy are different fail-closed states, retry cannot invent a booking', {timeout:150000},async()=>{
  await useLocalProfile('connected',true,async(browser,origin)=>{
    await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:'('+releaseClinicFixture.toString()+')();('+policyFault.toString()+')()'})
    for(const scenario of ['unapproved','offline']){
      await browser.goto(origin+'/book?actor=visitor&case='+scenario+'&theme=light')
      await browser.until('!document.querySelector("#main-content [role=status]")?.textContent.includes("Checking clinic booking")',10000)
      await browser.until('!!document.querySelector("#main-content h1")',10000)
      assert.equal(await browser.value('document.querySelectorAll("#main-content form").length'),0)
      assert.equal(await browser.value('document.querySelectorAll("input[name=slot]").length'),0)
      assert.equal(await browser.value('window.__cloudIntegrated.rpcs.length'),0)
      if(scenario==='offline'){
        await browser.until('!!document.querySelector("#main-content [role=alert] button")',8000)
        await browser.value('window.__cloudReleasePolicyRecovered=true;document.querySelector("#main-content [role=alert] button").click();true')
        await browser.until('!!document.querySelector("form.book-form")',10000)
      }else{
        assert.match(await browser.value('document.querySelector("#main-content")?.textContent'),/not open yet|unavailable|still being set up/i)
      }
      assert.deepEqual(await browser.value('window.__cloudIntegrated.unexpected'),[])
      assert.deepEqual(await browser.value('window.__cloudIntegrated.directWrites'),[])
    }
  })
})

test('CLOUD BUILT PROFILE A: isolated static Vite preview directly loads and refreshes SPA deep links with actual assets', {timeout:170000},async()=>{
  const keys=['VITE_RELEASE_PROFILE','VITE_SUPABASE_URL','VITE_SUPABASE_PUBLISHABLE_KEY']
  const prev=Object.fromEntries(keys.map(k=>[k,process.env[k]]))
  process.env.VITE_RELEASE_PROFILE='informational'
  delete process.env.VITE_SUPABASE_URL
  delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  const out=await mkdtemp(join(tmpdir(),'dawney-public-profile-'))
  let site
  try{
    await build({root,logLevel:'silent',build:{outDir:out,emptyOutDir:true,sourcemap:false}})
    const html=await readFile(join(out,'index.html'),'utf8')
    assert.match(html,/id="root"/)
    site=await preview({root,build:{outDir:out},preview:{host:'127.0.0.1',port:0,strictPort:false},logLevel:'silent'})
    const origin='http://127.0.0.1:'+site.httpServer.address().port
    for(const path of ['/','/services','/about','/location','/contact','/book','/unknown-route']){
      const result=await fetch(origin+path,{headers:{'Accept':'text/html'}})
      assert.equal(result.status,200,path+' Pages-style SPA fallback returns React shell')
      assert.match(await result.text(),/id="root"/)
    }
    const logo=await fetch(origin+'/brand/dawney-logo.webp')
    assert.equal(logo.status,200,'static clinic logo asset served separately')
    assert.match(logo.headers.get('content-type')||'',/image\/webp/)
    await withChromium(async browser=>{
      await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:'('+noProviderGuard.toString()+')()'})
      await browser.goto(origin+'/contact?theme=dark')
      await browser.until('document.querySelector("h1")?.textContent.includes("Contact")',10000)
      await browser.send('Page.reload',{ignoreCache:true})
      await browser.until('document.querySelector("h1")?.textContent.includes("Contact")',10000)
      assert.deepEqual(await browser.value('window.__cloudPublicProfile.outbound'),[])
      await browser.goto(origin+'/unknown-route?theme=dark')
      await browser.until('document.querySelector("h1")?.textContent.includes("Page not found")',10000)
    })
  }finally{
    if(site)await new Promise(resolve=>site.httpServer.close(resolve))
    await rm(out,{recursive:true,force:true,maxRetries:5,retryDelay:100})
    for(const [k,v] of Object.entries(prev)){if(v===undefined)delete process.env[k];else process.env[k]=v}
  }
})
