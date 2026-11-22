import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { Link } from 'react-router'
import { useAuth } from '../hooks/AuthProvider'
import { readOwner } from '../lib/owners'
import { addCatalogPet, editCatalogPet, listAnimalTypes, listBreedsForSpecies, listCatalogPets, type CatalogPet, type SpeciesOption } from '../lib/taxonomy'
import { currentAttachment, downloadPatientAttachment, finalizeUploadedAttachment, listPatientAttachments, uploadPatientAttachment, type AttachmentCategory } from '../lib/pet-attachments'
import { usePatientAttachments } from '../hooks/usePatientAttachments'
import { attachmentErrorText, attachmentsForPet, canActOnAttachment, documentsLocked, metadataSynced } from '../attachment-load.mjs'
import { sanitizeFilename } from '../attachment-policy.mjs'
import { emptyUpload, friendlyUploadError, pendingUploads, retryMode, savedToClear, uploadsBusy, uploadReducer, type UploadAction, type UploadState } from '../patient-form-logic.mjs'
import { AttachmentField, blobToDataUrl } from '../components/AttachmentField'
import { SpeciesBreedFields, type Taxonomy } from '../components/SpeciesBreedFields'
import { EmptyState, Icon, LoadingCard, PageHeading, Spinner } from '../components/ui'

/**
 * Phase 4 patient form: catalog-backed Species/Breed + three optional private attachments.
 * Rendered only when VITE_PHASE4_PATIENT_FORM === 'true' (see App.tsx); the legacy PetsPage stays the default
 * until the supervisor activates the Phase 4 migrations and confirms live checks.
 */
type Fields = { name: string; sex: 'male' | 'female' | 'unknown'; color: string; birth_date: string }
const emptyFields: Fields = { name: '', sex: 'unknown', color: '', birth_date: '' }
const categories: Array<{ category: AttachmentCategory; label: string; hint: string; accept: string }> = [
  { category: 'profile_photo', label: 'Profile photo', hint: 'PNG or JPEG, up to 5 MB. Shown on the patient card.', accept: 'image/png,image/jpeg' },
  { category: 'health_card', label: 'Health card', hint: 'PDF, PNG or JPEG, up to 5 MB. Stored privately.', accept: 'application/pdf,image/png,image/jpeg' },
  { category: 'vaccination_card', label: 'Vaccination card', hint: 'PDF, PNG or JPEG, up to 5 MB. Stored privately.', accept: 'application/pdf,image/png,image/jpeg' },
]
type Uploads = Record<AttachmentCategory, UploadState>
const emptyUploads: Uploads = { profile_photo: emptyUpload, health_card: emptyUpload, vaccination_card: emptyUpload }
const safeMessage = /^(Enter|Invalid|Birth date|Create|Select|Selected|Breed|Owner)/

function PatientPhoto({ petId, name, version }: { petId: string; name: string; version: number }) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const key = `${userId}:${petId}`
  const [shown, setShown] = useState<{ key: string; src: string | null } | null>(null)
  const src = shown && shown.key === key ? shown.src : null // never show another account's/patient's photo
  useEffect(() => {
    if (!user) return
    let live = true
    void (async () => {
      try {
        const current = currentAttachment(await listPatientAttachments(user, petId), 'profile_photo')
        if (!current) { if (live) setShown({ key, src: null }); return }
        const url = await blobToDataUrl(await downloadPatientAttachment(user, petId, current.id))
        if (live) setShown({ key, src: url })
      } catch { if (live) setShown({ key, src: null }) /* decorative paw fallback only; the edit form reports read failures explicitly */ }
    })()
    return () => { live = false }
  }, [userId, petId, key, version]) // keyed by account id: a token refresh (new user object, same id) must not refetch or blank the photo
  return <div className="patient-avatar" aria-hidden={src ? undefined : true}>{src ? <img src={src} alt={`Photo of ${name}`} /> : <Icon name="paw" />}</div>
}

export function PetsPageCatalog() {
  const { user } = useAuth()
  return user ? <OwnerPetsPageCatalog key={user.id} user={user} /> : null
}

/** Keep all edit, download, upload and private photo state inside the current account. */
function OwnerPetsPageCatalog({ user }: { user: User }) {
  const [pets, setPets] = useState<CatalogPet[]>([])
  const [species, setSpecies] = useState<SpeciesOption[]>([])
  const [speciesStatus, setSpeciesStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [speciesTry, setSpeciesTry] = useState(0)
  const [ownerReady, setOwnerReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [fields, setFields] = useState<Fields>(emptyFields)
  const [taxonomy, setTaxonomy] = useState<Taxonomy>({ speciesId: null, breedId: null })
  const [speciesError, setSpeciesError] = useState<string | null>(null)
  const [legacy, setLegacy] = useState<string | undefined>()
  const [editing, setEditing] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [uploads, setUploads] = useState<Uploads>(emptyUploads)
  const att = usePatientAttachments(user, editing)
  const authorizedRows = attachmentsForPet(att, editing ?? '')
  // Ignore private metadata that claims this patient but references a
  // different patient's Storage path; never show its filename or downloads.
  const malformedMetadata = Boolean(editing && authorizedRows.some(row =>
    typeof row.object_path !== 'string' || !row.object_path.startsWith('pets/' + editing + '/')))
  const existing = malformedMetadata ? [] : authorizedRows
  const locked = documentsLocked(editing, att) || malformedMetadata
  const userId = user?.id ?? null
  const accountRef = useRef(userId) // latest signed-in account id; async work that started under another account checks it before writing
  accountRef.current = userId
  const uploadBusy = uploadsBusy(uploads)
  const busy = saving || uploadBusy // the form may not be saved, closed or re-targeted while anything is in flight
  const session = useRef(0) // bumped whenever the form is closed/re-targeted or the account changes; late async work checks it
  const [photoVersion, setPhotoVersion] = useState(0)
  const transferActive = useRef(false)
  const uploadsRef = useRef(uploads)
  uploadsRef.current = uploads
  const formRef = useRef<HTMLDivElement>(null)

  const loadBreeds = useCallback((id: string) => listBreedsForSpecies(id), [])
  const dispatch = (c: AttachmentCategory, a: UploadAction) => setUploads(u => ({ ...u, [c]: uploadReducer(u[c], a) }))
  const attReload = att.reload

  async function reload() {
    if (!user) return
    const uid = user.id
    const [owner, items] = await Promise.all([readOwner(user), listCatalogPets(user)])
    if (accountRef.current !== uid) return // the account changed while loading: never show another account's patients
    setOwnerReady(Boolean(owner)); setPets(items)
  }
  useEffect(() => {
    if (!user) return
    let live = true
    setLoading(true)
    void Promise.all([readOwner(user), listCatalogPets(user)]).then(([owner, items]) => { if (live) { setOwnerReady(Boolean(owner)); setPets(items) } })
      .catch(() => { if (live) setError('Unable to load patients. Please try again.') }).finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [userId])
  useEffect(() => {
    let live = true
    setSpeciesStatus('loading')
    listAnimalTypes().then(list => { if (live) { setSpecies(list); setSpeciesStatus('ready') } }).catch(() => { if (live) setSpeciesStatus('error') })
    return () => { live = false }
  }, [speciesTry])

  function reset() {
    setFields(emptyFields); setTaxonomy({ speciesId: null, breedId: null }); setLegacy(undefined); setSpeciesError(null)
    setUploads(emptyUploads); setEditing(null); setFormOpen(false); session.current += 1
  }
  // A different signed-in account must never inherit the previous account's form, patients, messages or document list.
  useEffect(() => {
    reset(); setPets([]); setOwnerReady(false); setError(null); setNotice(null); setSaving(false)
  }, [userId])
  // Once the refreshed private metadata is authoritative, a successfully saved pending file is replaced by it (so Download works and
  // an unsaved/pending file can never be downloaded or mistaken for the stored one).
  const synced = metadataSynced(att, att.refreshing) &&
    Object.values(uploads).every(u => u.status !== 'saved' ||
      (typeof u.attachmentId === 'string' && existing.some(row => row.id === u.attachmentId)))
  useEffect(() => {
    for (const c of savedToClear(uploads, synced)) setUploads(u => (u[c as AttachmentCategory].status === 'saved' ? { ...u, [c]: uploadReducer(u[c as AttachmentCategory], { type: 'remove' }) } : u))
  }, [uploads, synced])
  function openNew() { reset(); setFormOpen(true); setNotice(null); setError(null) }
  function openEdit(pet: CatalogPet) {
    setFields({ name: pet.name, sex: pet.sex, color: pet.color ?? '', birth_date: pet.birth_date ?? '' })
    setTaxonomy({ speciesId: pet.species_id, breedId: pet.breed_id })
    setLegacy(pet.species_id ? undefined : [pet.species, pet.breed].filter(Boolean).join(' / '))
    setUploads(emptyUploads); setSpeciesError(null); session.current += 1
    setEditing(pet.id); setFormOpen(true); setError(null); setNotice(null)
    setTimeout(() => formRef.current?.querySelector<HTMLInputElement>('input')?.focus(), 0)
  }

  async function runUploads(petId: string, cats: string[]): Promise<number> {
    // An immediate second retry cannot upload the same file to a new Storage key
    // before React has rendered the disabled/busy state.
    if (transferActive.current) return cats.length
    transferActive.current = true
    let failures = 0
    const s = session.current
    const current = () => session.current === s && accountRef.current === user.id
    // false once the form was closed, re-targeted or the signed-in account changed
    const dispatch = (c: AttachmentCategory, a: UploadAction) => { if (current()) setUploads(u => ({ ...u, [c]: uploadReducer(u[c], a) })) }
    try {
    for (const c of cats as AttachmentCategory[]) {
      if (!current()) break // Never start another category after owner/patient switch.
      const u = uploadsRef.current[c]
      const file = u.file
      if (!file) continue
      dispatch(c, { type: 'start' })
      try {
        if (retryMode(u) === 'finalize' && u.objectPath) {
          // The private object already exists: only record its metadata again (never upload a second object).
          const finalized = await finalizeUploadedAttachment(user, petId, c, u.objectPath, sanitizeFilename(file.name), file.type, file.size)
          if (current()) {
            dispatch(c, { type: 'ack', attachmentId: finalized.id })
            dispatch(c, { type: 'saved' }); attReload()
          }
        } else {
          const result = await uploadPatientAttachment(user, petId, c, file, 'owners')
          if (result.status === 'saved') {
            if (current()) {
              dispatch(c, { type: 'ack', attachmentId: result.attachment.id })
              dispatch(c, { type: 'saved' }); attReload()
            }
          }
          else { dispatch(c, { type: 'unindexed', objectPath: result.objectPath }); failures += 1 }
        }
      } catch (e) { dispatch(c, { type: 'error', message: friendlyUploadError(e) }); failures += 1 }
    }
    if (current()) setPhotoVersion(v => v + 1)
    return failures
    } finally { transferActive.current = false }
  }
  async function retry(c: AttachmentCategory) {
    if (!editing) return
    const s = session.current
    const failures = await runUploads(editing, [c])
    if (session.current !== s) return
    if (failures === 0) { setError(null); setNotice('Private file metadata was recorded. Rechecking the saved document list…') }
  }

  async function save(e: FormEvent) {
    e.preventDefault(); if (!user || busy || uploadsBusy(uploadsRef.current)) return
    if (!taxonomy.speciesId) { setSpeciesError('Choose a species from the list.'); document.getElementById('patient-form-top')?.scrollIntoView(); return }
    setSaving(true); setError(null); setNotice(null); setSpeciesError(null)
    const s0 = session.current
    const uid0 = user.id
    try {
      const input = { name: fields.name, speciesId: taxonomy.speciesId, breedId: taxonomy.breedId, sex: fields.sex, color: fields.color, birth_date: fields.birth_date }
      const pet = editing ? await editCatalogPet(user, editing, input) : await addCatalogPet(user, input)
      // A successfully inserted patient must NEVER be inserted twice if the
      // subsequent list read fails or is denied. Switch to EDIT by server ID.
      const wasEditing = Boolean(editing)
      setEditing(pet.id)
      try {
        await reload()
      } catch {
        if (session.current === s0 && accountRef.current === uid0) {
          setError('Patient information reached the clinic database, but the updated list could not be verified. Retry loading rather than registering this patient again.')
        }
        return
      }
      if (session.current !== s0 || accountRef.current !== uid0) return // stale form or account
      const pending = pendingUploads(uploadsRef.current)
      if (pending.length) {
        setEditing(pet.id)
        const failures = await runUploads(pet.id, pending)
        if (session.current !== s0 || accountRef.current !== uid0) return
        if (failures > 0) { setError(`${pet.name} was saved, but ${failures === 1 ? 'one file' : `${failures} files`} could not be completed. Retry below.`); return }
      }
      if (session.current !== s0) return
      reset(); setNotice(wasEditing ? 'Patient information updated successfully.' : 'Patient saved to the clinic database.')
    } catch (err) {
      if (session.current !== s0) return
      setError(err instanceof Error && safeMessage.test(err.message) ? err.message : 'Patient could not be saved. Please check the information and try again.')
    } finally { if (accountRef.current === uid0) setSaving(false) }
  }

  const fieldUpdate = <K extends keyof Fields>(k: K, v: Fields[K]) => setFields(f => ({ ...f, [k]: v }))
  return <section className="page" aria-labelledby="pet-heading">
    <PageHeading id="pet-heading" eyebrow="Patient care" title="My patients"
      actions={ownerReady && <button className="button button-primary" type="button" onClick={openNew} disabled={busy}><Icon name="plus" width={18} height={18} />Add patient</button>}>
      Register your animals and keep their details and documents together. Records are private to your account.</PageHeading>
    {error && <p role="alert" className="alert alert-error">{error}</p>}
    {notice && <p role="status" className="alert alert-success">{notice}</p>}
    {loading ? <LoadingCard label="Loading your patients…" /> :
      !ownerReady ? <EmptyState icon="user" title="Complete your owner profile first" action={<Link className="button button-primary" to="/app/profile">Set up owner profile</Link>}>Your profile is needed to securely connect an animal to your account.</EmptyState> : <>
        {formOpen && <div className="card form-card" ref={formRef} id="patient-form-top">
          <div className="section-heading"><h2>{editing ? 'Edit patient' : 'Register a patient'}</h2><button type="button" className="button-quiet" onClick={reset} disabled={busy}>Close</button></div>
          <form className="form-stack" onSubmit={e => void save(e)} noValidate={false}>
            <div className="form-row"><label>Name<input required maxLength={150} autoComplete="off" value={fields.name} onChange={e => fieldUpdate('name', e.target.value)} /></label>
              <label>Sex<select value={fields.sex} onChange={e => fieldUpdate('sex', e.target.value as Fields['sex'])}><option value="unknown">Unknown</option><option value="female">Female</option><option value="male">Male</option></select></label></div>
            <div className="form-row">
              <SpeciesBreedFields species={species} speciesStatus={speciesStatus} onRetrySpecies={() => setSpeciesTry(n => n + 1)} value={taxonomy}
                onChange={t => { setTaxonomy(t); setSpeciesError(null) }} loadBreeds={loadBreeds} legacyText={legacy} error={speciesError} /></div>
            <div className="form-row"><label>Color (optional)<input maxLength={100} value={fields.color} onChange={e => fieldUpdate('color', e.target.value)} /></label>
              <label>Birth date (optional)<input type="date" max={new Date().toISOString().slice(0, 10)} value={fields.birth_date} onChange={e => fieldUpdate('birth_date', e.target.value)} /></label></div>
            <div className="attachment-group"><h3>Documents <span className="tag">All optional</span></h3>
              {editing && att.status === 'loading' && <p role="status" className="field-help"><Spinner /> Checking this patient’s saved documents…</p>}
              {editing && att.status === 'error' && <p role="alert" className="alert alert-error">{attachmentErrorText()} <button type="button" className="button-quiet" onClick={att.reload}>Try again</button></p>}
              {editing && malformedMetadata && <p role="alert" className="alert alert-error">This patient's private document references could not be verified. Downloads and replacements are unavailable. <button type="button" className="button-quiet" onClick={att.reload}>Retry document verification</button></p>}
              <p className="field-help">Files are uploaded to private storage when you save and are visible only to you and authorized clinic staff.</p>
              {categories.map(c => <AttachmentField key={`${editing ?? 'new'}:${c.category}`} {...c} state={uploads[c.category]} existing={currentAttachment(existing, c.category)} disabled={saving || locked} documentsStatus={editing ? att.status : 'idle'}
                onSelect={file => dispatch(c.category, { type: 'select', file })} onInvalid={message => dispatch(c.category, { type: 'invalid', message })}
                onRemove={() => dispatch(c.category, { type: 'remove' })} onRetry={() => void retry(c.category)}
                onDownload={async a => {
                  // Only metadata from a settled lookup for the selected patient may be downloaded.
                  if (!canActOnAttachment(att, editing, a)) throw new Error('Attachment is not current')
                  const s = session.current
                  const blob = await downloadPatientAttachment(user!, a.pet_id, a.id)
                  if (session.current !== s) return // form closed, patient or account changed while downloading
                  const url = URL.createObjectURL(blob); const link = document.createElement('a')
                  link.href = url; link.download = a.original_filename; document.body.appendChild(link); link.click(); link.remove()
                  setTimeout(() => URL.revokeObjectURL(url), 1000)
                }} />)}
            </div>
            {uploadBusy && !saving && <p role="status" className="field-help"><Spinner /> Finishing a private upload. Please wait before saving or closing.</p>}
            <div className="form-actions"><button disabled={busy} className="button button-primary">{saving ? 'Saving…' : editing ? 'Save patient changes' : 'Save patient'}</button>
              <button type="button" className="button button-secondary" onClick={reset} disabled={busy}>Cancel</button></div>
          </form></div>}
        {pets.length === 0 ? <EmptyState title="No patients registered yet" action={<button type="button" className="button button-primary" onClick={openNew} disabled={busy}>Register your first patient</button>}>Add an animal to book visits. Their record is saved to your account.</EmptyState> :
          <div className="patient-grid">{pets.map(pet => <article className="card patient-card" key={pet.id}>
            <div className="patient-top"><PatientPhoto petId={pet.id} name={pet.name} version={photoVersion} /><div><h2>{pet.name}</h2><p className="subtitle">{pet.species}{pet.breed ? ' · ' + pet.breed : ''}</p></div></div>
            <div className="chip-row"><span className="tag">{pet.sex === 'unknown' ? 'Sex not recorded' : pet.sex === 'female' ? 'Female' : 'Male'}</span>{pet.birth_date && <span className="tag">Born {pet.birth_date}</span>}{pet.color && <span className="tag">{pet.color}</span>}
              {pet.taxonomy_review_needed && <span className="badge badge-requested">Animal type needs review</span>}</div>
            <button type="button" className="button button-secondary button-small" aria-label={`${pet.taxonomy_review_needed ? 'Review & edit' : 'Edit details'} for ${pet.name}`} onClick={() => openEdit(pet)} disabled={busy}>{pet.taxonomy_review_needed ? 'Review & edit' : 'Edit details'}</button>
          </article>)}</div>}
      </>}
  </section>
}
