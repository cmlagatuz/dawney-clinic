/**
 * Owner-gated hosted Auth/RLS/Storage acceptance plan.
 * SOURCE ONLY: no fetch, no sockets, no Supabase client, no fallback transport.
 * All I/O must be injected by a SEPARATELY REVIEWED future staging adapter.
 */
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {assertFixtures,ensure,isUuid,sha256,storageKey,verifyOwnerGate,verifySignedJwt} from './guards.mjs';

const roles=['ownerA','ownerB','staff','revoked','anonymousAuth'];
const allowed=(method,path)=>{
 const exact=['/auth/v1/.well-known/jwks.json','/auth/v1/user'];
 if(method==='GET'&&exact.includes(path))return true;
 if(method==='GET'&&/^\/rest\/v1\/(owners|pets|appointments|staff_memberships)\?[-A-Za-z0-9_.%,=&]+$/.test(path))return true;
 if(method==='POST'&&path==='/rest/v1/rpc/request_service_appointment')return true;
 if(method==='PATCH'&&/^\/rest\/v1\/appointments\?id=eq\.[a-f0-9-]{36}$/i.test(path))return true;
 if((method==='POST'&&path.startsWith('/storage/v1/object/clinical-attachments/'))||
    (method==='GET'&&(path.startsWith('/storage/v1/object/authenticated/clinical-attachments/')||
       path.startsWith('/storage/v1/object/public/clinical-attachments/')))){
  const key=path.split('/clinical-attachments/')[1];
  return /^pets\/[a-f0-9-]{36}\/(owners\/[a-f0-9-]{36}|clinic)\/[a-f0-9-]{36}\.(pdf|exe)$/i.test(key);
 }
 return false;
};
const denied=r=>r.status===401||r.status===403;
const denyRead=r=>denied(r)||(r.status===200&&Array.isArray(r.json)&&r.json.length===0);
const requireRows=(r,label)=>{
 ensure(r.status===200&&Array.isArray(r.json),'expected_rows_'+label);
 return r.json;
};
const expectRow=(r,label)=>{
 const rows=requireRows(r,label);
 ensure(rows.length===1,'expected_one_'+label);
 return rows[0];
};
function payloadPdf(runId){
 return Buffer.from('%PDF-1.4\n%DAWNEY_STAGE_'+runId+'\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n','utf8');
}
const storagePath=(key,publicAccess=false)=>'/storage/v1/object/'+
 (publicAccess?'public/':'authenticated/')+'clinical-attachments/'+key;

export async function runHostedAcceptance({
 transport,approval,trust,staging,actors,fixtures,publishableKey,now=Date.now()
}={}){
 // No invocation of an injected transport may occur until every safety gate succeeds.
 ensure(transport&&typeof transport.request==='function','no_transport_injected');
 const gate=verifyOwnerGate({approval,trust,staging,now});
 ensure(typeof publishableKey==='string'&&/^sb_publishable_[A-Za-z0-9_-]{4,}$/.test(publishableKey),
   'publishable_key_only');
 assertFixtures(fixtures);
 ensure(actors&&roles.every(a=>typeof actors[a]==='string'&&actors[a].length>0),
   'signed_test_jwts_required');
 ensure(Date.parse(fixtures.slotA)>now+60000&&Date.parse(fixtures.slotB)>now+60000,
   'expired_staging_slots');

 async function request(actor,method,path,{body,headers={}}={}){
  ensure(allowed(method,path),'unapproved_http_operation');
  const token=actors[actor];
  const req={
   origin:gate.origin,actor,method,path,
   headers:{
    ...headers,
    apikey:publishableKey,
    ...(token?{Authorization:'Bearer '+token}:{})
   },
   ...(body===undefined?{}:{body})
  };
  let response;
  try{response=await transport.request(req);}
  catch{throw new Error('HOSTED_ACCEPTANCE_BLOCKED:transport_error_redacted');}
  ensure(response&&Number.isInteger(response.status)&&response.status>=100&&response.status<=599,
    'invalid_http_response');
  return response;
 }
 // Public JWKS must be fetched from the approved staging project, never user-supplied.
 const jwksReply=await request('anonymous','GET','/auth/v1/.well-known/jwks.json');
 ensure(jwksReply.status===200,'jwks_http_status');
 const jwks=jwksReply.json;
 ensure(jwks&&Array.isArray(jwks.keys),'staging_jwks_missing');
 const subjects=new Map([
  ['ownerA',fixtures.ownerA.userId],['ownerB',fixtures.ownerB.userId],
  ['staff',fixtures.staff.userId],['revoked',fixtures.revoked.userId],
  ['anonymousAuth',fixtures.anonymousAuth.userId]
 ]);
 for(const [actor,sub] of subjects){
  verifySignedJwt(actors[actor],jwks,{origin:gate.origin,expectedSub:sub,
   anonymous:actor==='anonymousAuth',now});
  const authReply=await request(actor,'GET','/auth/v1/user');
  ensure(authReply.status===200,'auth_user_http_status');
  const user=authReply.json;
  ensure(user?.id===sub&&
   (actor==='anonymousAuth'
    ?user.is_anonymous===true
    :Boolean(user.email_confirmed_at)&&user.is_anonymous!==true),
   'trusted_auth_user_mismatch');
 }
 const checked=['staging_gate_and_asymmetric_jwt_verified_against_auth_user'];
 const select=(actor,table,fields,filter)=>request(actor,'GET',
  '/rest/v1/'+table+'?select='+fields+'&'+filter);
 const owners=fixtures.ownerA, other=fixtures.ownerB;
 for(const [name,f] of [['ownerA',owners],['ownerB',other]]){
  const profile=expectRow(await select(name,'owners','id,user_id','user_id=eq.'+f.userId),
   'owner_profile');
  ensure(profile.id===f.ownerId&&profile.user_id===f.userId,'owner_profile_identity');
  const pet=expectRow(await select(name,'pets','id,owner_id','id=eq.'+f.petId),'owner_pet');
  ensure(pet.id===f.petId&&pet.owner_id===f.ownerId,'owner_pet_identity');
 }
 for(const [actor,foreign] of [['ownerA',other],['ownerB',owners]]){
  ensure(denyRead(await select(actor,'owners','id','id=eq.'+foreign.ownerId)),
   'cross_owner_profile_leak');
  ensure(denyRead(await select(actor,'pets','id','id=eq.'+foreign.petId)),
   'cross_owner_pet_leak');
 }
 for(const actor of ['anonymous','anonymousAuth']){
  ensure(denyRead(await select(actor,'owners','id','id=eq.'+owners.ownerId)),
   'anonymous_owner_leak');
  ensure(denyRead(await select(actor,'pets','id','id=eq.'+owners.petId)),
   'anonymous_patient_leak');
 }
 const staff=expectRow(await select('staff','staff_memberships','user_id,role,is_active',
  'user_id=eq.'+fixtures.staff.userId),'staff_membership');
 ensure(staff.is_active===true&&staff.role===fixtures.staff.expectedRole,
  'staff_membership_missing');
 const revoked=expectRow(await select('revoked','staff_memberships','user_id,role,is_active',
  'user_id=eq.'+fixtures.revoked.userId),'revoked_membership');
 ensure(revoked.is_active===false,'revoked_membership_still_active');
 checked.push('two_owners_anonymous_and_active_revoked_staff_rls');

 const marker='DAWNEY_STAGE_'+gate.runId;
 const requestNonceA=randomUUID(),requestNonceB=randomUUID();
 const makeBooking=(f,slot,nonce,concern=marker)=>({
  p_pet_id:f.petId,p_service_id:fixtures.serviceId,p_resource_id:fixtures.resourceId,
  p_starts_at:slot,p_request_nonce:nonce,p_concern:concern,p_details:marker
 });
 const book=(actor,payload)=>request(actor,'POST','/rest/v1/rpc/request_service_appointment',
  {body:payload,headers:{'Content-Type':'application/json'}});
 const bookingA=makeBooking(owners,fixtures.slotA,requestNonceA);
 const resultA=await book('ownerA',bookingA);
 ensure(resultA.status===200&&isUuid(resultA.json),'owner_booking_a_failed');
 const exactRetry=await book('ownerA',bookingA);
 ensure(exactRetry.status===200&&exactRetry.json===resultA.json,'nonce_not_idempotent');
 const altered=await book('ownerA',{...bookingA,p_concern:marker+'_CHANGED'});
 ensure(altered.status===409,'tampered_nonce_not_rejected');
 const wrongPet=await book('ownerB',makeBooking({...other,petId:owners.petId},
   fixtures.slotB,randomUUID()));
 ensure([400,401,403].includes(wrongPet.status),'foreign_pet_booking_allowed');
 const slotConflict=await book('ownerB',makeBooking(other,fixtures.slotA,randomUUID()));
 ensure(slotConflict.status===409&&slotConflict.json?.code==='23P01','slot_conflict_not_enforced');
 const deniedAnonymous=await book('anonymous',makeBooking(owners,fixtures.slotB,randomUUID()));
 ensure(denied(deniedAnonymous),'anonymous_booking_allowed');
 const resultB=await book('ownerB',makeBooking(other,fixtures.slotB,requestNonceB));
 ensure(resultB.status===200&&isUuid(resultB.json)&&resultB.json!==resultA.json,
  'separate_owner_booking_failed');
 for(const [actor,id,f] of [['ownerA',resultA.json,owners],['ownerB',resultB.json,other]]){
  const row=expectRow(await select(actor,'appointments',
   'id,owner_id,pet_id,resource_id,service_id,status,request_nonce','id=eq.'+id),
   'persisted_booking');
  ensure(row.id===id&&row.owner_id===f.ownerId&&row.pet_id===f.petId&&
    row.resource_id===fixtures.resourceId&&row.service_id===fixtures.serviceId&&
    row.status==='requested','booking_persistence_mismatch');
 }
 ensure(denyRead(await select('ownerB','appointments','id','id=eq.'+resultA.json)),
  'cross_owner_appointment_leak');
 for(const actor of ['anonymous','anonymousAuth','revoked']){
  ensure(denyRead(await select(actor,'appointments','id','id=eq.'+resultA.json)),
   'unauthorized_queue_leak');
 }
 for(const id of [resultA.json,resultB.json]){
  const row=expectRow(await select('staff','appointments','id,owner_id,status','id=eq.'+id),
    'staff_queue');
  ensure(row.id===id&&row.status==='requested','staff_queue_missing');
 }
 const forged=await request('ownerA','PATCH','/rest/v1/appointments?id=eq.'+resultA.json,
  {body:{status:'confirmed'},headers:{'Content-Type':'application/json',Prefer:'return=representation'}});
 ensure(denied(forged)||(forged.status===200&&Array.isArray(forged.json)&&forged.json.length===0),
  'owner_forged_confirmation_allowed');
 const unchanged=expectRow(await select('ownerA','appointments','id,status',
  'id=eq.'+resultA.json),'unchanged_status');
 ensure(unchanged.status==='requested','owner_changed_status');
 checked.push('booking_persistence_nonce_conflict_denials_and_staff_queue');

 // Synthetic PDF content only. Do NOT log tokens, IDs, paths or downloaded bytes.
 const pdf=payloadPdf(gate.runId),digest=sha256(pdf);
 const keyA=storageKey(owners.petId,owners.userId,randomUUID());
 const keyB=storageKey(other.petId,other.userId,randomUUID());
 const keyClinic=storageKey(owners.petId,null,randomUUID(),{clinic:true});
 const upload=(actor,key)=>request(actor,'POST','/storage/v1/object/clinical-attachments/'+key,
   {body:pdf,headers:{'Content-Type':'application/pdf','x-upsert':'false'}});
 const download=(actor,key,publicAccess=false)=>request(actor,'GET',storagePath(key,publicAccess));
 for(const [actor,key] of [['ownerA',keyA],['ownerB',keyB],['staff',keyClinic]]){
  const up=await upload(actor,key);
  ensure([200,201].includes(up.status),'authorized_storage_upload_failed');
  const downloaded=await download(actor,key);
  ensure(downloaded.status===200,'authorized_storage_download_failed');
  const bytes=downloaded.bytes;
  ensure(Buffer.isBuffer(bytes)&&bytes.length===pdf.length&&sha256(bytes)===digest,
    'storage_roundtrip_checksum_mismatch');
 }
 for(const [actor,key] of [
  ['ownerA',keyB],['ownerB',keyA],['revoked',keyA],
  ['anonymous',keyA],['anonymousAuth',keyA],['ownerA',keyClinic]
 ]){
  ensure(denied(await download(actor,key)),'private_storage_cross_read_allowed');
 }
 ensure(denied(await download('anonymous',keyA,true)),'public_bucket_access_allowed');
 for(const [actor,key] of [['ownerA',keyClinic],['ownerB',keyA],['revoked',keyClinic]]){
  ensure(denied(await upload(actor,key)),'private_storage_cross_upload_allowed');
 }
 const malformed=storageKey(owners.petId,owners.userId,randomUUID()).replace(/\.pdf$/,'.exe');
 ensure(denied(await upload('ownerA',malformed)),'malformed_storage_extension_allowed');
 for(const key of [keyA,keyB]) {
  const downloaded=await download('staff',key);
  ensure(downloaded.status===200,'staff_storage_read_failed');
  const bytes=downloaded.bytes;
  ensure(Buffer.isBuffer(bytes)&&sha256(bytes)===digest,'staff_storage_read_mismatch');
 }
 checked.push('private_storage_binary_sha256_and_cross_actor_denials');
 return {
  status:'MOCK_OR_APPROVED_TRANSPORT_VERIFIED',
  checks:checked,
  // Hand to the approved staging operator via a secure, NON-LOGGED channel.
  cleanup:{marker,appointmentIds:[resultA.json,resultB.json],objectKeys:[keyA,keyB,keyClinic]}
 };
}

// Running the file itself is permanently inert, irrespective of environment vars.
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 console.error('HOSTED_ACCEPTANCE_BLOCKED:source_only_no_network_adapter');
 process.exitCode=3;
}
