export const CLINICAL_BUCKET:'clinical-attachments'
export const MAX_ATTACHMENT_BYTES:number
export type AttachmentCategory='profile_photo'|'health_card'|'vaccination_card'
export type AttachmentFileMeta={
 mimeType:'image/png'|'image/jpeg'|'application/pdf';
 sizeBytes:number;originalFilename:string;ext:'png'|'jpg'|'pdf'
}
export function sanitizeFilename(name:unknown):string
export function validateAttachmentInfo(file:File,category:AttachmentCategory):AttachmentFileMeta
export function checkMagicBytes(file:File,meta:AttachmentFileMeta):Promise<void>
export function ownerObjectPath(
 petId:string,uploaderUid:string,extension:'png'|'jpg'|'pdf',randomId:string
):string
export function clinicObjectPath(
 petId:string,extension:'png'|'jpg'|'pdf',randomId:string
):string
export function verifyAttachmentRow<T extends {pet_id:string;object_path:string}>(row:T,petId:string):T
