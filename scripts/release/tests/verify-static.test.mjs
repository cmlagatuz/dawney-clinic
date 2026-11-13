import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,mkdirSync,writeFileSync,rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { verifyStaticBuild } from '../verify-static.mjs';

const baseHeaders = `/*
  X-Content-Type-Options: nosniff
  Content-Security-Policy: default-src 'self'; object-src 'none'
`;
function fixture() {
 const dir=mkdtempSync(path.join(os.tmpdir(),'dawney-build-'));
 mkdirSync(path.join(dir,'assets'));
 writeFileSync(path.join(dir,'index.html'),'<div id="root"></div><script src="/assets/index.js"></script>');
 writeFileSync(path.join(dir,'_headers'),baseHeaders);
 writeFileSync(path.join(dir,'assets/index.js'),'console.log("Dawney test build")');
 return dir;
}
test('accepts synthetic static bundle without credentials',()=>{
 const dir=fixture();
 try {assert.ok(verifyStaticBuild(dir).files>=3)} finally {rmSync(dir,{recursive:true,force:true})}
});
test('rejects service role and secret key markers in compiled assets',()=>{
 const dir=fixture();
 try {
  for(const value of ['sb_secret_forbidden','SUPABASE_SERVICE_ROLE_KEY','-----BEGIN PRIVATE KEY-----','DAWNEY_TEST_A_PASSWORD']){
   writeFileSync(path.join(dir,'assets/index.js'),value);
   assert.throws(()=>verifyStaticBuild(dir),/privileged key/);
  }
 } finally {rmSync(dir,{recursive:true,force:true})}
});
test('rejects missing security headers and source maps or env files',()=>{
 const dir=fixture();
 try{
  writeFileSync(path.join(dir,'_headers'),'/*\n  X-Frame-Options: DENY');
  assert.throws(()=>verifyStaticBuild(dir),/security header/);
  writeFileSync(path.join(dir,'_headers'),baseHeaders);
  writeFileSync(path.join(dir,'assets/index.js.map'),'sourcemap');
  assert.throws(()=>verifyStaticBuild(dir),/source-map/);
  rmSync(path.join(dir,'assets/index.js.map'));
  writeFileSync(path.join(dir,'.env.production'),'secret=never');
  assert.throws(()=>verifyStaticBuild(dir),/environment/);
 } finally {rmSync(dir,{recursive:true,force:true})}
});
