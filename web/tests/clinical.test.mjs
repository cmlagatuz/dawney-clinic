import test from 'node:test'
import assert from 'node:assert/strict'
import {cleanPet,cleanBooking,friendlyBookingError} from '../src/clinical.mjs'

const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
test('pet validation strips owner forgery and invalid dates',()=>{
  assert.deepEqual(cleanPet({name:' Luna ',species:' Dog ',owner_id:B,sex:'female'}),
    {name:'Luna',species:'Dog',breed:null,color:null,sex:'female',birth_date:null})
  assert.throws(()=>cleanPet({name:'Luna',species:'Dog',birth_date:'2024-02-30'}),/Birth date/)
  assert.throws(()=>cleanPet({name:'Luna',species:'Dog',sex:'other'}),/Invalid/)
})
test('booking is always 30 minutes, UTC-converted and cannot forge owner/status',()=>{
  const now=new Date('2031-01-01T00:00:00Z')
  const slot=cleanBooking({petId:A,resourceId:B,startsAt:'2031-01-02T11:00:00Z',concern:' Consultation ',
    status:'completed',owner_id:B,created_by:B},now)
  assert.equal(slot.starts_at,'2031-01-02T11:00:00.000Z')
  assert.equal(slot.ends_at,'2031-01-02T11:30:00.000Z')
  assert.equal(slot.concern,'Consultation')
  assert.equal(Object.hasOwn(slot,'owner_id'),false)
  assert.equal(Object.hasOwn(slot,'status'),false)
  assert.throws(()=>cleanBooking({petId:A,resourceId:B,startsAt:'2030-01-01',concern:'Visit'},now),/future/)
})
test('conflicting Postgres exclusion yields a clear booking retry explanation',()=>{
  assert.match(friendlyBookingError('23P01'),/already reserved/)
  assert.match(friendlyBookingError('42501'),/permission/)
})