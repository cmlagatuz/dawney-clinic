// Pure, framework-free helpers for the Phase 4 patient form (no network, no Supabase).
// Database constraints and RLS remain the authority; this only drives the UI.

export const GROUP_ORDER = ['companion', 'livestock', 'birds', 'reptiles_amphibians', 'aquatic', 'other']
export const GROUP_LABELS = {
  companion: 'Companion animals',
  livestock: 'Livestock & farm animals',
  birds: 'Birds',
  reptiles_amphibians: 'Reptiles & amphibians',
  aquatic: 'Fish & aquatic animals',
  other: 'Exotic & other animals',
}

export function normalizeSearch(text) {
  return String(text ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Active species only, filtered by label / scientific name, grouped in a stable clinical order. Empty groups are dropped. */
export function groupSpecies(options, query = '') {
  const q = normalizeSearch(query)
  const known = new Set(GROUP_ORDER)
  const groups = new Map(GROUP_ORDER.map(g => [g, []]))
  for (const o of options ?? []) {
    if (!o || o.is_active === false) continue
    const hay = normalizeSearch(`${o.label} ${o.scientific_name ?? ''}`)
    if (q && !hay.includes(q)) continue
    groups.get(known.has(o.group_name) ? o.group_name : 'other').push(o)
  }
  return GROUP_ORDER.map(g => ({
    group: g,
    label: GROUP_LABELS[g],
    items: groups.get(g).slice().sort((a, b) => a.label.localeCompare(b.label)),
  })).filter(g => g.items.length > 0)
}

export function flattenGroups(groups) {
  return groups.flatMap(g => g.items)
}

/** Choosing a different species always clears the previous breed; re-choosing the same one keeps it. */
export function selectSpecies(state, speciesId) {
  if (state.speciesId === speciesId) return state
  return { speciesId, breedId: null }
}

/** Breed control state: disabled until a species exists, and while breeds load or fail. */
export function breedControl(speciesId, status, count) {
  if (!speciesId) return { disabled: true, hint: 'Choose a species first.' }
  if (status === 'loading') return { disabled: true, hint: 'Loading breeds…' }
  if (status === 'error') return { disabled: true, hint: 'Breeds could not be loaded.' }
  if (count === 0) return { disabled: true, hint: 'No breeds are listed for this animal type. You can leave this blank.' }
  return { disabled: false, hint: 'Optional. Only breeds valid for the selected species are shown.' }
}

/** A breed id is only acceptable if it is among the breeds loaded for the currently selected species. */
export function breedIsLoadedFor(breedId, breeds) {
  return breedId === null || breeds.some(b => b.id === breedId)
}

export const emptyUpload = { status: 'idle', file: null, message: '', objectPath: null }

/** Upload state machine per attachment category. */
export function uploadReducer(state, action) {
  switch (action.type) {
    case 'select': return { status: 'ready', file: action.file, message: '', objectPath: null }
    case 'invalid': return { status: 'error', file: null, message: action.message, objectPath: null }
    case 'remove': return emptyUpload
    case 'start': return { ...state, status: 'uploading', message: '' }
    case 'saved': return { status: 'saved', file: state.file, message: '', objectPath: null }
    case 'unindexed': return { status: 'unindexed', file: state.file, message: 'The file reached private storage but could not be recorded. Retry to finish.', objectPath: action.objectPath }
    case 'error': return { ...state, status: 'error', message: action.message }
    default: return state
  }
}

/** Files that still need work when the patient is saved or the user retries. */
export function pendingUploads(uploads) {
  return Object.entries(uploads).filter(([, u]) => u.file && (u.status === 'ready' || u.status === 'error' || u.status === 'unindexed')).map(([category]) => category)
}

/** Only known, user-actionable adapter messages are shown; anything else becomes a generic retry message. */
export function friendlyUploadError(err) {
  const msg = err instanceof Error ? err.message : ''
  if (/^(File |Unsupported|Photo must|Invalid document|File signature|File needs|Private file upload failed|Verified session|This patient|Patient is unavailable)/.test(msg)) return msg
  return 'The file could not be uploaded. Check your connection and try again.'
}

export function formatBytes(n) {
  if (!Number.isFinite(n) || n < 0) return ''
  return n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`
}
