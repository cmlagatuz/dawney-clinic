// Non-network, browser-safe policy shared by the Supabase attachment adapter.
// Database + private Storage RLS remain the authority; never grant access here.
export const CLINICAL_BUCKET='clinical-attachments';
export const MAX_ATTACHMENT_BYTES=5*1024*1024;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const categories=new Set(['profile_photo','health_card','vaccination_card']);
const types={'image/png':'png','image/jpeg':'jpg','application/pdf':'pdf'};
export function sanitizeFilename(name) {
 const cleaned=String(name??'').normalize('NFKC')
   .replace(/[<>"'&\/\\\u0000-\u001f\u007f]/g,'_').trim().slice(0,180);
 if(!cleaned)throw Error('File needs a safe name');
 return cleaned;
}
export function validateAttachmentInfo(file,category) {
 if(!categories.has(category))throw Error('Invalid document category');
 if(!file||typeof file!=='object'||!Number.isSafeInteger(file.size)||
    file.size<1||file.size>MAX_ATTACHMENT_BYTES)throw Error('File must be 1 byte to 5 MiB');
 if(!Object.hasOwn(types,file.type))throw Error('Unsupported PDF or image MIME type');
 if(category==='profile_photo'&&file.type==='application/pdf')throw Error('Photo must be PNG or JPEG');
 if(typeof file.slice!=='function')throw Error('Invalid browser File');
 return {
  mimeType:file.type,sizeBytes:file.size,originalFilename:sanitizeFilename(file.name),
  ext:types[file.type]
 };
}
export async function checkMagicBytes(file,meta) {
 const bytes=new Uint8Array(await file.slice(0,16).arrayBuffer());
 const png=bytes.length>=8 && [137,80,78,71,13,10,26,10].every((x,i)=>bytes[i]===x);
 const jpeg=bytes.length>=3 && bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 const pdf=bytes.length>=5 && [37,80,68,70,45].every((x,i)=>bytes[i]===x);
 if(!((meta.mimeType==='image/png'&&png)||
      (meta.mimeType==='image/jpeg'&&jpeg)||
      (meta.mimeType==='application/pdf'&&pdf)))throw Error('File signature does not match MIME');
}
export function ownerObjectPath(petId,uploaderUid,extension,randomId) {
 if(![petId,uploaderUid,randomId].every(x=>typeof x==='string'&&uuid.test(x))||
     !['png','jpg','pdf'].includes(extension))throw Error('Unsafe patient file path');
 return `pets/${petId}/owners/${uploaderUid}/${randomId}.${extension}`;
}
export function clinicObjectPath(petId,extension,randomId) {
 if(![petId,randomId].every(x=>typeof x==='string'&&uuid.test(x))||
    !['png','jpg','pdf'].includes(extension))throw Error('Unsafe clinic file path');
 return `pets/${petId}/clinic/${randomId}.${extension}`;
}
export function verifyAttachmentRow(row,petId) {
 if(!row||row.pet_id!==petId||typeof row.object_path!=='string'||
    !row.object_path.startsWith('pets/'+petId+'/'))throw Error('Attachment/patient reference mismatch');
 return row;
}
