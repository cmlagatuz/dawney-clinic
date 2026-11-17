import test from 'node:test'
import assert from 'node:assert/strict'
import { serviceSpeciesView, applyServiceSpecies, canBookPet, serviceSpeciesErrorText } from '../src/public-site/service-eligibility.mjs'
import { eligibilityHelp, eligibilityNote } from '../src/public-site/eligibility.mjs'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const DOG = 'dog', CAT = 'cat'
const pets = [
  { id: 'p1', species_id: DOG, eligibility: 'eligible' },
  { id: 'p2', species_id: CAT, eligibility: 'eligible' },
  { id: 'p3', species_id: DOG, eligibility: 'review' },
  { id: 'p4', species_id: 'cattle', eligibility: 'unsupported' },
]
const ready = (serviceId, ids) => ({ serviceId, status: 'ready', ids })

test('view: idle without a service, loading until THIS service has settled', () => {
  assert.equal(serviceSpeciesView('', null).status, 'idle')
  assert.equal(serviceSpeciesView(A, null).status, 'loading')
  assert.equal(serviceSpeciesView(A, ready(A, [DOG])).status, 'ready')
})
test('stale response from the previously selected service is never current and cannot unlock a patient', () => {
  const staleForA = ready(A, [DOG, CAT])
  const v = serviceSpeciesView(B, staleForA)
  assert.equal(v.status, 'loading'); assert.equal(v.ids, null)
  assert.equal(canBookPet(pets[0], v), false)
  const stale = serviceSpeciesView(B, { serviceId: A, status: 'error', message: 'x' })
  assert.equal(stale.status, 'loading')
})
test('dog eligible for service A but not B; per-service mapping drives eligibility', () => {
  const a = applyServiceSpecies(pets, serviceSpeciesView(A, ready(A, [DOG])))
  assert.deepEqual(a.map(p => p.eligibility), ['eligible', 'service', 'review', 'unsupported'])
  const b = applyServiceSpecies(pets, serviceSpeciesView(B, ready(B, [CAT])))
  assert.deepEqual(b.map(p => p.eligibility), ['service', 'eligible', 'review', 'unsupported'])
})
test('a valid empty mapping disables every patient (offered to no animals)', () => {
  const v = serviceSpeciesView(A, ready(A, []))
  assert.equal(v.status, 'ready')
  const out = applyServiceSpecies(pets, v)
  assert.equal(out.filter(p => p.eligibility === 'eligible').length, 0)
  assert.equal(out[0].eligibility, 'service')
  assert.equal(canBookPet(pets[0], v), false)
})
test('lookup errors are not an empty mapping: block submission, keep patients unchanged, offer retry text', () => {
  for (const message of ['permission denied', 'Verified customer login required', 'Cannot verify service species eligibility', '']) {
    const v = serviceSpeciesView(A, { serviceId: A, status: 'error', message })
    assert.equal(v.status, 'error'); assert.equal(v.ids, null)
    assert.equal(applyServiceSpecies(pets, v), pets) // not relabelled "service not offered"
    assert.equal(canBookPet(pets[0], v), false)
    assert.doesNotMatch(serviceSpeciesErrorText(v), /not offered|permission|42501|supabase/i)
  }
  assert.match(serviceSpeciesErrorText({ status: 'error', message: 'Verified customer login required' }), /verified/i)
  assert.equal(serviceSpeciesView(A, { serviceId: A, status: 'ready' }).status, 'error') // malformed ready entry fails closed
})
test('submit gate needs global eligibility AND a matching settled mapping', () => {
  const v = serviceSpeciesView(A, ready(A, [DOG]))
  assert.equal(canBookPet(pets[0], v), true)
  assert.equal(canBookPet(pets[1], v), false)
  assert.equal(canBookPet(pets[2], v), false)          // review stays blocked even though dog is offered
  assert.equal(canBookPet({ id: 'z', species_id: null, eligibility: 'eligible' }, v), false)
  assert.equal(canBookPet(undefined, v), false)
  assert.equal(canBookPet(pets[0], serviceSpeciesView('', null)), false)
})
test('service reason text is explicit and never promises treatment', () => {
  assert.match(eligibilityNote('service'), /not offered for this service/)
  assert.match(eligibilityHelp('service'), /clinic/); assert.doesNotMatch(eligibilityHelp('service'), /will treat|guarantee/i)
})
