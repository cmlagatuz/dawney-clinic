/** Owner-operated staging-only Supabase HTTP/RLS/Storage verifier.
 * NEVER import credentials into CI, print API bodies or accept production hosts.
 * Execution requires direct invocation plus two separate affirmative guards.
 */
import { randomUUID, createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA = /^[0-9a-f]{64}$/i;
const REF = /^[a-z]{20}$/;
const PROD_REF = 'lgimhirgvresvbsdugac'; // Known Dawney production project; NOT a secret.
const PREFIX = 'DAWNEY_STAGING_';
const required = [
  'URL','PROJECT_REF','PUBLISHABLE_KEY','TEST_A_EMAIL','TEST_A_PASSWORD',
  'TEST_A_USER_ID','TEST_A_OWNER_ID','TEST_A_PET_ID','TEST_A_APPOINTMENT_ID',
  'TEST_A_CLINICAL_RECORD_ID','TEST_A_OBJECT_PATH','TEST_A_OBJECT_SHA256',
  'TEST_B_EMAIL','TEST_B_PASSWORD','TEST_B_USER_ID','TEST_B_OWNER_ID',
  'TEST_B_PET_ID','TEST_B_APPOINTMENT_ID','TEST_B_OBJECT_PATH','TEST_B_OBJECT_SHA256'
];
const configError = () => new Error('Staging preflight refused: check owner-only configuration and fixture inventory');
const assert = (condition, step) => { if (!condition) throw new Error('Staging verification failed: '+step); };
const objectPath = (pet,user) => new RegExp('^pets/'+pet+'/owners/'+user+'/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.(pdf|png|jpe?g)$','i');
const objectPrefix = (pet,user) => `pets/${pet}/owners/${user}/`;

/** Pure validation; runs BEFORE constructing a fetch request or reading secrets into logs. */
export function validateStagingConfig(env) {
  if (env.CI || env.GITHUB_ACTIONS || env.TF_BUILD || env.DAWNEY_ALLOW_PRODUCTION_TESTS) throw configError();
  if (env.DAWNEY_STAGING_RUN !== 'I_APPROVE_STAGING_HTTP_TESTS' ||
      env.DAWNEY_STAGING_FIXTURE_ACK !== 'TWO_VERIFIED_SYNTHETIC_OWNERS_ONLY') throw configError();
  const values = Object.fromEntries(required.map(k=>[k,env[PREFIX+k]]));
  if (required.some(k=>typeof values[k]!=='string' || !values[k].trim())) throw configError();
  if (!REF.test(values.PROJECT_REF) || values.PROJECT_REF===PROD_REF ||
      values.PROJECT_REF===env.DAWNEY_PRODUCTION_PROJECT_REF) throw configError();
  let url;
  try { url = new URL(values.URL); } catch { throw configError(); }
  if (url.protocol!=='https:' || url.username || url.password || url.port ||
      url.hostname!==values.PROJECT_REF+'.supabase.co' || url.pathname!=='/' ||
      url.search || url.hash || values.URL!==url.origin) throw configError();
  if (!values.PUBLISHABLE_KEY.startsWith('sb_publishable_') ||
      /\s/.test(values.PUBLISHABLE_KEY) || values.PUBLISHABLE_KEY.length>400) throw configError();
  const users = {};
  for (const side of ['A','B']) {
    const user = {
      email:values[`TEST_${side}_EMAIL`],password:values[`TEST_${side}_PASSWORD`],
      user:values[`TEST_${side}_USER_ID`],owner:values[`TEST_${side}_OWNER_ID`],
      pet:values[`TEST_${side}_PET_ID`],appointment:values[`TEST_${side}_APPOINTMENT_ID`],
      object:values[`TEST_${side}_OBJECT_PATH`],sha:values[`TEST_${side}_OBJECT_SHA256`]
    };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email) || !user.password ||
        ![user.user,user.owner,user.pet,user.appointment].every(id=>UUID.test(id)) ||
        !SHA.test(user.sha) || !objectPath(user.pet,user.user).test(user.object)) throw configError();
    users[side]=user;
  }
  if (users.A.user===users.B.user || users.A.email.toLowerCase()===users.B.email.toLowerCase() ||
      users.A.owner===users.B.owner || users.A.pet===users.B.pet ||
      users.A.appointment===users.B.appointment || users.A.object===users.B.object) throw configError();
  if (!UUID.test(values.TEST_A_CLINICAL_RECORD_ID)) throw configError();
  const deniedUploads=env.DAWNEY_STAGING_DENIED_UPLOADS==='I_APPROVE_DENIAL_WRITE_PROBES';
  if (env.DAWNEY_STAGING_DENIED_UPLOADS && !deniedUploads) throw configError();
  return {url:url.origin,key:values.PUBLISHABLE_KEY,users,
    clinicalRecord:values.TEST_A_CLINICAL_RECORD_ID,deniedUploads};
}

const MAX_JSON=1024*1024, MAX_STORAGE=5*1024*1024;
/** Injected fetch permits strict offline fake-server testing; no redirects of JWTs. */
async function request(config, fetchImpl, path, {method='GET',token,body,contentType}={}) {
  assert(path.startsWith('/')&&!path.startsWith('//')&&!path.includes('://'),'unsafe path');
  const headers={apikey:config.key,...(token?{Authorization:'Bearer '+token}:{}),
    ...(body===undefined?{}:{'Content-Type':contentType??'application/json'}),
    'Cache-Control':'no-store'};
  let response;
  try {response=await fetchImpl(config.url+path,{method,headers,redirect:'error',
    signal:AbortSignal.timeout(10000),
    ...(body===undefined?{}:{body:typeof body==='string'||body instanceof Uint8Array?body:JSON.stringify(body)})});}
  catch {throw new Error('Staging verification failed: HTTP transport unavailable');}
  if (!Number.isInteger(response?.status) || response.status<100 || response.status>599) throw new Error('Staging verification failed: invalid HTTP result');
  return response;
}
async function smallJson(response) {
  const len=Number(response.headers?.get('content-length')||0);
  assert(!len || len<=MAX_JSON,'response too large');
  const text=await response.text();
  assert(text.length<=MAX_JSON,'response too large');
  try{return JSON.parse(text);} catch {throw new Error('Staging verification failed: malformed JSON response');}
}
const denied = (s) => [401,403,404].includes(s);
async function rows(config, fetchImpl, table, fields, filter, token) {
  const query = new URLSearchParams({select:fields,...filter,limit:'2'});
  const response=await request(config,fetchImpl,'/rest/v1/'+table+'?'+query,{token});
  if(denied(response.status))return {status:response.status,items:[]};
  assert(response.status===200,'unexpected database response');
  const items=await smallJson(response);
  assert(Array.isArray(items),'invalid database response');
  return {status:200,items};
}
async function ownRow(config, fetchImpl, table, fields, filter, token, predicate, tag) {
  const r=await rows(config,fetchImpl,table,fields,filter,token);
  assert(r.status===200 && r.items.length===1 && predicate(r.items[0]),'expected synthetic '+tag+' missing or mismatched');
  return r.items[0];
}
async function noRows(config,fetchImpl,table,filter,token,tag){
  const r=await rows(config,fetchImpl,table,'id',filter,token);
  assert(r.items.length===0,'unauthorized '+tag+' visible');
}
async function signIn(config,fetchImpl,user) {
  const r=await request(config,fetchImpl,'/auth/v1/token?grant_type=password',{
    method:'POST',body:{email:user.email,password:user.password}});
  assert(r.status===200,'pre-provisioned synthetic sign-in failed');
  const session=await smallJson(r);
  assert(typeof session.access_token==='string' && session.access_token.length>20,'missing access token');
  const who=await request(config,fetchImpl,'/auth/v1/user',{token:session.access_token});
  assert(who.status===200,'JWT identity introspection failed');
  const found=await smallJson(who);
  assert(found.id===user.user && found.email?.toLowerCase()===user.email.toLowerCase() &&
    !!found.email_confirmed_at && found.is_anonymous!==true && !found.banned_until,
    'verified synthetic identity does not match owner fixture');
  return session.access_token;
}
async function readFixture(config,fetchImpl,side,token){
  const u=config.users[side];
  await ownRow(config,fetchImpl,'owners','id,user_id',{id:'eq.'+u.owner},token,
    x=>x.id===u.owner&&x.user_id===u.user,'owner '+side);
  await ownRow(config,fetchImpl,'pets','id,owner_id',{id:'eq.'+u.pet},token,
    x=>x.id===u.pet&&x.owner_id===u.owner,'patient '+side);
  const ap=await ownRow(config,fetchImpl,'appointments','id,owner_id,pet_id,status',
    {id:'eq.'+u.appointment},token,
    x=>x.id===u.appointment&&x.owner_id===u.owner&&x.pet_id===u.pet&&
      typeof x.status==='string','appointment '+side);
  return ap;
}
function storagePath(object){return object.split('/').map(encodeURIComponent).join('/');}
async function fileDigest(config,fetchImpl,path,token,tag){
  const r=await request(config,fetchImpl,'/storage/v1/object/authenticated/clinical-attachments/'+storagePath(path),{token});
  assert(r.status===200,tag+' fixture object cannot be downloaded');
  const size=Number(r.headers?.get('content-length')||0);
  assert(!size||size<=MAX_STORAGE,'private object too large');
  const bytes=new Uint8Array(await r.arrayBuffer());
  assert(bytes.byteLength>0&&bytes.byteLength<=MAX_STORAGE,'invalid private object size');
  return createHash('sha256').update(bytes).digest('hex');
}
async function listFiles(config,fetchImpl,prefix,token,tag){
  const r=await request(config,fetchImpl,'/storage/v1/object/list/clinical-attachments',{
    method:'POST',token,body:{prefix,limit:100,offset:0,sortBy:{column:'name',order:'asc'}}});
  if(denied(r.status))return [];
  assert(r.status===200,tag+' Storage list response');
  const items=await smallJson(r);
  assert(Array.isArray(items),'invalid Storage list');
  return items;
}
async function probeStorageDenied(config,fetchImpl,path,token,tag){
  const r=await request(config,fetchImpl,'/storage/v1/object/authenticated/clinical-attachments/'+storagePath(path),{token});
  assert(denied(r.status),tag+' unauthorized file download succeeded');
}
async function probeDeniedUpload(config,fetchImpl,path,token,tag){
  const pdf='%PDF-1.2\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n';
  const r=await request(config,fetchImpl,'/storage/v1/object/clinical-attachments/'+storagePath(path),{
    method:'POST',token,body:pdf,contentType:'application/pdf'});
  assert(denied(r.status),tag+' unauthorized upload unexpectedly succeeded; owner MUST inspect and purge synthetic test objects');
}

/** No database writes or account creation. Denied Storage upload probes are opt-in. */
export async function verifyStaging(config,fetchImpl=fetch){
  const {users:{A,B}}=config;
  const ta=await signIn(config,fetchImpl,A),tb=await signIn(config,fetchImpl,B);
  const beforeA=await readFixture(config,fetchImpl,'A',ta), beforeB=await readFixture(config,fetchImpl,'B',tb);
  await ownRow(config,fetchImpl,'clinical_records','id,pet_id',
    {id:'eq.'+config.clinicalRecord},ta,x=>x.id===config.clinicalRecord&&x.pet_id===A.pet,'clinical record A');
  // Confirm the revoked staff fixture EXISTS and is INACTIVE. A missing row
  // must not masquerade as successful revoked-membership authorization.
  await ownRow(config,fetchImpl,'staff_memberships','user_id,role,is_active',
    {user_id:'eq.'+B.user},tb,x=>x.user_id===B.user && x.is_active===false &&
      ['administrator','veterinarian','receptionist'].includes(x.role),'revoked staff membership B');
  await noRows(config,fetchImpl,'owners',{id:'eq.'+B.owner},ta,'foreign owner');
  await noRows(config,fetchImpl,'owners',{id:'eq.'+A.owner},tb,'foreign owner');
  await noRows(config,fetchImpl,'pets',{id:'eq.'+B.pet},ta,'foreign patient');
  await noRows(config,fetchImpl,'pets',{id:'eq.'+A.pet},tb,'revoked staff foreign patient');
  await noRows(config,fetchImpl,'appointments',{id:'eq.'+B.appointment},ta,'foreign appointment');
  await noRows(config,fetchImpl,'appointments',{id:'eq.'+A.appointment},tb,'revoked staff foreign appointment');
  await noRows(config,fetchImpl,'clinical_records',{id:'eq.'+config.clinicalRecord},tb,'revoked staff foreign clinical record');
  await noRows(config,fetchImpl,'pets',{id:'eq.'+A.pet},undefined,'anonymous patient');
  await noRows(config,fetchImpl,'appointments',{id:'eq.'+A.appointment},undefined,'anonymous appointment');
  await noRows(config,fetchImpl,'owners',{id:'eq.'+A.owner},'malformed-untrusted-jwt','invalid JWT owner');
  assert((await fileDigest(config,fetchImpl,A.object,ta,'A'))===A.sha.toLowerCase(),'A private object bytes differ');
  assert((await fileDigest(config,fetchImpl,B.object,tb,'B'))===B.sha.toLowerCase(),'B private object bytes differ');
  for(const [u,t,side] of [[A,ta,'A'],[B,tb,'B']]){
    const files=await listFiles(config,fetchImpl,objectPrefix(u.pet,u.user),t,side);
    assert(files.some(f=>f.name===u.object.split('/').at(-1)),'own private fixture not listed '+side);
  }
  for(const [u,foreign,side] of [[A,tb,'revoked B'],[B,ta,'A'],[A,undefined,'anonymous']]){
    await probeStorageDenied(config,fetchImpl,u.object,foreign,side);
    const files=await listFiles(config,fetchImpl,objectPrefix(u.pet,u.user),foreign,side);
    assert(files.length===0,side+' cross-account private Storage list leaked');
  }
  await probeStorageDenied(config,fetchImpl,A.object,'malformed-untrusted-jwt','invalid JWT');
  // A new HTTP JWT, not simply the same JS session cache, must see persisted rows.
  const againA=await signIn(config,fetchImpl,A), againB=await signIn(config,fetchImpl,B);
  assert(JSON.stringify(await readFixture(config,fetchImpl,'A',againA))===JSON.stringify(beforeA),
    'A appointment persistence changed across sign-ins');
  assert(JSON.stringify(await readFixture(config,fetchImpl,'B',againB))===JSON.stringify(beforeB),
    'B appointment persistence changed across sign-ins');
  if(config.deniedUploads){
    const badA=objectPrefix(A.pet,A.user)+randomUUID()+'.pdf';
    const badB=objectPrefix(B.pet,B.user)+randomUUID()+'.pdf';
    const clinic='pets/'+A.pet+'/clinic/'+randomUUID()+'.pdf';
    await probeDeniedUpload(config,fetchImpl,badA,tb,'revoked B to A owner path');
    await probeDeniedUpload(config,fetchImpl,badB,ta,'A to B owner path');
    await probeDeniedUpload(config,fetchImpl,clinic,ta,'A to clinic-only path');
    await probeDeniedUpload(config,fetchImpl,badA,undefined,'anonymous to owner path');
  }
  return {stage:'staging-http-verified',checks:'auth,owner,patient,appointment,clinical,revoked-staff,Storage-read-list,persistence',
    deniedUploads:config.deniedUploads?'verified':'not-run-owner-opt-in-required'};
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const config=validateStagingConfig(process.env);
    const result=await verifyStaging(config);
    // Never print host, identifiers, tokens, emails, file paths or API error details.
    process.stdout.write('PASS staging HTTP authorization/persistence; Storage upload denial: '+result.deniedUploads+'\n');
  }catch{
    process.stderr.write('FAIL staging verification; inspect staging configuration and approved synthetic fixtures privately. No credentials or records printed.\n');
    process.exitCode=1;
  }
}
