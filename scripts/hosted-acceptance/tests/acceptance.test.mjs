import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createHash,sign as signBytes,sign as cryptoSign,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,copyFileSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {runHostedAcceptance} from '../acceptance.mjs';
import {BACKEND_SOURCE_SHA,PROTECTED_PROJECT_REF,harnessHashes,verifyOwnerGate,verifySignedJwt,storageKey} from '../guards.mjs';

const now=Date.parse('2026-11-17T12:00:00.000Z');
// Test-process-only deterministic clock: NO exported runner time injection.
// This file is executed by node --test in an isolated worker process.
mock.method(Date,'now',()=>now);
const stagingRef='zzzzzzzzzzzzzzzzzzzz';
const staging={ref:stagingRef,origin:'https://'+stagingRef+'.supabase.co',productionRef:PROTECTED_PROJECT_REF};
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const {privateKey:issuerKey,publicKey:issuerPublic}=generateKeyPairSync('rsa',{modulusLength:2048});
const fingerprint=createHash('sha256').update(publicKey.export({type:'spki',format:'der'})).digest('hex');
const trust={publicKey:publicKey.export({type:'spki',format:'pem'}).toString(),pinnedSha256:fingerprint};
const jwk=issuerPublic.export({format:'jwk'});
const jwks={keys:[{...jwk,use:'sig',alg:'RS256',kid:'synthetic-stage-key'}]};
const uid={
 ownerA:'11111111-1111-4111-8111-111111111111',
 ownerB:'22222222-2222-4222-8222-222222222222',
 staff:'33333333-3333-4333-8333-333333333333',
 revoked:'44444444-4444-4444-8444-444444444444',
 anonymousAuth:'77777777-7777-4777-8777-777777777777'
};
const fixtures={
 ownerA:{userId:uid.ownerA,ownerId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   petId:'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'},
 ownerB:{userId:uid.ownerB,ownerId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   petId:'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'},
 staff:{userId:uid.staff,expectedRole:'veterinarian'},
 revoked:{userId:uid.revoked,expectedRole:'veterinarian'},
 anonymousAuth:{userId:uid.anonymousAuth},
 serviceId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
 resourceId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
 slotA:'2026-12-07T02:00:00.000Z',
 slotB:'2026-12-07T03:00:00.000Z'
};
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const jwt=(name,override={},headerOverrides={})=>{
 const header={alg:'RS256',kid:'synthetic-stage-key',typ:'JWT',...headerOverrides};
 const body={iss:staging.origin+'/auth/v1',aud:'authenticated',role:'authenticated',sub:uid[name],
  iat:Math.floor(now/1000)-60,exp:Math.floor(now/1000)+3600,
  is_anonymous:name==='anonymousAuth',...override};
 const signing=encode(header)+'.'+encode(body);
 return signing+'.'+cryptoSign('RSA-SHA256',Buffer.from(signing),issuerKey).toString('base64url');
};
const actors=Object.fromEntries(Object.keys(uid).map(name=>[name,jwt(name)]));
const claims={
 kind:'dawney-hosted-security-acceptance-v1',ownerApproved:true,allowSyntheticWrites:true,
 environment:'disposable-staging',verifiedSeparateProject:true,
 backendSourceSha:BACKEND_SOURCE_SHA,harnessFiles:harnessHashes(),
 runId:'TEST_20261117',projectRef:stagingRef,origin:staging.origin,
 notBefore:now-60_000,expiresAt:now+600_000
};
const signedApproval=(c=claims)=>({claims:c,signature:signBytes('RSA-SHA256',
 Buffer.from(JSON.stringify(c)),privateKey).toString('base64url')});
const base=()=>({
 transport:{async request(){throw Error('should never be called');}},
 approval:signedApproval({...claims,runId:'TEST_'+randomUUID().replace(/-/g,'').slice(0,20).toUpperCase()}),
 trust,staging,actors,fixtures,journalDir:mkdtempSync(join(tmpdir(),'dawney-journal-')),
 publishableKey:'sb_publishable_synthetic_dummy'
});

function fakeTransport({
 leakOwner=false,corruptDownload=false,allowOverlap=false,throwSecrets=false,
 jwksStatus=200,authStatus=200,ownFileStatus=200,
 acceptExe=false,staffDownloadStatus=200,throwAfterStorageWrite=false,throwAfterBookingWrite=false
}={}){
 const state={calls:[],appointments:[],objects:new Map(),nonce:new Map()};
 const ownerOf={ownerA:fixtures.ownerA,ownerB:fixtures.ownerB};
 function getRows(actor,table,query){
  const parms=new URLSearchParams(query);
  let rows=[];
  if(table==='owners')rows=[fixtures.ownerA,fixtures.ownerB].map(x=>({id:x.ownerId,user_id:x.userId}));
  else if(table==='pets')rows=[fixtures.ownerA,fixtures.ownerB].map(x=>({id:x.petId,owner_id:x.ownerId}));
  else if(table==='staff_memberships')rows=[
    {user_id:uid.staff,role:'veterinarian',is_active:true},
    {user_id:uid.revoked,role:'veterinarian',is_active:false}];
  else if(table==='appointments')rows=state.appointments;
  rows=rows.filter(row=>[...parms.entries()].every(([key,val])=>
    key==='select'||row[key]===val.replace(/^eq\./,'')));
  if(table==='staff_memberships')rows=rows.filter(row=>row.user_id===uid[actor]);
  else if(!leakOwner){
   if(actor==='staff'){}
   else if(ownerOf[actor]&&['owners','pets','appointments'].includes(table)){
    const own=ownerOf[actor];
    rows=rows.filter(row=>table==='owners'?row.user_id===own.userId:row.owner_id===own.ownerId);
   }else rows=[];
  }
  return rows;
 }
 const transport={async request(req){
  state.calls.push({actor:req.actor,method:req.method,path:req.path});
  if(throwSecrets)throw Error('Bearer '+actors.ownerA);
  const {path,method,actor}=req;
  if(path==='/auth/v1/.well-known/jwks.json')return {status:jwksStatus,json:jwks};
  if(path==='/auth/v1/user')return {status:authStatus,json:{
   id:uid[actor],email_confirmed_at:actor==='anonymousAuth'?null:'2026-11-01T00:00:00Z',
   is_anonymous:actor==='anonymousAuth'}};
  if(path.startsWith('/rest/v1/')&&method==='GET'){
   const [table,query]=path.slice('/rest/v1/'.length).split('?');
   if(actor==='anonymous' || actor==='anonymousAuth' || actor==='revoked'){
    if(table==='staff_memberships'&&actor==='revoked')return {status:200,json:getRows(actor,table,query)};
    return {status:200,json:[]};
   }
   return {status:200,json:getRows(actor,table,query)};
  }
  if(path==='/rest/v1/rpc/request_service_appointment'){
   if(!ownerOf[actor])return {status:401,json:{code:'42501'}};
   const f=ownerOf[actor],b=req.body;
   if(b.p_pet_id!==f.petId)return {status:403,json:{code:'42501'}};
   const key=actor+':'+b.p_request_nonce;
   if(state.nonce.has(key)){
    const row=state.nonce.get(key);
    return row.params===JSON.stringify(b)?{status:200,json:row.id}:{status:409,json:{code:'23505'}};
   }
   if(!allowOverlap&&state.appointments.some(x=>x.resource_id===b.p_resource_id&&
     x.starts_at===b.p_starts_at))return {status:409,json:{code:'23P01'}};
   const id=randomUUID();
   state.appointments.push({id,owner_id:f.ownerId,pet_id:f.petId,resource_id:b.p_resource_id,
    service_id:b.p_service_id,starts_at:b.p_starts_at,status:'requested',
    request_nonce:b.p_request_nonce});
   state.nonce.set(key,{id,params:JSON.stringify(b)});
   if(throwAfterBookingWrite)throw Error('synthetic secret in server error');
   return {status:200,json:id};
  }
  if(method==='PATCH'&&path.startsWith('/rest/v1/appointments'))return {status:403,json:{code:'42501'}};
  if(path.startsWith('/storage/v1/object/')){
   if(path.startsWith('/storage/v1/object/public/'))return {status:403};
   const prefix=method==='POST'?'/storage/v1/object/clinical-attachments/':
      '/storage/v1/object/authenticated/clinical-attachments/';
   const key=path.slice(prefix.length);
   const pet=key.split('/')[1],which=key.includes('/clinic/')?'clinic':'owners';
   const writable=(actor==='staff'&&which==='clinic'&&pet===fixtures.ownerA.petId)||
    (ownerOf[actor]&&which==='owners'&&pet===ownerOf[actor].petId&&
      key.includes('/owners/'+ownerOf[actor].userId+'/'));
   const readable=actor==='staff'||writable;
   if(!key.endsWith('.pdf'))return {status:acceptExe?200:403};
   if(method==='POST'){
    if(!writable)return {status:403};
    state.objects.set(key,Buffer.from(req.body));
    if(throwAfterStorageWrite)throw Error('synthetic secret in server error');
    return {status:200,json:{Key:key}};
   }
   if(!readable)return {status:403};
   if(!state.objects.has(key))return {status:404};
   const bytes=Buffer.from(state.objects.get(key));
   if(corruptDownload&&actor==='ownerA')bytes[bytes.length-1]^=1;
   if(actor==='staff')state.staffDownloads=(state.staffDownloads??0)+1;
   return {status:actor==='staff'&&state.staffDownloads>1?staffDownloadStatus:ownFileStatus,bytes};
  }
  throw Error('Unexpected mocked method');
 }};
 return {transport,state};
}

test('direct CLI invocation permanently blocks without any network adapter',()=>{
 const result=spawnSync(process.execPath,['scripts/hosted-acceptance/acceptance.mjs'],
  {encoding:'utf8',env:{...process.env,SUPABASE_URL:staging.origin,
   DAWNEY_ALLOW_SYNTHETIC_WRITES:'YES'}});
 assert.equal(result.status,3);
 assert.match(result.stderr,/source_only_no_network_adapter/);
});
test('no transport is used without a signed owner approval',async()=>{
 const {transport,state}=fakeTransport();
 const input={...base(),transport,approval:null};
 await assert.rejects(runHostedAcceptance(input),/approval_required/);
 assert.equal(state.calls.length,0);
});
test('default and legacy protected project never make a request',async()=>{
 const {transport,state}=fakeTransport();
 await assert.rejects(runHostedAcceptance({...base(),transport,
   staging:{ref:PROTECTED_PROJECT_REF,origin:'https://'+PROTECTED_PROJECT_REF+'.supabase.co',
    productionRef:PROTECTED_PROJECT_REF}}),/staging_not_separate/);
 assert.equal(state.calls.length,0);
});
test('invalid or forged approval, source drift, expiry and trust anchor fail before transport',async()=>{
 const {transport,state}=fakeTransport();
 const cases=[
  {...base(),transport,approval:signedApproval({...claims,backendSourceSha:'0'.repeat(40)})},
  {...base(),transport,approval:signedApproval({...claims,allowSyntheticWrites:false})},
  {...base(),transport,approval:signedApproval({...claims,expiresAt:now-1})},
  {...base(),transport,approval:{...signedApproval(),signature:'forged'}},
  {...base(),transport,trust:{...trust,pinnedSha256:'0'.repeat(64)}},
  {...base(),transport,staging:{...staging,origin:'https://other.example.com'}},
  {...base(),transport,publishableKey:'sb_secret_very_bad'},
  {...base(),transport,fixtures:{...fixtures,slotB:fixtures.slotA}}
 ];
 for(const input of cases)await assert.rejects(runHostedAcceptance(input),/HOSTED_ACCEPTANCE_BLOCKED/);
 assert.equal(state.calls.length,0);
});
test('positive full offline mock proves signed JWT/Auth, RLS, booking, staff and checksum',async()=>{
 const {transport,state}=fakeTransport();
 const savedFetch=globalThis.fetch;
 globalThis.fetch=()=>{throw Error('NETWORK MUST NOT BE CALLED');};
 try{
  const result=await runHostedAcceptance({...base(),transport});
  assert.equal(result.checks.length,4);
  assert.equal(result.cleanup.appointmentIds.length,2);
  assert.equal(result.cleanup.objectKeys.length,3);
  assert.equal(result.cleanup.status,'passed');
  assert.equal(result.cleanup.bookingAttempts.length,7);
  assert.equal(result.cleanup.uploadAttempts.length,7);
  assert.equal(JSON.parse(readFileSync(result.cleanup.journalFile,'utf8')).status,'passed');
  assert.equal(state.appointments.length,2);
  assert.equal(state.objects.size,3);
  assert.ok(state.calls.length>20);
  for(const call of state.calls){
   assert.ok(!JSON.stringify(call).includes(actors.ownerA));
   assert.ok(!JSON.stringify(call).includes('sb_publishable_synthetic_dummy'));
  }
 }finally{globalThis.fetch=savedFetch;}
});
test('JWT signature/issuer/audience/expiration and insecure algorithms fail closed',()=>{
 const input={origin:staging.origin,expectedSub:uid.ownerA,now};
 assert.equal(verifySignedJwt(actors.ownerA,jwks,input).sub,uid.ownerA);
 const invalid=[
  jwt('ownerA',{aud:'other'}),jwt('ownerA',{iss:'https://attacker.invalid/auth/v1'}),
  jwt('ownerA',{exp:Math.floor(now/1000)-1}),jwt('ownerA',{sub:uid.ownerB}),
  jwt('ownerA',{}, {alg:'HS256'}),jwt('ownerA',{is_anonymous:true})
 ];
 for(const token of invalid)assert.throws(()=>verifySignedJwt(token,jwks,input),/HOSTED_ACCEPTANCE_BLOCKED/);
 const tampered=actors.ownerA.slice(0,-5)+'aaaaa';
 assert.throws(()=>verifySignedJwt(tampered,jwks,input),/jwt_signature_invalid/);
});
test('runtime rejects invalid signed JWT before querying owner data',async()=>{
 const {transport,state}=fakeTransport();
 await assert.rejects(runHostedAcceptance({...base(),transport,
  actors:{...actors,ownerA:jwt('ownerA',{aud:'other'})}}),/jwt_identity_invalid/);
 assert.ok(state.calls.every(x=>x.path.includes('/auth/v1/')));
});
test('cross-owner visibility regression fails without disclosing actor data',async()=>{
 const {transport}=fakeTransport({leakOwner:true});
 await assert.rejects(runHostedAcceptance({...base(),transport}),/cross_owner_profile_leak/);
});
test('broken booking conflict exclusion fails acceptance',async()=>{
 const {transport}=fakeTransport({allowOverlap:true});
 await assert.rejects(runHostedAcceptance({...base(),transport}),/slot_conflict_not_enforced/);
});
test('altered private Storage bytes fail SHA-256 roundtrip',async()=>{
 const {transport}=fakeTransport({corruptDownload:true});
 await assert.rejects(runHostedAcceptance({...base(),transport}),/storage_roundtrip_checksum_mismatch/);
});
test('injected transport errors are redacted and cannot expose bearer values',async()=>{
 const {transport}=fakeTransport({throwSecrets:true});
 let failure;
 try{await runHostedAcceptance({...base(),transport});}catch(e){failure=e;}
 assert.ok(failure);
 assert.equal(failure.message,'HOSTED_ACCEPTANCE_BLOCKED:transport_error_redacted');
 assert.ok(!failure.message.includes(actors.ownerA));
});
test('HTTP 500 JWKS/Auth or non-200 private file cannot masquerade as successful verification',async()=>{
 const cases=[
  [{jwksStatus:500},/jwks_http_status/],
  [{authStatus:500},/auth_user_http_status/],
  [{ownFileStatus:206},/authorized_storage_download_failed/]
 ];
 for(const [options,pattern] of cases){
  const {transport}=fakeTransport(options);
  await assert.rejects(runHostedAcceptance({...base(),transport}),pattern);
 }
});
test('path validation rejects PII or malformed object identifiers',()=>{
 assert.throws(()=>storageKey('not-a-pet',uid.ownerA,randomUUID()),/storage_path_uuid/);
});

test('partial failure after .exe acceptance preserves complete private cleanup manifest',async()=>{
 const {transport,state}=fakeTransport({acceptExe:true});
 let failure;
 try{await runHostedAcceptance({...base(),transport});}catch(e){failure=e;}
 assert.match(failure?.message??'',/malformed_storage_extension_allowed/);
 const m=failure.cleanup;
 assert.equal(m.status,'failed');
 assert.equal(m.failureCode,'malformed_storage_extension_allowed');
 assert.equal(m.appointmentIds.length,2);
 assert.equal(m.objectKeys.length,3);
 assert.equal(m.uploadAttempts.at(-1).cleanupEligible,false);
 assert.equal(m.uploadAttempts.at(-1).state,'accepted');
 assert.equal(m.bookingAttempts.length,7);
 assert.equal(state.appointments.length,2);
 assert.equal(state.objects.size,3);
 assert.deepEqual(JSON.parse(readFileSync(m.journalFile,'utf8')),m);
 assert.ok(!JSON.stringify(m).includes(actors.ownerA));
});
test('checksum mismatch preserves partial object key and booking cleanup evidence',async()=>{
 const {transport}=fakeTransport({corruptDownload:true});
 let failure;
 try{await runHostedAcceptance({...base(),transport});}catch(e){failure=e;}
 assert.match(failure?.message??'',/storage_roundtrip_checksum_mismatch/);
 assert.equal(failure.cleanup.appointmentIds.length,2);
 assert.equal(failure.cleanup.objectKeys.length,1);
 assert.equal(failure.cleanup.uploadAttempts[0].state,'accepted');
 assert.equal(JSON.parse(readFileSync(failure.cleanup.journalFile,'utf8')).status,'failed');
});
test('later staff re-read denial retains full cleanup manifest',async()=>{
 const {transport}=fakeTransport({staffDownloadStatus:403});
 let failure;
 try{await runHostedAcceptance({...base(),transport});}catch(e){failure=e;}
 assert.match(failure?.message??'',/staff_storage_read_failed/);
 assert.equal(failure.cleanup.objectKeys.length,3);
 assert.equal(failure.cleanup.appointmentIds.length,2);
});
test('lost booking reply and lost upload reply leave pre-write intent for manual reconciliation',async()=>{
 for(const [options,kind] of [[{throwAfterBookingWrite:true},'booking'],[{throwAfterStorageWrite:true},'upload']]){
  const {transport,state}=fakeTransport(options);
  let failure;
  try{await runHostedAcceptance({...base(),transport});}catch(e){failure=e;}
  assert.equal(failure?.message,'HOSTED_ACCEPTANCE_BLOCKED:transport_error_redacted');
  assert.equal(failure.cleanup.status,'failed');
  if(kind==='booking'){
   assert.equal(state.appointments.length,1);
   assert.equal(failure.cleanup.appointmentIds.length,0);
   assert.equal(failure.cleanup.bookingAttempts[0].state,'outcome_unknown');
   assert.match(failure.cleanup.bookingAttempts[0].nonce,/^[a-f0-9-]{36}$/i);
  }else{
   assert.equal(state.objects.size,1);
   assert.equal(failure.cleanup.objectKeys.length,1);
   assert.equal(failure.cleanup.uploadAttempts[0].state,'outcome_unknown');
  }
  assert.equal(JSON.parse(readFileSync(failure.cleanup.journalFile,'utf8')).status,'failed');
 }
});
test('owner approval is bound to both actual source file digests',async()=>{
 const {transport,state}=fakeTransport();
 const input={...base(),transport};
 const fake=signedApproval({...input.approval.claims,
  harnessFiles:{...harnessHashes(),'acceptance.mjs':'0'.repeat(64)}});
 await assert.rejects(runHostedAcceptance({...input,approval:fake}),/harness_content_not_approved/);
 assert.equal(state.calls.length,0);
 const dir=mkdtempSync(join(tmpdir(),'dawney-hash-regression-'));
 try{
  const guardFile=join(dir,'guards.mjs'),runnerFile=join(dir,'acceptance.mjs');
  copyFileSync('scripts/hosted-acceptance/guards.mjs',guardFile);
  copyFileSync('scripts/hosted-acceptance/acceptance.mjs',runnerFile);
  const candidate=await import(pathToFileURL(guardFile).href);
  assert.deepEqual(candidate.verifyOwnerGate({approval:input.approval,trust,staging,now}),
   {runId:input.approval.claims.runId,origin:staging.origin});
  writeFileSync(runnerFile,readFileSync(runnerFile,'utf8')+'\n// drift after signature\n');
  assert.throws(()=>candidate.verifyOwnerGate({approval:input.approval,trust,staging,now}),
   /harness_content_not_approved/);
  copyFileSync('scripts/hosted-acceptance/acceptance.mjs',runnerFile);
  writeFileSync(guardFile,readFileSync(guardFile,'utf8')+'\n// altered guard bytes\n');
  assert.throws(()=>candidate.verifyOwnerGate({approval:input.approval,trust,staging,now}),
   /harness_content_not_approved/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('private ledger rejects signed approval replay before all transport calls',async()=>{
 const {transport,state}=fakeTransport();
 const input={...base(),transport};
 const first=await runHostedAcceptance(input);
 assert.equal(first.cleanup.status,'passed');
 const count=state.calls.length;
 await assert.rejects(runHostedAcceptance(input),/approval_replay/);
 assert.equal(state.calls.length,count);
});
test('service_role JWT is rejected prior to owner RLS queries',async()=>{
 const {transport,state}=fakeTransport();
 await assert.rejects(runHostedAcceptance({...base(),transport,
  actors:{...actors,ownerA:jwt('ownerA',{role:'service_role'})}}),/jwt_identity_invalid/);
 assert.ok(state.calls.every(call=>call.path.startsWith('/auth/v1/')));
});
test('duplicate, malformed, and broadened JWT audience claims fail closed',()=>{
 const input={origin:staging.origin,expectedSub:uid.ownerA,now};
 for(const aud of [['authenticated','authenticated'],['authenticated','service_role'],[],
  ['service_role'],[null],{},null,1337]){
  assert.throws(()=>verifySignedJwt(jwt('ownerA',{aud}),jwks,input),/jwt_identity_invalid/);
 }
 assert.equal(verifySignedJwt(jwt('ownerA',{aud:['authenticated']}),jwks,input).sub,uid.ownerA);
});
test('malformed JWKS, duplicate kid and private key fields fail closed',()=>{
 const input={origin:staging.origin,expectedSub:uid.ownerA,now};
 for(const invalid of [{keys:null},{keys:[null]}, {keys:[]},
   {keys:[jwks.keys[0],jwks.keys[0]]},
   {keys:[{...jwks.keys[0],d:'secret'}]},
   {keys:[{...jwks.keys[0],alg:'HS256'}]},
   {keys:[{...jwks.keys[0],use:'enc'}]},
   {keys:[{...jwks.keys[0],kty:'oct'}]}]){
  assert.throws(()=>verifySignedJwt(actors.ownerA,invalid,input),
   /HOSTED_ACCEPTANCE_BLOCKED/);
 }
});

test('SOL P2 runner rejects caller-supplied historical time before transport or journal',async()=>{
 const {transport,state}=fakeTransport();
 const expired=signedApproval({...claims,notBefore:now-7200000,expiresAt:now-7140000});
 const input={...base(),transport,approval:expired};
 const historical=now-7199000;
 await assert.rejects(runHostedAcceptance({...input,now:historical}),
  /caller_time_forbidden/);
 await assert.rejects(runHostedAcceptance(input),/approval_expired/);
 assert.equal(state.calls.length,0);
 const {readdirSync}=await import('node:fs');
 assert.deepEqual(readdirSync(input.journalDir),[],'no journal or writes on stale consent');
});
test('SOL P2 owned staging cannot substitute signed origin through getter or Proxy traps',async()=>{
 const {transport,state}=fakeTransport();
 const valid=base();
 const broken={...staging};
 let getterCalls=0;
 Object.defineProperty(broken,'origin',{enumerable:true,get(){
  getterCalls++;
  return getterCalls<3?staging.origin:'https://evil.example.invalid';
 }});
 await assert.rejects(runHostedAcceptance({...valid,staging:broken,transport}),
  /staging_data_only/);
 assert.equal(getterCalls,0);
 const orig=base(),reads={get:0,proto:0,keys:0};
 const malicious=new Proxy(staging,{
  get(){reads.get++;throw Error('proxy getter reached');},
  getPrototypeOf(){reads.proto++;throw Error('proxy proto reached');},
  ownKeys(){reads.keys++;throw Error('proxy keys reached');}
 });
 await assert.rejects(runHostedAcceptance({...orig,staging:malicious,transport}),
  /staging_data_only/);
 assert.deepEqual(reads,{get:0,proto:0,keys:0});
 assert.equal(state.calls.length,0);
});
test('SOL P2 signed, validated origin survives later mutation after journal-before-request',async()=>{
 const {transport,state}=fakeTransport();
 const input={...base(),transport:null,staging:{...staging}};
 const origins=[];
 input.transport={async request(req){
  origins.push(req.origin);
  input.staging.origin='https://evil.example.invalid';
  return transport.request(req);
 }};
 const result=await runHostedAcceptance(input);
 assert.equal(result.cleanup.status,'passed');
 assert.ok(origins.length>20);
 assert.ok(origins.every(origin=>origin===staging.origin));
 assert.equal(result.cleanup.origin,staging.origin);
 assert.equal(state.calls.length,origins.length);
});
test('SOL P2 guard rejects inherited, nonenumerable and extra staging claims',()=>{
 const context=base();
 const root={...staging};
 const invalids=[
  Object.create(root),
  Object.defineProperty({...staging},'origin',{value:staging.origin,enumerable:false}),
  {...staging,unreviewed:'https://evil.example.invalid'}
 ];
 for(const target of invalids)assert.throws(()=>
  verifyOwnerGate({approval:context.approval,trust,staging:target,now}),
  /staging_data_only/);
 const valid=verifyOwnerGate({approval:context.approval,trust,staging,now});
 assert.equal(valid.origin,staging.origin);
});


test('SOL P2 actor credentials reject getters without invoking once and before journal or network',async()=>{
 const {transport,state}=fakeTransport();
 let reads=0;
 const poisoned={...actors};
 Object.defineProperty(poisoned,'ownerA',{enumerable:true,configurable:true,get(){
  reads++;return reads<=3?actors.ownerA:actors.anonymousAuth;
 }});
 const input={...base(),transport,actors:poisoned};
 await assert.rejects(runHostedAcceptance(input),/actor_tokens_data_only/);
 assert.equal(reads,0,'credential getter must never run even during validation');
 assert.deepEqual(state.calls,[]);
 const {readdirSync}=await import('node:fs');
 assert.deepEqual(readdirSync(input.journalDir),[],'no approval journal before actor snapshot');
});

test('SOL P2 actor Proxy rejected before inspecting trap/getter/prototype',async()=>{
 const {transport,state}=fakeTransport();
 const traps={get:0,proto:0,keys:0,descriptor:0};
 const proxy=new Proxy({...actors},{
  get(){traps.get++;throw Error('unexpected actor read');},
  getPrototypeOf(){traps.proto++;throw Error('unexpected proto');},
  ownKeys(){traps.keys++;throw Error('unexpected ownKeys');},
  getOwnPropertyDescriptor(){traps.descriptor++;throw Error('unexpected descriptor');}
 });
 const input={...base(),transport,actors:proxy};
 await assert.rejects(runHostedAcceptance(input),/actor_tokens_data_only/);
 assert.deepEqual(traps,{get:0,proto:0,keys:0,descriptor:0});
 assert.equal(state.calls.length,0);
 const {readdirSync}=await import('node:fs');
 assert.deepEqual(readdirSync(input.journalDir),[]);
});

test('SOL P2 actor credentials reject inherited, extra, hidden, missing, symbol and null tokens',async()=>{
 const {transport,state}=fakeTransport();
 const inherited=Object.assign(Object.create({ownerA:actors.ownerA}),actors);
 delete inherited.ownerA;
 const invalid=[
  inherited,
  Object.assign(Object.create({inherited:true}),actors),
  Object.defineProperty({...actors},'ownerA',{value:actors.ownerA,enumerable:false}),
  Object.defineProperty({...actors},'hidden',{value:actors.ownerA,enumerable:false}),
  {...actors,administrator:actors.staff},
  Object.assign({...actors},{ownerA:null}),
  Object.fromEntries(Object.entries(actors).filter(([key])=>key!=='ownerB')),
  Object.assign(Object.create(null),actors,{ownerB:''}),
  Object.defineProperty({...actors},Symbol('extra'),{value:actors.ownerA,enumerable:true})
 ];
 for(const candidate of invalid){
  await assert.rejects(runHostedAcceptance({...base(),transport,actors:candidate}),
   /actor_tokens_data_only/);
 }
 assert.equal(state.calls.length,0);
});

test('SOL P2 captures immutable token identity despite caller token swaps after JWT verification',async()=>{
 const original={...actors},caller={...actors};
 const {transport,state}=fakeTransport();
 const observed=[];
 const input={...base(),actors:caller};
 input.transport={async request(req){
  const expected=req.actor==='anonymous'?undefined:original[req.actor];
  const actual=req.headers.Authorization;
  assert.equal(actual,expected?'Bearer '+expected:undefined,
   'Authorization bytes must belong to verified actor, not req.actor label alone');
  observed.push({actor:req.actor,path:req.path,hasBearer:typeof actual==='string'});
  // Mutation happens *after* JWKS and ownerA Auth-user verification, before
  // positive and negative owner queries, and again after the positive owner read.
  // The old implementation used these later anonymous/staff tokens as Bearer.
  if(req.actor==='ownerA'&&req.path==='/auth/v1/user'){
   caller.ownerA=original.anonymousAuth;
   caller.ownerB=original.staff;
   caller.staff=original.ownerB;
   caller.revoked=original.ownerA;
   caller.anonymousAuth=original.ownerB;
  }
  if(req.actor==='ownerA'&&req.path.includes('/rest/v1/pets?')){
   caller.ownerA=original.revoked;
  }
  return transport.request(req);
 }};
 const result=await runHostedAcceptance(input);
 assert.equal(result.cleanup.status,'passed');
 assert.ok(observed.some(x=>x.actor==='ownerA'&&x.path.includes('/rest/v1/owners?')));
 assert.ok(observed.some(x=>x.actor==='ownerA'&&x.path.includes('id=eq.'+fixtures.ownerB.ownerId)));
 assert.ok(observed.some(x=>x.actor==='staff'&&x.hasBearer));
 assert.ok(observed.some(x=>x.actor==='revoked'&&x.hasBearer));
 assert.ok(observed.some(x=>x.actor==='anonymousAuth'&&x.hasBearer));
 assert.ok(observed.some(x=>x.actor==='anonymous'&&!x.hasBearer));
 assert.ok(state.calls.length>20);
});

test('SOL P2 rejects JWT identity/expiry/anonymous/revoked role mismatch independently of data-only snapshot',async()=>{
 for(const [role,token,error] of [
  ['ownerA',jwt('ownerB'),/jwt_identity_invalid/],
  ['ownerB',jwt('ownerB',{exp:Math.floor(now/1000)-1}),/jwt_expired_or_not_yet_valid/],
  ['staff',jwt('staff',{role:'service_role'}),/jwt_identity_invalid/],
  ['revoked',jwt('revoked',{is_anonymous:true}),/jwt_anonymity_mismatch/],
  ['anonymousAuth',jwt('anonymousAuth',{is_anonymous:false}),/jwt_anonymity_mismatch/]
 ]){
  const {transport,state}=fakeTransport();
  await assert.rejects(runHostedAcceptance({...base(),transport,
   actors:{...actors,[role]:token}}),error);
  assert.ok(state.calls.every(call=>call.path.startsWith('/auth/v1/')));
 }
});


test('SOL P2 fifth-read owner identity substitution is rejected before first getter, journal or request',async()=>{
 const original=structuredClone(fixtures);
 const malicious=structuredClone(original);
 const reads={ownerA:{ownerId:0,petId:0},ownerB:{ownerId:0,petId:0}};
 for(const owner of ['ownerA','ownerB']){
  for(const key of ['ownerId','petId']){
   Object.defineProperty(malicious[owner],key,{enumerable:true,configurable:true,get(){
    const n=++reads[owner][key];
    return n<=4?original[owner][key]:
      owner==='ownerA'?'99999999-9999-4999-8999-999999999999':
        '88888888-8888-4888-8888-888888888888';
   }});
  }
 }
 const {transport,state}=fakeTransport({leakOwner:true});
 const input={...base(),fixtures:malicious,transport};
 const {readdirSync}=await import('node:fs');
 await assert.rejects(runHostedAcceptance(input),/fixture_data_only/);
 assert.deepEqual(reads,{ownerA:{ownerId:0,petId:0},ownerB:{ownerId:0,petId:0}});
 assert.equal(state.calls.length,0,'no request can be authorized by fifth-read identity');
 assert.deepEqual(readdirSync(input.journalDir),[],'no replay/journal before fixture validation');
});

test('SOL P2 every nested Proxy and root Proxy rejected without ANY trap execution',async()=>{
 const {transport,state}=fakeTransport();
 const trap=()=>{
  const calls={get:0,getPrototypeOf:0,ownKeys:0,getOwnPropertyDescriptor:0};
  const proxy=new Proxy({...fixtures.ownerA},{
   get(){calls.get++;throw Error('unsafe nested get');},
   getPrototypeOf(){calls.getPrototypeOf++;throw Error('unsafe nested prototype');},
   ownKeys(){calls.ownKeys++;throw Error('unsafe nested keys');},
   getOwnPropertyDescriptor(){calls.getOwnPropertyDescriptor++;throw Error('unsafe nested descriptor');}
  });
  return {proxy,calls};
 };
 for(const field of ['root','ownerA','ownerB','staff','revoked','anonymousAuth']){
  const {proxy,calls}=trap();
  const input={...base(),transport,
   fixtures:field==='root'?new Proxy(structuredClone(fixtures),{
    get(){calls.get++;throw Error('unsafe root get');},
    getPrototypeOf(){calls.getPrototypeOf++;throw Error('unsafe root prototype');},
    ownKeys(){calls.ownKeys++;throw Error('unsafe root keys');},
    getOwnPropertyDescriptor(){calls.getOwnPropertyDescriptor++;throw Error('unsafe root descriptor');}
   }):{...fixtures,[field]:proxy}};
  await assert.rejects(runHostedAcceptance(input),/fixture_data_only/);
  assert.deepEqual(calls,{get:0,getPrototypeOf:0,ownKeys:0,getOwnPropertyDescriptor:0});
  assert.equal(state.calls.length,0);
  const {readdirSync}=await import('node:fs');
  assert.deepEqual(readdirSync(input.journalDir),[]);
 }
});

test('SOL P2 strict fixture schema blocks hidden, inherited, symbol, extra, missing and exotic fields',async()=>{
 const {transport,state}=fakeTransport();
 const original=structuredClone(fixtures);
 const bad=[
  Object.assign(Object.create({unknown:'inherited'}),original),
  Object.assign(Object.create(null),original,{unexpected:'extra'}),
  Object.defineProperty({...original},'hidden',{value:uid.ownerA,enumerable:false}),
  Object.defineProperty({...original},Symbol('stray'),{value:uid.ownerA,enumerable:true}),
  Object.fromEntries(Object.entries(original).filter(([name])=>name!=='slotB')),
  {...original,ownerA:Object.assign(Object.create({userId:uid.ownerA}),
     {ownerId:original.ownerA.ownerId,petId:original.ownerA.petId})},
  {...original,ownerB:Object.defineProperty({...original.ownerB},'petId',
     {value:original.ownerB.petId,enumerable:false})},
  {...original,staff:{...original.staff,unexpectedRole:'administrator'}},
  {...original,revoked:{...original.revoked,expectedRole:'receptionist'}},
  {...original,anonymousAuth:{...original.anonymousAuth,hidden:'owner'}},
  {...original,serviceId:original.ownerA.ownerId},
  {...original,resourceId:original.ownerB.petId},
  {...original,ownerA:{...original.ownerA,petId:original.ownerB.petId}},
  {...original,ownerB:{...original.ownerB,ownerId:original.ownerA.ownerId}},
  {...original,slotA:'2026-12-07T02:00:00+01:00'},
  {...original,slotA:'invalid-date'},
  {...original,slotB:original.slotA}
 ];
 for(const fixturesCandidate of bad){
  const input={...base(),transport,fixtures:fixturesCandidate};
  await assert.rejects(runHostedAcceptance(input),/HOSTED_ACCEPTANCE_BLOCKED/);
  const {readdirSync}=await import('node:fs');
  assert.deepEqual(readdirSync(input.journalDir),[]);
 }
 assert.equal(state.calls.length,0);
});

test('SOL P2 caller fixture changes after authorization never redirect tests, booking or storage',async()=>{
 const owned=structuredClone(fixtures),caller=structuredClone(fixtures);
 const {transport,state}=fakeTransport();
 const observed=[];
 let mutated=false;
 const input={...base(),fixtures:caller};
 input.transport={async request(req){
  // This callback occurs AFTER the first JWKS request is authorized. The
  // original caller objects are modified repeatedly during successful checks.
  if(req.path==='/auth/v1/user'&&req.actor==='ownerA'){
   mutated=true;
   caller.ownerA.userId=uid.ownerB;caller.ownerA.ownerId='99999999-9999-4999-8999-999999999999';
   caller.ownerA.petId='99999999-1111-4111-8111-999999999999';
   caller.ownerB.userId=uid.ownerA;caller.ownerB.ownerId='88888888-8888-4888-8888-888888888888';
   caller.ownerB.petId='88888888-2222-4222-8222-888888888888';
   caller.staff.userId=uid.revoked;caller.staff.expectedRole='administrator';
   caller.revoked.userId=uid.staff;caller.revoked.expectedRole='administrator';
   caller.anonymousAuth.userId=uid.staff;
   caller.serviceId=uid.ownerA;caller.resourceId=uid.ownerB;
   caller.slotA='2030-01-01T02:00:00.000Z';caller.slotB='2031-01-01T03:00:00.000Z';
  }
  observed.push({actor:req.actor,path:req.path,body:req.body});
  return transport.request(req);
 }};
 const result=await runHostedAcceptance(input);
 assert.equal(result.cleanup.status,'passed');
 assert.equal(mutated,true);
 const has=(actor,table,column,id)=>observed.some(x=>x.actor===actor&&
  x.path.includes('/rest/v1/'+table+'?')&&x.path.includes(column+'=eq.'+id));
 // Both the owner positives and the owner negatives must probe existing
 // fixture rows — never the substituted nonexistent UUIDs.
 for(const [actor,foreign] of [['ownerA',owned.ownerB],['ownerB',owned.ownerA]]){
  assert.ok(has(actor,'owners','id',foreign.ownerId));
  assert.ok(has(actor,'pets','id',foreign.petId));
 }
 for(const [actor,own] of [['ownerA',owned.ownerA],['ownerB',owned.ownerB]]){
  assert.ok(has(actor,'owners','user_id',own.userId));
  assert.ok(has(actor,'pets','id',own.petId));
  assert.ok(observed.some(x=>x.actor===actor&&
   x.path==='/rest/v1/rpc/request_service_appointment'&&
   x.body.p_pet_id===own.petId&&x.body.p_service_id===owned.serviceId&&
   x.body.p_resource_id===owned.resourceId&&
   x.body.p_starts_at===(actor==='ownerA'?owned.slotA:owned.slotB)));
  assert.ok(result.cleanup.objectKeys.some(k=>
   k.startsWith('pets/'+own.petId+'/owners/'+own.userId+'/')));
 }
 assert.ok(has('staff','staff_memberships','user_id',owned.staff.userId));
 assert.ok(has('revoked','staff_memberships','user_id',owned.revoked.userId));
 assert.ok(result.cleanup.objectKeys.some(k=>
  k.startsWith('pets/'+owned.ownerA.petId+'/clinic/')));
 assert.equal(state.appointments.length,2);
});

test('SOL P2 cross-owner leaked existing synthetic rows cannot hide behind post-validation mutation',async()=>{
 const caller=structuredClone(fixtures);
 const original=structuredClone(caller);
 const {transport,state}=fakeTransport({leakOwner:true});
 const paths=[];
 const input={...base(),fixtures:caller};
 input.transport={async request(req){
  paths.push(req.path);
  // After legitimate owner positive reads, change both foreign IDs to missing
  // UUIDs. Correct source still checks existing ownerB under ownerA bearer.
  if(req.path.includes('/rest/v1/pets?')&&req.actor==='ownerB'){
   caller.ownerB.ownerId='88888888-8888-4888-8888-888888888888';
   caller.ownerB.petId='88888888-1111-4111-8111-888888888888';
   caller.ownerA.ownerId='99999999-9999-4999-8999-999999999999';
   caller.ownerA.petId='99999999-1111-4111-8111-999999999999';
  }
  return transport.request(req);
 }};
 await assert.rejects(runHostedAcceptance(input),/cross_owner_profile_leak/);
 assert.ok(paths.some(p=>p.includes('id=eq.'+original.ownerB.ownerId)));
 assert.ok(!paths.some(p=>p.includes('id=eq.'+caller.ownerB.ownerId)));
 assert.ok(state.calls.some(c=>c.actor==='ownerA'&&c.path.includes(
  'id=eq.'+original.ownerB.ownerId)));
 assert.equal(state.appointments.length,0,'failed RLS gate must precede booking writes');
});
