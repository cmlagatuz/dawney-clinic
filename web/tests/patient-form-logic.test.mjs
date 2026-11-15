import test from 'node:test'
import assert from 'node:assert/strict'
import { groupSpecies, flattenGroups, selectSpecies, breedControl, breedIsLoadedFor, uploadReducer, emptyUpload, pendingUploads, friendlyUploadError, normalizeSearch } from '../src/patient-form-logic.mjs'

const sp = (id, label, group_name, extra = {}) => ({ id, label, group_name, scientific_name: null, is_active: true, ...extra })
const species = [
  sp('dog', 'Dog', 'companion', { scientific_name: 'Canis lupus familiaris' }), sp('cat', 'Cat', 'companion'),
  sp('cattle', 'Cattle', 'livestock', { scientific_name: 'Bos taurus' }), sp('goat', 'Goat', 'livestock'),
  sp('parrot', 'Parrot', 'birds'), sp('bearded-dragon', 'Bearded dragon', 'reptiles_amphibians'),
  sp('goldfish', 'Goldfish', 'aquatic'), sp('ferret', 'Ferret', 'other'), sp('retired', 'Retired', 'other', { is_active: false }),
  sp('weird', 'Weird', 'unknown_group'),
]

test('species are grouped in clinical order covering companion, livestock, birds, reptiles, fish and exotic', () => {
  const g = groupSpecies(species)
  assert.deepEqual(g.map(x => x.group), ['companion', 'livestock', 'birds', 'reptiles_amphibians', 'aquatic', 'other'])
  assert.ok(flattenGroups(g).some(s => s.id === 'cattle'))
  assert.ok(!flattenGroups(g).some(s => s.id === 'retired'), 'inactive species are never offered')
  assert.ok(g.at(-1).items.some(s => s.id === 'weird'), 'unknown groups fall back to exotic & other')
})
test('search matches label, scientific name, case and accents; empty groups disappear', () => {
  assert.deepEqual(flattenGroups(groupSpecies(species, 'CATT')).map(s => s.id), ['cattle'])
  assert.deepEqual(flattenGroups(groupSpecies(species, 'bos taurus')).map(s => s.id), ['cattle'])
  assert.deepEqual(groupSpecies(species, 'zzz'), [])
  assert.equal(normalizeSearch('  Café  Au  '), 'cafe au')
})
test('changing species resets the breed; re-selecting the same species keeps it', () => {
  const s = { speciesId: 'dog', breedId: 'chow-chow' }
  assert.deepEqual(selectSpecies(s, 'cattle'), { speciesId: 'cattle', breedId: null })
  assert.equal(selectSpecies(s, 'dog'), s)
})
test('breed control is disabled until a species is chosen and while loading/failed/empty', () => {
  assert.equal(breedControl(null, 'idle', 0).disabled, true)
  assert.equal(breedControl('dog', 'loading', 0).disabled, true)
  assert.equal(breedControl('dog', 'error', 0).disabled, true)
  assert.equal(breedControl('cattle', 'ready', 0).disabled, true)
  assert.equal(breedControl('dog', 'ready', 5).disabled, false)
})
test('a breed must be one of the breeds loaded for the current species', () => {
  assert.equal(breedIsLoadedFor(null, []), true)
  assert.equal(breedIsLoadedFor('chow-chow', [{ id: 'chow-chow' }]), true)
  assert.equal(breedIsLoadedFor('holstein', [{ id: 'chow-chow' }]), false)
})
test('upload state machine: select → uploading → saved, error retry, unindexed keeps object path', () => {
  const f = { name: 'a.png' }
  let s = uploadReducer(emptyUpload, { type: 'select', file: f })
  assert.equal(s.status, 'ready'); s = uploadReducer(s, { type: 'start' }); assert.equal(s.status, 'uploading')
  s = uploadReducer(s, { type: 'error', message: 'x' }); assert.equal(s.status, 'error'); assert.equal(s.file, f, 'file kept for retry')
  assert.deepEqual(pendingUploads({ health_card: s, profile_photo: emptyUpload }), ['health_card'])
  s = uploadReducer(s, { type: 'unindexed', objectPath: 'pets/p/owners/u/k.png' }); assert.equal(s.objectPath, 'pets/p/owners/u/k.png')
  assert.deepEqual(pendingUploads({ a: s }), ['a'])
  s = uploadReducer(s, { type: 'saved' }); assert.deepEqual(pendingUploads({ a: s }), [])
  assert.equal(uploadReducer(s, { type: 'remove' }).status, 'idle')
})
test('upload errors expose only safe, actionable messages', () => {
  assert.equal(friendlyUploadError(new Error('File must be 1 byte to 5 MiB')), 'File must be 1 byte to 5 MiB')
  assert.match(friendlyUploadError(new Error('relation "storage.objects" violates row-level security')), /could not be uploaded/)
  assert.match(friendlyUploadError('boom'), /could not be uploaded/)
})

import { retryMode, uploadsBusy, savedToClear, uploadReducer as ur, emptyUpload as eu } from '../src/patient-form-logic.mjs'
const f = { name: 'a.pdf', type: 'application/pdf', size: 4 }
test('retryMode: a retained private object path is ONLY finalised, whatever the status (unindexed or error after failed finalisation)', () => {
  let s = ur(eu, { type: 'select', file: f })
  assert.equal(retryMode(s), 'upload')
  s = ur(ur(s, { type: 'start' }), { type: 'unindexed', objectPath: 'pets/p/x' })
  assert.equal(retryMode(s), 'finalize')
  s = ur(ur(s, { type: 'start' }), { type: 'error', message: 'boom' })        // finalisation failed
  assert.equal(s.status, 'error'); assert.equal(s.objectPath, 'pets/p/x')
  assert.equal(retryMode(s), 'finalize')                                      // the regression: previously fell through to a second upload
  assert.equal(retryMode(ur(ur(s, { type: 'start' }), { type: 'saved' })), 'upload')   // saved clears the path
})
test('retryMode: an upload that failed before reaching storage (no path) uploads again; no file → upload', () => {
  const s = ur(ur(ur(eu, { type: 'select', file: f }), { type: 'start' }), { type: 'error', message: 'net' })
  assert.equal(s.objectPath, null); assert.equal(retryMode(s), 'upload')
  assert.equal(retryMode({ ...eu, objectPath: 'pets/p/x' }), 'upload')         // path without a file is never finalised
  assert.equal(retryMode(null), 'upload')
})
test('uploadsBusy: true only while a transfer is in flight', () => {
  const u = { a: eu, b: { ...eu, status: 'ready', file: f } }
  assert.equal(uploadsBusy(u), false)
  assert.equal(uploadsBusy({ ...u, b: ur(u.b, { type: 'start' }) }), true)
  assert.equal(uploadsBusy(undefined), false)
})
test('savedToClear: saved pending files are dropped only after metadata is synced; unsaved/failed files are never touched', () => {
  const saved = ur(ur(ur(eu, { type: 'select', file: f }), { type: 'start' }), { type: 'saved' })
  const ready = ur(eu, { type: 'select', file: f })
  const failed = ur(ur(ready, { type: 'start' }), { type: 'error', message: 'x' })
  const u = { health_card: saved, vaccination_card: ready, profile_photo: failed }
  assert.deepEqual(savedToClear(u, false), [])
  assert.deepEqual(savedToClear(u, true), ['health_card'])
})
