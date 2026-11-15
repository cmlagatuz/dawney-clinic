import test from 'node:test'
import assert from 'node:assert/strict'
import {readServiceSpeciesIds} from '../src/service-species-reader.mjs'
const SERVICE='88888888-8888-4888-8888-888888888888'
const confirmed={id:'123',email_confirmed_at:'2026-11-14T00:00:00Z',is_anonymous:false}
function mockDb({user=confirmed,authError=null,rows=[],queryError=null}={}){
 const calls=[]
 return {calls,
  auth:{getUser:async()=>{calls.push('getUser');return {data:{user},error:authError}}},
  from:table=>{calls.push(['from',table]);return {
   select:column=>{calls.push(['select',column]);return {
    eq:async(key,value)=>{calls.push(['eq',key,value]);return {data:rows,error:queryError}}
   }}
  }}
 }
}
test('auth reader returns only selected service mapping',async()=>{
 const db=mockDb({rows:[{species_id:'dog'},{species_id:'cat'},{species_id:'dog'}]})
 assert.deepEqual(await readServiceSpeciesIds(db,SERVICE),['dog','cat'])
 assert.deepEqual(db.calls,['getUser',['from','clinic_service_species'],['select','species_id'],['eq','service_id',SERVICE]])
})
test('zero approved species is a legitimate empty result',async()=>{
 assert.deepEqual(await readServiceSpeciesIds(mockDb({rows:[]}),SERVICE),[])
})
test('anonymous, missing or unconfirmed identities never query the mapping',async()=>{
 for(const user of [null,{...confirmed,is_anonymous:true},{...confirmed,email_confirmed_at:null}]){
  const db=mockDb({user})
  await assert.rejects(readServiceSpeciesIds(db,SERVICE),/Verified customer login required/)
  assert.deepEqual(db.calls,['getUser'])
 }
})
test('Auth server errors and malformed UUIDs fail before database access',async()=>{
 const db=mockDb({authError:{message:'expired'}})
 await assert.rejects(readServiceSpeciesIds(db,SERVICE),/Verified customer login required/)
 assert.deepEqual(db.calls,['getUser'])
 const invalid=mockDb()
 await assert.rejects(readServiceSpeciesIds(invalid,'not-a-uuid'),/Invalid service/)
 assert.deepEqual(invalid.calls,[])
})
test('PostgREST denial does not masquerade as zero eligible species',async()=>{
 const denied={code:'42501',message:'Permission denied'}
 await assert.rejects(readServiceSpeciesIds(mockDb({queryError:denied}),SERVICE),e=>e===denied)
})
test('malformed or missing results fail closed',async()=>{
 for(const rows of [null,[{}],[{species_id:null}]]){
  await assert.rejects(readServiceSpeciesIds(mockDb({rows}),SERVICE),/Cannot verify service species eligibility/)
 }
})
