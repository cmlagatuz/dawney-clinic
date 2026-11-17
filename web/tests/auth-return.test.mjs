import test from 'node:test'
import assert from 'node:assert/strict'
import {saveBookingIntent,readBookingIntent} from '../src/booking-contract.mjs'
import {resolveAfterAuth,authCallbackUrl} from '../src/auth-return.mjs'
const SERVICE='88888888-8888-4888-8888-888888888888'
const RESOURCE='55555555-5555-4555-8555-555555555555'
function storage(){
 const data=new Map()
 return {setItem:(k,v)=>data.set(k,v),getItem:k=>data.get(k)??null,removeItem:k=>data.delete(k),raw:()=>[...data.entries()]}
}

test('verification return: only the exact /book hint (or a valid same-tab intent) selects booking',()=>{
 for(const bad of [null,undefined,'','/book/','/BOOK','//evil.example','https://evil.example/book','/book?x=1','/book#x','\\evil','javascript:alert(1)',['/book'],{},0,'/app/profile','%2Fbook']){
  const r=resolveAfterAuth(bad,null)
  assert.deepEqual(r,{toBook:false,needsReselect:false,dest:'/app/overview',suffix:''},String(bad))
 }
 // fresh tab: hint only, no intent -> back to booking but must reselect
 assert.deepEqual(resolveAfterAuth('/book',null),{toBook:true,needsReselect:true,dest:'/book',suffix:'?next=%2Fbook'})
 // same tab: valid intent -> no reselect message, even without the hint
 const s=storage();saveBookingIntent(s,{serviceId:SERVICE},1000)
 const intent=readBookingIntent(s,1000+60000)
 assert.deepEqual(resolveAfterAuth('/book',intent),{toBook:true,needsReselect:false,dest:'/book',suffix:'?next=%2Fbook'})
 assert.equal(resolveAfterAuth(null,intent).toBook,true)
 // expired intent is dropped by the reader, so the fresh-tab message applies
 assert.equal(readBookingIntent(s,1000+31*60000),null)
 assert.equal(resolveAfterAuth('/book',readBookingIntent(s,1000+31*60000)).needsReselect,true)
})

test('email redirect carries only a constant navigation hint, never data',()=>{
 assert.equal(authCallbackUrl('https://dawney-clinic.pages.dev',false),'https://dawney-clinic.pages.dev/auth/callback')
 assert.equal(authCallbackUrl('https://dawney-clinic.pages.dev',true),'https://dawney-clinic.pages.dev/auth/callback?next=%2Fbook')
 assert.equal(authCallbackUrl('http://localhost:5173',true),'http://localhost:5173/auth/callback?next=%2Fbook')
 for(const bad of ['','javascript:x','https://a.test/path','https://a.test?x=1','https://a.test#h',null,'//a.test'])
  assert.throws(()=>authCallbackUrl(bad,true))
 const s=storage();saveBookingIntent(s,{serviceId:SERVICE,resourceId:RESOURCE,startsAtUtc:'2030-01-01T01:00:00.000Z'})
 const url=authCallbackUrl('https://x.test',true)
 for(const [,v] of s.raw())for(const piece of [SERVICE,RESOURCE,'2030']) assert.ok(!url.includes(piece)&&v.length>0)
})
