// Pure, framework-free state derivation for a patient's private attachment metadata (no network, no Supabase).
//
// A settled lookup ("entry") belongs to ONE signed-in user + ONE patient (its key). The view is always derived against the
// CURRENT key, so a response for another patient or another account is never read as current: it shows as 'loading'.
//
//  idle     – no patient is being edited (nothing to load)
//  loading  – the lookup for the current user+patient has not settled
//  error    – read failed or was denied (database/Auth/RLS/Storage). NOT the same as "no attachments".
//  ready    – an RLS-visible list for exactly this user+patient; an empty list is a true empty result
export function attachmentKey(userId, petId) {
  return typeof userId === 'string' && userId && typeof petId === 'string' && petId ? `${userId}:${petId}` : ''
}

export function attachmentView(key, entry) {
  if (!key) return { status: 'idle', list: [] }
  if (!entry || entry.key !== key) return { status: 'loading', list: [] }
  if (entry.status === 'ready' && Array.isArray(entry.list)) return { status: 'ready', list: entry.list }
  return { status: 'error', list: [] }
}

/** Defense in depth: even a ready list only exposes rows that really belong to the selected patient. */
export function attachmentsForPet(view, petId) {
  return view?.status === 'ready' ? view.list.filter(r => r && r.pet_id === petId) : []
}

/** Gate for download/replace actions: metadata must come from a settled lookup AND belong to the selected patient. */
export function canActOnAttachment(view, petId, attachment) {
  return view?.status === 'ready' && Boolean(petId) && Boolean(attachment) && attachment.pet_id === petId
    && view.list.some(r => r === attachment || r?.id === attachment.id)
}

/** Replacing/uploading for an existing patient is only offered once its saved documents were read successfully. */
export function documentsLocked(editingPetId, view) {
  return Boolean(editingPetId) && view?.status !== 'ready'
}

export function attachmentErrorText() {
  return 'We could not check this patient’s saved documents, so existing files may not be shown. Nothing was changed.'
}
