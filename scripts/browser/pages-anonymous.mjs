/**
 * Public production Pages browser acceptance without user accounts or writes.
 * Verifies actual rendered React, anonymous protected routing and mobile width.
 * Uses a disposable blank Chromium profile and never enters clinical data.
 */
import {acceptedOrigin, withChromium} from './cdp.mjs';
const base=acceptedOrigin(process.argv[2]);
await withChromium(async browser=>{
 await browser.goto(base+'/auth/signin');
 await browser.until("document.querySelector('#auth-title')?.textContent === 'Welcome back'",25000);
 console.log('PASS: deployed React sign-in renders in real Chromium');
 for(const path of ['/app/profile','/app/pets','/app/appointments']){
  await browser.goto(base+path);
  await browser.until("location.pathname === '/auth/signin' && document.querySelector('#auth-title')?.textContent === 'Welcome back'",25000);
 }
 console.log('PASS: deployed anonymous private routes redirect to login');
 await browser.send('Emulation.setDeviceMetricsOverride',{width:360,height:780,deviceScaleFactor:1,mobile:true});
 await browser.goto(base+'/auth/signin');
 await browser.until("document.querySelector('#auth-title')?.textContent === 'Welcome back'",25000);
 const within=await browser.value('document.documentElement.scrollWidth <= window.innerWidth + 2');
 if(!within)throw Error('Deployed mobile login has horizontal overflow');
 console.log('PASS: deployed 360px mobile sign-in has no horizontal overflow');
});
