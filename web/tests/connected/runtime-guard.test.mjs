import test from 'node:test'
import assert from 'node:assert/strict'
import {RC2,WEB,BACKEND,MAIL,SIGNUP_SUBJECT,roles,flags,validatePacket,validateCatalogRows,matchingSignupMessages,extractSignupOtp,privatePacket,outsideCheckout} from './runtime-guard.mjs'
import {mkdtempSync,mkdirSync,writeFileSync,chmodSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
const id=n=>'50000000-0000-4000-8000-'+String(n).padStart(12,'0')
const runId='isolated-test-01'
const packet=()=>({version:2,mailOrigin:MAIL,sourceSha:RC2,webTree:WEB,runId,backendOrigin:BACKEND,runtime:'isolated-disposable-full-stack',networkIsolation:true,syntheticOnly:true,noExternalMail:true,freshSeed:true,migrationCount:23,runtimeEvidence:'offline-guard-example-only',publishableKey:'sb_publishable_synthetic_guard_only',accounts:Object.fromEntries(roles.map(role=>[role,{email:role.toLowerCase()+'-'+runId+'@example.test',password:'SyntheticGuardOnly123'}])),branchId:id(1),otherBranchId:id(2),serviceId:id(3),speciesId:'dog',breedId:'dog-labrador-retriever',checkedInVisitId:id(5),checkedInPetId:id(6),speciesLabel:'Dog',branchLabel:'Synthetic Naga',otherBranchLabel:'Synthetic Cavite',checkedInDay:'2026-11-27',expiryDay:'2027-01-01',otherOwnerPet:'Synthetic '+runId+' other'})
test('valid shape does not claim runtime attestation',()=>assert.equal(validatePacket(packet(),runId).runId,runId))
test('reject absent authorization and source mismatch',()=>{assert.throws(()=>validatePacket(packet(),''));assert.throws(()=>validatePacket({...packet(),sourceSha:'master'},runId))})
test('reject hosted endpoints, raw localhost, TLS alternate and URL tricks',()=>{for(const backendOrigin of ['https://lgimhirgvresvbsdugac.supabase.co','https://gxklkkoffpkdcxbqjlav.supabase.co','http://127.0.0.1:54321',BACKEND+'/','https://dawney-rc2-synthetic.supabase.co.evil.test'])assert.throws(()=>validatePacket({...packet(),backendOrigin},runId))})
test('require complete isolated runtime, fresh seed and local mail',()=>{for(const key of ['networkIsolation','syntheticOnly','noExternalMail','freshSeed'])assert.throws(()=>validatePacket({...packet(),[key]:false},runId));assert.throws(()=>validatePacket({...packet(),migrationCount:11},runId))})
test('reject duplicate or non-synthetic accounts, invalid fixture identities',()=>{const p=packet();p.accounts.ownerOther.email=p.accounts.ownerNew.email;assert.throws(()=>validatePacket(p,runId));const a=packet();a.accounts.ownerNew.email='real@example.com';assert.throws(()=>validatePacket(a,runId));assert.throws(()=>validatePacket({...packet(),branchId:packet().otherBranchId},runId))})
test('require publishable-key shape, no privileged key or legacy JWT',()=>{for(const publishableKey of ['sb_secret_not_allowed','eyJhbGciOiJIUzI1NiJ9',''])assert.throws(()=>validatePacket({...packet(),publishableKey},runId))})
test('exact nine approved flags only, backup is separate',()=>{assert.equal(new Set(flags).size,9);assert.ok(!flags.some(f=>f.includes('BACKUP')))})

test('reject unsanitized runtime evidence',()=>assert.throws(()=>validatePacket({...packet(),runtimeEvidence:'unsafe raw evidence text'},runId)))

test('optional lifecycle set must have exact distinct fixture IDs and visible prefixes',()=>{const p=packet();p.lifecycleVisits=Object.fromEntries(['checkIn','noShow','decline','cancel','complete'].map((k,i)=>[k,{id:(i+1).toString().padStart(6,'0')+'aa-0000-4000-8000-000000000001',day:p.checkedInDay}]));assert.equal(validatePacket(p,runId).lifecycleVisits.checkIn.day,p.checkedInDay);p.lifecycleVisits.noShow.id=p.lifecycleVisits.checkIn.id;assert.throws(()=>validatePacket(p,runId))})

test('canonical breed ID accepts real seed text; rejects former UUID and malformed values',()=>{
 const p=packet()
 assert.equal(validatePacket(p,runId).breedId,'dog-labrador-retriever')
 for(const breedId of [id(4),'','Dog Labrador','dog?select=*','../dog','dog\ncat'])assert.throws(()=>validatePacket({...p,breedId},runId))
 assert.throws(()=>validatePacket({...p,speciesId:id(4)},runId))
})
test('actual catalog response contract rejects unknown/mismatched/inactive or unreviewed breed and unsupported species',()=>{
 const p=packet(),species={id:'dog',label:'Dog',is_active:true,clinic_supported:true},breed={id:p.breedId,species_id:'dog',is_active:true,review_status:'curated'}
 assert.doesNotThrow(()=>validateCatalogRows(p,[species],[breed]))
 for(const rows of [[],[breed,breed],[{...breed,id:'dog-unknown-id'}],[{...breed,species_id:'cat'}],[{...breed,is_active:false}],[{...breed,review_status:'pending'}]])assert.throws(()=>validateCatalogRows(p,[species],rows))
 for(const rows of [[],[{...species,label:'Cat'}],[{...species,is_active:false}],[{...species,clinic_supported:false}]])assert.throws(()=>validateCatalogRows(p,rows,[breed]))
})
test('require revised packet version and exact loopback mail origin',()=>{
 const p=packet()
 for(const mailOrigin of ['http://localhost:54324','https://example.test',MAIL+'/','http://127.0.0.1:54325',undefined])assert.throws(()=>validatePacket({...p,mailOrigin},runId))
 assert.throws(()=>validatePacket({...p,version:1},runId))
})
const recipient=packet().accounts.ownerNew.email
const envelope={ID:'message-1',To:[{Address:recipient}],Subject:SIGNUP_SUBJECT}
test('offline mail metadata parser accepts only one exact synthetic recipient; empty means no delivery',()=>{
 assert.deepEqual(matchingSignupMessages({total:0,messages:[]},recipient),[])
 assert.deepEqual(matchingSignupMessages({total:1,messages:[envelope]},recipient),['message-1'])
 const other={...envelope,ID:'message-2',To:[{Address:packet().accounts.applicant.email}]}
 assert.deepEqual(matchingSignupMessages({total:1,messages:[other]},recipient),[])
 for(const data of [{total:2,messages:[envelope]}, {total:2,messages:[envelope,{...envelope,ID:'message-2'}]}, {total:2,messages:[envelope,envelope]}, {total:1,messages:[{...envelope,Subject:'Password recovery'}]}, {total:1,messages:[{...envelope,To:[{Address:recipient},{Address:'external@example.com'}]}]}])assert.throws(()=>matchingSignupMessages(data,recipient))
})
test('offline OTP parser requires exact delivered-message identity, recipient, subject and template',()=>{
 const message={...envelope,Text:'Dawney synthetic confirmation code: 123456\n'}
 assert.equal(extractSignupOtp(message,envelope.ID,recipient),'123456')
 for(const value of [{...message,ID:'other'},{...message,To:[{Address:packet().accounts.applicant.email}]},{...message,Subject:'Reset password'},{...message,Text:'123456'},{...message,Text:'Dawney synthetic confirmation code: 123456\nDawney synthetic confirmation code: 654321'},{...message,Cc:[{Address:recipient}]}])assert.throws(()=>extractSignupOtp(value,envelope.ID,recipient))
})
test('packet and evidence require owner-controlled private parent directories outside checkout',()=>{
 const temp=mkdtempSync(join(tmpdir(),'dawney-offline-guard-'))
 try{
  const root=join(temp,'checkout'),parent=join(temp,'private'),file=join(parent,'packet.json')
  mkdirSync(root,{mode:0o700});mkdirSync(parent,{mode:0o700});writeFileSync(file,'{}',{mode:0o600})
  assert.equal(privatePacket(root,file),file)
  assert.equal(outsideCheckout(root,join(parent,'new-evidence')),join(parent,'new-evidence'))
  chmodSync(parent,0o755)
  assert.throws(()=>privatePacket(root,file));assert.throws(()=>outsideCheckout(root,join(parent,'new-evidence')))
  chmodSync(parent,0o700);chmodSync(file,0o644)
  assert.throws(()=>privatePacket(root,file))
  assert.throws(()=>outsideCheckout(root,join(root,'new-evidence')))
 }finally{rmSync(temp,{recursive:true,force:true})}
})
