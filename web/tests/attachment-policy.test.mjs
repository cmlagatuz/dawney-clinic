import {test} from 'node:test'
import assert from 'node:assert/strict'
import {
 CLINICAL_BUCKET,MAX_ATTACHMENT_BYTES,validateAttachmentInfo,checkMagicBytes,
 ownerObjectPath,clinicObjectPath,verifyAttachmentRow,sanitizeFilename
} from '../src/attachment-policy.mjs'
const PET='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const UID='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const KEY='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const sig={
 'image/png':[137,80,78,71,13,10,26,10],
 'image/jpeg':[255,216,255,224],
 'application/pdf':[37,80,68,70,45,49]
}
function fake(type,bytes=sig[type],name='health-card.pdf',size=bytes.length){
 return {type,size,name,slice:()=>({arrayBuffer:async()=>Uint8Array.from(bytes).buffer})}
}
test('private bucket and limit fixed, supported exact MIME with magic signature',async()=>{
 assert.equal(CLINICAL_BUCKET,'clinical-attachments')
 assert.equal(MAX_ATTACHMENT_BYTES,5242880)
 for(const [mime,bytes] of Object.entries(sig)){
  const cat=mime==='application/pdf'?'health_card':'profile_photo'
  const f=fake(mime,bytes,'sample')
  const p=validateAttachmentInfo(f,cat)
  assert.equal(p.mimeType,mime)
  await checkMagicBytes(f,p)
 }
})
test('reject profile PDF, fake PNG/SVG/HTML, empty and oversize files',async()=>{
 assert.throws(()=>validateAttachmentInfo(fake('application/pdf'), 'profile_photo'),/Photo/)
 assert.throws(()=>validateAttachmentInfo(fake('image/svg+xml',[60,115,118,103]),'health_card'),/Unsupported/)
 assert.throws(()=>validateAttachmentInfo(fake('text/html',[60,104,116,109,108]),'health_card'),/Unsupported/)
 assert.throws(()=>validateAttachmentInfo(fake('image/png',sig['image/png'],'bad.png',0),'profile_photo'),/5 MiB/)
 assert.throws(()=>validateAttachmentInfo(fake('image/png',sig['image/png'],'bad.png',5242881),'profile_photo'),/5 MiB/)
 await assert.rejects(checkMagicBytes(fake('image/png',sig['application/pdf']),{mimeType:'image/png'}),/signature/)
})
test('generated patient paths reject forged IDs, path traversal, invalid extension',()=>{
 assert.equal(ownerObjectPath(PET,UID,'jpg',KEY),`pets/${PET}/owners/${UID}/${KEY}.jpg`)
 assert.equal(clinicObjectPath(PET,'pdf',KEY),`pets/${PET}/clinic/${KEY}.pdf`)
 assert.throws(()=>ownerObjectPath(PET,'../spoof','png',KEY),/Unsafe/)
 assert.throws(()=>ownerObjectPath(PET,UID,'svg',KEY),/Unsafe/)
 assert.throws(()=>clinicObjectPath(PET+'/../other','png',KEY),/Unsafe/)
 assert.throws(()=>clinicObjectPath(PET,'png','not-uuid'),/Unsafe/)
})
test('sanitize hostile names and reject inconsistent patient metadata',()=>{
 assert.equal(sanitizeFilename('../<script>alert(1)</script>.pdf').includes('<'),false)
 assert.equal(sanitizeFilename('../<script>alert(1)</script>.pdf').includes('/'),false)
 assert.throws(()=>sanitizeFilename(''),/safe name/)
 const row={pet_id:PET,object_path:ownerObjectPath(PET,UID,'png',KEY)}
 assert.equal(verifyAttachmentRow(row,PET),row)
 assert.throws(()=>verifyAttachmentRow(row,UID),/mismatch/)
})
