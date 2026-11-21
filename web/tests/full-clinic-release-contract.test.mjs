// CLOUD PR122 — audit that the release train never turns a proposed contract
// into an executable RPC, and every route/flag is represented in the matrix.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const matrix=source('../docs/FULL_CLINIC_FRONTEND_RELEASE_CONTRACT_2026.md')
const app=source('src/App.tsx')
const nav=source('src/components/Layout.tsx')
const hub=source('src/pages/ClinicJourneyPage.tsx')
const msg=source('src/pages/CommunicationsUnavailablePage.tsx')

test('CLOUD full-clinic: all actual public, Auth, owner, staff, finance and communications routes are cataloged',()=>{
  for(const url of ['/','/services','/about','/location','/contact','/book',
    '/auth/signin','/auth/signup','/auth/verify','/auth/callback','/auth/forgot','/auth/recovery',
    '/app/overview','/app/profile','/app/pets','/app/appointments','/app/workflows',
    '/app/ops','/app/clinical','/app/pharmacy','/app/billing','/app/invoices','/app/communications']){
    assert.ok(app.includes('path="'+url+'"'),'route '+url+' exists in real App')
    assert.ok(matrix.includes(url),'route '+url+' contract documented')
  }
})
test('CLOUD full-clinic: protected features are still individually OFF by default',()=>{
  for(const flag of ['VITE_PHASE4_PATIENT_FORM','VITE_PHASE5A_OPS_UI','VITE_CLINICAL_WORKSPACE_UI',
    'VITE_PHASE5B_PHARMACY_UI','VITE_PHASE5C_BILLING_UI']){
    assert.match(app+nav+hub,new RegExp(flag))
    assert.doesNotMatch(app+nav+hub,new RegExp(flag+'\\s*=\\s*true'))
    assert.ok(matrix.includes(flag),'documented preview flag '+flag)
  }
  assert.match(app,/function Guard\(\)/)
  assert.match(app,/return user \? <Outlet \/> : <Navigate to="\/auth\/signin" replace \/>/)
  assert.match(hub,/createClinicalReadPort\(account\)/)
  assert.match(hub,/assertStaffBranch\(account,branch\.id\)/)
  assert.match(hub,/Promise\.allSettled\(branches\.map/)
  assert.match(hub,/staffPreviewRequested&&access\.kind==='allowed'/)
})
test('CLOUD full-clinic: no synthetic message, finance or clinical API is introduced',()=>{
  assert.doesNotMatch(msg,/supabase|fetch\(|XMLHttpRequest|WebSocket|\.rpc\(|sendMessage|sendEmail/)
  assert.match(msg,/disabled>Compose message/)
  assert.match(msg,/disabled>Send reminder/)
  assert.match(msg,/disabled>Manage message consent/)
  assert.match(msg,/No message has been queued/)
  assert.match(source('src/clinical/chart-port.ts'),/async read\(\)\{return \{kind:'unavailable'\}\}/)
  assert.doesNotMatch(source('src/clinical/chart-port.ts'),/async saveDraft/)
  assert.match(source('src/billing/port.ts'),/BILLING_READER_NOT_INTEGRATED/)
  assert.doesNotMatch(source('src/billing/port.ts'),/\.from\(['"]invoices['"]\)/)
  assert.doesNotMatch(hub,/sessionStorage|localStorage|location\.search|user_metadata|\.rpc\(/)
})
test('CLOUD full-clinic: exact existing server RPC references are documented, future names are not invented',()=>{
  const contracts=[
    ['src/lib/public-booking.ts','request_service_appointment'],
    ['src/staff-branch-read-contract.mjs','assert_staff_branch'],
    ['src/staff-branch-read-contract.mjs','get_branch_dashboard_counts'],
    ['src/inventory/port.ts','list_branch_medicine_alerts'],
    ['src/inventory/port.ts','list_branch_medicine_fefo']
  ]
  for(const [path,rpc] of contracts){
    assert.ok(source(path).includes("'"+rpc+"'"),rpc+' must come from real reviewed source')
    assert.ok(matrix.includes(rpc),rpc+' must be in ASTRA integration handoff')
  }
  for(const wouldBe of ['finalize_clinical_encounter','send_campaign_message','dispense_stock','record_payment']){
    assert.doesNotMatch(app+hub+msg,new RegExp(wouldBe))
  }
})
test('CLOUD full-clinic: owner overview data is keyed to active identity and failures are not empty counts',()=>{
  const overview=source('src/pages/OverviewPage.tsx')
  assert.match(overview,/key=\{user\.id\}/)
  assert.match(overview,/user\.id !== userId/)
  assert.match(overview,/setData\(null\)/)
  assert.match(overview,/setError\('Could not load your overview/)
  assert.match(overview,/Retry overview/)
  assert.match(overview,/to="\/app\/workflows"/)
})
test('CLOUD full-clinic: all unconnected production operations remain explicitly unavailable',()=>{
  for(const concept of ['Clinical chart reader','Clinical finalization','Vaccination',
    'Prescription','Pharmacy receiving','Invoice finalize','Payments','Consent-bound messaging',
    'Staff appointment']){
    assert.match(matrix,new RegExp(concept,'i'))
  }
  assert.match(matrix,/HOSTED UNVERIFIED|HOSTED UNVERIFIED/i)
  assert.match(matrix,/FULL_TREE_GATE_BLOCKED/)
  assert.match(matrix,/Chow Chow/)
})
