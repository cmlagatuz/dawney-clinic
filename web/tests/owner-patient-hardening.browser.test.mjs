// CLOUD PR116 local real Chromium. Supabase/Auth/Storage are entirely intercepted;
// all writes below are synthetic test fixture operations, never hosted clinic data.
import test from 'node:test'
import assert from 'node:assert/strict'
import {fileURLToPath} from 'node:url'
import {createServer} from 'vite'
import {withChromium} from '../../scripts/browser/cdp.mjs'
import {releaseClinicFixture} from './fixtures/release-clinic-http.mjs'
import {ownerPatientHttpFixture} from './fixtures/owner-patient-http.mjs'

async function withOwnerBrowser(catalog,fn){
  process.env.VITE_SUPABASE_URL='https://issue51-fixtures.supabase.co'
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_issue51_offline'
  process.env.VITE_PHASE4_PATIENT_FORM=catalog?'true':'false'
  const vite=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),
    server:{host:'127.0.0.1',port:0,strictPort:false}})
  try{
    await vite.listen()
    const origin='http://127.0.0.1:'+vite.httpServer.address().port
    await withChromium(async browser=>{
      await browser.send('Page.addScriptToEvaluateOnNewDocument',
        {source:'('+releaseClinicFixture.toString()+')();('+ownerPatientHttpFixture.toString()+')()'})
      await fn(browser,origin)
    })
  }finally{
    await vite.close()
    for(const key of ['VITE_SUPABASE_URL','VITE_SUPABASE_PUBLISHABLE_KEY','VITE_PHASE4_PATIENT_FORM'])
      delete process.env[key]
  }
}

test('CLOUD: default patient/profile/booking reads fail closed across two accounts and six responsive themes',
  {timeout:200000},async()=>withOwnerBrowser(false,async(browser,origin)=>{
    for(const width of [360,768,1440]){
      await browser.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false})
      for(const theme of ['light','dark']){
        for(const route of ['/app/profile','/app/pets','/app/appointments']){
          await browser.goto(origin+route+'?actor=owner&theme='+theme)
          await browser.until('!!document.querySelector("#main-content h1")',9000)
          const view=await browser.value('({heading:document.querySelector("#main-content h1")?.textContent,theme:document.documentElement.getAttribute("data-theme"),overflow:document.documentElement.scrollWidth>innerWidth,unexpected:window.__cloudIntegrated.unexpected})')
          assert.ok(view.heading)
          assert.equal(view.theme,theme)
          assert.equal(view.overflow,false,route+' overflow '+width+'/'+theme)
          assert.deepEqual(view.unexpected,[])
        }
      }
    }
    await browser.goto(origin+'/app/profile?actor=owner&case=owner-denied')
    await browser.until('document.body.textContent.includes("Retry profile verification")',9000)
    assert.equal(await browser.value('!!document.querySelector("form input[autocomplete=given-name]")'),false,
      'a denied owner lookup must not be displayed as a blank profile')
    await browser.goto(origin+'/app/pets?actor=owner&case=patient-denied')
    await browser.until('document.body.textContent.includes("Retry patient list")',9000)
    assert.equal(await browser.value('document.body.textContent.includes("No patients registered yet")'),false)
    await browser.goto(origin+'/app/appointments?actor=owner&case=patient-denied')
    await browser.until('document.body.textContent.includes("Could not retrieve your appointments")',9000)
    assert.equal(await browser.value('document.body.textContent.includes("No appointments yet")'),false)
    await browser.goto(origin+'/app/pets?actor=owner')
    await browser.until('document.body.textContent.includes("Synthetic Patient")',9000)
    await browser.goto(origin+'/app/pets?actor=other')
    await browser.until('document.body.textContent.includes("Synthetic B Patient")',9000)
    assert.equal(await browser.value('document.body.textContent.includes("Synthetic Patient")'),false)
    await browser.goto(origin+'/app/pets?actor=owner')
    await browser.until('!!document.querySelector("button[aria-label^=Edit]")',9000)
    await browser.value('document.querySelector("button[aria-label^=Edit]").focus();true')
    assert.equal(await browser.value('document.activeElement.matches(":focus-visible")'),true)
    await browser.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'})
    await browser.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13})
    await browser.until('document.body.textContent.includes("Edit patient")',9000)
    assert.deepEqual(await browser.value('window.__cloudIntegrated.unexpected'),[])
  }))

test('CLOUD: catalog flag test-only, Chow Chow and three private attachment categories; metadata retry has no second Storage upload',
  {timeout:220000},async()=>withOwnerBrowser(true,async(browser,origin)=>{
    await browser.send('Emulation.setDeviceMetricsOverride',{width:768,height:900,deviceScaleFactor:1,mobile:false})
    await browser.goto(origin+'/app/pets?actor=owner&case=metadata-fail&theme=light')
    await browser.until('!!document.querySelector(".patient-grid .patient-card")',9000)
    await browser.value('document.querySelector("button.button-primary").click();true')
    await browser.until('document.body.textContent.includes("Register a patient")',9000)
    await browser.value('document.querySelector("input[autocomplete=off]").focus();true')
    await browser.send('Input.insertText',{text:'Synthetic Release Chow Chow'})
    await browser.value('document.querySelector("input[role=combobox]").focus();true')
    await browser.send('Input.insertText',{text:'Dog'})
    await browser.until('!!document.querySelector("[role=option]")',9000)
    await browser.value('document.querySelector("[role=option]").click();true')
    await browser.until('!![...document.querySelectorAll("select option")].find(x=>x.value==="dog-chow-chow")',9000)
    const options=await browser.value('[...document.querySelectorAll("select option")].map(x=>x.textContent)')
    for(const expected of ['Chow Chow','Mixed','Unknown','Not applicable'])
      assert.equal(options.some(x=>x.includes(expected)),true,'breed '+expected+' preserved')
    await browser.value('(()=>{const e=[...document.querySelectorAll("select")].find(x=>[...x.options].some(o=>o.value==="dog-chow-chow"));e.value="dog-chow-chow";e.dispatchEvent(new Event("change",{bubbles:true}));return true})()')
    const files=[
      ['profile_photo','image/png',[137,80,78,71,13,10,26,10,0,0]],
      ['health_card','application/pdf',[37,80,68,70,45,49,46,55]],
      ['vaccination_card','application/pdf',[37,80,68,70,45,49,46,55]]
    ]
    for(const [i,item] of files.entries()){
      const [category,mime,bytes]=item
      const name='synthetic-'+category+(mime==='image/png'?'.png':'.pdf')
      const expr='(()=>{const el=document.querySelectorAll("input[type=file]")['+i+'];'+
        'if(!el)return false;const file=new File([new Uint8Array('+JSON.stringify(bytes)+')],'+
        JSON.stringify(name)+',{type:'+JSON.stringify(mime)+'});'+
        'Object.defineProperty(el,"files",{configurable:true,value:[file]});'+
        'el.dispatchEvent(new Event("change",{bubbles:true}));return true})()'
      assert.equal(await browser.value(expr),true)
      await browser.until('document.querySelectorAll(".attachment-status.status-ready").length>='+String(i+1),9000)
    }
    await browser.value('document.querySelector("#patient-form-top form button.button-primary").click();true')
    await browser.until('document.body.textContent.includes("one file")&&document.body.textContent.includes("Retry below")',16000)
    assert.equal(await browser.value('document.querySelectorAll(".attachment-status.status-unindexed").length'),1)
    const current=await browser.value('({uploads:JSON.parse(localStorage.getItem("cloud.qaOwner.objects")||"[]").length,metadata:JSON.parse(localStorage.getItem("cloud.qaOwner.attachments")||"[]").length})')
    assert.deepEqual(current,{uploads:3,metadata:2})
    await browser.value('[...document.querySelectorAll(".attachment button")].find(x=>x.textContent.includes("Retry metadata recording")).click();true')
    await browser.until('document.body.textContent.includes("Private file metadata was recorded")',9000)
    const retry=await browser.value('({uploads:JSON.parse(localStorage.getItem("cloud.qaOwner.objects")||"[]").length,metadata:JSON.parse(localStorage.getItem("cloud.qaOwner.attachments")||"[]").length,unknown:window.__cloudIntegrated.unexpected})')
    assert.equal(retry.uploads,3,'finalization replay cannot duplicate Storage object')
    assert.equal(retry.metadata,3)
    assert.deepEqual(retry.unknown,[])
    await browser.goto(origin+'/app/pets?actor=other&theme=dark')
    await browser.until('document.body.textContent.includes("Synthetic B Patient")',9000)
    assert.equal(await browser.value('document.body.textContent.includes("Synthetic Release Chow Chow")'),false)
    await browser.goto(origin+'/app/pets?actor=owner&case=attachments-denied')
    await browser.until('!!document.querySelector(".patient-card")',9000)
    await browser.value('document.querySelector(".patient-card button").click();true')
    await browser.until('document.body.textContent.includes("saved documents")&&document.body.textContent.includes("Try again")',9000)
    assert.equal(await browser.value('document.querySelectorAll("fieldset.attachment:not(:disabled)").length'),0)
    assert.equal(await browser.value('document.querySelectorAll("fieldset.attachment:disabled").length'),3)
    assert.deepEqual(await browser.value('window.__cloudIntegrated.unexpected'),[])
  }))
