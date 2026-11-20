import test from 'node:test'
import assert from 'node:assert/strict'
import {CLINICAL_SECTIONS,DRAFT_FIELDS,newDraft,validateClinicalDraft,selectPatientVisits} from '../src/clinical/draft.mjs'

test('CLOUD clinical sections contain navigation for encounter, history and orders',()=>{
  assert.deepEqual(CLINICAL_SECTIONS.map(s=>s.id),
    ['overview','visits','history','encounter','treatments','vaccinations','prescriptions'])
  assert.deepEqual(Object.keys(DRAFT_FIELDS),
    ['encounter','treatments','vaccinations','prescriptions'])
})
test('every draft starts empty; cannot validate an empty encounter or submit by default',()=>{
  const draft=newDraft('encounter')
  assert.equal(Object.values(draft).every(v=>v===''),true)
  const check=validateClinicalDraft('encounter',draft)
  assert.equal(check.valid,false)
  assert.equal(check.errors.assessment,'This field is required.')
})
test('complete encounter draft validates in-memory only, no save method',()=>{
  const draft={complaint:'Fixture symptom',examination:'Fixture examination',assessment:'Fixture assessment',plan:''}
  assert.deepEqual(validateClinicalDraft('encounter',draft),{valid:true,errors:{}})
})
test('treatment needs procedure and details',()=>{
  const d=newDraft('treatments');d.procedure='Fixture procedure'
  assert.equal(validateClinicalDraft('treatments',d).errors.details,'This field is required.')
  d.details='Fixture description'
  assert.equal(validateClinicalDraft('treatments',d).valid,true)
})
test('vaccination requires valid date and lot; no fabricated actual administration',()=>{
  const d={product:'Fixture vaccine',administeredOn:'2026-02-30',lot:'Fixture lot',notes:''}
  assert.match(validateClinicalDraft('vaccinations',d).errors.administeredOn,/valid calendar date/)
  d.administeredOn='2026-02-28'
  assert.equal(validateClinicalDraft('vaccinations',d).valid,true)
  d.lot=''
  assert.equal(validateClinicalDraft('vaccinations',d).valid,false)
})
test('prescription requires medication, directions and duration',()=>{
  const d=newDraft('prescriptions')
  d.medicine='Fixture drug'
  d.instructions='Fixture clinician directions'
  assert.equal(validateClinicalDraft('prescriptions',d).errors.duration,'This field is required.')
  d.duration='Fixture duration'
  assert.equal(validateClinicalDraft('prescriptions',d).valid,true)
})
test('unprintable text and overlength notes fail rather than silently truncate',()=>{
  const a={complaint:'a\u0001',examination:'x',assessment:'y',plan:''}
  assert.match(validateClinicalDraft('encounter',a).errors.complaint,/control characters/)
  a.complaint='x'.repeat(1001)
  assert.match(validateClinicalDraft('encounter',a).errors.complaint,/1000/)
})
test('unsupported or malformed drafts fail closed',()=>{
  assert.equal(validateClinicalDraft('history',{}).valid,false)
  assert.equal(validateClinicalDraft('encounter',null).valid,false)
  assert.equal(validateClinicalDraft('encounter',{complaint:999}).valid,false)
})
test('visits never come from guessed or unrelated patient identifiers',()=>{
  const rows=[
    {pet_id:'p-a',starts_at:'2026-11-20T10:00:00Z'},
    {pet_id:'p-b',starts_at:'2026-11-20T09:00:00Z'},
    {pet_id:'p-a',starts_at:'2026-11-20T08:00:00Z'}]
  assert.deepEqual(selectPatientVisits({items:rows},'p-a'),[rows[0],rows[2]])
  assert.deepEqual(selectPatientVisits({items:rows},'p-forged'),[])
  assert.deepEqual(selectPatientVisits(null,'p-a'),[])
})
test('clinical read adapter imports branch-scoped source only (no unscoped patient/history helper)',async()=>{
  const fs=await import('node:fs/promises')
  const source=await fs.readFile(new URL('../src/clinical/port.ts',import.meta.url),'utf8')
  assert.match(source,/listBranchQueueWindow/)
  assert.match(source,/assertStaffBranch/)
  assert.doesNotMatch(source,/import\s*\{[^}]*listClinicPatients/)
  assert.doesNotMatch(source,/import\s*\{[^}]*listClinicClinicalRecords/)
  assert.doesNotMatch(source,/\.insert\(|\.update\(|\.delete\(|\.upsert\(/)
})
