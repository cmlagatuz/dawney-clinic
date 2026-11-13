/**
 * Explicit owner-operated, READ-ONLY Chromium acceptance for an approved
 * deployed *.pages.dev test site. Uses an EXISTING confirmed disposable user.
 * Never signs up, creates pets/appointments, updates profiles or uploads files.
 * Auth login/logout can update Supabase-managed session metadata.
 * Passwords and user data are not printed, photographed or recorded.
 */
import {acceptedOrigin,withChromium} from './cdp.mjs';
const base=acceptedOrigin(process.env.DAWNEY_BROWSER_PAGES_ORIGIN);
if(process.env.DAWNEY_BROWSER_READ_ONLY!=='YES' ||
   !process.env.DAWNEY_TEST_A_EMAIL || !process.env.DAWNEY_TEST_A_PASSWORD) {
  throw Error('Owner must explicitly enable read-only browser mode and set private disposable credentials');
}
await withChromium(async browser=>{
 await browser.goto(base+'/auth/signin');
 await browser.until("document.querySelector('#auth-title')?.textContent === 'Welcome back'");
 for(const [name,value] of [['email',process.env.DAWNEY_TEST_A_EMAIL],['password',process.env.DAWNEY_TEST_A_PASSWORD]]){
  const focused=await browser.value(`Boolean((()=>{const el=document.querySelector('input[name="${name}"]'); if(!el)return false; el.focus();return true;})())`);
  if(!focused)throw Error('Sign-in input unavailable');
  // CDP browser native text insertion fires real input events for React.
  await browser.send('Input.insertText',{text:value});
 }
 const click=await browser.value("Boolean((()=>{const b=document.querySelector('form button'); if(!b)return false; b.click();return true;})())");
 if(!click)throw Error('Sign-in button unavailable');
 await browser.until("location.pathname === '/app/profile' && document.querySelector('#profile-heading')?.textContent === 'My owner profile'",25000);
 await browser.until("!document.body.innerText.includes('Loading saved profile')",12000);
 const haveProfile=await browser.value("Boolean(document.querySelector('.tag')?.textContent?.includes('Saved profile'))");
 if(!haveProfile)throw Error('Existing disposable owner profile not loaded');
 console.log('PASS: confirmed disposable account signed in and preexisting owner profile was read');
 await browser.send('Page.reload',{ignoreCache:true});
 await browser.until("location.pathname === '/app/profile' && document.querySelector('.tag')?.textContent?.includes('Saved profile')",25000);
 console.log('PASS: actual browser reload rehydrated session and persisted owner profile');
 for(const [route,heading] of [['/app/pets','My patients'],['/app/appointments','Appointments']]){
  await browser.goto(base+route);
  await browser.until(`document.querySelector('h1')?.textContent === ${JSON.stringify(heading)}`,25000);
  const good=await browser.value("!document.querySelector('[role=alert].alert-error') && !document.body.innerText.includes('Loading your patients') && !document.body.innerText.includes('Loading appointments')");
  if(!good)throw Error('Read-only patients/appointments view not ready');
 }
 console.log('PASS: existing patient list and appointment list read without data mutation');
 const signedOut=await browser.value("Boolean((()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent?.trim()==='Sign out');if(!b)return false;b.click();return true;})())");
 if(!signedOut)throw Error('Sign-out control unavailable');
 await browser.until("location.pathname === '/auth/signin' && document.querySelector('#auth-title')?.textContent === 'Welcome back'",25000);
 await browser.goto(base+'/app/pets');
 await browser.until("location.pathname === '/auth/signin'",12000);
 console.log('PASS: logout removes private route access in real browser');
});
