import test from 'node:test'
import assert from 'node:assert/strict'
import {
 BOOKING_RETURN_PATH,validateBookingIntent,saveBookingIntent,readBookingIntent,
 clearBookingIntent,signinForBooking,safeBookingReturnPath,clinicSlotToUtc,
 utcToClinicSlot,validUtcInstant
} from '../src/booking-contract.mjs'
const SERVICE='88888888-8888-4888-8888-888888888888'
const RESOURCE='55555555-5555-4555-8555-555555555555'
function storage(){
 const data=new Map()
 return {
  setItem:(k,v)=>data.set(k,v),getItem:k=>data.get(k)??null,
  removeItem:k=>data.delete(k),raw:()=>[...data.entries()]
 }
}
test('anonymous signup/login continuation stores only validated non-PII intent',()=>{
 const st=storage()
 const input={serviceId:SERVICE,resourceId:RESOURCE,
  startsAtUtc:'2026-11-14T01:00:00Z',
  patientName:'DO NOT STORE',ownerEmail:'DO NOT STORE',concern:'DO NOT STORE',
  patientId:'DO NOT STORE',access_token:'DO NOT STORE'}
 assert.equal(saveBookingIntent(st,input,1000),BOOKING_RETURN_PATH)
 assert.deepEqual(readBookingIntent(st,2000),{
  serviceId:SERVICE,resourceId:RESOURCE,startsAtUtc:'2026-11-14T01:00:00Z'
 })
 const json=JSON.stringify(st.raw())
 for(const word of ['patientName','ownerEmail','concern','patientId','access_token','DO NOT STORE'])
  assert.equal(json.includes(word),false)
 assert.equal(signinForBooking(),'/auth/signin?next=%2Fbook')
 assert.equal(signinForBooking('signup'),'/auth/signup?next=%2Fbook')
 assert.equal(safeBookingReturnPath('//evil.example'),'/app/profile')
 assert.equal(safeBookingReturnPath('https://evil.example'),'/app/profile')
 assert.equal(safeBookingReturnPath('/book'),'/book')
 clearBookingIntent(st)
 assert.equal(readBookingIntent(st),null)
})
test('expired malformed or forged booking payload is discarded',()=>{
 const st=storage()
 saveBookingIntent(st,{serviceId:SERVICE},5000)
 assert.deepEqual(readBookingIntent(st,5000+29*60*1000),{serviceId:SERVICE})
 assert.equal(readBookingIntent(st,5000+31*60*1000),null)
 assert.throws(()=>validateBookingIntent({serviceId:'../test'}),/service/)
 assert.throws(()=>validateBookingIntent({serviceId:SERVICE,resourceId:'../test'}),/resource/)
 assert.throws(()=>validateBookingIntent({serviceId:SERVICE,startsAtUtc:'2026-11-14T01:00:00Z'}),/Resource/)
 assert.throws(()=>validateBookingIntent({serviceId:SERVICE,resourceId:RESOURCE,startsAtUtc:'2026-11-14T09:00:00+08:00'}),/UTC/)
 assert.equal(validUtcInstant('2026-02-30T09:00:00Z'),false)
 assert.equal(validUtcInstant('2026-11-14T01:00:00Z'),true)
})
test('Asia/Manila clinic local time roundtrips and does not use visitor/device timezone',()=>{
 assert.equal(clinicSlotToUtc('2026-11-14','09:00','Asia/Manila'),'2026-11-14T01:00:00.000Z')
 assert.equal(clinicSlotToUtc('2026-11-14','00:30','Asia/Manila'),'2026-11-13T16:30:00.000Z')
 assert.deepEqual(utcToClinicSlot('2026-11-14T01:00:00Z','Asia/Manila'),{
  date:'2026-11-14',time:'09:00',timezone:'Asia/Manila'
 })
 assert.throws(()=>clinicSlotToUtc('2026-02-30','09:00','Asia/Manila'),/Invalid date/)
})
test('DST ambiguous and missing clock hours fail closed rather than choosing a slot',()=>{
 assert.throws(()=>clinicSlotToUtc('2026-11-01','01:30','America/New_York'),/Ambiguous/)
 assert.throws(()=>clinicSlotToUtc('2026-03-08','02:30','America/New_York'),/Ambiguous/)
})
