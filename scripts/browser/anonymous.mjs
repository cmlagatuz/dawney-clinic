/**
 * Real Chrome UI smoke against local built static Vite preview only.
 * Uses an inert publishable key and an empty browser profile. No logins/writes.
 */
import {acceptedOrigin,withChromium} from './cdp.mjs';
const base=acceptedOrigin(process.argv[2],{local:true});
await withChromium(async browser=>{
 for(const route of ['/app/profile','/app/pets','/app/appointments']){
  await browser.goto(base+route);
  await browser.until("location.pathname === '/auth/signin' && document.querySelector('#auth-title')?.textContent === 'Welcome back'");
 }
 console.log('PASS: anonymous protected routes redirect to sign-in in Chromium');
 await browser.send('Emulation.setDeviceMetricsOverride',{
  width:360,height:800,deviceScaleFactor:1,mobile:true
 });
 await browser.goto(base+'/auth/signin');
 await browser.until("document.querySelector('#auth-title')?.textContent === 'Welcome back'");
 const small=await browser.value('document.documentElement.scrollWidth <= window.innerWidth + 2');
 if(!small)throw Error('Mobile sign-in page overflows horizontally');
 await browser.send('Emulation.setDeviceMetricsOverride',{
  width:1280,height:800,deviceScaleFactor:1,mobile:false
 });
 await browser.goto(base+'/auth/signin');
 await browser.until("document.querySelector('#auth-title')?.textContent === 'Welcome back'");
 const wide=await browser.value('document.documentElement.scrollWidth <= window.innerWidth + 2');
 if(!wide)throw Error('Desktop sign-in page overflows horizontally');
 console.log('PASS: Chromium 360px mobile and 1280px desktop sign-in viewport widths');
});
