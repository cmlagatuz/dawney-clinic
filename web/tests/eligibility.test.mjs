import test from 'node:test'
import assert from 'node:assert/strict'
import { petEligibility, annotatePets, firstEligibleId, eligibilityHelp, eligibilityNote } from '../src/public-site/eligibility.mjs'

const sp = (id, o = {}) => ({ id, is_active: true, clinic_supported: true, review_status: 'curated', ...o })
const species = [sp('dog'), sp('cattle', { clinic_supported: false }), sp('x-pending', { review_status: 'pending' }), sp('old', { is_active: false })]
const map = new Map(species.map(s => [s.id, s]))

test('eligible only for typed, active, supported, non-pending species', () => {
  assert.equal(petEligibility({ id: 'a', species_id: 'dog' }, map), 'eligible')
  assert.equal(petEligibility({ id: 'a', species_id: 'cattle' }, map), 'unsupported')
  assert.equal(petEligibility({ id: 'a', species_id: 'x-pending' }, map), 'unsupported')
  assert.equal(petEligibility({ id: 'a', species_id: 'old' }, map), 'unsupported')
})
test('legacy/uncategorised or review-flagged records need review; never inferred from the free-text label', () => {
  assert.equal(petEligibility({ id: 'a', species: 'Dog', species_id: null }, map), 'review')
  assert.equal(petEligibility({ id: 'a', species: 'Dog' }, map), 'review')
  assert.equal(petEligibility({ id: 'a', species_id: 'dog', taxonomy_review_needed: true }, map), 'review')
})
test('unverifiable → unknown (fail closed)', () => {
  assert.equal(petEligibility({ id: 'a', species_id: 'nope' }, map), 'unknown')
  assert.equal(petEligibility({ id: 'a', species_id: 'dog' }, new Map()), 'unknown')
  assert.equal(petEligibility(null, map), 'unknown')
})
test('annotate keeps every record, picks first eligible, and messages never promise treatment', () => {
  const pets = [{ id: '1', species_id: null }, { id: '2', species_id: 'cattle' }, { id: '3', species_id: 'dog' }]
  const a = annotatePets(pets, species)
  assert.equal(a.length, 3); assert.equal(firstEligibleId(a), '3'); assert.equal(firstEligibleId(a.slice(0, 2)), '')
  for (const k of ['unsupported', 'review', 'unknown']) { assert.ok(eligibilityNote(k)); assert.match(eligibilityHelp(k), /clinic/); assert.doesNotMatch(eligibilityHelp(k), /will treat|guarantee|available slot/i) }
  assert.equal(eligibilityHelp('eligible'), '')
})
