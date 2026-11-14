import { useEffect, useId, useRef, useState } from 'react'
import { Icon, Spinner } from './ui'
import type { AttachmentCategory, PetAttachment } from '../lib/pet-attachments'
import { validateAttachmentInfo } from '../attachment-policy.mjs'
import { formatBytes, friendlyUploadError, type UploadState } from '../patient-form-logic.mjs'

/** Previews use data: URLs because the site CSP allows `img-src 'self' data:` (no blob:). */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => typeof r.result === 'string' ? resolve(r.result) : reject(new Error('Preview unavailable'))
    r.onerror = () => reject(new Error('Preview unavailable'))
    r.readAsDataURL(blob)
  })
}

type Props = {
  category: AttachmentCategory
  label: string
  hint: string
  accept: string
  state: UploadState
  existing: PetAttachment | null
  onSelect: (file: File) => void
  onInvalid: (message: string) => void
  onRemove: () => void
  onRetry: () => void
  onDownload: (attachment: PetAttachment) => Promise<void>
  disabled?: boolean
}

/** One optional private document slot: pick → preview → upload status → retry/replace/download. No public URLs. */
export function AttachmentField({ category, label, hint, accept, state, existing, onSelect, onInvalid, onRemove, onRetry, onDownload, disabled }: Props) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [dl, setDl] = useState<'idle' | 'busy' | 'error'>('idle')

  useEffect(() => {
    const f = state.file
    if (!f || !f.type.startsWith('image/')) { setPreview(null); return }
    let live = true
    void blobToDataUrl(f).then(url => { if (live) setPreview(url) }).catch(() => { if (live) setPreview(null) })
    return () => { live = false }
  }, [state.file])

  function pick(file: File | undefined) {
    if (!file) return
    try { validateAttachmentInfo(file, category) } catch (e) { onInvalid(friendlyUploadError(e)); if (input.current) input.current.value = ''; return }
    onSelect(file)
  }
  async function download() {
    if (!existing) return
    setDl('busy')
    try { await onDownload(existing); setDl('idle') } catch { setDl('error') }
  }
  const busy = state.status === 'uploading'
  const statusText = state.status === 'uploading' ? 'Uploading privately…' : state.status === 'saved' ? 'Saved securely' : state.status === 'ready' ? 'Ready — uploads when you save' : state.status === 'unindexed' ? 'Upload needs finishing' : state.status === 'error' ? 'Upload failed' : ''

  return <fieldset className="attachment" disabled={disabled}>
    <legend>{label} <span className="tag">Optional</span></legend>
    <p className="field-help" id={`${id}-hint`}>{hint}</p>
    <div className="attachment-body">
      <div className="attachment-thumb" aria-hidden={preview ? undefined : true}>
        {preview ? <img src={preview} alt={`Preview of selected ${label.toLowerCase()}`} /> : <Icon name={category === 'profile_photo' ? 'paw' : 'shield'} width={26} height={26} />}
      </div>
      <div className="attachment-info">
        {state.file ? <p className="attachment-name"><strong>{state.file.name}</strong> <small>{formatBytes(state.file.size)}</small></p>
          : existing ? <p className="attachment-name"><strong>{existing.original_filename}</strong> <small>version {existing.version_no} · {formatBytes(existing.size_bytes)}</small></p>
          : <p className="attachment-name field-help">No file selected.</p>}
        <p className={`attachment-status status-${state.status}`} role="status" aria-live="polite">
          {busy && <Spinner />} {statusText}</p>
        {state.message && <p className="error-text" role="alert">{state.message}</p>}
        {dl === 'error' && <p className="error-text" role="alert">The file could not be downloaded. Please try again.</p>}
        <div className="form-actions">
          <input ref={input} id={id} className="visually-hidden-input" type="file" accept={accept} aria-describedby={`${id}-hint`} disabled={busy}
            onChange={e => { pick(e.target.files?.[0]); e.target.value = '' }} />
          <label htmlFor={id} className="button button-secondary button-small file-button">{state.file || existing ? 'Choose replacement' : 'Choose file'}</label>
          {state.file && !busy && state.status !== 'saved' && <button type="button" className="button-quiet" onClick={onRemove}>Remove</button>}
          {(state.status === 'error' || state.status === 'unindexed') && state.file && <button type="button" className="button button-secondary button-small" onClick={onRetry}>Retry upload</button>}
          {existing && !state.file && <button type="button" className="button button-secondary button-small" disabled={dl === 'busy'} onClick={() => void download()}>{dl === 'busy' ? 'Preparing…' : 'Download'}</button>}
        </div>
      </div>
    </div>
  </fieldset>
}
