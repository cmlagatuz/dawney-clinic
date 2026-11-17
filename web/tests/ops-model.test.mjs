import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,readdirSync} from 'node:fs'
import {
 FLOW_LANES,OPS_RANGES,OPS_STATUSES,addDays,buildFlow,buildKpis,classifyOpsError,dayWindow,formatClinicTime,
 rangeWindow,shortRef,todayInZone,validateCounts,validateWindow,weekDates,windowState,isIsoDate,groupByResource
} from '../src/ops/ops-model.mjs'

const ID=n=>`${String(n).padStart(8,'0')}-0000-4000-8000-000000000000`
const row=(n,status='confirmed',start='2026-11-16T01:00:00Z',end='2026-11-16T01:30:00Z')=>
 ({id:ID(n),pet_id:ID(1000+n),owner_id:ID(2000+n),resource_id:ID(3000+(n%2)),starts_at:start,ends_at:end,status,concern:'Checkup'})
const many=n=>Array.from({length:n},(_,i)=>row(i+1,'confirmed',new Date(Date.UTC(2026,10,16,0,i)).toISOString().replace('.000Z','Z'),new Date(Date.UTC(2026,10,16,0,i,30)).toISOString().replace('.000Z','Z')))

test('clinic day/week/range windows are exact half-open UTC bounds <=24h',()=>{
 assert.deepEqual(dayWindow('2026-11-16'),{fromUtc:'2026-11-15T16:00:00.000Z',toUtc:'2026-11-16T16:00:00.000Z'})
 assert.deepEqual(rangeWindow('2026-11-16','morning'),{fromUtc:'2026-11-15T22:00:00.000Z',toUtc:'2026-11-16T04:00:00.000Z'})
 assert.deepEqual(rangeWindow('2026-11-16','evening'),{fromUtc:'2026-11-16T10:00:00.000Z',toUtc:'2026-11-16T16:00:00.000Z'})
 assert.deepEqual(rangeWindow('2026-11-16','all'),dayWindow('2026-11-16'))
 for(const r of OPS_RANGES){const w=rangeWindow('2026-11-16',r.key);assert.ok(Date.parse(w.toUtc)-Date.parse(w.fromUtc)<=86400000)}
 assert.throws(()=>rangeWindow('2026-11-16','nope'))
 for(const bad of ['2026-13-01','2026-02-30','','x',null,'2026-1-1'])assert.throws(()=>dayWindow(bad),String(bad))
 assert.equal(isIsoDate('2026-02-28'),true)
})
test('week is Monday-start, seven consecutive dates, any weekday selects the same week',()=>{
 const w=weekDates('2026-11-15')
 assert.equal(w.length,7);assert.equal(w[0],'2026-11-09');assert.equal(w[6],'2026-11-15')
 for(const d of w)assert.deepEqual(weekDates(d),w)
 assert.equal(addDays('2026-12-31',1),'2027-01-01')
 assert.equal(todayInZone(Date.UTC(2026,10,15,17,0)),'2026-11-16')
 assert.equal(formatClinicTime('2026-11-16T01:30:00Z'),'9:30 AM');assert.equal(formatClinicTime('2026-11-16T04:05:00Z'),'12:05 PM')
})
test('validateWindow fails closed on malformed, oversize, lookahead or untyped payloads',()=>{
 const ok=validateWindow({items:[row(2),row(1)],hasMore:false})
 assert.equal(ok.items[0].id,ID(1)==ok.items[0].id?ID(1):ID(2))
 for(const bad of [null,undefined,[],{},{items:[],hasMore:'no'},{items:'x',hasMore:false},{items:[{}],hasMore:false},
  {items:[row(1,'in_consult')],hasMore:false},{items:[{...row(1),concern:' '}],hasMore:false},
  {items:[row(1,'confirmed','2026-11-16T02:00:00Z','2026-11-16T01:00:00Z')],hasMore:false},
  {items:[{...row(1),starts_at:'not a date'}],hasMore:false},{items:many(251),hasMore:true}])
  assert.throws(()=>validateWindow(bad),/Malformed/,JSON.stringify(bad)?.slice(0,60))
 assert.equal(validateWindow({items:many(250),hasMore:false}).items.length,250)
 assert.equal(validateWindow({items:many(250),hasMore:true}).hasMore,true)
})
test('window state: hasMore is never complete or empty; zero only for a complete zero-row read',()=>{
 assert.equal(windowState({items:[],hasMore:false}),'empty')
 assert.equal(windowState({items:[],hasMore:true}),'incomplete')
 assert.equal(windowState({items:many(249),hasMore:false}),'ready')
 assert.equal(windowState({items:many(250),hasMore:false}),'ready')
 assert.equal(windowState({items:many(250),hasMore:true}),'incomplete')
})
test('flow lanes use only persisted statuses; consult is a labelled gap with no data',()=>{
 const consult=FLOW_LANES.find(l=>l.key==='consult')
 assert.equal(consult.persisted,false);assert.deepEqual(consult.statuses,[])
 const used=new Set(FLOW_LANES.flatMap(l=>l.statuses))
 for(const s of used)assert.ok(OPS_STATUSES.includes(s),s)
 assert.ok(!OPS_STATUSES.includes('in_consult'))
 const items=[row(1,'requested'),row(2,'confirmed'),row(3,'checked_in'),row(4,'completed'),row(5,'cancelled'),row(6,'no_show')]
 const f=buildFlow(items)
 const by=Object.fromEntries(f.lanes.map(l=>[l.key,l.items.map(i=>i.status)]))
 assert.deepEqual(by,{expected:['requested','confirmed'],checked_in:['checked_in'],consult:[],completed:['completed']})
 assert.deepEqual(f.closed.map(i=>i.status),['cancelled','no_show'])
 assert.equal(f.lanes.reduce((n,l)=>n+l.items.length,0)+f.closed.length,items.length)
})
test('KPI contracts: lower bounds on incomplete windows, unavailable metrics are never zero',()=>{
 const win={items:[row(1,'checked_in'),row(2,'completed'),row(3,'no_show')],hasMore:false}
 const counts={patients:7,requestedAppointments:2,confirmedAppointments:5}
 const k=Object.fromEntries(buildKpis({win,counts}).map(x=>[x.key,x]))
 assert.deepEqual([k.visits.value,k.checked_in.value,k.completed.value,k.no_show.value],[3,1,1,1])
 assert.ok([k.visits,k.checked_in,k.completed,k.no_show].every(x=>x.state==='value'))
 assert.deepEqual([k.patients.value,k.requested_all.value,k.confirmed_all.value],[7,2,5])
 for(const key of ['waiting','rooms']){assert.equal(k[key].state,'unavailable');assert.equal(k[key].value,null)}
 const inc=Object.fromEntries(buildKpis({win:{...win,hasMore:true},counts}).map(x=>[x.key,x]))
 for(const key of ['visits','checked_in','completed','no_show'])assert.equal(inc[key].state,'atLeast',key)
 assert.equal(inc.patients.state,'value')
 const none=Object.fromEntries(buildKpis({win:null,counts:null}).map(x=>[x.key,x]))
 for(const x of Object.values(none))assert.ok(x.state==='unavailable'&&x.value===null,x.key)
 assert.equal(buildKpis({win:{items:[],hasMore:false},counts}).find(x=>x.key==='visits').value,0)
})
test('counts must be real non-negative integers',()=>{
 assert.deepEqual(validateCounts({patients:0,requestedAppointments:0,confirmedAppointments:0}),{patients:0,requestedAppointments:0,confirmedAppointments:0})
 for(const bad of [null,{},{patients:-1,requestedAppointments:0,confirmedAppointments:0},{patients:1.5,requestedAppointments:0,confirmedAppointments:0},
  {patients:'3',requestedAppointments:0,confirmedAppointments:0},{patients:1,requestedAppointments:0}])assert.throws(()=>validateCounts(bad))
})
test('error classification: denial, network, unavailable and generic never leak raw text',()=>{
 for(const m of ['Verified staff session required','Clinic staff access is not approved','Verified staff identity required'])assert.equal(classifyOpsError(Error(m)),'denied',m)
 assert.equal(classifyOpsError({code:'42501',message:'x'}),'denied')
 assert.equal(classifyOpsError(TypeError('Failed to fetch')),'network')
 assert.equal(classifyOpsError(Error('Staff read contract not integrated')),'unavailable')
 assert.equal(classifyOpsError(Error('boom secret detail')),'error')
 assert.equal(classifyOpsError(undefined),'error')
})
test('display helpers use real ids only',()=>{
 assert.equal(shortRef('12345678-90ab-4cde-8f01-234567890abc'),'123456');assert.equal(shortRef(null),'------')
 const g=groupByResource([row(1),row(2),row(3)]);assert.equal(g.reduce((n,x)=>n+x.rows.length,0),3)
})

const root=new URL('../src/',import.meta.url)
function files(dir,out=[]){for(const e of readdirSync(new URL(dir,root),{withFileTypes:true})){
 const p=dir+e.name;e.isDirectory()?files(p+'/',out):out.push(p)}return out}
const opsFiles=[...files('ops/'),...files('components/ops/'),...files('pages/staff/')]
test('static guards: no backend imports, no demo data, no in_consult status, no secrets',()=>{
 for(const f of opsFiles){
  const s=readFileSync(new URL(f,root),'utf8')
  assert.ok(f==='ops/port.ts'||!/lib\/(supabase|staff-clinic|clinical|owners)/.test(s),f+' must not import backend-owned lib (only ops/port.ts may)')
  assert.ok(!/@supabase\/supabase-js'/.test(s.replace(/import type[^\n]*\n/g,'')),f+' must not create a client')
  assert.ok(!/alpha|demo|fixture|mock|synthetic/i.test(s.replace(/no demo data is shown|Nothing is invented/g,'')),f+' must not reference demo data')
  assert.ok(!/in_consult/.test(s.replace(/\*`in_consult`|an `in_consult`/g,''))||f.endsWith('ops-model.mjs'),f)
  assert.ok(!/service_role|sb_secret|localStorage|sessionStorage|fetch\(/.test(s),f)
 }
})
test('route and nav exist only behind the build flag, which defaults OFF',()=>{
 const flag=readFileSync(new URL('ops/flag.ts',root),'utf8')
 assert.match(flag,/VITE_PHASE5A_OPS_UI === 'true'/)
 assert.match(readFileSync(new URL('App.tsx',root),'utf8'),/OPS_UI_ENABLED && <Route path="\/app\/ops"/)
 assert.match(readFileSync(new URL('components/Layout.tsx',root),'utf8'),/OPS_UI_ENABLED \? \[/)
 const env=readFileSync(new URL('../.env.example',import.meta.url),'utf8')
 assert.ok(!/PHASE5A_OPS_UI=true/.test(env))
})
