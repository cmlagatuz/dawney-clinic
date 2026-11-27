import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {fileURLToPath} from 'node:url'
import {mkdir,writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {withChromium} from '../../scripts/browser/cdp.mjs'
import {backupCenterFixture} from './fixtures/backup-center-http.mjs'

test('CLOUD Backup Center: administrator-only rehearsal, role/account isolation, guided keyboard flow and truthful failure states',{timeout:180000},async()=>{
 const env={VITE_SUPABASE_URL:'https://backup-preview-fixture.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_backup_preview_fixture',VITE_ADMIN_BACKUP_PREVIEW_UI:'true'}
 const prior=Object.fromEntries(Object.keys(env).map(k=>[k,process.env[k]]))
 Object.assign(process.env,env)
 const vite=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),server:{host:'127.0.0.1',port:0,strictPort:false},logLevel:'error'})
 try{
  await vite.listen()
  const origin='http://127.0.0.1:'+vite.httpServer.address().port
  await withChromium(async b=>{
   await b.send('Page.addScriptToEvaluateOnNewDocument',{source:'('+backupCenterFixture.toString()+')()'})
   const path='/app/admin/backup',nav='.sidebar a[href="/app/admin/backup"]'
   const has=text=>b.until('document.body.innerText.includes('+JSON.stringify(text)+')')
   const selectText=text=>'[...document.querySelectorAll("button")].find(e=>e.textContent.trim()==='+JSON.stringify(text)+')'
   const click=async text=>{await b.until('!!('+selectText(text)+')&&!('+selectText(text)+').disabled');await b.value(selectText(text)+'.click();true')}
   const disabled=async text=>assert.equal(await b.value('!!('+selectText(text)+')&&('+selectText(text)+').disabled'),true,text)
   const key=async(name)=>{
    const codes={Tab:9,Enter:13,Escape:27}
    await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:name,code:name,windowsVirtualKeyCode:codes[name],...(name==='Enter'?{text:'\r',unmodifiedText:'\r'}:{})})
    await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:name,code:name,windowsVirtualKeyCode:codes[name]})
   }
   const open=async(role,theme='light',fail=false)=>{
    await b.goto(origin+path+'?role='+role+'&theme='+theme+(fail?'&fail=1':''))
   }
   const clean=async()=>assert.deepEqual(await b.value('window.__backupFixture.unexpected'),[])
   const screenshot=async(name)=>{
    const directory=process.env.DAWNEY_BACKUP_SCREENSHOT_DIR
    if(!directory)return
    // Only the local synthetic route with a fully verified fixture admin may be captured.
    assert.equal(await b.value('location.origin'),origin)
    assert.equal(await b.value('location.pathname'),path)
    assert.equal(await b.value('!!document.querySelector(".backup-center")'),true)
    await mkdir(directory,{recursive:true})
    const shot=await b.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})
    await writeFile(join(directory,name+'.png'),Buffer.from(shot.data,'base64'))
   }
   const ready=async()=>{await b.until('!!document.querySelector(".backup-center")&&!!document.querySelector('+JSON.stringify(nav)+')');await disabled('Create Database Backup');await disabled('Restore database · unavailable')}
   const guide=async()=>{
    await click('Start guided rehearsal');await has('Setup step 1 of 4')
    await b.until('document.activeElement?.id==="backup-step-title"')
    await disabled('Previous')
    for(let n=2;n<=4;n++){await click('Next');await has('Setup step '+n+' of 4')}
    await click('Previous');await has('Setup step 3 of 4');await click('Next')
    await click('Continue to verification preview');await has('Additional identity verification')
    await disabled('Verify identity · unavailable')
    assert.equal(await b.value('document.querySelector(".backup-center input[type=password]")===null'),true)
    await click('Continue rehearsal without verification');await has('Select an example storage drive')
   }
   const drive=async(id)=>{
    await b.value('(()=>{const e=document.querySelector(".backup-wizard select");e.value='+JSON.stringify(id)+';e.dispatchEvent(new Event("change",{bubbles:true}));return true})()')
   }
   const start=async()=>{await drive('example-ready');await has('Example destination ready');await click('Start simulated backup');await has('Simulated backup in progress')}
   for(const role of ['owner','veterinarian','receptionist','accountant']){
    await open(role);await has('Backup & recovery access unavailable')
    assert.equal(await b.value('!!document.querySelector(".backup-center")||!!document.querySelector('+JSON.stringify(nav)+')'),false,role)
    await clean()
   }
   await open('visitor')
   await b.until('location.pathname==="/auth/signin"&&!!document.querySelector("form input[type=password]")')
   assert.equal(await b.value('!!document.querySelector(".backup-center")'),false);await clean()
   await open('administrator','light',true);await has('Administrator access could not be verified')
   assert.equal(await b.value('!!document.querySelector(".backup-center")'),false)
   await b.value('window.__backupFixture.recover();true');await click('Recheck access')
   await b.until('!!document.querySelector(".backup-center")')
   await disabled('Create Database Backup');await clean()
   for(const [width,height] of [[360,740],[768,900],[1440,900]]){
    await b.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false})
    for(const theme of ['light','dark']){
     await open('administrator',theme);await ready()
     assert.equal(await b.value('document.documentElement.getAttribute("data-theme")'),theme)
     assert.equal(await b.value('document.documentElement.scrollWidth<=innerWidth'),true)
     assert.equal(await b.value('document.querySelector(".backup-actions button").getBoundingClientRect().height>=44'),true)
     if(width<=768){
      await b.value('document.querySelector(".mobile-toggle").click();true')
      await b.until('document.querySelector(".sidebar").getAttribute("aria-modal")==="true"&&document.querySelector(".app-content").inert')
      await b.value('document.querySelector('+JSON.stringify(nav)+').focus();true')
      await key('Escape');await b.until('document.activeElement===document.querySelector(".mobile-toggle")&&!document.querySelector(".app-content").inert')
     }
     await screenshot('dashboard-'+width+'-'+theme)
     await b.value(selectText('Start guided rehearsal')+'.focus();true');await key('Enter')
     await has('Setup step 1 of 4')
     await b.until('document.activeElement?.id==="backup-step-title"')
     await key('Tab');assert.equal(await b.value('document.activeElement.matches(":focus-visible")'),true)
     await key('Escape');await b.until('document.activeElement?.textContent==="Start guided rehearsal"&&!document.querySelector(".backup-wizard")')
     await guide()
     await disabled('Start simulated backup')
     await drive('example-small');await has('Example capacity insufficient');await disabled('Start simulated backup')
     await drive('example-readonly');await has('Example destination not writable');await disabled('Start simulated backup')
     await drive('example-ready');await has('Example destination ready')
     assert.equal(await b.value('document.documentElement.scrollWidth<=innerWidth'),true)
     await screenshot('destination-'+width+'-'+theme)
     await start()
     await click('Simulate integrity failure');await has('Simulated backup failed')
     await has('Not issued — rehearsal only')
     await disabled('Create Database Backup');await clean()
     await click('Return to dashboard');await b.until('!document.querySelector(".backup-example-receipt")&&!document.querySelector(".backup-wizard")')
    }
   }
   await guide();await start();await click('Cancel rehearsal');await has('Simulated backup interrupted');await has('partial output is not a valid backup')
   await click('Return to dashboard');await guide();await start()
   await click('Advance example stage');await click('Advance example stage');await click('Finish simulated verification')
   await has('Simulated backup success');await has('No real archive, checksum or integrity receipt exists')
   await screenshot('simulated-result-1440-dark')
   await b.value('window.__backupFixture.switchAccount("administrator");true')
   await b.until('!!document.querySelector(".backup-center")&&!document.querySelector(".backup-wizard")&&!document.querySelector(".backup-example-receipt")')
   await ready();await guide();await start()
   // Hold the old administrator's read after explicit recheck; switch the real
   // AuthProvider session while it is pending; late results cannot expose the wizard.
   await b.value('window.__backupFixture.holdMembership();true');await click('Recheck access')
   await b.until('window.__backupFixture.held&&!document.querySelector(".backup-center")')
   await b.value('window.__backupFixture.switchAccount("receptionist");true')
   await has('Backup & recovery access unavailable')
   await b.value('window.__backupFixture.releaseMembership();true')
   await b.until('window.__backupFixture.released&&!document.querySelector(".backup-center")&&!document.querySelector('+JSON.stringify(nav)+')')
   assert.equal(await b.value('!!document.querySelector(".backup-wizard")||!!document.querySelector(".backup-example-receipt")'),false)
   await clean()
  })
 }finally{
  await vite.close()
  for(const [k,v] of Object.entries(prior))if(v===undefined)delete process.env[k];else process.env[k]=v
 }
})
