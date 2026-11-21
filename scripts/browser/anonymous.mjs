/**
 * CLOUD two-track REAL Chromium smoke on locally built Vite static preview.
 * Profile A: verified public-only site, Auth/private routes unavailable.
 * Profile B: anonymous protected routes redirect to the sign-in form.
 * Neither branch logs in, writes patient data or contacts a real provider.
 */
import {acceptedOrigin,withChromium} from './cdp.mjs'
const base=acceptedOrigin(process.argv[2],{local:true})

await withChromium(async browser=>{
  await browser.goto(base+'/auth/signin')
  await browser.until("!!document.querySelector('#auth-title, #online-unavailable-heading')")
  const informational=await browser.value("!!document.querySelector('#online-unavailable-heading')")

  if(informational){
    for(const route of ['/auth/signin','/app/profile','/app/pets','/app/appointments']){
      await browser.goto(base+route)
      await browser.until("document.querySelector('#online-unavailable-heading')?.textContent === 'Online account access is unavailable'")
      const form=await browser.value("document.querySelector('#main-content form') !== null")
      if(form)throw Error('Informational profile unexpectedly exposed account form')
    }
    console.log('PASS: Profile A anonymous account and patient routes unavailable; no sign-in or private form')
  }else{
    for(const route of ['/app/profile','/app/pets','/app/appointments']){
      await browser.goto(base+route)
      await browser.until("location.pathname === '/auth/signin' && document.querySelector('#auth-title')?.textContent === 'Welcome back'")
    }
    console.log('PASS: Profile B anonymous protected routes redirect to sign-in in Chromium')
  }

  for(const width of [360,1280]){
    await browser.send('Emulation.setDeviceMetricsOverride',{
      width,height:800,deviceScaleFactor:1,mobile:width===360
    })
    await browser.goto(base+(informational?'/contact':'/auth/signin'))
    await browser.until(informational
      ? "document.querySelector('#main-content h1')?.textContent.includes('Contact')"
      : "document.querySelector('#auth-title')?.textContent === 'Welcome back'")
    const noOverflow=await browser.value('document.documentElement.scrollWidth <= window.innerWidth + 2')
    if(!noOverflow)throw Error('Anonymous release route overflows horizontally')
  }
  console.log('PASS: Chromium 360px mobile and 1280px desktop release entry widths')
})
