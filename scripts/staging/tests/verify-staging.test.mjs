import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateStagingConfig,verifyStaging} from '../verify-staging.mjs';

const id={a:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',b:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  oa:'11111111-1111-4111-8111-111111111111',ob:'22222222-2222-4222-8222-222222222222',
  pa:'33333333-3333-4333-8333-333333333333',pb:'44444444-4444-4444-8444-444444444444',
  aa:'55555555-5555-4555-8555-555555555555',ab:'66666666-6666-4666-8666-666666666666',
  ca:'77777777-7777-4777-8777-777777777777'};
const oa=`pets/${id.pa}/owners/${id.a}/88888888-8888-4888-8888-888888888888.pdf`;
const ob=`pets/${id.pb}/owners/${id.b}/99999999-9999-4999-8999-999999999999.pdf`;
const contentA=Buffer.from('CI-ONLY-BINARY-A'),contentB=Buffer.from('CI-ONLY-BINARY-B');
const sha=data=>createHash('sha256').update(data).digest('hex');
const env={
 DAWNEY_STAGING_RUN:'I_APPROVE_STAGING_HTTP_TESTS',
 DAWNEY_STAGING_FIXTURE_ACK:'TWO_VERIFIED_SYNTHETIC_OWNERS_ONLY',
 DAWNEY_STAGING_URL:'https://abcdefghijklmnopqrst.supabase.co',
 DAWNEY_STAGING_PROJECT_REF:'abcdefghijklmnopqrst',
 DAWNEY_STAGING_PUBLISHABLE_KEY:'sb_publishable_example_not_secret',
 DAWNEY_STAGING_TEST_A_EMAIL:'synthetic-A@example.invalid',DAWNEY_STAGING_TEST_A_PASSWORD:'dummy-pass-A',
 DAWNEY_STAGING_TEST_A_USER_ID:id.a,DAWNEY_STAGING_TEST_A_OWNER_ID:id.oa,
 DAWNEY_STAGING_TEST_A_PET_ID:id.pa,DAWNEY_STAGING_TEST_A_APPOINTMENT_ID:id.aa,
 DAWNEY_STAGING_TEST_A_CLINICAL_RECORD_ID:id.ca,
 DAWNEY_STAGING_TEST_A_OBJECT_PATH:oa,DAWNEY_STAGING_TEST_A_OBJECT_SHA256:sha(contentA),
 DAWNEY_STAGING_TEST_B_EMAIL:'synthetic-B@example.invalid',DAWNEY_STAGING_TEST_B_PASSWORD:'dummy-pass-B',
 DAWNEY_STAGING_TEST_B_USER_ID:id.b,DAWNEY_STAGING_TEST_B_OWNER_ID:id.ob,
 DAWNEY_STAGING_TEST_B_PET_ID:id.pb,DAWNEY_STAGING_TEST_B_APPOINTMENT_ID:id.ab,
 DAWNEY_STAGING_TEST_B_OBJECT_PATH:ob,DAWNEY_STAGING_TEST_B_OBJECT_SHA256:sha(contentB)
};
const fail=(overrides)=>assert.throws(()=>validateStagingConfig({...env,...overrides}),/Staging preflight refused/);

test('strict opt-in, pinned exact staging ref, no CI or production',()=>{
 const c=validateStagingConfig(env);
 assert.equal(c.url,'https://abcdefghijklmnopqrst.supabase.co');
 assert.equal(c.deniedUploads,false);
 fail({DAWNEY_STAGING_RUN:''});fail({DAWNEY_STAGING_FIXTURE_ACK:''});
 fail({GITHUB_ACTIONS:'true'});fail({CI:'1'});fail({TF_BUILD:'1'});
 fail({DAWNEY_ALLOW_PRODUCTION_TESTS:'false'});
 fail({DAWNEY_STAGING_URL:'https://lgimhirgvresvbsdugac.supabase.co',DAWNEY_STAGING_PROJECT_REF:'lgimhirgvresvbsdugac'});
 fail({DAWNEY_PRODUCTION_PROJECT_REF:'abcdefghijklmnopqrst'});
 fail({DAWNEY_STAGING_URL:'https://evil.example/'});
 fail({DAWNEY_STAGING_URL:'https://abcdefghijklmnopqrst.supabase.co/other'});
 fail({DAWNEY_STAGING_URL:'https://abcdefghijklmnopqrst.supabase.co.evil.example'});
 fail({DAWNEY_STAGING_URL:'http://abcdefghijklmnopqrst.supabase.co'});
 fail({DAWNEY_STAGING_URL:'https://user:password@abcdefghijklmnopqrst.supabase.co'});
 fail({DAWNEY_STAGING_PUBLISHABLE_KEY:'service_role_key'});
 fail({DAWNEY_STAGING_TEST_B_USER_ID:id.a});
 fail({DAWNEY_STAGING_TEST_A_OBJECT_PATH:'pets/foo/owners/bar/bad.pdf'});
 fail({DAWNEY_STAGING_TEST_A_OBJECT_SHA256:'invalid'});
 fail({DAWNEY_STAGING_TEST_A_EMAIL:''});
 fail({DAWNEY_STAGING_DENIED_UPLOADS:'YES'});
 assert.equal(validateStagingConfig({...env,DAWNEY_STAGING_DENIED_UPLOADS:'I_APPROVE_DENIAL_WRITE_PROBES'}).deniedUploads,true);
});

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
function mockServer({leak=false,activeRevoked=false,badBytes=false,allowUploads=false}={}){
 const requests=[];
 const authFor=options=>{
  const auth=options.headers?.Authorization;
  return auth==='Bearer mock-token-A-123456789012345'?'A':auth==='Bearer mock-token-B-123456789012345'?'B':null;
 };
 const fetchImpl=async (raw,options)=>{
  const url=new URL(raw);requests.push({route:url.pathname,method:options.method,redirect:options.redirect,headers:options.headers});
  assert.equal(url.hostname,'abcdefghijklmnopqrst.supabase.co');
  assert.equal(options.redirect,'error');
  const side=authFor(options);
  if(url.pathname==='/auth/v1/token'){
    const data=JSON.parse(options.body);
    const label=data.email===env.DAWNEY_STAGING_TEST_A_EMAIL?'A':data.email===env.DAWNEY_STAGING_TEST_B_EMAIL?'B':null;
    return label?json({access_token:'mock-token-'+label+'-123456789012345'}):json({},401);
  }
  if(url.pathname==='/auth/v1/user')return side?json({id:id[side.toLowerCase()],email:env[`DAWNEY_STAGING_TEST_${side}_EMAIL`],email_confirmed_at:'2026-11-13T00:00:00Z',is_anonymous:false}):json({},401);
  if(url.pathname.startsWith('/rest/v1/')){
    if(!side)return json({},401);
    const table=url.pathname.split('/')[3];
    const wanted=(url.searchParams.get('id')??url.searchParams.get('user_id')??'').replace(/^eq\./,'');
    const owning=side==='A'?{owner:id.oa,pet:id.pa,appointment:id.aa}:{owner:id.ob,pet:id.pb,appointment:id.ab};
    const owners=[{id:id.oa,user_id:id.a},{id:id.ob,user_id:id.b}];
    const pets=[{id:id.pa,owner_id:id.oa},{id:id.pb,owner_id:id.ob}];
    const apps=[{id:id.aa,owner_id:id.oa,pet_id:id.pa,status:'requested'},
      {id:id.ab,owner_id:id.ob,pet_id:id.pb,status:'confirmed'}];
    const record=[{id:id.ca,pet_id:id.pa}];
    const members=[{user_id:id.b,role:'veterinarian',is_active:activeRevoked}];
    const source={owners,pets,appointments:apps,clinical_records:record,staff_memberships:members}[table];
    if(!source)return json({},404);
    const result=source.filter(r=>(r.id===wanted||r.user_id===wanted)&&(
      table==='staff_memberships'?r.user_id===id.b&&side==='B':
      table==='owners'?(r.id===owning.owner||leak):
      table==='pets'?(r.id===owning.pet||leak):
      table==='appointments'?(r.id===owning.appointment||leak):
      table==='clinical_records'?(r.pet_id===owning.pet||leak):false));
    return json(result);
  }
  if(url.pathname==='/storage/v1/object/list/clinical-attachments'){
    if(!side)return json({},401);
    const prefix=JSON.parse(options.body).prefix;
    const owned=side==='A'?oa:ob;
    return json(owned.startsWith(prefix)||leak?[{name:(prefix.includes(id.pa)?oa:ob).split('/').at(-1)}]:[]);
  }
  if(url.pathname.startsWith('/storage/v1/object/authenticated/clinical-attachments/')){
    const object=decodeURIComponent(url.pathname.split('/').slice(6).join('/'));
    const actualSide=object===oa?'A':object===ob?'B':null;
    if(side!==actualSide||!actualSide)return json({},403);
    return new Response(badBytes?Buffer.from('tampered'):actualSide==='A'?contentA:contentB,{status:200});
  }
  if(url.pathname.startsWith('/storage/v1/object/clinical-attachments/')){
    return json({},allowUploads?200:403);
  }
  throw Error('Unexpected mocked route '+url.pathname);
 };
 return {fetchImpl,requests};
}

test('full fake HTTP staging matrix validates real API paths and persistence without hosted calls',async()=>{
 const {fetchImpl,requests}=mockServer();
 const result=await verifyStaging(validateStagingConfig(env),fetchImpl);
 assert.equal(result.deniedUploads,'not-run-owner-opt-in-required');
 assert.equal(requests.filter(x=>x.route==='/auth/v1/token').length,4);
 assert.ok(requests.some(x=>x.route==='/rest/v1/staff_memberships'));
 assert.equal(requests.some(x=>x.method==='POST'&&x.route.startsWith('/storage/v1/object/clinical-attachments/')),false);
 assert.ok(requests.every(x=>x.redirect==='error'));
});
test('explicit Storage denied-upload mode only probes four unauthorized writes',async()=>{
 const {fetchImpl,requests}=mockServer();
 const result=await verifyStaging(validateStagingConfig({...env,DAWNEY_STAGING_DENIED_UPLOADS:'I_APPROVE_DENIAL_WRITE_PROBES'}),fetchImpl);
 assert.equal(result.deniedUploads,'verified');
 assert.equal(requests.filter(x=>x.method==='POST'&&x.route.startsWith('/storage/v1/object/clinical-attachments/')).length,4);
});
test('fails closed on revoked staff reactivation and cross-owner RLS leakage',async()=>{
 await assert.rejects(()=>verifyStaging(validateStagingConfig(env),mockServer({activeRevoked:true}).fetchImpl),/revoked staff membership/);
 await assert.rejects(()=>verifyStaging(validateStagingConfig(env),mockServer({leak:true}).fetchImpl),/unauthorized foreign owner visible/);
});
test('fails closed when known private object bytes or upload denial are wrong',async()=>{
 await assert.rejects(()=>verifyStaging(validateStagingConfig(env),mockServer({badBytes:true}).fetchImpl),/private object bytes differ/);
 await assert.rejects(()=>verifyStaging(validateStagingConfig({...env,DAWNEY_STAGING_DENIED_UPLOADS:'I_APPROVE_DENIAL_WRITE_PROBES'}),mockServer({allowUploads:true}).fetchImpl),/unauthorized upload unexpectedly succeeded/);
});
