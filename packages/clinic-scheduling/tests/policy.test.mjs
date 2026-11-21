import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateClinicPolicy,evaluateSlot,mayTransition} from '../src/policy.mjs';
const policy=()=>({
 approved:true,timezone:'America/New_York',leadMinutes:0,maxAdvanceDays:120,
 slotStepMinutes:15,durationsMinutes:[30,60],
 hours:{sun:[],mon:[{open:'09:00',close:'17:00'}],tue:[{open:'09:00',close:'17:00'}],
  wed:[{open:'09:00',close:'17:00'}],thu:[{open:'09:00',close:'17:00'}],
  fri:[{open:'09:00',close:'17:00'}],sat:[]},
 holidays:['2027-03-16'],resources:[{id:'exam-1',capacity:1}]
});
const now=new Date('2027-01-01T00:00:00Z');
const slot=(start,extra={})=>({startsAt:start,durationMinutes:30,resourceId:'exam-1',...extra});
test('reject unknown owner policy, unsupported time zone, unsafe capacity',()=>{
 const p=policy();p.approved=false;
 assert.throws(()=>validateClinicPolicy(p),/not owner-approved/);
 const q=policy();q.timezone='Mars/Clinic';
 assert.throws(()=>validateClinicPolicy(q),/time zone/);
 const c=policy();c.resources[0].capacity=2;
 assert.throws(()=>validateClinicPolicy(c),/database enforcement/);
});
test('DST-aware timezone conversion: winter/summer hours, not user browser timezone',()=>{
 const p=policy();
 assert.equal(evaluateSlot(p,slot('2027-01-04T14:00:00Z'),now).allowed,true); // 09:00 EST
 assert.equal(evaluateSlot(p,slot('2027-03-15T13:00:00Z'),now).allowed,true); // 09:00 EDT
 assert.equal(evaluateSlot(p,slot('2027-03-15T12:00:00Z'),now).reason,'outside_hours');
 assert.equal(evaluateSlot(p,slot('2027-03-15T20:45:00Z'),now).reason,'outside_hours');
});
test('holidays, weekends, capacity, durations and lead-time fail closed',()=>{
 const p=policy();
 assert.equal(evaluateSlot(p,slot('2027-03-16T13:00:00Z'),now).reason,'holiday');
 assert.equal(evaluateSlot(p,slot('2027-03-14T13:00:00Z'),now).reason,'outside_hours');
 assert.equal(evaluateSlot(p,slot('2027-03-15T13:00:00Z',{resourceId:'fake'}),now).reason,'unknown_resource');
 assert.equal(evaluateSlot(p,slot('2027-03-15T13:00:00Z',{durationMinutes:90}),now).reason,'unsupported_duration');
 assert.equal(evaluateSlot(p,slot('2027-03-15T13:07:00Z'),now).reason,'unaligned_slot');
 const later=new Date('2027-03-15T12:50:00Z');p.leadMinutes=20;
 assert.equal(evaluateSlot(p,slot('2027-03-15T13:00:00Z'),later).reason,'lead_time');
});
test('reject malformed hours and UTC offsets that risk ambiguity',()=>{
 const p=policy();p.hours.mon=[{open:'22:00',close:'02:00'}];
 assert.throws(()=>validateClinicPolicy(p),/Overlapping or overnight/);
 assert.throws(()=>evaluateSlot(policy(),slot('2027-03-15T09:00:00-04:00'),now),/UTC ISO/);
});
test('transition matrix matches applied PostgreSQL lifecycle, no terminal reopening',()=>{
 assert.equal(mayTransition('requested','confirmed'),true);
 assert.equal(mayTransition('confirmed','checked_in'),true);
 assert.equal(mayTransition('checked_in','completed'),true);
 assert.equal(mayTransition('requested','completed'),false);
 assert.equal(mayTransition('cancelled','requested'),false);
 assert.equal(mayTransition('no_show','confirmed'),false);
});
