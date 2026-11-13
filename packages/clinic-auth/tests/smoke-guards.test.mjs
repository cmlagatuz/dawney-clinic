import { test } from 'node:test';
import assert from 'node:assert/strict';
import {validateSmokeInputs,fixtureName,attachmentObjectKey,deniedStatus,apiRequest} from '../src/smoke.mjs';

const env = {
  SUPABASE_URL:'https://lgimhirgvresvbsdugac.supabase.co',
  SUPABASE_PUBLISHABLE_KEY:'sb_publishable_unit_test',
  DAWNEY_TEST_A_EMAIL:'test-a@example.invalid',
  DAWNEY_TEST_A_PASSWORD:'not-used-in-logs',
  DAWNEY_TEST_B_EMAIL:'test-b@example.invalid',
  DAWNEY_TEST_B_PASSWORD:'not-used-in-logs'
};
test('only known operations and approved Supabase URL are accepted',()=>{
  assert.equal(validateSmokeInputs('read-only',env).operation,'read-only');
  assert.throws(()=>validateSmokeInputs('drop-all',env),/Unsupported/);
  assert.throws(()=>validateSmokeInputs('read-only',{...env,SUPABASE_URL:'https://example.com'}),/Unexpected Supabase URL/);
});
test('all synthetic write modes require explicit affirmative opt-in',()=>{
  for(const mode of ['clinical','storage']){
    assert.throws(()=>validateSmokeInputs(mode,env),/explicit opt-in/);
    assert.equal(validateSmokeInputs(mode,{...env,DAWNEY_ALLOW_SYNTHETIC_WRITES:'YES'}).operation,mode);
  }
});
test('missing credentials are reported by names only, not values',()=>{
  const input={...env,DAWNEY_TEST_A_EMAIL:''};
  assert.throws(()=>validateSmokeInputs('read-only',input),/DAWNEY_TEST_A_EMAIL/);
});
test('fixture marker is distinct and does not contain names or email addresses',()=>{
  assert.equal(fixtureName('A','123456'),'DAWNEY_SMOKE_A_123456');
  assert.equal(fixtureName('B','123456'),'DAWNEY_SMOKE_B_123456');
  assert.throws(()=>fixtureName('other','123456'),/Invalid/);
  assert.throws(()=>fixtureName('A','invalid/path'),/Invalid/);
});
test('private Storage keys require real UUIDs and are scoped to pet and account',()=>{
 const pet='77777777-7777-4777-8777-777777777777';
 const owner='88888888-8888-4888-8888-888888888888';
 const path=attachmentObjectKey(pet,owner);
 assert.match(path,/^pets\/77777777-7777-4777-8777-777777777777\/owners\/88888888-8888-4888-8888-888888888888\/[a-f0-9-]+\.pdf$/);
 assert.throws(()=>attachmentObjectKey('bad',owner),/UUID/);
});
test('response status checks never interpret success as a denial',()=>{
 for(const s of [400,401,403,404])assert.ok(deniedStatus(s));
 for(const s of [200,201,204,302,500])assert.equal(deniedStatus(s),false);
});
test('HTTP helper never logs or echoes a bearer token',async()=>{
  let got=null;
  const fake=async (url,options)=>{
    got={url,options};
    return {ok:true,status:200,headers:new Map([['content-type','application/json']]),async json(){return [];}};
  };
  const result=await apiRequest({url:env.SUPABASE_URL,publishableKey:'pk',token:'test-private-jwt',fetchImpl:fake},'/rest/v1/owners');
  assert.equal(result.status,200);
  assert.equal(got.options.headers.Authorization,'Bearer test-private-jwt');
  assert.ok(!JSON.stringify(result).includes('test-private-jwt'));
});
