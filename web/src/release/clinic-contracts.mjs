/**
 * CLOUD full-clinic release route/API contract inventory.
 *
 * SOURCE MANIFEST ONLY, not an executable authorization/feature-enable layer.
 * Every endpoint below is observed in the frozen PR116 frontend adapters. No
 * future RPC name is fabricated. "provider-unverified" is never a PASS.
 */
export const CLINIC_ROUTE_CONTRACTS = Object.freeze([
  {
    id:'public',path:'/',surface:'public',title:'Public clinic information',
    role:'anonymous',scope:'Naga public content; Cavite contact-only',
    reads:['clinic-info.mjs owner-reviewed local constants','clinic_branches for optional booking discovery'],
    writes:[],migration:['20261117233500 issue77 branch foundation (source only)'],
    flag:'none',request:'Public navigation and informational branch metadata',
    response:'Public clinic facts only; zero customer/patient data',
    failure:'Display existing information; never publish a price, treatment eligibility or booking slot from a failed read',
    persistence:'no-frontend-write',missing:'Owner/PM approval for current hosted public content and Pages routing'
  },
  {
    id:'auth',path:'/auth/signin',surface:'public',title:'Verified account and recovery',
    role:'anonymous to verified owner',scope:'Authenticated GoTrue user ID; no role from URL',
    reads:['Supabase auth.getSession','Supabase auth.getUser'],
    writes:['Supabase auth.signInWithPassword','Supabase auth.signUp','Supabase auth.resetPasswordForEmail','Supabase auth.updateUser (recovery)'],
    migration:['20261113074938 verified Auth and staff bootstrap (source)'],
    flag:'none',request:'Email + password or verification callback; allowlisted next=/book without PII',
    response:'GoTrue verified email, non-anonymous identity; revalidate booking on return',
    failure:'Unverified/expired/denied or network-error session never grants owner/staff access',
    persistence:'provider-unverified',missing:'Hosted OTP/PKCE/recovery/expiry and two-user JWT acceptance'
  },
  {
    id:'owner-profile',path:'/app/profile',surface:'owner',title:'Owner profile',
    role:'verified owner',scope:'owners.user_id equals verified Auth subject',
    reads:['owners SELECT by user_id'],
    writes:['owners INSERT returning ID','owners UPDATE returning row'],
    migration:['20261113070302 phase2 core data security'],
    flag:'none',request:'Verified owner account with scoped editable profile fields',
    response:'Exactly one persisted owner row or authorized null after successful read',
    failure:'Denied/read error is not blank setup; retry; account switch clears previous data',
    persistence:'provider-unverified',missing:'Hosted ownership isolation and owner A/B CRUD acceptance'
  },
  {
    id:'patients',path:'/app/pets',surface:'owner',title:'Patients and catalog',
    role:'verified owner',scope:'pets.owner_id matches server-authorized owner',
    reads:['pets SELECT owner-scoped','species_catalog','breed_catalog','breed review fallback'],
    writes:['pets INSERT/UPDATE with returned server row'],
    migration:['20261113070302 core pets','20261113211600 phase4 taxonomy attachments','20261113211700 animal catalog','20261114072200 Chow Chow guard'],
    flag:'VITE_PHASE4_PATIENT_FORM (OFF: catalog/attachments)',
    request:'Species first, then dependent breed; Mixed, Unknown and NA when valid',
    response:'Server-acknowledged pet ID; last read error cannot cause duplicate INSERT',
    failure:'Empty after verified success only; stale account/list/unknown breed fail closed',
    persistence:'provider-unverified',missing:'Hosted 2-owner taxonomy/retention and staff-reviewed catalog acceptance'
  },
  {
    id:'attachments',path:'/app/pets',surface:'owner',title:'Private patient documents',
    role:'verified owner or explicitly authorized staff',scope:'exact pet ID + private Storage object path prefix',
    reads:['pet_attachments SELECT pet_id and category','Supabase Storage private download'],
    writes:['Supabase Storage private upload','pet_attachments INSERT returning id/object_path'],
    migration:['20261113211600 phase4 taxonomy attachments','20261116002500 outer object path Storage RLS fix'],
    flag:'VITE_PHASE4_PATIENT_FORM (OFF)',
    request:'Profile photo, health card, vaccination card; validated file signature and size',
    response:'Private object path + independently verified exact metadata acknowledgment',
    failure:'Unindexed object retains original path; retry metadata only; forbidden path hides filename/download',
    persistence:'provider-unverified',missing:'Hosted RLS/Storage deny; idempotent metadata finalization after lost INSERT response'
  },
  {
    id:'public-booking',path:'/book',surface:'public',title:'Naga appointment discovery',
    role:'anonymous discovery; verified owner to submit',scope:'Naga mapped branch UUID; Cavite never inferred bookable',
    reads:['clinic_branches','branch_booking_policies','clinic_booking_policy (legacy source mode)','clinic_services','clinic_service_resources','clinic_service_species','appointment_resources'],
    writes:['request_service_appointment RPC only after verified owner+pet'],
    migration:['20261114090000 phase4 public booking contract','20261117233500 issue77 branch foundation','20261118203500 issue51 branch booking security'],
    flag:'none: backend policy must independently approve booking',
    request:'Branch, service, eligible pet, active resource, Manila slot UTC, unmodified request nonce',
    response:'Persisted owner-scoped appointment ID with status requested; never auto-confirm',
    failure:'Missing/denied/stale approval or service schedule shows unavailable; no direct INSERT fallback',
    persistence:'provider-unverified',missing:'Hosted branch/service/resource/species/holiday policy + RPC nonce/conflict proof'
  },
  {
    id:'owner-bookings',path:'/app/appointments',surface:'owner',title:'Owner appointment history',
    role:'verified owner',scope:'owner-linked pets and appointments only',
    reads:['appointments SELECT by owner_id through verified Auth and owned patient'],
    writes:['request_service_appointment RPC','existing scoped cancellation adapter (server-authoritative)'],
    migration:['20261113095318 phase3 appointment lifecycle','20261114090000 phase4 booking contract','20261118203500 issue51 branch booking'],
    flag:'none: owner request gated by current approved service policy',
    request:'Owner profile, selected pet, service, time and nonce; current owner history refresh',
    response:'Server-authorized requested/confirmed/cancelled status; returned ID must match',
    failure:'Failed history refresh clears stale data; cancelled/confirmed not inferred from clicking',
    persistence:'provider-unverified',missing:'Hosted requested→confirmed staff-only transition and exact retry under slot conflict'
  },
  {
    id:'operations',path:'/app/ops',surface:'staff',title:'Operations queue and day/week',
    role:'active receptionist, veterinarian or administrator',scope:'explicit asserted branch UUID, Manila half-open day window',
    reads:['staff_memberships','staff_branch_memberships','clinic_branches','assert_staff_branch RPC','appointments branch-filtered max 251','get_branch_dashboard_counts RPC'],
    writes:[],migration:['20261117233500 issue77 branch foundation','20261118215500 issue58 branch read contract'],
    flag:'VITE_PHASE5A_OPS_UI (OFF)',
    request:'Current staff subject, authorized branch, UTC from/to for <=24h, cap 250+1',
    response:'Branch-specific counts, requested and confirmed separate, incomplete flag for row 251',
    failure:'Denied/revoked clears previous queue and counts; no unscoped fallback',
    persistence:'provider-unverified',missing:'Hosted JWT role/branch/250-251 and staff queue read acceptance'
  },
  {
    id:'clinical',path:'/app/clinical',surface:'staff',title:'Patient chart and encounter drafts',
    role:'active receptionist appointments only; vet/administrator draft access if approved',scope:'verified branch, owner, pet, appointment and account',
    reads:['assert_staff_branch RPC','branch-filtered appointments','ChartIntegration unconnectedClinicalPort.read => unavailable'],
    writes:[],migration:['20261113070302 clinical core','20261113095318 lifecycle','proposed PR109 clinical #16/#17 NOT in PR116 tree'],
    flag:'VITE_CLINICAL_WORKSPACE_UI (OFF)',
    request:'Trusted exact account+branch+pet+owner+section+cursor; 50-row draft/record pagination',
    response:'Present branch appointment context; chart read unavailable until accepted source',
    failure:'Role/branch mismatches deny, 50/51 source fixture only; local draft not saved to provider',
    persistence:'missing-server-adapter',missing:'Reviewed authenticated clinical chart reader + CAS draft revision save, author/editor provenance; SOL recovery ACL PASS'
  },
  {
    id:'pharmacy',path:'/app/pharmacy',surface:'staff',title:'Pharmacy FEFO and stock history',
    role:'active staff in authorized branch',scope:'assert_staff_branch on each read; all stock rows branch-bound',
    reads:['medicine_catalog','branch_medicine_rules','clinic_branches timezone','list_branch_medicine_alerts RPC','branch_stock_batches','list_branch_medicine_fefo RPC','stock_movements'],
    writes:[],migration:['20261118225000 issue78 inventory read-only foundation (source, unapplied)'],
    flag:'VITE_PHASE5B_PHARMACY_UI (OFF)',
    request:'Verified branch ID and medicine ID; bounded ordered FEFO and read-only audit rows',
    response:'Only validated stock alerts, batches and movement history; cost columns never selected',
    failure:'Denied/network/error clears stock; no optimistic quantity or dispense',
    persistence:'provider-unverified',missing:'Hosted migration/role RLS and FEFO negative acceptance; no dispense/adjustment endpoint'
  },
  {
    id:'billing',path:'/app/billing',surface:'staff',title:'Branch billing and invoices',
    role:'active staff and asserted branch',scope:'branch UUID and verified membership',
    reads:['verifiedStaffSession','assert_staff_branch RPC','billing/port.ts returns BILLING_READER_NOT_INTEGRATED'],
    writes:[],migration:['MISSING approved invoice/ledger/payment schema'],
    flag:'VITE_PHASE5C_BILLING_UI (OFF)',
    request:'Branch-invoice list/detail request blocked at adapter until audited backend',
    response:'Unavailable; no verified invoice count, total, balance, receipt or paid status',
    failure:'No finance SELECT; denied/unavailable not misrepresented as zero charges',
    persistence:'missing-server-adapter',missing:'Approved branch-scoped invoice+line+receipt readers, immutable payment ledger and RLS'
  },
  {
    id:'owner-invoices',path:'/app/invoices',surface:'owner',title:'Owner invoices and receipts',
    role:'verified owner',scope:'verified owner ID, never via URL',
    reads:[],writes:[],migration:['MISSING approved owner finance reader'],
    flag:'VITE_PHASE5C_BILLING_UI (OFF)',
    request:'No request sent; show owner-specific unavailable state',
    response:'No published finance information',
    failure:'No fabricated charges/receipts/payment successful notice',
    persistence:'missing-server-adapter',missing:'MISSING owner-bound, publication-controlled invoice and receipt read API'
  },
  {
    id:'communications',path:'/app/communications',surface:'staff',title:'Consent-bound communications',
    role:'active staff (no messaging authorization contract exists)',scope:'staff membership before showing even an unavailable screen',
    reads:['verifiedStaffSession and active staff branch memberships (no messages read)'],
    writes:[],migration:['MISSING communications/consent/outbox migrations'],
    flag:'NONE: communication operations always unavailable in this source',
    request:'No message request; no patient/contact payload or provider outbound network',
    response:'Accessible staff-only unavailable notice, zero inbox messages asserted',
    failure:'Signed-out/denied staff access blocked; no inbox fallback or send button active',
    persistence:'missing-server-adapter',missing:'MISSING reviewed ASTRA consent/opt-out/retention scoped inbox/outbox + audited send-and-delivery contract with provider approval'
  }
].flatMap(x=>{
  // The source file groups similar presentation, but every actual user path
  // receives an independent auditable contract record. No new API is added.
  if(x.id==='public')return [
    x,
    {...x,id:'public-services',path:'/services',title:'Informational service categories',
      request:'Visit informational Naga care categories; not a published booking catalog',
      response:'Eight owner-approved category labels; no price, duration or clinical claim'},
    {...x,id:'public-about',path:'/about',title:'About the clinic',
      request:'Browse existing branch information',response:'Only approved public branch facts'},
    {...x,id:'public-location',path:'/location',title:'Clinic locations and maps',
      request:'Open approved contact and HTTPS Maps URLs on deliberate click',
      response:'Naga and Cavite addresses, safe outbound links; no geolocation tracking'},
    {...x,id:'public-contact',path:'/contact',title:'Contact clinic branches',
      request:'Open existing verified public Facebook link',response:'Contact facts only; no messages sent from the system'}
  ]
  if(x.id==='auth')return [
    x,
    {...x,id:'auth-signup',path:'/auth/signup',title:'Owner sign-up',
      request:'Email/password registration; no role claims from metadata',
      response:'Verified-session access only after GoTrue email confirmation'},
    {...x,id:'auth-verify',path:'/auth/verify',title:'Email confirmation guidance',
      request:'Account verification or resend through reviewed GoTrue Auth screen',
      response:'No portal access without GoTrue getUser-confirmed non-anonymous identity'},
    {...x,id:'auth-forgot',path:'/auth/forgot',title:'Password-reset request',
      request:'Account recovery initiation; callback URL contains only allowed return hint',
      response:'No sensitive account existence disclosure to unauthorized visitors'},
    {...x,id:'auth-recovery',path:'/auth/recovery',title:'Password recovery',
      request:'Validated recovery state and password change through Supabase Auth',
      response:'Password change acknowledged by GoTrue; no owner data in URL'},
    {...x,id:'auth-callback',path:'/auth/callback',title:'Authentication callback',
      request:'PKCE callback with safe allowlisted /book route hint only',
      response:'Verified user identity; service time rechecked after return'}
  ]
  return [x]
}).concat([{
  id:'not-found',path:'*',surface:'public',title:'Accessible unknown-route handling',
  role:'anonymous',scope:'No clinic scope or private data',
  reads:[],writes:[],migration:['None; client-side React Router wildcard'],
  flag:'none',request:'Unknown browser path or expired bookmark',
  response:'Semantic Page not found H1 with safe public navigation',
  failure:'No patient, booking or staff error details are exposed',
  persistence:'no-frontend-write',missing:'Hosted Pages SPA refresh/deep-link verification before release'
}]).map(x=>Object.freeze({...x,reads:Object.freeze(x.reads),writes:Object.freeze(x.writes),migration:Object.freeze(x.migration)})))

export const RELEASE_MISSING_OPERATIONS = Object.freeze([
  {id:'clinical-finalization',ui:'Disabled; local draft text explicitly unsaved',contract:'MISSING approved server-side encounter finalization, amendment/audit, patient+branch+author verification',acceptance:'Two vets: successful CAS draft once, stale revision rejected; finalization denied for receptionist, preserves immutable author and signed record'},
  {id:'vaccinations',ui:'Historical chart only if read verified; administer/record/remind disabled',contract:'MISSING server-authorized vaccine schedule, administration, lot/clinician/audit and consent contract',acceptance:'Authorized vet records vaccine after independent approval; unrelated branch, expired account and invalid lot denied'},
  {id:'prescriptions',ui:'Editable local scratch only; prescribing/printing/dispensing disabled',contract:'MISSING prescription author identity, controlled-medication policy, signed order and clinic role contract',acceptance:'Vet-approved prescription persists after refresh and cannot be forged by receptionist or wrong branch'},
  {id:'stock-transactions',ui:'Read-only FEFO and expiry; receive/dispense/adjust/transfer disabled',contract:'MISSING atomic cost-safe batch mutation, FEFO/quantity ledger, expiry validation and staff JWT/RLS',acceptance:'Authorized batch debit atomically changes stock exactly once; replay, wrong branch, expired lot rejected'},
  {id:'invoices-payments',ui:'Invoice/receipt/payment unavailable; never show invented balance',contract:'MISSING owner/branch invoice, immutable lines/payment/refund ledger, receipt publication and reconciliation API',acceptance:'Owner A cannot read B ledger; authorized payment receipt reconciles idempotently and is printable only after persisted acknowledgment'},
  {id:'communications',ui:'Staff-only unavailable screen, no inbox/compose/send',contract:'MISSING recipient verified consent, preferences/opt-out, anti-spam audit, provider approval and send status',acceptance:'Opted-out/wrong-owner/revoked staff message requests denied; authorized consent-bound send is audited and delivery failures are not called delivered'}
].map(x=>Object.freeze(x)))

export const STAFF_RELEASE_MODULES = Object.freeze([
  {id:'operations',label:'Operations queue & day/week',path:'/app/ops',gate:'ops',state:'Branch-scoped read-only schedule; source preview until hosted approval'},
  {id:'clinical',label:'Patient charts & encounter drafts',path:'/app/clinical',gate:'clinical',state:'Appointment context only; secure chart and Save remain unavailable'},
  {id:'pharmacy',label:'Veterinary pharmacy',path:'/app/pharmacy',gate:'pharmacy',state:'Read-only FEFO and expiry; dispensing and receiving unavailable'},
  {id:'billing',label:'Billing & invoices',path:'/app/billing',gate:'billing',state:'Read-only shell; no approved financial reader or payments'},
  {id:'communications',label:'Communications & consent',path:'/app/communications',gate:'always-unavailable',state:'No approved inbox, consent or send contract; no messages loaded'}
].map(x=>Object.freeze(x)))

/** A route flag never grants a staff privilege or proves server persistence. */
export function clinicModuleView(module,flags,staffAuthorized){
  if(!staffAuthorized)return Object.freeze({kind:'denied',linked:false})
  if(module.gate==='always-unavailable')return Object.freeze({kind:'unavailable',linked:true})
  if(flags?.[module.gate]!==true)return Object.freeze({kind:'off',linked:false})
  return Object.freeze({kind:'preview',linked:true})
}
export function routeContract(path){
  return CLINIC_ROUTE_CONTRACTS.find(x=>x.path===path)??null
}
