/**
 * Owner-triggered, non-production Supabase HTTP + RLS smoke test.
 * Uses two existing, confirmed disposable Auth users. NEVER registers accounts.
 * Clinical/storage operations persist synthetic records until audited cleanup.
 */
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const operation = process.env.DAWNEY_SMOKE_OPERATION ?? 'read-only';
const modes = new Set(['read-only', 'clinical', 'storage']);
if (!modes.has(operation)) throw Error('Unknown operation');
if (operation !== 'read-only' && process.env.DAWNEY_ALLOW_SYNTHETIC_WRITES !== 'YES') {
  throw Error('Synthetic clinical writes need explicit owner opt-in');
}
const keys = [
  'SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY',
  'DAWNEY_TEST_A_EMAIL','DAWNEY_TEST_A_PASSWORD',
  'DAWNEY_TEST_B_EMAIL','DAWNEY_TEST_B_PASSWORD'
];
if (keys.some(k=>!process.env[k])) throw Error('Missing required GitHub Actions secret');
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url) || !key.startsWith('sb_publishable_')) {
  throw Error('Unexpected project address or public key');
}
const marker = 'DAWNEY_SMOKE_' + (process.env.GITHUB_RUN_ID ?? 'local').replace(/[^0-9a-zA-Z_-]/g,'').slice(0,24);

const memory = () => {
  const map = new Map();
  return {
    getItem: k => map.get(k) ?? null,
    setItem: (k,v) => map.set(k,v),
    removeItem: k => map.delete(k)
  };
};
const create = (storage, name) => createClient(url,key,{
  auth:{storage,persistSession:true,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'dawney-smoke-'+name},
  global:{headers:{'X-Client-Info':'dawney-integration-smoke'}}
});
const storageA=memory(), storageB=memory();
const a=create(storageA,'a');
const b=create(storageB,'b');
const fail = (stage, error) => {
  // No raw error messages, object keys, user identifiers, email or tokens in logs.
  const code = typeof error?.code === 'string' ? error.code : 'request_failed';
  throw Error(stage + ' (' + code + ')');
};
const expect = (result,stage) => {
  if(result.error) fail(stage,result.error);
  return result.data;
};
const invariant = (condition,stage) => { if(!condition) throw Error('Security assertion failed: '+stage); };
const close = async () => {
  await Promise.allSettled([a.auth.signOut({scope:'local'}), b.auth.signOut({scope:'local'})]);
};
let fixtures = 0;
async function run() {
  const authA=expect(await a.auth.signInWithPassword({
    email:process.env.DAWNEY_TEST_A_EMAIL,password:process.env.DAWNEY_TEST_A_PASSWORD
  }), 'Account A sign-in');
  const authB=expect(await b.auth.signInWithPassword({
    email:process.env.DAWNEY_TEST_B_EMAIL,password:process.env.DAWNEY_TEST_B_PASSWORD
  }), 'Account B sign-in');
  const ua=expect(await a.auth.getUser(), 'Account A getUser').user;
  const ub=expect(await b.auth.getUser(), 'Account B getUser').user;
  invariant(ua?.id && ub?.id && ua.id !== ub.id, 'distinct accounts');
  invariant(ua.email_confirmed_at && ub.email_confirmed_at && !ua.is_anonymous && !ub.is_anonymous,
    'verified nonanonymous identities');
  invariant(authA.user.id===ua.id && authB.user.id===ub.id,'server validated session identities');
  console.log('PASS: two distinct verified HTTPS Auth sessions');

  // These profiles should be created first by Clinic Auth contract operation=test.
  const ownerA=expect(await a.from('owners').select('id,user_id').eq('user_id',ua.id).single(),
    'Read Account A owner profile');
  const ownerB=expect(await b.from('owners').select('id,user_id').eq('user_id',ub.id).single(),
    'Read Account B owner profile');
  invariant(ownerA?.user_id===ua.id && ownerB?.user_id===ub.id && ownerA.id!==ownerB.id,'owner identity');
  const wrongA=expect(await a.from('owners').select('id').eq('id',ownerB.id),'A reading B owner');
  const wrongB=expect(await b.from('owners').select('id').eq('id',ownerA.id),'B reading A owner');
  invariant(wrongA.length===0 && wrongB.length===0,'owner cross-account SELECT denied');

  // Real session restoration using a persistent storage adapter (not a real browser).
  const restoredA=create(storageA,'a');
  const restoredUser=expect(await restoredA.auth.getUser(),'Auth session rehydration').user;
  invariant(restoredUser?.id===ua.id,'session restoration');
  const ownerAfterRestore=expect(await restoredA.from('owners').select('id').eq('id',ownerA.id).single(),
    'Profile after new client reauthentication');
  invariant(ownerAfterRestore.id===ownerA.id,'owner persists after session restoration');
  await restoredA.auth.signOut({scope:'local'});
  console.log('PASS: owner RLS isolation and SDK session rehydration');

  if(operation==='read-only') {
    const anon=create(memory(),'anon');
    const noProfile=await anon.from('owners').select('id').limit(1);
    invariant(Boolean(noProfile.error) || (noProfile.data?.length??0)===0,'anonymous cannot read owners');
    console.log('PASS: authenticated read-only and anonymous privacy smoke; no records written');
    return;
  }

  // Explicit opt-in: persists synthetic nonclinical fixtures with a unique run marker.
  const resource=expect(await a.from('appointment_resources').select('id').eq('is_active',true).limit(1).single(),
    'Read active resource');
  const testPetA=expect(await a.from('pets').insert({
    owner_id:ownerA.id,name:marker+'_A',species:'Synthetic test',sex:'unknown'
  }).select('id,owner_id,name').single(),'Create synthetic pet A');
  fixtures++;
  const testPetB=expect(await b.from('pets').insert({
    owner_id:ownerB.id,name:marker+'_B',species:'Synthetic test',sex:'unknown'
  }).select('id,owner_id,name').single(),'Create synthetic pet B');
  fixtures++;
  invariant(testPetA.owner_id===ownerA.id && testPetB.owner_id===ownerB.id,'pet FK ownership');
  const aSeesB=expect(await a.from('pets').select('id').eq('id',testPetB.id),'A lookup B pet');
  const bSeesA=expect(await b.from('pets').select('id').eq('id',testPetA.id),'B lookup A pet');
  invariant(aSeesB.length===0 && bSeesA.length===0,'pet cross-account isolation');
  const forgedPet=await b.from('pets').insert({
    owner_id:ownerA.id,name:marker+'_FORGED',species:'Synthetic test',sex:'unknown'
  }).select('id');
  invariant(Boolean(forgedPet.error) && !forgedPet.data?.length,'pet owner forgery rejected');
  const tamper=await b.from('pets').update({name:marker+'_UNAUTHORIZED'})
    .eq('id',testPetA.id).select('id');
  invariant(Boolean(tamper.error)||!tamper.data?.length,'foreign pet UPDATE rejected');
  const verifyA=expect(await a.from('pets').select('name').eq('id',testPetA.id).single(),'Verify unchanged A pet');
  invariant(verifyA.name===marker+'_A','no foreign pet tampering');

  // 30-minute isolated synthetic slot: not a clinic-approved business-hour claim.
  const start = new Date(Date.now()+ (75*24*60*60+12345)*1000);
  const end = new Date(start.valueOf()+30*60*1000);
  const request={resource_id:resource.id,starts_at:start.toISOString(),ends_at:end.toISOString(),
    concern:'Synthetic integration smoke',details:marker};
  const appA=expect(await a.from('appointments').insert({
    owner_id:ownerA.id,pet_id:testPetA.id,...request
  }).select('id,owner_id,status').single(),'Book own synthetic pet');
  fixtures++;
  invariant(appA.owner_id===ownerA.id && appA.status==='requested','own requested booking');
  const inaccessible=expect(await b.from('appointments').select('id').eq('id',appA.id),'Foreign booking SELECT');
  invariant(inaccessible.length===0,'appointment privacy');
  const forgedBooking=await b.from('appointments').insert({
    owner_id:ownerB.id,pet_id:testPetA.id,...request
  }).select('id');
  invariant(Boolean(forgedBooking.error),'cross-account pet appointment denied');
  const overlap=await b.from('appointments').insert({
    owner_id:ownerB.id,pet_id:testPetB.id,...request
  }).select('id');
  invariant(overlap.error?.code==='23P01','database conflict exclusion enforced');
  const deniedNote=await a.from('clinical_records').insert({
    pet_id:testPetA.id,procedure:marker+'_UNAUTHORIZED'
  }).select('id');
  invariant(Boolean(deniedNote.error),'client clinical note WRITE denied');
  expect(await a.from('appointments').update({status:'cancelled'}).eq('id',appA.id).select('id,status').single(),
    'Cancel synthetic appointment A');
  const appB=expect(await b.from('appointments').insert({
    owner_id:ownerB.id,pet_id:testPetB.id,...request
  }).select('id,status').single(),'Reuse released slot for B');
  fixtures++;
  invariant(appB.status==='requested','released slot can be booked');
  expect(await b.from('appointments').update({status:'cancelled'}).eq('id',appB.id).select('id,status').single(),
    'Cancel synthetic appointment B');
  console.log('PASS: real synthetic patient creation, owner boundaries, FK, slot collision and cancellation');

  if(operation!=='storage') {
    console.log('Synthetic pet/appointment fixture marker: '+marker+' (requires authorized cleanup)');
    return;
  }

  // Storage: harmless minimal PDF only, never clinical data. The bucket must exist and be PRIVATE.
  const pdf = new Blob([
    '%PDF-1.2\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n'+
    '2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n'
  ],{type:'application/pdf'});
  const pathA='pets/'+testPetA.id+'/owners/'+ua.id+'/'+randomUUID()+'.pdf';
  const pathB='pets/'+testPetB.id+'/owners/'+ub.id+'/'+randomUUID()+'.pdf';
  expect(await a.storage.from('clinical-attachments').upload(pathA,pdf,{
    contentType:'application/pdf',upsert:false
  }),'Upload own synthetic PDF A');
  fixtures++;
  const ownFile=expect(await a.storage.from('clinical-attachments').download(pathA),
    'Download own PDF A');
  invariant(ownFile.size>0,'owner download not empty');
  const foreignDownload=await b.storage.from('clinical-attachments').download(pathA);
  invariant(Boolean(foreignDownload.error),'B cannot download A document');
  const anon=create(memory(),'anon-storage');
  const anonymous=await anon.storage.from('clinical-attachments').download(pathA);
  invariant(Boolean(anonymous.error),'anonymous cannot download private file');
  const forgedUpload=await b.storage.from('clinical-attachments').upload(
    'pets/'+testPetA.id+'/owners/'+ua.id+'/'+randomUUID()+'.pdf',pdf,{
      contentType:'application/pdf',upsert:false
    });
  invariant(Boolean(forgedUpload.error),'B cannot upload into A private owner path');
  const clinicUpload=await a.storage.from('clinical-attachments').upload(
    'pets/'+testPetA.id+'/clinic/'+randomUUID()+'.pdf',pdf,{
      contentType:'application/pdf',upsert:false
    });
  invariant(Boolean(clinicUpload.error),'owner cannot upload internal staff file');
  expect(await b.storage.from('clinical-attachments').upload(pathB,pdf,{
    contentType:'application/pdf',upsert:false
  }),'Upload own synthetic PDF B');
  fixtures++;
  const foreignB=await a.storage.from('clinical-attachments').download(pathB);
  invariant(Boolean(foreignB.error),'A cannot download B document');
  console.log('PASS: private Storage owner uploads/downloads and cross-account/anonymous denies');
  console.log('Synthetic pet/appointment/storage fixture marker: '+marker+' (requires authorized cleanup)');
}
try { await run(); }
catch(e){
  console.error('FAIL: '+(e instanceof Error ? e.message : 'Unknown smoke error'));
  if(fixtures) console.error('Synthetic fixtures may remain; cleanup marker: '+marker);
  process.exitCode=1;
}
finally { await close(); }
