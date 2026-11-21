// CLOUD PR117: pure two-track public release/source safety checks; no network.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolveReleaseProfile, releaseCapabilities } from '../src/release-profile.mjs'
import { resolveAfterAuth, authCallbackUrl } from '../src/auth-return.mjs'
import { NAGA, CAVITE, BRANCHES, CLINIC_PHONE, SUNDAY_NOTE,
  NAGA_SERVICE_CATEGORIES, isSafeExternalUrl } from '../src/public-site/clinic-info.mjs'

const webRoot = fileURLToPath(new URL('../', import.meta.url))
const source = p => readFileSync(new URL('../'+p,import.meta.url),'utf8')

test('A informational is the default for empty, invalid, hostname, query and malformed selectors',()=>{
  for(const candidate of [undefined,null,'',false,true,{},'production','preview','CONNECTED',
    'connected?next=/app','https://preview.pages.dev','owner','clinical','staff']){
    assert.equal(resolveReleaseProfile(candidate),'informational')
    const caps = releaseCapabilities(candidate,true)
    assert.equal(caps.profile,'informational')
    assert.equal(caps.mayCheckBooking,false)
    assert.equal(caps.mayRenderOwnerAccess,false)
  }
})

test('B is only an explicit selected build profile and never a backend approval or confirmation',()=>{
  assert.equal(resolveReleaseProfile('connected'),'connected')
  const missing=releaseCapabilities('connected',false)
  assert.equal(missing.mayCheckBooking,false)
  assert.equal(missing.mayRenderOwnerAccess,false)
  const candidate=releaseCapabilities('connected',true)
  assert.equal(candidate.mayCheckBooking,true)
  assert.equal(candidate.mayRenderOwnerAccess,true)
  for(const k of ['canConfirmAppointments','canPublishServices','canEnableStaff',
    'canEnableClinicalWrites','canEnablePharmacyWrites','canEnableBilling']){
    assert.equal(candidate[k],false,k+' cannot be turned on by build selector')
    assert.equal(missing[k],false)
  }
  assert.equal(Object.isFrozen(candidate),true)
})

test('both release scripts select a fixed profile and a portable local test runner',()=>{
  const pkg=JSON.parse(source('package.json'))
  assert.match(pkg.scripts.build, /release-cli\.mjs build informational$/)
  assert.match(pkg.scripts['build:connected'],/release-cli\.mjs build connected$/)
  assert.match(pkg.scripts.test,/release-cli\.mjs test connected$/)
  const cli=source('scripts/release-cli.mjs')
  assert.match(cli,/VITE_RELEASE_PROFILE: mode/)
  assert.match(cli,/delete env\.VITE_SUPABASE_URL/)
  assert.match(cli,/delete env\.VITE_SUPABASE_PUBLISHABLE_KEY/)
  assert.match(cli,/flags\.some\(name => env\[name\] === 'true'\)/)
  assert.doesNotMatch(cli,/service_role|sb_secret_/i)
})

test('connected public build refuses absent publishable contract; no privileged credentials required',()=>{
  const processResult=spawnSync(process.execPath,[
    fileURLToPath(new URL('../scripts/release-cli.mjs',import.meta.url)), 'build','connected'
  ],{cwd:webRoot,encoding:'utf8',env:{
    ...process.env,VITE_SUPABASE_URL:'',VITE_SUPABASE_PUBLISHABLE_KEY:'',
    VITE_PHASE4_PATIENT_FORM:'false',VITE_PHASE5A_OPS_UI:'false',
    VITE_PHASE5B_PHARMACY_UI:'false',VITE_CLINICAL_WORKSPACE_UI:'false',VITE_PHASE5C_BILLING_UI:'false'
  }})
  assert.equal(processResult.status,2)
  assert.match(processResult.stderr,/requires an explicitly provided public Supabase URL and publishable key/)
  assert.doesNotMatch(processResult.stderr,/https:\/\/.*supabase/i,'error must not log configuration')
})

test('connected public build refuses accidentally on staff/clinical/financial flags before compiling',()=>{
  const result=spawnSync(process.execPath,[
    fileURLToPath(new URL('../scripts/release-cli.mjs',import.meta.url)),'build','connected'
  ],{cwd:webRoot,encoding:'utf8',env:{
    ...process.env,VITE_SUPABASE_URL:'https://issue51-fixtures.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_offline_test',
    VITE_PHASE5A_OPS_UI:'true',VITE_CLINICAL_WORKSPACE_UI:'false',
    VITE_PHASE5B_PHARMACY_UI:'false',VITE_PHASE5C_BILLING_UI:'false',
    VITE_PHASE4_PATIENT_FORM:'false'
  }})
  assert.equal(result.status,2)
  assert.match(result.stderr,/excludes private\/staff\/clinical\/pharmacy\/billing/)
})

test('public data is owner-supplied informational content, with safe outbound destinations',()=>{
  assert.equal(BRANCHES.length,2)
  assert.equal(NAGA.id,'naga')
  assert.equal(CAVITE.id,'cavite')
  assert.equal(CLINIC_PHONE,null)
  assert.equal(NAGA_SERVICE_CATEGORIES.length,8)
  assert.match(SUNDAY_NOTE,/not been confirmed/i)
  assert.ok(BRANCHES.every(b=>isSafeExternalUrl(b.mapsUrl)&&isSafeExternalUrl(b.facebookUrl)))
  assert.ok(BRANCHES.every(b=>b.address.includes('Philippines')))
  assert.ok(BRANCHES.every(b=>b.hours.every(h=>!/(sunday|24\s*\/\s*7|24.hour)/i.test(h))))
  assert.ok(!NAGA_SERVICE_CATEGORIES.some(c=>/\b(?:PHP|₱|SAR|USD)\b|\d+\s*(?:min|hour)/i.test(c)))
})

test('auth-return allows only a PII-free booking path; no open redirect',()=>{
  assert.deepEqual(resolveAfterAuth('/book',null),{toBook:true,needsReselect:true,dest:'/book',suffix:'?next=%2Fbook'})
  for(const unsafe of ['//evil.test','/app/pets','/book?patient=abc','https://evil.test','/auth/signin','../book']){
    assert.equal(resolveAfterAuth(unsafe,null).dest,'/app/overview')
  }
  assert.equal(authCallbackUrl('https://dawney-clinic.pages.dev',true),
    'https://dawney-clinic.pages.dev/auth/callback?next=%2Fbook')
  assert.throws(()=>authCallbackUrl('https://user:pass@example.com',true),/Valid origin/)
})

test('Pages SPA fallback and private crawler restrictions remain explicit and unmodified',()=>{
  assert.equal(existsSync(new URL('../public/404.html',import.meta.url)),false,
    'Pages serves SPA index for unknown paths only if no top-level 404.html')
  assert.equal(existsSync(new URL('../public/_redirects',import.meta.url)),false,
    'do not override real asset handling with an indiscriminate wildcard redirect')
  assert.match(source('public/_headers'),/Content-Security-Policy:.*default-src 'self'/)
  assert.match(source('public/robots.txt'),/Disallow: \//,
    'robot indexing still requires separate clinic-owner approval')
  const html=source('index.html')
  assert.match(html,/<meta property="og:title"/)
  assert.match(html,/<meta name="description"/)
  assert.doesNotMatch(html,/patient|appointment number|owner email|service_role|sb_secret_/i)
})

test('Profile A source tree does not instantiate AuthProvider, booking readers, or owner forms',()=>{
  const app=source('src/App.tsx')
  const a=app.slice(app.indexOf('if (!release.mayRenderOwnerAccess)'),app.indexOf('return <BrowserRouter><AuthProvider>'))
  assert.match(a,/publicRoutes\(true\)/)
  assert.doesNotMatch(a,/AuthProvider|<Guard|OwnerAppointments|ServiceBookingForm/)
  const book=source('src/pages/public/BookPage.tsx')
  const services=source('src/pages/public/ServicesPage.tsx')
  assert.match(book,/release\.mayCheckBooking \? <ConnectedBookPage \/> : <InformationalBookPage \/>/)
  assert.match(services,/release\.mayCheckBooking \? <ConnectedServicesPage \/> : <InformationalServicesPage \/>/)
})
