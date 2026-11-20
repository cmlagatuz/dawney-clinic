import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createPublicKey,sign as signBytes,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {harnessHashes,sha256,BACKEND_SOURCE_SHA} from '../guards.mjs';
import {prepareStagingRequest,materializeValidatedStagingBody,stagingPlanSha256,STAGING_ORIGIN,STAGING_REF} from '../staging-request-plan.mjs';

// Disposable signing key and synthetic JWT-like token: never a hosted secret.
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const pub=publicKey.export({type:'spki',format:'pem'}).toString();
const pinned=sha256(createPublicKey(pub).export({type:'spki',format:'der'}));
const token='Bearer eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJvZmZsaW5lIn0.c2ln';
const idA='11111111-1111-4111-8111-111111111111';
const idB='22222222-2222-4222-8222-222222222222';
const idC='33333333-3333-4333-8333-333333333333';
const idD='44444444-4444-4444-8444-444444444444';
const RUN='RUNABC12';
const marker='DAWNEY_STAGE_'+RUN;

function approvalFor(changes={}){
 const now=Date.now();
 const claims={
  kind:'dawney-hosted-security-acceptance-v1',
  ownerApproved:true,allowSyntheticWrites:true,environment:'disposable-staging',
  verifiedSeparateProject:true,backendSourceSha:BACKEND_SOURCE_SHA,
  harnessFiles:harnessHashes(),stagingPlanSha256:stagingPlanSha256(),
  runId:RUN,projectRef:STAGING_REF,origin:STAGING_ORIGIN,
  notBefore:now-1000,expiresAt:now+60000,...changes
 };
 const signature=signBytes('RSA-SHA256',Buffer.from(JSON.stringify(claims)),privateKey)
  .toString('base64url');
 return {
  approval:{claims,signature},
  trust:{publicKey:pub,pinnedSha256:pinned},
  staging:{ref:STAGING_REF,origin:STAGING_ORIGIN,productionRef:'lgimhirgvresvbsdugac'},
 };
}
const req=(actor,method,path,body,extra={})=>({
 origin:STAGING_ORIGIN,actor,method,path,
 headers:{
  apikey:'sb_publishable_offline_only',
  ...(actor==='anonymous'?{}:{Authorization:token}),
  ...extra
 },
 ...(body===undefined?{}:{body})
});
const booking=()=>({
 p_pet_id:idA,p_service_id:idB,p_resource_id:idC,
 p_starts_at:'2099-11-18T01:00:00.000Z',p_request_nonce:idD,
 p_concern:marker,p_details:marker
});
const key='pets/'+idA+'/owners/'+idB+'/'+idC+'.pdf';
const pdf=()=>Buffer.from('%PDF-1.4\n%'+marker+'\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n');

function plan(r,ctx=approvalFor()){
 return prepareStagingRequest({...ctx,request:r});
}
function denied(r,code,ctx=approvalFor()){
 assert.throws(()=>plan(r,ctx),{message:'HOSTED_ACCEPTANCE_BLOCKED:'+code});
}

test('offline canonical anonymous JWKS request binds exact staging URL, never provides a sender',()=>{
 const p=plan(req('anonymous','GET','/auth/v1/.well-known/jwks.json'));
 assert.equal(p.url,STAGING_ORIGIN+'/auth/v1/.well-known/jwks.json');
 assert.equal(p.method,'GET');
 assert.equal(p.responseKind,'json');
 assert.equal(p.redirectPolicy,'error');
 assert.equal(p.credentialsPolicy,'omit');
 assert.equal(typeof p.request,'undefined');
 assert.equal(typeof p.send,'undefined');
 assert.equal(Object.isFrozen(p),true);
});
test('owner A/B booking and tampered-nonce negative remain representable as synthetic only',()=>{
 const r=req('ownerA','POST','/rest/v1/rpc/request_service_appointment',booking(),
  {'Content-Type':'application/json'});
 const p=plan(r);
 assert.equal(p.body.p_request_nonce,idD);
 assert.equal(p.body.p_concern,marker);
 const altered={...booking(),p_concern:marker+'_CHANGED'};
 assert.equal(plan(req('ownerB','POST',r.path,altered,
  {'Content-Type':'application/json'})).body.p_concern,altered.p_concern);
 assert.notStrictEqual(p.body,r.body);
});
test('canonical owner/staff RLS reads and denied owner confirmation remain representable',()=>{
 const select='/rest/v1/appointments?select=id,owner_id,status&id=eq.'+idA;
 assert.equal(plan(req('staff','GET',select)).responseKind,'json');
 const patch=req('ownerA','PATCH','/rest/v1/appointments?id=eq.'+idA,
  {status:'confirmed'},{'Content-Type':'application/json',Prefer:'return=representation'});
 assert.equal(plan(patch).method,'PATCH');
});
test('synthetic private PDF upload and denied .exe attempt have isolated byte copies',()=>{
 const upload=req('ownerA','POST','/storage/v1/object/clinical-attachments/'+key,
  pdf(),{'Content-Type':'application/pdf','x-upsert':'false'});
 const p=plan(upload);
 assert.equal(p.responseKind,'json');
 assert.equal(p.body.equals(upload.body),true);
 assert.notStrictEqual(p.body,upload.body);
 const negative=req('ownerA','POST',upload.path.replace(/\.pdf$/,'.exe'),
  pdf(),{'Content-Type':'application/pdf','x-upsert':'false'});
 assert.equal(plan(negative).method,'POST');
 assert.equal(plan(req('anonymous','GET','/storage/v1/object/public/clinical-attachments/'+key))
  .responseKind,'bytes');
});
test('signed approval is mandatory, no fallback or arbitrary source digest',()=>{
 const ctx=approvalFor();
 ctx.approval.signature='c2ln';
 denied(req('anonymous','GET','/auth/v1/.well-known/jwks.json'),
  'owner_signature_invalid',ctx);
 denied(req('anonymous','GET','/auth/v1/.well-known/jwks.json'),
  'staging_plan_content_not_approved',approvalFor({stagingPlanSha256:'0'.repeat(64)}));
});
test('original reviewed guard and acceptance hashes cannot be bypassed',()=>{
 denied(req('anonymous','GET','/auth/v1/.well-known/jwks.json'),
  'harness_content_not_approved',
  approvalFor({harnessFiles:{'guards.mjs':'f'.repeat(64),'acceptance.mjs':'0'.repeat(64)}}));
});
test('independently pinned signer fingerprint and approval validity window fail closed',()=>{
 const ctx=approvalFor();
 ctx.trust.pinnedSha256='a'.repeat(64);
 denied(req('anonymous','GET','/auth/v1/.well-known/jwks.json'),
  'untrusted_approval_key',ctx);
 denied(req('anonymous','GET','/auth/v1/.well-known/jwks.json'),
  'approval_expired',approvalFor({notBefore:Date.now()-7200000,expiresAt:Date.now()-3600000}));
});
test('signed different staging project is refused even when its signature is valid',()=>{
 const other='abcdefghijklmnopqrst';
 const ctx=approvalFor({projectRef:other,origin:'https://'+other+'.supabase.co'});
 ctx.staging={...ctx.staging,ref:other,origin:'https://'+other+'.supabase.co'};
 denied(req('anonymous','GET','/auth/v1/.well-known/jwks.json'),
  'adapter_staging_only',ctx);
});
test('protected production ref and wrong origin are refused before request construction',()=>{
 const ctx=approvalFor();
 ctx.staging.ref='lgimhirgvresvbsdugac';
 ctx.staging.origin='https://lgimhirgvresvbsdugac.supabase.co';
 denied(req('anonymous','GET','/auth/v1/.well-known/jwks.json'),
  'staging_not_separate',ctx);
 const wrong=req('anonymous','GET','/auth/v1/.well-known/jwks.json');
 wrong.origin='https://'+STAGING_REF+'.supabase.co.evil.test';
 denied(wrong,'request_origin_mismatch');
});
test('no alternate port, userinfo, fragment, percent-encoded path or external URL',()=>{
 for(const path of [
  '//example.com/auth/v1/user','/auth/v1/user#fragment',
  '/auth/v1/%75ser','/auth/v1/user?redirect=https://evil.test',
  '/auth/v1/user%2Ffoo','/auth/v1/user@evil.test',
  '/rest/v1/owners?select=id&user_id=eq.'+idA+'&or=(true)',
  '/storage/v1/object/clinical-attachments/../admin'
 ]){
  const r=req('ownerA','GET',path);
  assert.throws(()=>plan(r),/^Error: HOSTED_ACCEPTANCE_BLOCKED:/);
 }
});
test('unapproved methods and endpoints including SQL, signup, bucket admin and deletes refused',()=>{
 for(const [method,path] of [
  ['DELETE','/rest/v1/appointments?id=eq.'+idA],
  ['POST','/auth/v1/signup'],
  ['POST','/storage/v1/bucket'],
  ['POST','/rest/v1/rpc/bootstrap_first_administrator'],
  ['GET','/pg/meta/default/query?sql=select'],
  ['POST','/storage/v1/object/clinical-attachments/'+key+'/bad']
 ]){
  assert.throws(()=>plan(req('ownerA',method,path)),
   /^Error: HOSTED_ACCEPTANCE_BLOCKED:/);
 }
});
test('privileged API keys, custom network headers, request-smuggling newline are blocked',()=>{
 denied(req('ownerA','GET','/auth/v1/user',undefined,{apikey:'sb_secret_foo'}),
  'publishable_key_only');
 denied(req('ownerA','GET','/auth/v1/user',undefined,{Host:'evil.test'}),
  'unapproved_http_header');
 denied(req('ownerA','GET','/auth/v1/user',undefined,{'x-forwarded-host':'evil.test'}),
  'unapproved_http_header');
 denied(req('ownerA','GET','/auth/v1/user',undefined,{Authorization:token+'\r\nHost: evil'}),
  'unapproved_http_header');
});
test('anonymous bearer injection or absent signed-role bearer is blocked',()=>{
 denied(req('anonymous','GET','/auth/v1/.well-known/jwks.json',undefined,
  {Authorization:token}),'anonymous_token_forbidden');
 denied(req('ownerA','GET','/auth/v1/user',undefined,
  {Authorization:'Bearer sb_secret_abcdef'}),'bearer_token_required');
});
test('non-synthetic booking data, extra columns and malformed JWT-like shape are denied',()=>{
 const path='/rest/v1/rpc/request_service_appointment';
 const opts={'Content-Type':'application/json'};
 denied(req('ownerA','POST',path,{...booking(),p_concern:'medical record'},opts),
  'booking_not_synthetic');
 denied(req('ownerA','POST',path,{...booking(),user_id:idA},opts),
  'booking_payload_shape');
 denied(req('ownerA','POST',path,{...booking(),p_request_nonce:'not-a-uuid'},opts),
  'booking_uuid_invalid');
});
test('mutating headers, data misuse and non-synthetic PDF uploads fail closed',()=>{
 denied(req('ownerA','POST','/rest/v1/rpc/request_service_appointment',booking(),
  {'Content-Type':'text/plain'}),'booking_headers');
 denied(req('ownerA','PATCH','/rest/v1/appointments?id=eq.'+idA,
  {status:'completed'},{'Content-Type':'application/json',Prefer:'return=representation'}),
  'forged_confirmation_shape');
 denied(req('ownerA','POST','/storage/v1/object/clinical-attachments/'+key,
  pdf(),{'Content-Type':'application/pdf','x-upsert':'true'}),'synthetic_pdf_only');
 denied(req('ownerA','POST','/storage/v1/object/clinical-attachments/'+key,
  Buffer.from('real patient bytes'),{'Content-Type':'application/pdf','x-upsert':'false'}),
  'synthetic_pdf_only');
});
test('GET never accepts payload or storage-write-only headers',()=>{
 denied(req('staff','GET','/auth/v1/user',{any:'data'}),'unexpected_get_payload');
 denied(req('staff','GET','/auth/v1/user',undefined,{'x-upsert':'false'}),
  'unexpected_get_payload');
});
test('source has no native network sender, client import or transport.request export',()=>{
 const src=readFileSync(new URL('../staging-request-plan.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(src,/\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b/);
 assert.doesNotMatch(src,/from\s+['"](?:node:)?(?:https?|net|tls|undici|@supabase)/);
 assert.doesNotMatch(src,/export\s+function\s+(?:request|send|transport)\b/);
});
test('direct CLI execution is inert with an approval-like env flag',()=>{
 const target=new URL('../staging-request-plan.mjs',import.meta.url);
 const child=spawnSync(process.execPath,[target.pathname],{
  encoding:'utf8',env:{...process.env,DAWNEY_ALLOW_SYNTHETIC_WRITES:'YES'}
 });
 assert.equal(child.status,3);
 assert.equal(child.stderr.trim(),
  'HOSTED_ACCEPTANCE_BLOCKED:staging_plan_no_network_sender');
 assert.equal(child.stdout,'');
});

test('P2-01 JSON snapshot excludes mutations and added unapproved fields after validation',()=>{
 const data=booking();
 const request=req('ownerA','POST','/rest/v1/rpc/request_service_appointment',data,
  {'Content-Type':'application/json'});
 const p=plan(request);
 const original=JSON.stringify(data);
 const expectedHash=createHash('sha256').update(original).digest('hex');
 assert.equal(p.bodyEncoding,'json-utf8');
 assert.equal(p.bodySha256,expectedHash);
 data.p_details='REAL_PATIENT_DATA';
 data.p_unreviewed='a forged field';
 request.body.p_concern='medical record';
 const copy=p.body;
 copy.p_details='REAL_PATIENT_DATA';
 copy.p_unreviewed='shadow';
 const good=materializeValidatedStagingBody(p);
 assert.equal(good.p_details,marker);
 assert.equal(good.p_concern,marker);
 assert.deepEqual(Object.keys(good).sort(),Object.keys(booking()).sort());
 assert.equal(JSON.stringify(good),original);
 assert.notStrictEqual(p.body,p.body);
 assert.throws(()=>{p.body={...good,p_unreviewed:'unsafe'};},TypeError);
 assert.throws(()=>{p.bodySha256='0'.repeat(64);},TypeError);
});
test('P2-01 binary PDF snapshot is byte-perfect, defensive and digest-bound',()=>{
 const raw=pdf();
 const expected=Buffer.from(raw);
 const request=req('ownerA','POST','/storage/v1/object/clinical-attachments/'+key,
  raw,{'Content-Type':'application/pdf','x-upsert':'false'});
 const p=plan(request);
 assert.equal(p.bodyEncoding,'pdf-bytes');
 assert.equal(p.bodySha256,createHash('sha256').update(expected).digest('hex'));
 raw[0]=0;
 request.body[1]=0;
 const copy=p.body;
 copy[2]=0;
 const verified=materializeValidatedStagingBody(p);
 assert.equal(verified.equals(expected),true);
 assert.equal(p.body.equals(expected),true);
 assert.notStrictEqual(p.body,p.body);
 assert.equal(createHash('sha256').update(verified).digest('hex'),p.bodySha256);
 assert.throws(()=>materializeValidatedStagingBody({...p}),{
  message:'HOSTED_ACCEPTANCE_BLOCKED:unvalidated_request_plan'
 });
 assert.throws(()=>Object.defineProperty(p,'body',{value:raw}),TypeError);
});
test('P2-02 caller cannot revive a validly signed EXPIRED approval with past time',()=>{
 const past=Date.now()-7200000;
 const ctx=approvalFor({notBefore:past-1000,expiresAt:past+60000});
 const r=req('anonymous','GET','/auth/v1/.well-known/jwks.json');
 assert.throws(()=>prepareStagingRequest({...ctx,request:r,now:past}),{
  message:'HOSTED_ACCEPTANCE_BLOCKED:caller_time_forbidden'
 });
 denied(r,'approval_expired',ctx);
});
test('forged owner, invalid signatures and wrong signed source/host are rejected',()=>{
 const r=req('anonymous','GET','/auth/v1/.well-known/jwks.json');
 denied(r,'owner_approval_scope',approvalFor({ownerApproved:false}));
 denied(r,'backend_source_not_approved',approvalFor({backendSourceSha:'a'.repeat(40)}));
 denied(r,'staging_plan_content_not_approved',
  approvalFor({stagingPlanSha256:'b'.repeat(64)}));
 denied(r,'staging_origin_mismatch',approvalFor({origin:'https://not-staging.example.invalid'}));
});
test('inert planner exports no networking credential or trusted post-plan mutation path',()=>{
 const module=readFileSync(new URL('../staging-request-plan.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(module,/\\bfetch\\s*\\(|\\bWebSocket\\b|\\bXMLHttpRequest\\b/);
 assert.doesNotMatch(module,/from\\s+['"](?:node:)?(?:https?|net|tls|undici|@supabase)/);
 const read=plan(req('anonymous','GET','/auth/v1/.well-known/jwks.json'));
 assert.equal(Object.hasOwn(read,'body'),false);
 assert.throws(()=>materializeValidatedStagingBody(read),{
  message:'HOSTED_ACCEPTANCE_BLOCKED:unvalidated_request_plan'
 });
});
