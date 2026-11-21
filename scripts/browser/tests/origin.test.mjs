import {test} from 'node:test';
import assert from 'node:assert/strict';
import {acceptedOrigin} from '../cdp.mjs';
test('anonymous CI is loopback only, manual hosted tests require HTTPS pages.dev',()=>{
 assert.equal(acceptedOrigin('http://127.0.0.1:4173',{local:true}),'http://127.0.0.1:4173');
 assert.equal(acceptedOrigin('https://preview-clinic.pages.dev'),'https://preview-clinic.pages.dev');
 for(const url of ['https://evil.example.com','http://preview-clinic.pages.dev',
  'https://token@preview-clinic.pages.dev','https://preview-clinic.pages.dev/a']){
  assert.throws(()=>acceptedOrigin(url));
 }
 for(const url of ['http://localhost:4173','http://192.168.0.1:4173','https://preview-clinic.pages.dev']){
  assert.throws(()=>acceptedOrigin(url,{local:true}));
 }
});
