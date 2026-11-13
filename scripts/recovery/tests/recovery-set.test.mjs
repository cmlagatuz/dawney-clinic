import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {verifyRecoverySet, validateManifest, requiredComponents} from '../verify-recovery-set.mjs';
async function fixture(fn) {
 const dir=await mkdtemp(join(tmpdir(),'dawney-recovery-set-'));
 try {
  const components={};
  for(const key of requiredComponents){
   const bytes=Buffer.from('synthetic-encrypted-fixture-'+key);
   const file=key+'.gpg';
   await writeFile(join(dir,file),bytes,{mode:0o600});
   components[key]={file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
  }
  const manifest={format:'dawney-recovery-set',version:1,created_utc:'2026-11-13T14:00:00Z',components};
  const path=join(dir,'recovery-set.json');
  await writeFile(path,JSON.stringify(manifest),{mode:0o600});
  await fn({dir,path,manifest});
 } finally {await rm(dir,{recursive:true,force:true});}
}
test('offline recovery set accepts exact five encrypted component checksums',async()=>{
 await fixture(async({path})=>{
  const result=await verifyRecoverySet(path);
  assert.equal(result.checked,5);
  assert.ok(result.totalBytes>0);
 });
});
test('reject changed encrypted component bytes and missing required coverage',async()=>{
 await fixture(async({path,dir,manifest})=>{
  await writeFile(join(dir,'auth-identities.gpg'),'wrong-but-same-length-data');
  await assert.rejects(verifyRecoverySet(path),/mismatch/);
  delete manifest.components['storage-objects'];
  assert.throws(()=>validateManifest(manifest),/missing/);
 });
});
test('reject traversal/absolute path, duplicate path and unexpected sensitive metadata',async()=>{
 await fixture(async({manifest})=>{
  manifest.components.application.file='../leaked.gpg';
  assert.throws(()=>validateManifest(manifest),/Unsafe/);
  manifest.components.application.file='/etc/passwd.gpg';
  assert.throws(()=>validateManifest(manifest),/Unsafe/);
  manifest.components.application.file='auth-identities.gpg';
  assert.throws(()=>validateManifest(manifest),/duplicate/);
  manifest.components.application.file='application.gpg';
  manifest.secret='must-not-be-in-manifest';
  assert.throws(()=>validateManifest(manifest),/Unexpected/);
 });
});
test('reject symlinked ciphertext instead of following it',async()=>{
 await fixture(async({dir,path})=>{
  await rm(join(dir,'configuration.gpg'));
  await symlink(join(dir,'application.gpg'),join(dir,'configuration.gpg'));
  await assert.rejects(verifyRecoverySet(path));
 });
});
test('reject a modified manifest or nonpositive ciphertext bytes',async()=>{
 await fixture(async({path,manifest})=>{
  manifest.components.configuration.bytes=0;
  assert.throws(()=>validateManifest(manifest),/Invalid/);
  manifest.components.configuration.bytes=99;
  await writeFile(path,JSON.stringify(manifest));
  await assert.rejects(verifyRecoverySet(path),/mismatch/);
 });
});
