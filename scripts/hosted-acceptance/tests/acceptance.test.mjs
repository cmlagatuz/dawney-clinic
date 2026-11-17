import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createHash,sign as signBytes,sign as cryptoSign,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {runHostedAcceptance} from '../acceptance.mjs';
import {REVIEWED_SOURCE_SHA,PROTECTED_PROJECT_REF,verifySignedJwt,storageKey} from '../guards.mjs';

const now=Date.parse('2026-11-17T12:00:00.000Z');
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
 sourceSha:REVIEWED_SOURCE_SHA,runId:'TEST_20261117',projectRef:stagingRef,origin:staging.origin,
 notBefore:now-60_000,expiresAt:now+600_000
};
const signedApproval=(c=claims)=>({claims:c,signature:signBytes('RSA-SHA256',
 Buffer.from(JSON.stringify(c)),privateKey).toString('base64url')});
const base=()=>({
 transport:{async request(){throw Error('should never be called');}},
 approval:signedApproval(),trust,staging,actors,fixtures,
 publishableKey:'sb_publishable_synthetic_dummy',now
});

function fakeTransport({leakOwner=false,corruptDownload=false,allowOverlap=false,throwSecrets=false}={}){
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
  if(path==='/auth/v1/.well-known/jwks.json')return {status:200,json:jwks};
  if(path==='/auth/v1/user')return {status:200,json:{
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
   if(!key.endsWith('.pdf'))return {status:403};
   if(method==='POST'){
    if(!writable)return {status:403};
    state.objects.set(key,Buffer.from(req.body));
    return {status:200,json:{Key:key}};
   }
   if(!readable)return {status:403};
   if(!state.objects.has(key))return {status:404};
   const bytes=Buffer.from(state.objects.get(key));
   if(corruptDownload&&actor==='ownerA')bytes[bytes.length-1]^=1;
   return {status:200,bytes};
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
  {...base(),transport,approval:signedApproval({...claims,sourceSha:'0'.repeat(40)})},
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
test('path validation rejects PII or malformed object identifiers',()=>{
 assert.throws(()=>storageKey('not-a-pet',uid.ownerA,randomUUID()),/storage_path_uuid/);
});
