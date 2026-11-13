import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validatePagesOrigin,checkPages} from '../check-pages.mjs';

test('Pages target must be a safe HTTPS pages.dev root',()=>{
 assert.equal(validatePagesOrigin('https://dawney-test.pages.dev'),'https://dawney-test.pages.dev');
 assert.equal(validatePagesOrigin('https://abc123.dawney-test.pages.dev'),'https://abc123.dawney-test.pages.dev');
 for(const url of [
   'http://dawney-test.pages.dev','https://evil.example.com',
   'https://user:password@dawney-test.pages.dev',
   'https://dawney-test.pages.dev/secret','https://dawney-test.pages.dev?token=1',
   'https://dawney-test.pages.dev:8443'
 ])assert.throws(()=>validatePagesOrigin(url),/HTTPS/);
});
test('Pages probe verifies security headers and SPA fallback for deep links',async()=>{
 const requests=[];
 const fake=async url=>{
   requests.push(url);
   return {status:200,
     headers:new Map([
      ['content-type','text/html; charset=utf-8'],
      ['x-content-type-options','nosniff'],
      ['content-security-policy',"default-src 'self'; object-src 'none'"]
     ]),
     async text(){return '<div id="root"></div><script src="/assets/index.js"></script>';}
   };
 };
 const count=await checkPages('https://dawney-test.pages.dev',fake);
 assert.equal(count,6);
 assert.ok(requests.some(v=>v.endsWith('/app/profile')));
 assert.ok(requests.some(v=>v.endsWith('/auth/recovery')));
});
test('Pages probe fails on deep-link 404 or missing CSP',async()=>{
 const fake=async url=>({status:url.endsWith('/app/pets')?404:200,
   headers:new Map([['content-type','text/html'],['x-content-type-options','nosniff'],['content-security-policy',"default-src 'self'"]]),
   async text(){return '<div id="root"></div><script src="/assets/main.js"></script>';}
 });
 await assert.rejects(checkPages('https://dawney-test.pages.dev',fake),/app route/);
 const missingCsp=async()=>({status:200,
   headers:new Map([['content-type','text/html'],['x-content-type-options','nosniff']]),
   async text(){return '<div id="root"></div><script src="/assets/main.js"></script>';}
 });
 await assert.rejects(checkPages('https://dawney-test.pages.dev',missingCsp),/security headers/);
});
