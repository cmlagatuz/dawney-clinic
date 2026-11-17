import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createReadPortFor} from '../src/ops/port-adapter.mjs'
import {classifyOpsError,dayWindow,validateWindow,validateCounts,weekDates,rangeWindow,OPS_VISIBLE_LIMIT,buildKpis,windowState} from '../src/ops/ops-model.mjs'

const U1='11111111-1111-4111-8111-111111111111',U2='22222222-2222-4222-8222-222222222222'
const user=id=>({id})
const row=(i,iso='2026-11-18T01:00:00.000Z')=>({id:`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`,pet_id:U1,owner_id:U2,resource_id:U1,starts_at:iso,ends_at:'2026-11-18T01:30:00.000Z',status:'requested',concern:'c'})
const deps=(o={})=>({
 calls:[],
 async verifiedStaffSession(u){this.calls.push(['verify',u.id]);if(o.verify)return o.verify(u);return{userId:u.id,role:'receptionist',isActive:true}},
 async listClinicQueueWindow(u,f,t){this.calls.push(['window',u.id,f,t]);if(o.window)return o.window(u,f,t);return{items:[],hasMore:false}},
 async getClinicDashboardCounts(u){this.calls.push(['counts',u.id]);if(o.counts)return o.counts(u);return{patients:1,requestedAppointments:2,confirmedAppointments:3}}
})

test('no user → no port (nothing is ever requested)',()=>{
 assert.equal(createReadPortFor(deps(),null),null)
 assert.equal(createReadPortFor(deps(),{}),null)
})
test('verify returns only {userId, role} for the same account and a known role',async()=>{
 const d=deps();const p=createReadPortFor(d,user(U1))
 assert.deepEqual(await p.verify(),{userId:U1,role:'receptionist'})
 for(const role of ['administrator','veterinarian'])assert.equal((await createReadPortFor(deps({verify:u=>({userId:u.id,role,isActive:true})}),user(U1)).verify()).role,role)
})
test('verify fails closed: other account, inactive, unknown/owner role, empty → denied',async()=>{
 for(const bad of [{userId:U2,role:'administrator',isActive:true},{userId:U1,role:'administrator',isActive:false},{userId:U1,role:'owner',isActive:true},{userId:U1,role:'service_role',isActive:true},null,undefined,{}]){
  const p=createReadPortFor(deps({verify:()=>bad}),user(U1))
  await assert.rejects(p.verify(),e=>classifyOpsError(e)==='denied',JSON.stringify(bad))
 }
})
test('backend errors pass through unchanged (denial, network, schema) — never become empty data',async()=>{
 const mk=(code,msg)=>Object.assign(Error(msg),{code})
 for(const [err,kind] of [[Error('Verified staff session required'),'denied'],[mk('42501','permission denied for table appointments'),'denied'],[TypeError('Failed to fetch'),'network'],[Error('Clinic queue response could not be verified'),'error']]){
  const p=createReadPortFor(deps({window:()=>{throw err},counts:()=>{throw err},verify:()=>{throw err}}),user(U1))
  for(const call of [()=>p.verify(),()=>p.window('2026-11-17T16:00:00.000Z','2026-11-18T16:00:00.000Z'),()=>p.counts()])
   await assert.rejects(call(),e=>classifyOpsError(e)===kind)
 }
})
test('window/counts are bound to the port account and pass UTC bounds through untouched',async()=>{
 const d=deps();const p=createReadPortFor(d,user(U1));const w=dayWindow('2026-11-18')
 await p.window(w.fromUtc,w.toUtc);await p.counts()
 assert.deepEqual(d.calls,[['window',U1,w.fromUtc,w.toUtc],['counts',U1]])
 const d2=deps();const p2=createReadPortFor(d2,user(U2));await p2.window(w.fromUtc,w.toUtc)
 assert.equal(d2.calls[0][1],U2,'a different account gets its own port and never reuses the first')
})
test('revoked membership: the NEXT read re-verifies server-side and is denied (no cached rows)',async()=>{
 let active=true
 const d=deps({window:()=>{if(!active)throw Error('Clinic staff access is not approved');return{items:[row(1)],hasMore:false}}})
 const p=createReadPortFor(d,user(U1));const w=dayWindow('2026-11-18')
 assert.equal((await p.window(w.fromUtc,w.toUtc)).items.length,1)
 active=false
 await assert.rejects(p.window(w.fromUtc,w.toUtc),e=>classifyOpsError(e)==='denied')
})
test('the port exposes exactly three read methods',()=>{
 assert.deepEqual(Object.keys(createReadPortFor(deps(),user(U1))).sort(),['counts','verify','window'])
})

test('Asia/Manila day boundaries: half-open 24h windows, no gaps/overlap across the week',()=>{
 const w=dayWindow('2026-11-18');assert.equal(w.fromUtc,'2026-11-17T16:00:00.000Z');assert.equal(w.toUtc,'2026-11-18T16:00:00.000Z')
 const days=weekDates('2026-11-18');assert.equal(days.length,7)
 for(let i=1;i<7;i++)assert.equal(dayWindow(days[i]).fromUtc,dayWindow(days[i-1]).toUtc)
 for(const d of days){const x=dayWindow(d);assert.equal(Date.parse(x.toUtc)-Date.parse(x.fromUtc),86400000)}
 const r=rangeWindow('2026-11-18','all');assert.equal(r.fromUtc,w.fromUtc)
 // 23:59 Manila on the 18th (15:59Z) is in the 18th; 00:00 Manila on the 19th (16:00Z) is not
 assert.ok(Date.parse('2026-11-18T15:59:59.000Z')<Date.parse(w.toUtc)&&Date.parse('2026-11-18T16:00:00.000Z')>=Date.parse(w.toUtc))
})
test('hasMore: 250 complete, 251st → incomplete; KPIs never present a truncated day as complete',()=>{
 const full=validateWindow({items:Array.from({length:OPS_VISIBLE_LIMIT},(_,i)=>row(i+1)),hasMore:false})
 assert.equal(windowState(full),'ready')
 const more=validateWindow({items:Array.from({length:OPS_VISIBLE_LIMIT},(_,i)=>row(i+1)),hasMore:true})
 assert.equal(windowState(more),'incomplete')
 assert.ok(buildKpis({win:more,counts:null}).some(k=>k.state==='atLeast'))
 assert.throws(()=>validateWindow({items:Array.from({length:OPS_VISIBLE_LIMIT+1},(_,i)=>row(i+1)),hasMore:true}))
 assert.throws(()=>validateWindow(null));assert.throws(()=>validateWindow({items:[row(1)]}))
})
test('incomplete or malformed counts are rejected, not shown as 0',()=>{
 assert.throws(()=>validateCounts({patients:1,requestedAppointments:2}))
 assert.throws(()=>validateCounts({patients:-1,requestedAppointments:0,confirmedAppointments:0}))
 assert.throws(()=>validateCounts(null))
 assert.deepEqual(validateCounts({patients:1,requestedAppointments:2,confirmedAppointments:3}),{patients:1,requestedAppointments:2,confirmedAppointments:3})
})
test('static: port.ts uses only the three read functions; flag default OFF; no writes or sample data',()=>{
 const rd=f=>readFileSync(new URL('../src/'+f,import.meta.url),'utf8')
 const port=rd('ops/port.ts')
 assert.match(port,/import \{getClinicDashboardCounts, listClinicQueueWindow, verifiedStaffSession\} from '\.\.\/lib\/staff-clinic'/)
 assert.ok(!/listClinicQueue\(|listClinicPatients|listClinicClinicalRecords|roleCan|\.insert|\.update|\.upsert|\.delete|\.rpc|supabase/.test(port.replace(/PR #59|supabase/g,'')))
 assert.ok(!/=>\s*null\s*$/m.test(port))
 assert.match(rd('ops/flag.ts'),/VITE_PHASE5A_OPS_UI === 'true'/)
 assert.ok(!/\.catch\(/.test(rd('ops/port-adapter.mjs')),'adapter never swallows errors')
 assert.match(rd('pages/staff/OpsPage.tsx'),/\[uid\]/)
})
