import test from 'node:test'
import assert from 'node:assert/strict'
import {ACTIONS,STATUS_AFTER,actionsFor,verifyAppointmentDetail,verifyTransitionReply,transitionError} from '../src/appointments/lifecycle.mjs'
const uuid=n=>'40000000-0000-4000-8000-'+String(n).padStart(12,'0')
const branch=uuid(1)
const row={id:uuid(11),owner_id:uuid(8),pet_id:uuid(9),resource_id:uuid(4),
 starts_at:'2026-11-20T01:15:00Z',ends_at:'2026-11-20T01:45:00Z',status:'requested'}
test('exact six server-backed staff actions and truthful status mapping',()=>{
 assert.deepEqual(ACTIONS,['confirm','decline','check_in','complete','no_show','cancel'])
 assert.deepEqual(Object.values(STATUS_AFTER),['confirmed','cancelled','checked_in','completed','no_show','cancelled'])
 assert.deepEqual(actionsFor('requested','receptionist'),['confirm','decline','cancel'])
 assert.deepEqual(actionsFor('confirmed','receptionist',false,row.starts_at,Date.parse('2026-11-20T01:00:00Z')),['check_in','cancel'])
 assert.deepEqual(actionsFor('confirmed','administrator',false,row.starts_at,Date.parse('2026-11-20T02:00:00Z')),['check_in','no_show','cancel'])
 assert.deepEqual(actionsFor('checked_in','receptionist',true),[])
 assert.deepEqual(actionsFor('checked_in','veterinarian',false),[])
 assert.deepEqual(actionsFor('checked_in','administrator',true),['complete'])
 for(const role of ['accountant','owner',null,'unknown'])assert.deepEqual(actionsFor('requested',role),[])
 for(const status of ['completed','cancelled','no_show'])assert.deepEqual(actionsFor(status,'administrator'),[])
})
test('appointment revision/detail comes from matching server branch, not queue or frontend counter',()=>{
 const raw={...row,branch_id:branch,lifecycle_revision:4}
 const d=verifyAppointmentDetail(raw,row,branch)
 assert.deepEqual(d,{id:row.id,branchId:branch,status:'requested',revision:4,startsAt:row.starts_at,
  endsAt:row.ends_at,petId:row.pet_id,ownerId:row.owner_id,resourceId:row.resource_id})
 for(const value of [0,-1,1.5,NaN,null,undefined,2147483648]){
  assert.throws(()=>verifyAppointmentDetail({...raw,lifecycle_revision:value},row,branch),/could not be verified/)
 }
 for(const overwrite of [{branch_id:uuid(2)},{pet_id:uuid(3)},{resource_id:uuid(3)},
   {owner_id:uuid(5)},{id:uuid(3)},{status:'declined'},{starts_at:'wrong'}])
  assert.throws(()=>verifyAppointmentDetail({...raw,...overwrite},row,branch),/could not be verified/)
})
test('server acknowledgment requires exact action, branch, status and revision+1',()=>{
 const d={id:row.id,branchId:branch,revision:3}
 const ack={kind:'staff_appointment_transition',appointmentId:row.id,branchId:branch,
  action:'decline',status:'cancelled',revision:4}
 assert.deepEqual(verifyTransitionReply(ack,d,'decline'),ack)
 for(const diff of [{kind:'ok'},{appointmentId:uuid(6)},{branchId:uuid(7)},
   {action:'cancel'},{status:'declined'},{status:'confirmed'},{revision:3},{revision:5}])
  assert.throws(()=>verifyTransitionReply({...ack,...diff},d,'decline'),/could not be verified/)
})
test('SQLSTATE errors distinguish stale revision, denied, backend absent and lost response',()=>{
 for(const [code,result] of [['42501','denied'],['40001','conflict'],['23505','nonce'],
 ['23514','policy'],['22023','policy'],['PGRST202','unavailable'],['08006','uncertain']])
  assert.equal(transitionError({code,message:'fixture'}),result)
 assert.equal(transitionError(Error('Failed to fetch')),'uncertain')
 assert.equal(transitionError(Error('unexpected parsing')),'unverified')
})
