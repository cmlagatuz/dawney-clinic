import { useCallback, useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { listPatientAttachments } from '../lib/pet-attachments'
import { attachmentKey, attachmentView, type AttachmentEntry, type AttachmentView } from '../attachment-load.mjs'

/**
 * Private attachment metadata for one patient. Refetches when the signed-in account or patient changes. The returned view is derived
 * against the current account+patient, so an older response (previous patient, previous account, cancelled form, unmounted page)
 * can never appear, and a failed/denied read is an explicit error, never an empty list.
 */
export function usePatientAttachments(user: User | null, petId: string | null): AttachmentView & { reload: () => void; refreshing: boolean } {
  const userId = user?.id ?? null
  const key = attachmentKey(userId, petId)
  const [entry, setEntry] = useState<AttachmentEntry | null>(null)
  const [n, setN] = useState(0)
  useEffect(() => {
    // Keep a settled entry only if it is for this exact account+patient (a refresh); anything else is dropped immediately.
    setEntry(prev => (prev && prev.key === key ? prev : null))
    if (!user || !key || !petId) return
    let live = true
    listPatientAttachments(user, petId)
      .then(list => { if (live) setEntry({ key, status: 'ready', list, rev: n }) })
      .catch(() => { if (live) setEntry({ key, status: 'error', rev: n }) })
    return () => { live = false }
    // `user` identity may change on token refresh; the account is identified by its id.
  }, [userId, petId, key, n])
  const reload = useCallback(() => setN(v => v + 1), [])
  // A refresh of an already-settled list (e.g. after a successful upload) keeps the old list visible but is flagged, so callers can tell it is not yet authoritative.
  const refreshing = Boolean(key && entry && entry.key === key && entry.rev !== n)
  return useMemo(() => ({ ...attachmentView(key, entry), reload, refreshing }), [key, entry, reload, refreshing])
}
