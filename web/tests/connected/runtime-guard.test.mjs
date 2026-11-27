import test from 'node:test'
import assert from 'node:assert/strict'
import {RC2,WEB,BACKEND,roles,flags,validatePacket} from './runtime-guard.mjs'
const id=n=>'50000000-0000-4000-8000-'+String(n).padStart(12,'0')
const runId='isolated-test-01'
const packet=()=>({version:1,sourceSha:RC2,webTree:WEB,runId,backendOrigin:BACKEND,runtime:'isolated-disposable-full-stack',networkIsolation:true,syntheticOnly:true,noExternalMail:true,freshSeed:true,migrationCount:23,runtimeEvidence:'offline-guard-example-only',publishableKey:'sb_publishable_synthetic_guard_only',accounts:Object.fromEntries(roles.map(role=>[role,{email:role.toLowerCase()+'-'+runId+'@example.test',password:'SyntheticGuardOnly123'}])),branchId:id(1),otherBranchId:id(2),serviceId:id(3),breedId:id(4),checkedInVisitId:id(5),checkedInPetId:id(6),speciesLabel:'Dog',branchLabel:'Synthetic Naga',otherBranchLabel:'Synthetic Cavite',checkedInDay:'2026-11-27',expiryDay:'2027-01-01',otherOwnerPet:'Synthetic '+runId+' other'})
test('valid shape does not claim runtime attestation',()=>assert.equal(validatePacket(packet(),runId).runId,runId))
test('reject absent authorization and source mismatch',()=>{assert.throws(()=>validatePacket(packet(),''));assert.throws(()=>validatePacket({...packet(),sourceSha:'master'},runId))})
test('reject hosted endpoints, raw localhost, TLS alternate and URL tricks',()=>{for(const backendOrigin of ['https://lgimhirgvresvbsdugac.supabase.co','https://gxklkkoffpkdcxbqjlav.supabase.co','http://127.0.0.1:54321',BACKEND+'/','https://dawney-rc2-synthetic.supabase.co.evil.test'])assert.throws(()=>validatePacket({...packet(),backendOrigin},runId))})
test('require complete isolated runtime, fresh seed and local mail',()=>{for(const key of ['networkIsolation','syntheticOnly','noExternalMail','freshSeed'])assert.throws(()=>validatePacket({...packet(),[key]:false},runId));assert.throws(()=>validatePacket({...packet(),migrationCount:11},runId))})
test('reject duplicate or non-synthetic accounts, invalid fixture identities',()=>{const p=packet();p.accounts.ownerOther.email=p.accounts.ownerNew.email;assert.throws(()=>validatePacket(p,runId));const a=packet();a.accounts.ownerNew.email='real@example.com';assert.throws(()=>validatePacket(a,runId));assert.throws(()=>validatePacket({...packet(),branchId:packet().otherBranchId},runId))})
test('require publishable-key shape, no privileged key or legacy JWT',()=>{for(const publishableKey of ['sb_secret_not_allowed','eyJhbGciOiJIUzI1NiJ9',''])assert.throws(()=>validatePacket({...packet(),publishableKey},runId))})
test('exact nine approved flags only, backup is separate',()=>{assert.equal(new Set(flags).size,9);assert.ok(!flags.some(f=>f.includes('BACKUP')))})

test('reject unsanitized runtime evidence',()=>assert.throws(()=>validatePacket({...packet(),runtimeEvidence:'unsafe raw evidence text'},runId)))

test('optional lifecycle set must have exact distinct fixture IDs and visible prefixes',()=>{const p=packet();p.lifecycleVisits=Object.fromEntries(['checkIn','noShow','decline','cancel','complete'].map((k,i)=>[k,{id:(i+1).toString().padStart(6,'0')+'aa-0000-4000-8000-000000000001',day:p.checkedInDay}]));assert.equal(validatePacket(p,runId).lifecycleVisits.checkIn.day,p.checkedInDay);p.lifecycleVisits.noShow.id=p.lifecycleVisits.checkIn.id;assert.throws(()=>validatePacket(p,runId))})
