/**
 * OFFLINE staging request-plan adapter. It has no network sender, request() method,
 * SDK import, CLI entry point, hosted I/O or provider credentials.
 *
 * A later owner-approved transport must be injected into runHostedAcceptance(),
 * never called as a standalone bypass of its pre-request durable journal.
 */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {ensure,sha256,isUuid,verifyOwnerGate} from './guards.mjs';

export const STAGING_REF='gxklkkoffpkdcxbqjlav';
export const STAGING_ORIGIN='https://'+STAGING_REF+'.supabase.co';
const actors=new Set(['ownerA','ownerB','staff','revoked','anonymous','anonymousAuth']);
const headersAllowed=new Set(['apikey','Authorization','Content-Type','Prefer','x-upsert']);
const uuidPart='[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
const objectPath=new RegExp('^/storage/v1/object/(authenticated/|public/)?clinical-attachments/pets/'+
 uuidPart+'/(owners/'+uuidPart+'|clinic)/'+uuidPart+'\\.(pdf|exe)$','i');
const rowsPath=new RegExp('^/rest/v1/(owners|pets|appointments|staff_memberships)\\?'+
 'select=[a-z_]+(?:,[a-z_]+)*&(id|user_id)=eq\\.('+uuidPart+')$','i');
const bookingPath='/rest/v1/rpc/request_service_appointment';
const patchPath=new RegExp('^/rest/v1/appointments\\?id=eq\\.'+uuidPart+'$','i');
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&!Buffer.isBuffer(v);
const exactKeys=(value,keys)=>plain(value)&&Object.keys(value).length===keys.length&&
 Object.keys(value).every(k=>keys.includes(k));

/**
 * Signed claims must include stagingPlanSha256 for these exact file bytes.
 * This ADDITIVE attestation leaves Grok-reviewed PR #68 guard/harness unchanged.
 */
export function stagingPlanSha256(){
 try{return sha256(readFileSync(new URL('./staging-request-plan.mjs',import.meta.url)));}
 catch{throw Error('HOSTED_ACCEPTANCE_BLOCKED:staging_plan_unreadable');}
}

function checkRequest(req,runId){
 ensure(plain(req)&&req.origin===STAGING_ORIGIN,'request_origin_mismatch');
 ensure(actors.has(req.actor),'unknown_actor');
 ensure(typeof req.method==='string'&&['GET','POST','PATCH'].includes(req.method),'method_not_allowed');
 ensure(typeof req.path==='string'&&req.path.length<1024&&req.path.startsWith('/')&&
  !/[%#@\\]/.test(req.path),'noncanonical_request_path');
 // Raw method/path allowlist matches the reviewed harness's operations, with narrower,
 // canonical query syntax and no normalized/encoded path ambiguity.
 let kind;
 if(req.method==='GET'&&req.path==='/auth/v1/.well-known/jwks.json'){
  ensure(req.actor==='anonymous','jwks_actor');
  kind='json';
 }else if(req.method==='GET'&&req.path==='/auth/v1/user'){
  ensure(req.actor!=='anonymous','user_endpoint_requires_actor');
  kind='json';
 }else if(req.method==='GET'&&rowsPath.test(req.path)){
  kind='json';
 }else if(req.method==='POST'&&req.path===bookingPath){
  ensure(['ownerA','ownerB','anonymous'].includes(req.actor),'booking_actor_not_in_plan');
  kind='json';
 }else if(req.method==='PATCH'&&patchPath.test(req.path)){
  ensure(req.actor==='ownerA','forged_status_actor');
  kind='json';
 }else if(objectPath.test(req.path)){
  const isWrite=req.path.startsWith('/storage/v1/object/clinical-attachments/');
  if(req.method==='POST'&&isWrite){
   ensure(['ownerA','ownerB','staff','revoked'].includes(req.actor),'upload_actor_not_in_plan');
   kind='json';
  }else if(req.method==='GET'&&!isWrite){
   kind='bytes';
  }else ensure(false,'method_path_not_allowed');
 }else ensure(false,'method_path_not_allowed');

 const h=req.headers;
 ensure(plain(h)&&Object.keys(h).every(k=>headersAllowed.has(k)&&
  typeof h[k]==='string'&&h[k].length>0&&h[k].length<32768&&
  !/[\r\n]/.test(h[k])),'unapproved_http_header');
 ensure(/^sb_publishable_[A-Za-z0-9_-]{4,}$/.test(h.apikey??''),'publishable_key_only');
 if(req.actor==='anonymous')ensure(!Object.hasOwn(h,'Authorization'),'anonymous_token_forbidden');
 else ensure(/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(
  h.Authorization??''),'bearer_token_required');

 if(req.method==='GET'){
  ensure(!Object.hasOwn(req,'body')&&
   !Object.hasOwn(h,'Content-Type')&&!Object.hasOwn(h,'Prefer')&&
   !Object.hasOwn(h,'x-upsert'),'unexpected_get_payload');
 }else if(req.method==='POST'&&req.path===bookingPath){
  ensure(h['Content-Type']==='application/json'&&
   !Object.hasOwn(h,'Prefer')&&!Object.hasOwn(h,'x-upsert'),'booking_headers');
  const b=req.body;
  const fields=['p_pet_id','p_service_id','p_resource_id','p_starts_at',
   'p_request_nonce','p_concern','p_details'];
  ensure(exactKeys(b,fields),'booking_payload_shape');
  for(const k of ['p_pet_id','p_service_id','p_resource_id','p_request_nonce'])
   ensure(isUuid(b[k]),'booking_uuid_invalid');
  const marker='DAWNEY_STAGE_'+runId;
  ensure(typeof b.p_starts_at==='string'&&
   /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(b.p_starts_at)&&
   Number.isFinite(Date.parse(b.p_starts_at))&&
   b.p_details===marker&&
   (b.p_concern===marker||b.p_concern===marker+'_CHANGED'),
   'booking_not_synthetic');
 }else if(req.method==='PATCH'){
  ensure(h['Content-Type']==='application/json'&&h.Prefer==='return=representation'&&
   !Object.hasOwn(h,'x-upsert')&&exactKeys(req.body,['status'])&&
   req.body.status==='confirmed','forged_confirmation_shape');
 }else if(req.method==='POST'){
  ensure(h['Content-Type']==='application/pdf'&&h['x-upsert']==='false'&&
   !Object.hasOwn(h,'Prefer')&&Buffer.isBuffer(req.body)&&
   req.body.length>0&&req.body.length<=131072&&
   req.body.subarray(0,('%PDF-1.4\n%DAWNEY_STAGE_'+runId).length)
    .equals(Buffer.from('%PDF-1.4\n%DAWNEY_STAGE_'+runId)),
   'synthetic_pdf_only');
 }
 return kind;
}

/**
 * Builds an inert canonical request description. This function NEVER SENDS.
 * The call is not a standalone execution path: real HTTP must be wired into the
 * original, signed, journal-first acceptance runner in a future separate approval.
 */
// The only authoritative body is a PRIVATE immutable copy of validated bytes.
// Never expose the original Buffer or a mutable JSON object as canonical state.
// Each read yields a fresh copy; a future journal-bound sender MUST call
// materializeValidatedStagingBody() at the actual outbound consumption boundary.
const validatedBodies=new WeakMap();
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export function materializeValidatedStagingBody(plan){
 const canonical=validatedBodies.get(plan);
 ensure(canonical!==undefined,'unvalidated_request_plan');
 ensure(plan.bodySha256===canonical.sha256&&plan.bodyEncoding===canonical.encoding&&
  digest(Buffer.from(canonical.base64,'base64'))===canonical.sha256,
  'staging_body_integrity');
 const copy=Buffer.from(canonical.base64,'base64');
 if(canonical.encoding==='json-utf8'){
  try{return JSON.parse(copy.toString('utf8'));}
  catch{throw Error('HOSTED_ACCEPTANCE_BLOCKED:staging_body_integrity');}
 }
 return copy;
}
/**
 * OFFLINE only, never sends. Clock is ALWAYS internally sourced.
 * A future sender must consume materializeValidatedStagingBody(plan) ONLY from
 * the existing journal-first runHostedAcceptance boundary. Never trust a
 * caller's previous .body copy or editable arbitrary descriptor.
 */
export function prepareStagingRequest(options={}){
 ensure(plain(options)&&!Object.hasOwn(options,'now'),
  'caller_time_forbidden');
 const {request,approval,trust,staging}=options;
 const gate=verifyOwnerGate({approval,trust,staging,now:Date.now()});
 ensure(staging.ref===STAGING_REF&&gate.origin===STAGING_ORIGIN&&
  staging.productionRef==='lgimhirgvresvbsdugac','adapter_staging_only');
 ensure(approval.claims.stagingPlanSha256===stagingPlanSha256(),
  'staging_plan_content_not_approved');
 const kind=checkRequest(request,gate.runId);
 const hasBody=Object.hasOwn(request,'body');
 // JSON bytes are serialized from exact-key validated fields, so no extra
 // field can enter the snapshot; PDF bytes are copied, never shared.
 const bytes=hasBody?(Buffer.isBuffer(request.body)?
  Buffer.from(request.body):Buffer.from(JSON.stringify(request.body),'utf8')):null;
 const canonical=hasBody?Object.freeze({
  encoding:Buffer.isBuffer(request.body)?'pdf-bytes':'json-utf8',
  base64:bytes.toString('base64'),sha256:digest(bytes)
 }):null;
 const descriptor={
  origin:STAGING_ORIGIN,url:STAGING_ORIGIN+request.path,method:request.method,
  responseKind:kind,redirectPolicy:'error',credentialsPolicy:'omit',
  headers:Object.freeze({...request.headers})
 };
 if(canonical){
  Object.defineProperties(descriptor,{
   bodySha256:{value:canonical.sha256,enumerable:true},
   bodyEncoding:{value:canonical.encoding,enumerable:true},
   body:{enumerable:true,get(){return materializeValidatedStagingBody(descriptor);}}
  });
 }
 const plan=Object.freeze(descriptor);
 if(canonical)validatedBodies.set(plan,canonical);
 return plan;
}

// Direct execution is permanently inert, regardless of environment variables.
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 console.error('HOSTED_ACCEPTANCE_BLOCKED:staging_plan_no_network_sender');
 process.exitCode=3;
}
