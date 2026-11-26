// CLOUD: real Chromium presentation/accessibility gate, only synthetic HTTP.
// No provider calls, screenshots, patient records, external tools or activation.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {fileURLToPath} from 'node:url'
import {withChromium} from '../../scripts/browser/cdp.mjs'
import {releaseClinicFixture} from './fixtures/release-clinic-http.mjs'

test('CLOUD professional UI: public hierarchy, short viewports, readable controls, drawer keyboard and theme contrast',{timeout:180000},async()=>{
 process.env.VITE_SUPABASE_URL='https://issue51-fixtures.supabase.co'
 process.env.VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_offline_professional_ui'
 process.env.VITE_PHASE5A_OPS_UI='true'
 process.env.VITE_CLINICAL_WORKSPACE_UI='true'
 process.env.VITE_PHASE5B_PHARMACY_UI='true'
 process.env.VITE_PHASE5C_BILLING_UI='true'
 const vite=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),server:{host:'127.0.0.1',port:0,strictPort:false},logLevel:'error'})
 try{
  await vite.listen()
  const origin='http://127.0.0.1:'+vite.httpServer.address().port
  await withChromium(async b=>{
   await b.send('Page.addScriptToEvaluateOnNewDocument',{source:'('+releaseClinicFixture.toString()+')()'})
   const viewport=(width,height)=>b.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false})
   const open=async(path,actor,theme,selector)=>{
    await b.goto(origin+path+'?actor='+actor+'&case=administrator&theme='+theme)
    await b.until('location.pathname==='+JSON.stringify(path)+'&&document.documentElement.getAttribute("data-theme")==='+JSON.stringify(theme)+'&&!!document.querySelector('+JSON.stringify(selector)+')')
   }
   const key=async(name,shift=false)=>{
    const number=name==='Tab'?9:27,modifiers=shift?8:0
    await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:name,code:name,windowsVirtualKeyCode:number,modifiers})
    await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:name,code:name,windowsVirtualKeyCode:number,modifiers})
   }
   const overflow=async label=>assert.equal(await b.value('document.documentElement.scrollWidth<=innerWidth'),true,label+' horizontal overflow')
   const contrast=async(selector,background)=>b.value('(()=>{const e=document.querySelector('+JSON.stringify(selector)+'),s=getComputedStyle(e),bg=getComputedStyle(document.querySelector('+JSON.stringify(background)+'));const luminance=c=>{const x=c.match(/[\\d.]+/g).slice(0,3).map(n=>Number(n)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return .2126*x[0]+.7152*x[1]+.0722*x[2]};const f=luminance(s.color),v=luminance(bg.backgroundColor);return (Math.max(f,v)+.05)/(Math.min(f,v)+.05)})()')
   const clean=async()=>{
    assert.deepEqual(await b.value('window.__cloudIntegrated.directWrites'),[])
    assert.deepEqual(await b.value('window.__cloudIntegrated.rpcs'),[])
    assert.deepEqual(await b.value('window.__cloudIntegrated.unexpected'),[])
   }
   for(const [width,height] of [[360,640],[768,900],[1440,600]]){
    await viewport(width,height)
    for(const theme of ['light','dark']){
     await open('/','visitor',theme,'.hero-copy h1')
     assert.equal(await b.value('innerWidth'),width);assert.equal(await b.value('innerHeight'),height)
     const hero=await b.value('(()=>{const c=document.querySelector(".hero-copy").getBoundingClientRect(),a=document.querySelector(".hero-art").getBoundingClientRect();return {copyFirst: c.top<a.top||c.left<a.left,flat:getComputedStyle(document.querySelector(".site")).backgroundImage==="none",services:document.querySelectorAll(".home-services li").length,nested:document.querySelectorAll(".home-services .card").length}})()')
     assert.equal(hero.copyFirst,true,'identity/contact copy before decorative artwork')
     assert.equal(hero.flat,true);assert.ok(hero.services>0);assert.equal(hero.nested,0)
     assert.ok(await contrast('.hero h1','.site')>=4.5)
     await overflow('public '+width+'/'+theme);await clean()
     await open('/location','visitor',theme,'.branch-directory .branch-card')
     const branches=await b.value('Array.from(document.querySelectorAll(".branch-directory .branch-card")).map(e=>{const r=e.getBoundingClientRect();return {width:r.width,top:r.top}})')
     assert.equal(branches.length,2);assert.ok(Math.abs(branches[0].width-branches[1].width)<2)
     assert.equal(Math.abs(branches[0].top-branches[1].top)<2,width===1440,'equal desktop profiles, stacked narrow profiles')
     assert.equal(await b.value('document.querySelectorAll(".branch-directory h4").length'),6)
     await overflow('branches '+width+'/'+theme);await clean()
     await open('/auth/signin','visitor',theme,'.auth-panel input')
     assert.equal(await b.value('getComputedStyle(document.querySelector(".public-layout")).backgroundImage'), 'none')
     assert.ok(await b.value('parseFloat(getComputedStyle(document.querySelector(".auth-panel input")).fontSize)')>=16)
     assert.ok(await b.value('document.querySelector(".auth-panel input").getBoundingClientRect().height')>=44)
     assert.ok(await contrast('.auth-panel label','.auth-panel')>=4.5)
     await overflow('sign in '+width+'/'+theme);await clean()
     await open('/app/overview','staff',theme,'.sidebar a[href="/app/staff-management"]')
     assert.equal(await b.value('document.querySelector(".app-content").inert'),false)
     await overflow('staff shell '+width+'/'+theme)
     if(width===1440){
      // A 600px tall desktop must permit keyboard access to every staff item
      // and the bottom sign-out action, without trapping document focus.
      assert.equal(await b.value('(()=>{const s=document.querySelector(".sidebar"),items=[...s.querySelectorAll("a[href],button:not(:disabled)")].filter(e=>e.getClientRects().length);return items.length>=12&&items.every(e=>{e.focus();const r=e.getBoundingClientRect(),p=s.getBoundingClientRect();return document.activeElement===e&&r.top>=p.top-1&&r.bottom<=p.bottom+1})})()'),true)
      assert.equal(await b.value('document.activeElement===document.querySelector(".sidebar-bottom button")'),true)
      assert.ok(await contrast('.sidebar .button-quiet','.sidebar')>=4.5)
      assert.equal(await b.value('document.querySelector(".sidebar").getAttribute("role")'),null)
     }else{
      await b.value('document.querySelector(".mobile-toggle").click();true')
      await b.until('document.querySelector(".sidebar").getBoundingClientRect().left>=-1&&document.querySelector(".sidebar").getAttribute("aria-modal")==="true"&&document.activeElement?.matches(".sidebar nav a")')
      assert.equal(await b.value('document.querySelector(".app-content").inert'),true)
      assert.equal(await b.value('getComputedStyle(document.querySelector(".skip-link")).visibility'), 'hidden')
      assert.equal(await b.value('(()=>{const e=document.querySelector(".topbar .mobile-toggle");e.focus();return !e.isSameNode(document.activeElement)})()'),true,'inert background cannot receive focus')
      assert.equal(await b.value('(()=>{const s=document.querySelector(".sidebar"),items=[...s.querySelectorAll("a[href],button:not(:disabled)")].filter(e=>e.getClientRects().length);return items.length>=13&&items.every(e=>{e.focus();const r=e.getBoundingClientRect(),p=s.getBoundingClientRect();return document.activeElement===e&&r.top>=p.top-1&&r.bottom<=p.bottom+1})})()'),true)
      assert.equal(await b.value('document.activeElement===document.querySelector(".sidebar-bottom button")'),true)
      await key('Tab')
      await b.until('document.activeElement===document.querySelector(".sidebar-close")')
      assert.equal(await b.value('document.activeElement.matches(":focus-visible")'),true)
      await key('Tab',true)
      await b.until('document.activeElement===document.querySelector(".sidebar-bottom button")')
      await key('Escape')
      await b.until('document.activeElement===document.querySelector(".mobile-toggle")&&!document.querySelector(".app-content").inert')
      assert.equal(await b.value('document.querySelector(".mobile-toggle").getAttribute("aria-expanded")'),'false')
      await b.value('document.querySelector(".mobile-toggle").click();true')
      await b.until('document.querySelector(".sidebar").getAttribute("aria-modal")==="true"')
      await b.value('document.querySelector(".sidebar-close").click();true')
      await b.until('document.activeElement===document.querySelector(".mobile-toggle")&&!document.querySelector(".app-content").inert')
      await b.value('document.querySelector(".mobile-toggle").click();true')
      await b.until('document.querySelector(".sidebar").getAttribute("aria-modal")==="true"')
      await b.value('document.querySelector(".sidebar a[href=\'/app/clinic\']").click();true')
      await b.until('location.pathname==="/app/clinic"&&!document.querySelector(".app-content").inert&&document.activeElement===document.querySelector("#main-content")')
      assert.equal(await b.value('document.querySelector(".mobile-toggle").getAttribute("aria-expanded")'),'false')
      await overflow('drawer destination '+width+'/'+theme)
     }
     await clean()
    }
   }
   // Opening at mobile width and rotating/resizing to desktop must not leave
   // the desktop page inert or hide the normal navigation from assistive tech.
   await viewport(360,640);await open('/app/overview','staff','dark','.sidebar a[href="/app/staff-management"]')
   await b.value('document.querySelector(".mobile-toggle").click();true')
   await b.until('document.querySelector(".app-content").inert')
   await viewport(1440,600)
   await b.until('!document.querySelector(".app-content").inert&&document.querySelector(".sidebar").getAttribute("role")===null')
   await overflow('resized desktop');await clean()
  })
 }finally{
  await vite.close()
  for(const flag of ['VITE_PHASE5A_OPS_UI','VITE_CLINICAL_WORKSPACE_UI','VITE_PHASE5B_PHARMACY_UI','VITE_PHASE5C_BILLING_UI'])delete process.env[flag]
 }
})
