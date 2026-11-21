# DAWNEY — Full Clinic Frontend Release Train and Server Contract Acceptance

**CLOUD · 21 November 2026 · Draft PR121 · SOURCE + LOCAL SYNTHETIC CHROMIUM ONLY**
**Base:** frozen PR116, b4129cdf6318cf43f27bc709ad8d1b2e87dfe669.
**Branch:** ai/cloud/full-clinic-release-train-20261121, targeting PR116 branch ai/cloud/owner-patient-release-hardening-20261121.

## Release boundary and dependency truth

This is an integrated React navigation and contract-verification package built from **existing production route components**. It does not build disconnected imitation clinical or finance features, change any backend API, alter SQL/RLS/Storage, modify the pinned source integrity workflow, publish clinic policy, turn on private flags, or send provider messages. The separate earlier PR117 public-only fallback is NOT cherry-picked or required by this child. Clinic-live operation remains **NO-GO** until ASTRA-hosted acceptance, SOL/Qwen independent audits and specific human owner approval.

The protected route /app/clinic now joins public discovery, GoTrue sign-in, owner profile/patient/private files, service-aware /book, requested-only owner history and verified staff modules. /app/communications is directly accessible only behind Auth Guard and current server-asserted active staff membership; it has **no inbox, recipient, outbound API, send, reminder, preview message or provider access** and its buttons are disabled. A successful staff membership display does not confer authority for later operations: each destination independently asserts the server branch and required role. Revoke even one offered branch and the hub/sidebar fails closed until permissions can be rechecked. No branch/patient/scope is passed through URLs as an authorization hint. Account ID changes remount the release view; overview account changes remount and deny/failed read clears previous counts.

The original visitor SiteLayout, owner Guard/AppLayout, OpsPage, ClinicalWorkspacePage/PatientChart/ChartIntegration, PharmacyPage, BillingStaffWorkspace/OwnerBillingPage and all typed backend adapters are reused, not replaced.

## Source-of-truth exact route/API/RLS contract matrix

The machine-readable registry contains 22 distinct actual React paths (public, Auth, protected portals, and unknown-route wildcard) with required request, response, error semantics, migrations, flags, missing operations and persistence truth is web/src/release/clinic-contracts.mjs and its TypeScript declaration clinic-contracts.d.mts. The following human-review matrix groups related routes for readability; each actual path has a separate machine-readable record.  all API/table/function names below originate from PR116 reviewed source. RPC functions for missing operations have **not** been assigned invented names.

| Actual route | Current trusted source/API | Verified subject + branch scope | Required migration/source | Current UI/flag | Persistence and missing contract |
| --- | --- | --- | --- | --- | --- |
| /, /services, /about, /location, /contact | clinic-info.mjs public-only constants; optional clinic_branches directory read | anonymous, Naga public primary and Cavite **contact-only** | issue77 branch foundation where public branch discovery is needed | Always public; published service/pricing/booking NOT inferred from categories | Informational only; owner must confirm hours, location and public links |
| /book | clinic_branches, branch_booking_policies, clinic_booking_policy compatibility, clinic_services, clinic_service_resources, clinic_service_species, appointment_resources; exact request_service_appointment RPC for verified owner | Naga branch UUID server-approved; eligible verified owner+pet; active resource, UTC Manila window | 20261114090000 Phase4 contract; 20261117233500 issue77; 20261118203500 issue51 | Always shows public page; request ONLY if approved branch/service/time | Persisted requested after returned ID + owner-scoped read; no hosted approval, nonce/slot conflict still unverified |
| /auth/signin, /auth/signup, /auth/verify, /auth/forgot, /auth/recovery, /auth/callback | auth.getSession/getUser, GoTrue signup/login/reset/update, PKCE | Auth subject verified, email-confirmed, non-anonymous; next=/book allowlisted without PII | 20261113074938 verified Auth | Available with configured public Supabase client | Real OTP/expired/callback and multi-owner JWT unverified; no open redirect or patient ID in return |
| /app/overview | owners SELECT, pets SELECT, appointments SELECT through user-scoped lib adapters | verified Auth+owner account | phase2 core/phase3 appointment | Owner portal available; new account-keyed data/explicit retry | Production historical persistence NOT verified; failure cannot preserve stale counts |
| /app/profile | owners SELECT/INSERT/UPDATE returning row | verified subject owners.user_id | 20261113070302 core | Owner route; separate denied vs authorized empty/create | Owner A/B server RLS and real write retention not verified |
| /app/pets | pets SELECT/INSERT/UPDATE, species_catalog, breed_catalog | verified owner/pet; separate species and breed eligibility | phase2 core; Phase4 20261113211600/11700/20261114072200 | Default pet form; catalog + three private attachments ONLY when VITE_PHASE4_PATIENT_FORM=true (OFF) | Exact Chow Chow preservation; server pet-save/read and taxonomy migrations hosted unverified |
| /app/pets attachments | pet_attachments SELECT/INSERT returned metadata; PRIVATE Storage upload/download | exact owner, pet ID, category and object-path prefix | 20261113211600 Phase4; 20261116002500 Storage path RLS correction | Profile photo, health card, vaccine card opt-in; state distinguishes uploaded-unindexed | No public URLs; metadata-only retry; ASTRA must provide truly idempotent finalization when INSERT committed but ack lost |
| /app/appointments | appointments owner-scoped read, request_service_appointment RPC; existing scoped cancel/update adapter | verified owner and owned patient, service/resource/nonce | phase3 lifecycle + Phase4 booking + issue51 | Requested and confirmed distinct; no optimistic confirmed | Pending real staff-only confirm/cancel server evidence and idempotent lost response |
| /app/clinic | verifiedStaffSession, staff_branch_memberships, clinic_branches, server assert_staff_branch per offered branch; no patient read | authenticated subject, current membership/branch | 20261117233500 issue77 + 20261118215500 issue58 | New release navigation; flags OFF unchanged | Navigation-only, no clinical/finance/messaging permission; independent destination checks |
| /app/ops | staff_memberships, staff_branch_memberships, assert_staff_branch, branch-scoped appointments <=251, get_branch_dashboard_counts RPC | active receptionist/vet/admin; verified branch and UTC interval | 20261118215500 issue58 + issue77 | VITE_PHASE5A_OPS_UI OFF; real read-only day/week | 250/251 incomplete flagged; real hosted role/revocation/branch counts not verified; no unscoped fallbacks |
| /app/clinical | clinical/port read-only branch queue and PatientChart; ChartIntegration unconnectedClinicalPort intentionally unavailable | verified staff branch; receptionist appointment-only, vet/admin draft UI subject to future API | Phase2/3 clinical; proposed ASTRA PR109 clinical #16/#17 NOT in PR116 migration tree | VITE_CLINICAL_WORKSPACE_UI OFF; write disabled; local scratch is not persisted | Secure chart reader, 50/51 cursor, provenance/CAS write and finalization still missing/NO-GO |
| /app/pharmacy | medicine_catalog, branch_medicine_rules, clinic_branches timezone, list_branch_medicine_alerts RPC, branch_stock_batches, list_branch_medicine_fefo RPC, stock_movements | active staff branch asserted, bounded medicine and FEFO reads, no cost columns | 20261118225000 issue78 inventory read-only migration (source, not hosted verified) | VITE_PHASE5B_PHARMACY_UI OFF; read-only | No receiving/dispensing/adjustment/transfer; hosted schema/RLS and ledger need approval |
| /app/billing | verifiedStaffSession and assert_staff_branch; billing/port throws BILLING_READER_NOT_INTEGRATED, NO finance SELECT | verified staff branch | MISSING approved invoices/ledger RLS/API | VITE_PHASE5C_BILLING_UI OFF; controlled unavailable | No real invoices, balance, payment, refund or receipt service; never infer paid/zero |
| /app/invoices | OwnerBillingPage no finance read (intentionally unavailable) | verified owner; only own invoices after approved reader | MISSING owner-specific invoice publication | VITE_PHASE5C_BILLING_UI OFF | No published owner balances, paid status or printable/downloadable receipts |
| /app/communications | verifiedStaffNavigationBranches -> verifiedStaffSession, membership + per-branch assert_staff_branch; no message API | current staff only; all roles denied for messaging actions | MISSING consent/outbox/retention/transport schema | Read-only unavailable shell; send/inbox/reminder buttons DISABLED | No recipients looked up or messages sent; needs consent-bound audited, opt-out-safe, provider-approved backend |

Read semantics: loading = verification in progress; empty only after an authorized complete server response; denied/403 = clear old account/branch/pet data and hide controls; missing contract = unavailable, not a zero-value result; offline = retry existing read, no unsafe mutation; malformed/foreign object or patient = fail closed; stale responses = ignored and cannot be displayed as current. Clinic and finance persistence are **not** vouched for by localhost fixture results.

## Six missing server operation contracts — no fabricated RPCs

| Missing operation | Current truthful frontend state | ASTRA to implement and independently authorize | Essential acceptance test |
| --- | --- | --- | --- |
| Clinical finalization and encounter amendment | Vet draft scratch editable, server Save/finalize disabled; ChartIntegration reader intentionally unavailable | Auth+branch+patient+appointment bound read and optimistic-revision CAS write, immutable author, current editor, signed finalization, post-sign amendment audit and controlled role RLS | Vet A starts revision 1, Vet B edits same revision, one succeeds and other conflicts; receptionist/revoked/wrong-branch denied; finalized record cannot silently mutate |
| Vaccinations & history | Informational categories only; no vaccine recorded or administered | Staff-verified clinical vaccination schedule/order/administration, lot/expiry provenance, consent and audit, patient-scoped history | Authorized vet administration persists exactly once after refresh; invalid lot, unrelated owner/branch and expired staff all denied |
| Prescriptions | No prescribing, printing or dispensing from local draft | Legal/clinical author identity, prescription order validation, medicine identity, patient+branch, signature/revision and role-aware RLS | Only authorized prescriber can sign; receptionist and wrong-branch cannot print an unsigned order or dispense; stale revisions fail |
| Pharmacy stock movements | Read-only inventory FEFO, expiry and stock ledger; all stock mutation controls unavailable | Transactional per-branch lot receiving/dispense/waste/transfer/adjustment, immutable event journal, FEFO/reservation/expiry enforcement and idempotency | Two concurrent lot requests cannot oversell; replay does not debit twice; expired lot and unauthorized branch denied; after read matches journal |
| Invoices, payments and receipts | Both owner invoice and staff billing show unavailable, no fabricated amount/payment success | Audited branch invoice+line, pricing/tax publication, owner-scoped invoice read, immutable payments/refunds and reconcilable receipt issuance, RLS and proof of settlement | Owner A can't view B; receipt generated only after persisted reconciled payment; duplicate capture/retry idempotent; offline cannot display paid |
| Consent-bound communications | Staff-only unavailable, all inbox/send/reminder disabled; no backend network | Verified recipient/contact consent and opt-out, purpose, provider authorization, bounded retention, audit, idempotent outbox and per-message delivery status | Unconsented/opted-out/wrong-branch/revoked actor cannot send; a pending or failed provider action is never labelled delivered |

These are contract requirements, NOT assertions that backend APIs exist. Human clinic owner must separately approve clinical/financial policy, providers and live actions. No new privileged endpoints have been introduced here.

## Source/test coverage and integrated operator journey

The existing PR114/116 baseline has 247 Node and actual local Chromium tests, all inherited unchanged. This child adds a source-contract safety test and cross-module Chromium route train; test-only flags activate staff routes in a Vite process with fully intercepted synthetic HTTP, NOT production flag changes.

| Journey requirement | Actual source/browser suite | What remains unverified |
| --- | --- | --- |
| Anonymous public service/booking, current Naga/Cavite distinction, PII-free auth return | release-clinic.browser.test.mjs, public-owner-journeys.test.mjs, booking-contract.test.mjs, clinic-release-train.browser.test.mjs | Real hosted clinic policy, Auth PKCE, provider identity |
| Owner A/B profile/pet taxonomy, Chow Chow/Mixed/Unknown/NA and three private documents | owner-patient-hardening.browser.test.mjs and owner-patient-hardening.test.mjs; new route bridge verifies account separation | Live Storage policy, two browser tabs, metadata INSERT-committed/response-lost case |
| Server-returned REQUESTED booking, same-nonce lost-response retry, separate confirmed history | release-clinic.browser.test.mjs + frontend-release-integration.browser.test.mjs | Actual provider idempotency/conflict and staff confirmation |
| Staff receptionist, veterinarian, administrator, revoked and Naga/Cavite branch selection | clinic-release-train.browser.test.mjs; staff-ops-connected.browser.test.mjs and release-clinic.browser.test.mjs | Hosted JWT revocation in flight and role RLS |
| Day/week, 250/251 queue and counts; stale branch response | release-clinic.browser.test.mjs, staff-ops-connected.browser.test.mjs, ops-branch.test.mjs | Hosted 251st row, real branch catalog |
| Clinical 50/51, two-vet CAS draft conflict, receptionist denial and provenance | clinical-chart-integration.browser.test.mjs, clinical-workspace.browser.test.mjs, release-clinic.browser.test.mjs | PR109 security corrections and provider clinical reader/save |
| FEFO, expiry, receipt/dispense disabled, no cost leak | inventory-pharmacy.browser.test.mjs and release-clinic.browser.test.mjs | Hosted stock migration and historical journal |
| Branch billing, owner invoices, empty/denied and no fake receipt/payment | billing-workspace.browser.test.mjs, billing-model.test.mjs, clinic-release-train.browser.test.mjs | Entire real finance ledger and invoice reader |
| Messaging authorization | clinic-release-train.browser.test.mjs and clinic-release-contracts.test.mjs | Entire consent + outbox backend |
| 360/768/1440 light/dark, H1/ARIA/keyboard/no overflow, back/reload | clinic-release-train.browser.test.mjs plus inherited tests | Manual NVDA/VoiceOver, 2-tab race and real Pages refresh |

**Local reproducible commands** from repository root:
1. cd web && npm ci --ignore-scripts --no-audit --no-fund
2. npm test
3. npm run typecheck
4. npm run build
5. CHROMIUM_BIN=/usr/bin/chromium node --test tests/clinic-release-train.browser.test.mjs tests/clinic-release-contracts.test.mjs
6. node ../scripts/release/verify-static.mjs dist

Use only synthetic HTTP. The real Chromium harness tests the actual React/Vite routes and browser focus. It is NOT Playwright API verification. UI keyboard/ARIA automation does not substitute for manual NVDA/VoiceOver or audited contrast.

### Operator UAT order (separate owner-authorized staging)

A. Public / and /services /location /about /contact /book; inspect only approved public facts, confirm Naga vs Cavite no fake prices, Sunday or available times, and external contact/map safety.

B. Owner A sign-up, verification/new-tab sign-in; profile and animal species/breed; upload three allowed private documents, metadata retry; successful booking request with one lost ack and exact nonce replay; verify persisted REQUESTED history after refresh. Owner B logs in separately; sees zero A patient/attachment/appointment data. Session expiry/error switches clear all before a retry.

C. Receptionist in branch Naga: day/week queue, distinct counts and 250/251. Branch Cavite only if current membership. Check wrong branch and expired membership (403) clears data, never returns unscoped legacy queue.

D. Veterinarian A/B selects authorized appointment; verified 50/51 chart pages, 2-vet draft CAS conflict, immutable authorship; receptionist cannot read clinical records or sign charts. Finalization stays DISABLED until approved.

E. Authorized staff opens pharmacy FEFO and expiry, never observes unscoped costs, demonstrates all dispensing/stock controls disabled; billing has no invoice/payment/receipt and cannot claim paid or zero.

F. Direct /app/communications under active staff verifies branch and shows message/actions unavailable. With revoked staff or ordinary owner it denies. No SMS/email/WhatsApp/Telegram/Facebook message or campaign action. All real messaging needs specific human consent and service approval.

G. Browser 360/768/1440 with light and dark, keyboard Tab/Enter/Escape, contrast; responsive live browser, two separate tabs and NVDA/VoiceOver must be **manually** recorded. Confirm hosted refresh + SPA fallback, CSP, exact Pages deployment commit and runtime errors. No proof of hosted readiness from local Vite.

## CI ownership and exact-source handoff

Inherited full-tree CI still rejects PR116 AppointmentsPage exact blob against PR88 frozen source pins and rejects frontend children outside ASTRA's two authorized paths. This is a PRETEST BLOCK; PG17, full-tree Node and full-tree Chromium are not run. Never hide the failure or adjust a source-integrity check in CLOUD's PR.

**ASTRA after exact-head PM/Qwen review:** create a separate CI-only, narrowly pinned child from this accepted frontend SHA, include exact Git blob hashes of PR116 plus every new PR121 source/test/doc file, preserve ancestor/migration pins and security negative tests, run disposable PG17, real Chromium and real provider staging under owner authorization. Do NOT import isolated synthetic Alpha PR56/57 or cherry-pick unreviewed clinical backend.

**SOL:** audit provenance, ACL, RLS, recovery and cross-account/branch behavior; **Qwen:** exact frontend functional/browser acceptance; **Manus:** deployment metadata evidence only; **human Project Owner:** approves all clinic-live release/SQL, publication, real messages, clinical work, staff creation, private exports, DNS and spending. No deployment, release build activation, live SQL, patient data change, payment, message or self-merge performed here.

**Recommendation:** Full-clinic frontend source may be independently reviewed after tests; **clinic-live release remains NO-GO** for unsupported clinical finalization, pharmacy mutations, finance and communications. Do not substitute synthetic UI for actual persisted services. **One next owner: PROJECT MANAGER**, to freeze this exact SHA and route independent Qwen review plus ASTRA/SOL real backend/CI acceptance.
