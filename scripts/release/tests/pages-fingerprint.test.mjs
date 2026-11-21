import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fingerprintPages, verifyRollback, validateDigest} from '../pages-fingerprint.mjs';
const body='<div id="root"></div><script src="/assets/a123.js"></script>';
const headers=new Map([
 ['content-type','text/html; charset=utf-8'],
 ['x-content-type-options','nosniff'],
 ['content-security-policy',"default-src 'self'; object-src 'none'"]
]);
const mock=async()=>({status:200,headers,async text(){return body;}});
test('fingerprint covers Pages deep links and matches approved bytes',async()=>{
 const expected=createHash('sha256').update(body).digest('hex');
 assert.equal(await fingerprintPages('https://example.pages.dev',mock),expected);
 assert.equal(await verifyRollback('https://example.pages.dev',expected,mock),true);
});
test('mismatch or malformed hash fails closed',async()=>{
 assert.throws(()=>validateDigest('broken'),/SHA-256/);
 const incorrect='0'.repeat(64);
 await assert.rejects(verifyRollback('https://example.pages.dev',incorrect,mock),/mismatch/);
});
test('reject non-Pages hosts, unauthorized route responses and oversized content',async()=>{
 await assert.rejects(fingerprintPages('https://evil.example.net',mock),/HTTPS/);
 const missing=async u=>({...await mock(),status:u.endsWith('/app/appointments')?404:200});
 await assert.rejects(fingerprintPages('https://example.pages.dev',missing),/app route/);
 const huge=async()=>({...await mock(),async text(){return body+'X'.repeat(2_000_001)}});
 await assert.rejects(fingerprintPages('https://example.pages.dev',huge),/oversized/);
});
