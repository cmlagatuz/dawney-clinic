// CLOUD: actual Chromium, intercepted LOCAL synthetic HTTP; no hosted records or writes.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {fileURLToPath} from 'node:url'
import {withChromium} from '../../scripts/browser/cdp.mjs'

function install(){
  const id=n=>'20000000-0000-4000-8000-'+String(n).padStart(12,'0')
  const scenario=new URLSearchParams(location.search).get('case')??'ok'
  const calls={reads:[],saves:[],unexpected:[]}
  window.__clinicalQA=calls
  const original=window.fetch.bind(window)
  const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}})
  const stamp=n=>new Date(Date.parse('2026-11-20T12:00:00Z')-n*60000).toISOString()
  let attempts=0
  window.fetch=async(input,init)=>{
    const req=new Request(input,init),url=new URL(req.url)
    if(url.origin!==location.origin){calls.unexpected.push(url.origin);throw Error('External request blocked')}
    if(!url.pathname.startsWith('/__qa_clinical/'))return original(input,init)
    if(url.pathname==='/__qa_clinical/save'){
      const data=await req.json()
      calls.saves.push({method:req.method,nonce:data.requestId,revision:data.expectedRevision})
      if(!['write','conflict','uncertain'].includes(scenario))return reply({code:'42501'},403)
      if(scenario==='conflict')return reply({code:'40001'},409)
      if(scenario==='uncertain'&&attempts++===0)return reply({code:'500'},500)
      return reply({kind:'saved',id:id(100),appointmentId:data.appointmentId,
        branchId:data.branchId,petId:data.petId,authorId:id(5),editorId:id(1),
        status:'draft',revision:data.expectedRevision+1,updatedAt:'2026-11-21T12:00:00Z'})
    }
    if(url.pathname!=='/__qa_clinical/read'||req.method!=='GET'){
      calls.unexpected.push(url.pathname);return reply({code:'404'},404)
    }
    const account=req.headers.get('x-qa-account'),branch=req.headers.get('x-qa-branch')
    const pet=req.headers.get('x-qa-pet'),owner=req.headers.get('x-qa-owner')
    const section=req.headers.get('x-qa-section'),cursor=req.headers.get('x-qa-cursor')
    const limit=req.headers.get('x-qa-limit')
    calls.reads.push({account,branch,pet,owner,section,cursor,limit})
    if(scenario==='expired'||scenario==='revoked'||account!==id(1))return reply({code:'42501'},403)
    if(scenario==='missing')return reply({code:'PGRST202'},404)
    if(scenario==='network')throw new TypeError('Failed to fetch fixture')
    if(scenario==='not-found'||pet!==id(3))return reply({kind:'not_found'})
    if(scenario==='late'&&branch===id(2))await new Promise(resolve=>setTimeout(resolve,220))
    const count=scenario==='pages'?51:section==='drafts'?1:2
    const all=Array.from({length:count},(_,n)=>{
      const base={id:id(100+n),petId:id(3),branchId:branch}
      if(section==='appointments')return {...base,startsAt:stamp(n),
        endsAt:new Date(Date.parse(stamp(n))+1800000).toISOString(),
        status:'confirmed',concern:'Synthetic booking'}
      if(section==='records')return {...base,performedAt:stamp(n),
        procedure:'Synthetic examination',temperatureC:38.4,weightKg:10,
        comments:'Test only',authoredBy:id(1)}
      return {...base,appointmentId:scenario==='pages'&&n<50?id(500+n):id(5),
        authorId:id(5),editorId:id(6),status:'draft',
        revision:1,complaint:'Existing synthetic complaint',examination:'Prior exam',
        assessment:'Prior assessment',plan:'Prior plan',createdAt:stamp(n),
        updatedAt:new Date(Date.parse(stamp(n))+1000).toISOString()}
    })
    const items=cursor?all.slice(50):all.slice(0,50)
    const more=all.length>50&&!cursor
    const last=items.at(-1)
    const at=last&&(section==='appointments'?last.startsAt:section==='records'?last.performedAt:last.createdAt)
    const page={kind:'ok',accountId:account,branchId:branch,section,
      patient:{id:id(3),ownerId:id(4),name:branch===id(7)?'Synthetic Cavite Patient':'Synthetic Naga Patient',
        species:'Dog',breed:'Chow Chow',sex:'unknown',birthDate:'2021-11-01',taxonomyReviewNeeded:false},
      items,hasMore:more,nextCursor:more?{at,id:last.id}:null}
    if(scenario==='wrong-owner')page.patient.ownerId=id(99)
    if(scenario==='wrong-branch')page.branchId=id(99)
    if(scenario==='wrong-patient')page.items[0].petId=id(99)
    if(scenario==='wrong-account')page.accountId=id(99)
    if(scenario==='malformed')page.items[0].id='malformed'
    if(scenario==='bad-date')page.items[0].performedAt='yesterday'
    if(scenario==='bad-amount')page.items[0].temperatureC=900
    if(scenario==='empty'){page.items=[];page.hasMore=false;page.nextCursor=null}
    return reply(page)
  }
}
const pick=mode=>'(()=>{const s=document.querySelector("#qa-mode");s.value="'+mode+'";s.dispatchEvent(new Event("change",{bubbles:true}));return true})()'
const originOf=vite=>'http://127.0.0.1:'+vite.httpServer.address().port
const fixture=(origin,scenario,theme='light')=>origin+'/tests/fixtures/clinical-chart-fixture.html?case='+scenario+'&theme='+theme

test('CLOUD chart: live Chromium synthetic 50/51, responsive theme, denied, stale context and receptionist',
  {timeout:180000},async()=>{
  const vite=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),
    server:{host:'127.0.0.1',port:0,strictPort:false}})
  try{
    await vite.listen()
    await withChromium(async browser=>{
      await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:'('+install.toString()+')()'})
      const origin=originOf(vite)
      for(const width of [360,768,1440])for(const theme of ['light','dark']){
        await browser.send('Emulation.setDeviceMetricsOverride',
          {width,height:900,deviceScaleFactor:1,mobile:false})
        await browser.goto(fixture(origin,'ok',theme))
        await browser.until('document.body.textContent.includes("Synthetic Naga Patient")')
        const result=await browser.value('({theme:document.documentElement.getAttribute("data-theme"),overflow:document.documentElement.scrollWidth>innerWidth,writes:window.__clinicalQA.saves.length,unknown:window.__clinicalQA.unexpected,reads:window.__clinicalQA.reads,href:location.href,storage:Object.keys(localStorage)})')
        assert.equal(result.theme,theme)
        assert.equal(result.overflow,false,'width '+width+' theme '+theme)
        assert.equal(result.writes,0)
        assert.deepEqual(result.unknown,[])
        assert.equal(result.reads.every(x=>x.limit==='50'&&x.account&&x.owner),true)
        assert.equal(result.href.includes('20000000'),false,'no patient id in URL')
        assert.equal(result.storage.some(k=>/patient|clinical|draft/i.test(k)),false)
        await browser.value(pick('history'))
        await browser.until('!!document.querySelector("[aria-label=\'Verified records history\']")')
        await browser.value(pick('encounter'))
        await browser.until('!!document.querySelector("form[aria-label=\'Persisted encounter draft form\']")')
        assert.equal(await browser.value('[...document.querySelectorAll("button")].some(b=>b.textContent.includes("Save unavailable")&&b.disabled)'),true)
        assert.equal(await browser.value('document.querySelector(".clinical-attribution").textContent.includes("Last edited by")'),true)
        assert.equal(await browser.value('window.__clinicalQA.saves.length'),0)
      }
      await browser.goto(fixture(origin,'pages'))
      await browser.until('document.querySelectorAll(".clinical-visit").length===50')
      await browser.value('document.querySelector(".clinical-chart-pagination button").click();true')
      await browser.until('document.querySelectorAll(".clinical-visit").length===51')
      for(const section of ['history','encounter']){
        await browser.value(pick(section))
        await browser.until('document.querySelectorAll(".clinical-visit").length===50')
        if(section==='encounter'){
          assert.equal(await browser.value('!!document.querySelector(".clinical-attribution")'),false,
            'unseen appointment draft must not be invented as a saved revision')
          assert.equal(await browser.value('document.querySelector(".clinical-encounter-editor button[type=submit]").disabled'),true)
        }
        await browser.value('document.querySelector(".clinical-chart-pagination button").click();true')
        await browser.until('document.querySelectorAll(".clinical-visit").length===51')
        if(section==='encounter'){
          await browser.until('!!document.querySelector(".clinical-attribution")')
          assert.equal(await browser.value('document.querySelector("form[aria-label=\'Persisted encounter draft form\'] textarea").value'),
            'Existing synthetic complaint','newly paged draft hydrates editor rather than treating it as revision 0')
        }
      }
      assert.equal(await browser.value('window.__clinicalQA.reads.every(r=>r.limit==="50")'),true)
      await browser.goto(origin+'/tests/fixtures/clinical-chart-fixture.html?case=ok&role=receptionist')
      await browser.until('!!document.querySelector(".clinical-verified-demographics")')
      await browser.value(pick('history'))
      await browser.until('document.body.textContent.includes("Receptionists can view")')
      await browser.value(pick('encounter'))
      await browser.until('document.body.textContent.includes("Receptionists can view")')
      assert.equal(await browser.value('window.__clinicalQA.reads.every(r=>r.section==="appointments")'),true)
      assert.equal(await browser.value('window.__clinicalQA.saves.length'),0)
      for(const [caseName,expected] of [
        ['missing','Secure chart unavailable'],['not-found','Patient context not found'],
        ['network','Network interruption'],['wrong-owner','Invalid clinical response'],
        ['wrong-patient','Invalid clinical response'],['wrong-branch','Invalid clinical response'],
        ['wrong-account','Invalid clinical response'],['malformed','Invalid clinical response'],
        ['empty','Verified empty']
      ]){
        await browser.goto(fixture(origin,caseName))
        await browser.until('document.body.textContent.includes("'+expected+'")')
        assert.equal(await browser.value('!!document.querySelector(".clinical-verified-demographics")'),
          caseName==='empty',caseName)
      }
      for(const caseName of ['expired','revoked']){
        await browser.goto(fixture(origin,caseName))
        await browser.until('document.body.textContent.includes("Access revoked")')
        assert.equal(await browser.value('!!document.querySelector(".clinical-verified-demographics")'),false)
      }
      for(const caseName of ['bad-date','bad-amount']){
        await browser.goto(fixture(origin,caseName))
        await browser.value(pick('history'))
        await browser.until('document.body.textContent.includes("Invalid clinical response")')
        assert.equal(await browser.value('!!document.querySelector("[aria-label=\'Verified records history\']")'),false)
      }
      await browser.goto(fixture(origin,'late'))
      await browser.until('window.__clinicalQA.reads.length>0')
      await browser.value('document.querySelector("#qa-branch").click();true')
      await browser.until('document.body.textContent.includes("Synthetic Cavite Patient")')
      await browser.value('new Promise(resolve=>setTimeout(resolve,330))')
      assert.equal(await browser.value('document.body.textContent.includes("Synthetic Naga Patient")'),false)
      await browser.value('document.querySelector("#qa-account").click();true')
      await browser.until('document.body.textContent.includes("Access revoked")')
      assert.equal(await browser.value('document.body.textContent.includes("Synthetic Cavite Patient")'),false)
      await browser.goto(fixture(origin,'ok'))
      await browser.until('document.body.textContent.includes("Synthetic Naga Patient")')
      await browser.value('document.querySelector("#qa-patient").click();true')
      await browser.until('document.body.textContent.includes("Patient context not found")')
      assert.equal(await browser.value('document.body.textContent.includes("Synthetic Naga Patient")'),false)
    })
  }finally{await vite.close()}
})

test('CLOUD synthetic encounter: two veterinarian attribution, CAS conflict and idempotent retry',
  {timeout:180000},async()=>{
  const vite=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),
    server:{host:'127.0.0.1',port:0,strictPort:false}})
  try{
    await vite.listen()
    await withChromium(async browser=>{
      await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:'('+install.toString()+')()'})
      const origin=originOf(vite)
      const setEdited=async()=>{
        await browser.value(pick('encounter'))
        await browser.until('!!document.querySelector(".clinical-attribution")')
        await browser.value('document.querySelector("form[aria-label=\'Persisted encounter draft form\'] textarea").focus();true')
        await browser.send('Input.insertText',{text:' edited by second vet'})
        await browser.until('!!document.querySelector(".clinical-encounter-editor button[type=submit]:not(:disabled)")')
      }
      await browser.goto(fixture(origin,'write'))
      await setEdited()
      await browser.value('document.querySelector(".clinical-encounter-editor button[type=button]").click();true')
      await browser.until('document.querySelector("form[aria-label=\'Persisted encounter draft form\'] textarea")?.value==="Existing synthetic complaint"')
      assert.equal(await browser.value('window.__clinicalQA.saves.length'),0,'discard never claims a network save')
      await setEdited()
      await browser.value('document.querySelector(".clinical-encounter-editor button[type=submit]").click();true')
      await browser.until('document.body.textContent.includes("Server-acknowledged DRAFT saved")')
      assert.equal(await browser.value('window.__clinicalQA.saves.length'),1)
      assert.equal(await browser.value('document.querySelector(".clinical-attribution").textContent.includes("Revision2")'),true)
      await browser.goto(fixture(origin,'uncertain'))
      await setEdited()
      await browser.value('document.querySelector(".clinical-encounter-editor button[type=submit]").click();true')
      await browser.until('document.body.textContent.includes("Save was not verified")')
      await browser.value('document.querySelector(".clinical-encounter-editor button[type=submit]").click();true')
      await browser.until('document.body.textContent.includes("Server-acknowledged DRAFT saved")')
      const ids=await browser.value('window.__clinicalQA.saves.map(x=>x.nonce)')
      assert.equal(ids.length,2)
      assert.equal(ids[0],ids[1],'same request UUID reused when payload unchanged')
      await browser.goto(fixture(origin,'conflict'))
      await setEdited()
      await browser.value('document.querySelector(".clinical-encounter-editor button[type=submit]").click();true')
      await browser.until('document.body.textContent.includes("Revision or request-ID conflict")')
      assert.equal(await browser.value('document.querySelector(".clinical-encounter-editor button[type=submit]").disabled'),true)
      assert.equal(await browser.value('window.__clinicalQA.saves.length'),1)
    })
  }finally{await vite.close()}
})
