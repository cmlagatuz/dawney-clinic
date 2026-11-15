import type { PetAttachment } from './lib/pet-attachments'
export type AttachmentEntry = { key: string; status: 'ready' | 'error'; list?: PetAttachment[]; rev?: number }
export type AttachmentView = { status: 'idle' | 'loading' | 'error'; list: [] } | { status: 'ready'; list: PetAttachment[] }
export function attachmentKey(userId: string | null | undefined, petId: string | null | undefined): string
export function attachmentView(key: string, entry: AttachmentEntry | null): AttachmentView
export function attachmentsForPet(view: AttachmentView, petId: string): PetAttachment[]
export function canActOnAttachment(view: AttachmentView, petId: string | null, attachment: PetAttachment | null | undefined): boolean
export function documentsLocked(editingPetId: string | null, view: AttachmentView): boolean
export function attachmentErrorText(): string
/** True once the lookup for the current account+patient has settled successfully AND no newer refresh is pending. */
export function metadataSynced(view: AttachmentView, refreshing: boolean): boolean
