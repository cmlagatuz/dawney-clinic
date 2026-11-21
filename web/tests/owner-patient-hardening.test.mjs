// CLOUD — owner/patient hardening regression contracts. Pure client-side guards;
// no provider, SQL, real patient files or hosted side effects.
import test from 'node:test'
import assert from 'node:assert/strict'
import {emptyUpload,uploadReducer,retryMode,savedToClear,selectSpecies,breedIsLoadedFor} from '../src/patient-form-logic.mjs'
import {saveBookingIntent,readBookingIntent,signinForBooking,clinicSlotToUtc} from '../src/booking-contract.mjs'
import {serviceSpeciesView,canBookPet} from '../src/public-site/service-eligibility.mjs'
import {attachmentView,attachmentKey,documentsLocked,attachmentsForPet,canActOnAttachment} from '../src/attachment-load.mjs'
import {ownerObjectPath,verifyAttachmentRow,sanitizeFilename,validateAttachmentInfo,checkMagicBytes} from '../src/attachment-policy.mjs'
const uid=(n)=>'70000000-0000-4000-8000-'+String(n).padStart(12,'0')
const fakeFile={name:'card.pdf',type:'application/pdf',size:8}
function picked(){return uploadReducer(emptyUpload,{type:'select',file:fakeFile})}

test('exact metadata identity is required before discarding all three pending private document categories',()=>{
 const cats=['profile_photo','health_card','vaccination_card']
 const uploads=Object.fromEntries(cats.map((category,n)=>[category,uploadReducer(picked(),{type:'saved',attachmentId:uid(10+n)})]))
 assert.deepEqual(savedToClear(uploads,false,[]),[])
 assert.deepEqual(savedToClear(uploads,true,[]),[],'stale ready/empty metadata must never clear pending files')
 assert.deepEqual(savedToClear(uploads,true,[{id:uid(10)}]),['profile_photo'])
 assert.deepEqual(savedToClear(uploads,true,[{id:uid(10)},{id:uid(12)}]),['profile_photo','vaccination_card'])
 assert.deepEqual(savedToClear(uploads,true,cats.map((_,n)=>({id:uid(10+n)}))),cats)
 assert.deepEqual(savedToClear(uploads,true,[{id:uid(23)}]),[])
 assert.deepEqual(savedToClear({profile_photo:uploadReducer(picked(),{type:'saved'})},true,[]),[],
  'missing server acknowledgement is never proof')
})

test('failed metadata finalization retries the same private object without re-upload or cross-patient path',()=>{
 const objectPath=ownerObjectPath(uid(1),uid(2),'pdf',uid(3))
 let state=uploadReducer(picked(),{type:'start'})
 state=uploadReducer(state,{type:'unindexed',objectPath})
 assert.equal(retryMode(state),'finalize')
 state=uploadReducer(uploadReducer(state,{type:'start'}),{type:'error',message:'Private metadata denied'})
 assert.equal(state.objectPath,objectPath)
 assert.equal(retryMode(state),'finalize')
 state=uploadReducer(state,{type:'saved',attachmentId:uid(4)})
 assert.equal(retryMode(state),'upload')
 assert.deepEqual(savedToClear({health_card:state},true,[{id:uid(4)}]),['health_card'])
 const replacement=uploadReducer(state,{type:'select',file:{...fakeFile,name:'replacement.pdf'}})
 assert.equal(replacement.objectPath,null)
 assert.equal(replacement.attachmentId,undefined)
})

test('three attachment types reject unsupported MIME and forged signatures without uploading',async()=>{
 const png=[137,80,78,71,13,10,26,10],pdf=[37,80,68,70,45]
 const fake=(name,type,bytes)=>({name,type,size:bytes.length,slice:()=>({arrayBuffer:async()=>Uint8Array.from(bytes).buffer})})
 for(const category of ['profile_photo','health_card','vaccination_card']){
  const f=category==='profile_photo'?fake('photo.png','image/png',png):fake('card.pdf','application/pdf',pdf)
  await checkMagicBytes(f,validateAttachmentInfo(f,category))
 }
 assert.throws(()=>validateAttachmentInfo(fake('fake.svg','image/svg+xml',[60]),'profile_photo'),/Unsupported/)
 assert.throws(()=>validateAttachmentInfo(fake('not-photo.pdf','application/pdf',pdf),'profile_photo'),/Photo/)
 await assert.rejects(()=>checkMagicBytes(fake('fake.png','image/png',pdf),{mimeType:'image/png'}),/signature/)
 assert.equal(sanitizeFilename('../card\\\\<script>J.pdf').includes('/'),false)
})

test('patient and account identity mismatches cannot render or download stale private metadata',()=>{
 const a=attachmentKey(uid(1),uid(3)),b=attachmentKey(uid(2),uid(3)),c=attachmentKey(uid(1),uid(4))
 const item={id:uid(5),pet_id:uid(3),object_path:ownerObjectPath(uid(3),uid(1),'pdf',uid(6))}
 const v=attachmentView(a,{key:a,status:'ready',list:[item]})
 assert.deepEqual(attachmentsForPet(v,uid(3)),[item])
 assert.equal(canActOnAttachment(v,uid(3),item),true)
 for(const key of [b,c]){
  const pending=attachmentView(key,{key:a,status:'ready',list:[item]})
  assert.equal(pending.status,'loading')
  assert.equal(documentsLocked(uid(3),pending),true)
  assert.equal(canActOnAttachment(pending,uid(3),item),false)
 }
 assert.deepEqual(attachmentsForPet(v,uid(4)),[])
 assert.throws(()=>verifyAttachmentRow(item,uid(4)),/mismatch/)
})

test('Dog Chow Chow remains selectable; Mixed/Unknown/NA remain distinct and species changes reset breed',()=>{
 const dog={speciesId:'dog',breedId:'dog-chow-chow'}
 assert.equal(breedIsLoadedFor('dog-chow-chow',[{id:'dog-chow-chow'}]),true)
 for(const kind of ['mixed','unknown','na']){
  assert.equal(breedIsLoadedFor('dog-'+kind,[{id:'dog-'+kind}]),true)
 }
 assert.deepEqual(selectSpecies(dog,'cat'),{speciesId:'cat',breedId:null})
 assert.equal(selectSpecies(dog,'dog'),dog)
})

test('stale service-species permission is never treated as a verified booking decision',()=>{
 const pet={id:uid(3),species_id:'dog',eligibility:'eligible'}
 assert.equal(canBookPet(pet,serviceSpeciesView(uid(1),{serviceId:uid(1),status:'ready',ids:['dog']})),true)
 for(const state of [
  serviceSpeciesView(uid(2),{serviceId:uid(1),status:'ready',ids:['dog']}),
  serviceSpeciesView(uid(1),{serviceId:uid(1),status:'error',message:'denied'}),
  serviceSpeciesView(uid(1),null)
 ])assert.equal(canBookPet(pet,state),false)
})

test('booking return hint is PII-free, expires, and never carries owner/patient notes',()=>{
 const data=new Map(),store={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}
 const now=1700000000000;const service=uid(10),resource=uid(11)
 saveBookingIntent(store,{serviceId:service,resourceId:resource,startsAtUtc:'2026-11-22T02:00:00Z'},now)
 const saved=[...data.values()][0]
 for(const unsafe of ['Owner A','Dog Chow Chow','symptoms','@example.test','access_token'])assert.equal(saved.includes(unsafe),false)
 assert.equal(signinForBooking('signin'),'/auth/signin?next=%2Fbook')
 assert.equal(readBookingIntent(store,now+2000)?.serviceId,service)
 assert.equal(readBookingIntent(store,now+31*60000),null)
})

test('Manila wall clock converts strictly while nonexistent DST time refuses invented availability',()=>{
 assert.equal(clinicSlotToUtc('2026-11-22','10:00','Asia/Manila'),'2026-11-22T02:00:00.000Z')
 assert.throws(()=>clinicSlotToUtc('2026-03-08','02:30','America/New_York'),/Ambiguous or nonexistent/)
})
