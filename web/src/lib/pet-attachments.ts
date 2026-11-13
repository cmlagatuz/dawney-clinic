import type {User} from '@supabase/supabase-js'
import {supabase} from './supabase'
import {readOwner} from './owners'
import {
 CLINICAL_BUCKET,validateAttachmentInfo,checkMagicBytes,ownerObjectPath,
 clinicObjectPath,verifyAttachmentRow
} from '../attachment-policy.mjs'

export type AttachmentCategory='profile_photo'|'health_card'|'vaccination_card'
export type AttachmentScope='owners'|'clinic'
export type PetAttachment={
 id:string;pet_id:string;category:AttachmentCategory;version_no:number;
 object_path:string;original_filename:string;mime_type:string;
 size_bytes:number;uploaded_by:string;created_at:string
}
export type UploadResult=
 |{status:'saved';attachment:PetAttachment}
 |{status:'uploaded_unindexed';objectPath:string;reason:'metadata_finalization_failed'}
const columns='id,pet_id,category,version_no,object_path,original_filename,mime_type,size_bytes,uploaded_by,created_at'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
function client(){if(!supabase)throw Error('Clinic database is not configured');return supabase}
async function actualUser(user:User){
 const {data,error}=await client().auth.getUser()
 if(error||!data.user||data.user.id!==user.id||
    !data.user.email_confirmed_at||data.user.is_anonymous)throw Error('Verified session required')
 return data.user
}
async function mayUpload(user:User,petId:string,scope:AttachmentScope){
 if(!uuid.test(petId))throw Error('Invalid patient identifier')
 const db=client()
 const {data,error}=await db.from('pets').select('id,owner_id').eq('id',petId).single()
 if(error||!data)throw Error('Patient is unavailable to this user')
 if(scope==='owners'){
  const owner=await readOwner(user)
  if(!owner||owner.id!==data.owner_id)throw Error('This patient does not belong to the signed-in owner')
 }else if(scope==='clinic'){
  const {data:staff,error:roleError}=await db.from('staff_memberships')
    .select('role,is_active').eq('user_id',user.id).maybeSingle()
  if(roleError||!staff?.is_active||!['veterinarian','administrator'].includes(staff.role)) {
   throw Error('Clinic attachment upload requires an active veterinarian or administrator')
  }
 }else throw Error('Invalid upload scope')
}
export async function listPatientAttachments(user:User,petId:string):Promise<PetAttachment[]>{
 await actualUser(user)
 if(!uuid.test(petId))throw Error('Invalid patient identifier')
 const {data,error}=await client().from('pet_attachments').select(columns)
  .eq('pet_id',petId).order('category').order('version_no',{ascending:false})
 if(error)throw error
 return (data??[]) as PetAttachment[]
}
/** Resolve latest per category using immutable version numbers, not client timestamps. */
export function currentAttachment(list:PetAttachment[],category:AttachmentCategory){
 return list.filter(row=>row.category===category)
    .sort((a,b)=>b.version_no-a.version_no)[0]??null
}
/** Only a metadata ID in the user's permitted RLS view may be downloaded.
 * No perpetual public or signed bearer URLs are issued. */
export async function downloadPatientAttachment(user:User,petId:string,attachmentId:string):Promise<Blob>{
 await actualUser(user)
 if(!uuid.test(petId)||!uuid.test(attachmentId))throw Error('Invalid attachment reference')
 const {data,error}=await client().from('pet_attachments').select(columns)
   .eq('id',attachmentId).eq('pet_id',petId).single()
 if(error||!data)throw Error('Attachment is unavailable to this account')
 verifyAttachmentRow(data,petId)
 const {data:file,error:fileError}=await client().storage.from(CLINICAL_BUCKET).download(data.object_path)
 if(fileError||!file)throw Error('Private file is unavailable')
 return file
}
/** If metadata finalization fails after a successful immutable Storage upload,
 * return the existing object key for a controlled same-user retry. No unsafe
 * Storage DELETE/UPSERT is attempted or grant added. */
export async function finalizeUploadedAttachment(
 user:User,petId:string,category:AttachmentCategory,objectPath:string,
 originalFilename:string,mimeType:string,sizeBytes:number
):Promise<PetAttachment>{
 await actualUser(user)
 if(!uuid.test(petId)||typeof objectPath!=='string'||objectPath.length>280) {
  throw Error('Invalid attachment path')
 }
 const {data,error}=await client().from('pet_attachments').insert({
  pet_id:petId,category,object_path:objectPath,original_filename:originalFilename,
  mime_type:mimeType,size_bytes:sizeBytes
 }).select(columns).single()
 if(error)throw error
 return verifyAttachmentRow(data,petId) as PetAttachment
}
export async function uploadPatientAttachment(
 user:User,petId:string,category:AttachmentCategory,file:File,
 scope:AttachmentScope='owners'
):Promise<UploadResult>{
 const verified=await actualUser(user)
 await mayUpload(verified,petId,scope)
 const meta=validateAttachmentInfo(file,category)
 await checkMagicBytes(file,meta)
 const key=crypto.randomUUID()
 const objectPath=scope==='owners'
  ?ownerObjectPath(petId,verified.id,meta.ext,key)
  :clinicObjectPath(petId,meta.ext,key)
 // No public bucket, no token in any response/log, no overwrite permissions.
 const {error}=await client().storage.from(CLINICAL_BUCKET).upload(objectPath,file,{
  cacheControl:'0',upsert:false,contentType:meta.mimeType
 })
 if(error)throw Error('Private file upload failed. Please retry with the original file.')
 try{
  const attachment=await finalizeUploadedAttachment(
   verified,petId,category,objectPath,meta.originalFilename,meta.mimeType,meta.sizeBytes
  )
  return {status:'saved',attachment}
 }catch{
  return {status:'uploaded_unindexed',objectPath,reason:'metadata_finalization_failed'}
 }
}
/** Replacements are never Storage.upsert: upload generates a fresh key and
 * DB assigns a new version_no. Historic documents remain available to authorized users. */
export const replacePatientAttachment=uploadPatientAttachment
