// CLOUD source-only release contract regression; no hosted HTTP, no fake RPCs.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {CLINIC_ROUTE_CONTRACTS,RELEASE_MISSING_OPERATIONS,STAFF_RELEASE_MODULES,routeContract,clinicModuleView} from '../src/release/clinic-contracts.mjs'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')

test('22 actual routes have unique source-backed contracts, roles, migrations and negative gates',()=>{
 assert.equal(CLINIC_ROUTE_CONTRACTS.length,25)
 assert.equal(new Set(CLINIC_ROUTE_CONTRACTS.map(r=>r.path)).size,24)
 assert.ok(CLINIC_ROUTE_CONTRACTS.some(r=>r.id==='attachments'&&r.path==='/app/pets'),'private documents share the patient route but require a separate API contract')
 for(const row of CLINIC_ROUTE_CONTRACTS){
  for(const field of ['id','title','role','scope','flag','request','response','failure','persistence','missing'])
   assert.ok(typeof row[field]==='string'&&row[field].trim().length>0,row.path+' '+field)
  for(const field of ['request','response','failure','missing'])assert.ok(row[field].length>20,row.path+' '+field)
  assert.ok(Array.isArray(row.migration)&&row.migration.length)
  assert.ok(Array.isArray(row.reads)&&Array.isArray(row.writes))
  assert.equal(Object.isFrozen(row),true)
  assert.ok(['no-frontend-write','provider-unverified','missing-server-adapter'].includes(row.persistence))
  assert.equal(routeContract(row.path)?.path,row.path)
 }
 for(const path of ['/missing','/app/unknown','/admin/diagnostics'])assert.equal(routeContract(path),null)
})
test('machine contract registry matches EVERY actual React Router path, including overview and clinic navigator',()=>{
 const app=read('src/App.tsx')
 const routed=[...app.matchAll(/<Route\\s+path="([^"]+)"/g)].map(match=>match[1])
 assert.equal(new Set(routed).size,routed.length,'each actual React Route path is unique')
 const contracted=[...new Set(CLINIC_ROUTE_CONTRACTS.map(row=>row.path))]
 assert.deepEqual(contracted.sort(),routed.sort(),'a new actual route must never omit the release API/role/migration contract')
 assert.deepEqual(CLINIC_ROUTE_CONTRACTS.filter(x=>x.path==='/app/pets').map(x=>x.id),['patients','attachments'],
   'patient documents share the real pet route but need a separate private-storage contract')
 const overview=routeContract('/app/overview')
 assert.equal(overview.id,'owner-overview')
 assert.equal(overview.persistence,'provider-unverified')
 assert.deepEqual(overview.writes,[])
 assert.match(overview.failure,/late responses ignored/)
 const clinic=routeContract('/app/clinic')
 assert.equal(clinic.id,'clinic-journey')
 assert.equal(clinic.persistence,'no-frontend-write')
 assert.deepEqual(clinic.writes,[])
 assert.ok(clinic.reads.some(name=>name.includes('assert_staff_branch')))
 assert.match(clinic.failure,/partially revoked/)
})

test('communications and finance have no imagined SQL/RPC contract or active client transport',()=>{
 for(const path of ['/app/communications','/app/billing','/app/invoices']){
  const row=routeContract(path)
  assert.deepEqual(row.writes,[])
  assert.match(row.missing,/MISSING|Approved|approved/i)
  assert.equal(row.persistence,'missing-server-adapter')
 }
 const ui=read('src/pages/ClinicReleasePage.tsx')
 assert.doesNotMatch(ui,/fetch\s*\(|\.rpc\s*\(|\.from\s*\(|\.storage\s*\.|\.signIn/)
 assert.match(ui,/disabled>Send message/)
 assert.match(ui,/disabled>Schedule reminder/)
})
test('staff navigation derives from current server assert for EVERY branch; no user-controlled role hint',()=>{
 const p=read('src/release/verified-staff-branches.ts')
 assert.match(p,/createClinicalReadPort/)
 assert.match(p,/Promise\.all\(branches\.map\(b=>assertStaffBranch\(user,b\.id\)\)\)/)
 assert.match(p,/asserted\.some/)
 assert.doesNotMatch(p,/localStorage|sessionStorage|window\.location|user_metadata|app_metadata/)
 const layout=read('src/components/Layout.tsx')
 assert.match(layout,/verifiedStaffNavigationBranches/)
 assert.match(layout,/access\.account!==account/)
})
test('flags never grant privilege or make disabled modules clickable',()=>{
 const flags={ops:false,clinical:false,pharmacy:false,billing:false}
 assert.equal(STAFF_RELEASE_MODULES.length,5)
 for(const m of STAFF_RELEASE_MODULES){
  assert.equal(clinicModuleView(m,flags,false).kind,'denied')
  assert.equal(clinicModuleView(m,flags,false).linked,false)
  if(m.id==='communications')assert.equal(clinicModuleView(m,flags,true).kind,'unavailable')
  else{
   assert.equal(clinicModuleView(m,flags,true).kind,'off')
   assert.equal(clinicModuleView(m,flags,true).linked,false)
   assert.equal(clinicModuleView(m,{...flags,[m.gate]:true},true).kind,'preview')
  }
 }
})
test('chart and finance never write; pharmacy adapter uses only bounded, branch-scoped readers',()=>{
 const chart=read('src/clinical/chart-port.ts')
 assert.match(chart,/unconnectedClinicalPort/)
 assert.match(chart,/kind:'unavailable'/)
 const finance=read('src/billing/port.ts')
 assert.match(finance,/BILLING_READER_NOT_INTEGRATED/)
 assert.doesNotMatch(finance,/\.from\(['"]invoices/)
 const inventory=read('src/inventory/port.ts')
 assert.match(inventory,/list_branch_medicine_fefo/)
 assert.match(inventory,/list_branch_medicine_alerts/)
 assert.doesNotMatch(inventory,/\.insert\(|\.update\(|\.delete\(/)
})
test('owner, clinical and consent paths are guarded and private document, booking match authoritative rows',()=>{
 const routes=read('src/App.tsx')
 for(const p of ['/app/overview','/app/profile','/app/pets','/app/appointments','/app/clinic',
  '/app/communications','/app/ops','/app/clinical','/app/pharmacy','/app/billing','/app/invoices'])
  assert.ok(routes.includes('path="'+p+'"'),p)
 assert.match(routes,/<Route element={<Guard\/>}>/)
 assert.match(routes,/phase4PatientForm\?<PetsPageCatalog\/>:<PetsPage\/>/)
 for(const flag of ['OPS_UI_ENABLED','clinicalWorkspacePreview','pharmacyPreview','billingPreview'])
  assert.ok(routes.includes('{'+flag+' && <Route'),flag)
 const attachments=read('src/lib/pet-attachments.ts')
 assert.match(attachments,/pet_attachments/)
 assert.match(attachments,/storage\.from\(CLINICAL_BUCKET\)/)
 const booking=read('src/lib/public-booking.ts')
 assert.match(booking,/request_service_appointment/)
 assert.match(booking,/\.eq\('id',bookingId\)/)
})
test('missing clinical/vaccination/prescription/stock/finance/messages never represented as persisted',()=>{
 const ids=['clinical-finalization','vaccinations','prescriptions','stock-transactions','invoices-payments','communications']
 assert.deepEqual(RELEASE_MISSING_OPERATIONS.map(x=>x.id),ids)
 for(const m of RELEASE_MISSING_OPERATIONS){
  assert.ok(m.ui.length>15&&m.contract.length>30&&m.acceptance.length>30)
  assert.match(m.ui,/Disabled|disabled|unavailable|Read-only|scratch|Historical/i)
 }
 assert.equal(routeContract('/app/clinical').persistence,'missing-server-adapter')
 assert.equal(routeContract('/app/communications').persistence,'missing-server-adapter')
})
