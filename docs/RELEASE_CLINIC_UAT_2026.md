# DAWNEY — Full Clinic Frontend Release Acceptance & Human Operator UAT
**CLOUD · 21 November 2026 · SYNTHETIC SOURCE ACCEPTANCE, NOT A CLINIC-LIVE CERTIFICATE**

## 1. Scope, source identity and non-negotiable boundaries

- Repository: https://github.com/cmlagatuz/dawney-clinic.
- Frozen frontend parent: PR #112 at 0d09f4dcccd87b5e8b31cdadbcbeb2f19c2a05aa. Child: Draft PR #114, branch ai/cloud/full-clinic-release-uat-20261121, directly targeting the frozen PR112 branch.
- This package adds tests and this operator document **only**. It does not modify React production components, backend adapters, SQL/RLS, migration history, CI/source pins, approved static content, PR89 Qwen fixtures, current feature-flag defaults, Cloudflare settings or Supabase configuration.
- No actual clinical, medication/inventory, invoice, payment, email, social-network message, reminder, vaccination, prescription, dispensing, clinical sign-off, staff bootstrap, production deployment or spending is performed.
- The tests run local Vite and real Chromium using completely synthetic intercepted HTTP. Synthetic booking is a local test-only simulated request that fails once and replays the exact nonce and body; the fake receipt is explicitly marked REQUESTED. Any clinical save in an isolated test fixture is a local acknowledgement simulation only; production has no connected Save.
- Names, dates, owner/pet/branch UUIDs and medications appearing in the fixtures are fictitious; test data uses synthetic 20000000... and 40000000... UUID families. The fixture uses a localStorage-only fake booking so that a second page can see the same fabricated request. This test harness is not a production storage pattern or evidence of provider persistence.
- **SOURCE ONLY != SYNTHETIC BROWSER PASS != HOSTED STAGING PASS != CLINIC-LIVE OWNER GO.** Each gate must be recorded separately, on the exact code/database version.

## 2. Operator preflight — do not use live patient identities

- [ ] PM confirms reviewed source tree/merge ancestry and one exact SHA for every frontend, backend and security artifact. Preserve the historical Dog / Chow Chow record and its appointment.
- [ ] Owner authorizes a separate isolated STAGING environment and precisely scoped synthetic accounts. Never reuse real customer identities, patient records, phone numbers, private clinic documents or genuine messages.
- [ ] Backend operator verifies full ordered migrations including the new branch, scheduling, inventory and clinical proposals, but **does not apply migrations without explicit human-owner authorization**. Preserve immutable original 11 migrations and reviewed #12–#17 ordering.
- [ ] Verify an independently approved encrypted/signed, restorable PostgreSQL + Auth + Storage recovery and rollback, including grants/ACL, role memberships, database functions, private storage and object bytes. A disposable PG17 test is not provider-managed restoration.
- [ ] SOL independently accepts the corrected exact backend source. At the PR112 frozen checkpoint SOL's PR109 verdict is NEEDS FIX for one P2 recovery authorization/ACL fidelity defect (https://github.com/cmlagatuz/dawney-clinic/pull/109#issuecomment-7051738226). No clinical activation on that source.
- [ ] Veterinary owner signs off branch identity, approved published services and species, appointment hours and holidays in Asia/Manila, prices/taxes, scope of treatments, medical record retention, consent, vaccination/prescription policy and communications.
- [ ] Confirm flags remain OFF in production: VITE_PHASE5A_OPS_UI, VITE_CLINICAL_WORKSPACE_UI, VITE_PHASE5B_PHARMACY_UI, VITE_PHASE5C_BILLING_UI, VITE_PHASE4_PATIENT_FORM (until separately approved). Testing temporarily sets the relevant flags in the local Node/Vite process ONLY.
- [ ] Prepare two confirmed owners A/B with distinct pets, one receptionist, two veterinarians A/B, one administrator and one revoked staff fixture; test both Naga and Cavite branches, unrelated branch membership and wrong-branch access.
- [ ] Make sure the browser can truly reach the intended approved staging commit, and observe actual Auth and server-side RLS/role behavior from the browser and independently from query logs. A Cloudflare Pages preview success does not establish hosted medical persistence.

## 3. Release acceptance matrix: expected user-facing state and evidence type

| Phase / actual route | Actor and authorized action | Expected outcome | Current evidence / remaining gate |
| --- | --- | --- | --- |
| Public home and information: /, /services, /location | Anonymous visitor | Branded clinic, semantic H1/landmarks, eight Naga *informational categories*; Naga and Cavite addresses, safe external map links. No fabricated service price, duration, Sunday hours or 24/7 assertion. | Source and local Chromium tests; owner-approved content must be rechecked on hosted release |
| Public booking: /book | Anonymous visitor | Inspect genuinely approved Naga booking options if visible. May select service/time without identity; cannot send booking without confirmed Auth and eligible owned pet. Cavite remains contact-only unless separately approved. | Synthetic browser; real published service/resource RLS **NOT VERIFIED** |
| Return through /auth/signin?next=%2Fbook | Customer A | PII-free constant route hint; valid same-tab service/time reselected only if within allowed validity; never put pet, owner, clinic ID, notes or token in URL. Verified sign-in returns to /book. | Existing auth-return Node + new release browser; real OTP/confirmation links NOT VERIFIED |
| Patient selection /app/pets | Owner A/B | Species then dependent breed, Mixed/Unknown/NA where allowed, accurate historical Chow Chow, optional private attachments; B never sees A's pet/card/medical files. Empty versus denied must differ. | Existing source + inherited browser/Node; hosted Storage RLS, object bytes and real attachment upload/download **NOT VERIFIED** |
| Appointment request /book or /app/appointments | Verified customer | Select only owned eligible pet and published service/resource/date; 15-minute grid when policy explicitly says 15 minutes, Manila timezone, lead/horizon and holiday limits. First network failure preserves same nonce/payload. Server returns REQUESTED, not CONFIRMED; no fabricated email/SMS. | Local fake RPC and source test; actual JWT/RLS booking idempotency/confirmation transition **NOT VERIFIED** |
| Owner appointment list /app/appointments | Owner A/B | A sees own requested booking; B cannot see it. Requested remains requested until independently authorized server change. | Synthetic browser; hosted owner A/B RLS and refresh persistence **NOT VERIFIED** |
| Operations /app/ops | Active branch receptionist/vet/admin | Verified role and selected branch only; branch-filtered queue and distinct branch counts, requested/confirmed separated; current day and week schedules, exact Manila dates. Disabled confirm/reschedule/providers unless valid contracts exist. | Existing and release synthetic Chromium; hosted staff bootstrap, counts and confirmed transition **NOT VERIFIED** |
| Branch paging and safety | Active staff | 250 rows complete only if <=250; 251 means visible first 250, explicit incomplete lower bound, not a global queue. Wrong branch or revoked role clears visible patients and counts. | Synthetic 250/251; hosted 250/251 and role revocation **NOT VERIFIED** |
| Patient chart /app/clinical | Verified receptionist vs veterinarian/admin | Selected exact branch appointment and owner identity; receptionist can see appointments, not clinical records/drafts. Missing, denied, not found, network and verified empty distinctly; no untrusted legacy record backfill. | Clinical source-only unavailable; local chart fixture 50/51 and negative tests; hosted chart RPC **NOT VERIFIED** |
| History pagination | Vet/admin | Appointments, provenanced records and immutable-createdAt drafts load <=50 at a time, retain no stale foreign rows. 51st draft discovered on page 2 must hydrate its correct appointment editor. | Local chart fixture; SQL #16/#17 source, actual server data/ACL **NOT VERIFIED** |
| Encounter editor | Veterinarian | Complaint, examination, assessment, follow-up plan. Unsaved local text must never be displayed as server-saved. Creator and last editor distinct. Duplicate unchanged request uses same UUID; stale two-vet revision causes conflict requiring reload. No finalization/prescription. | Local synthetic CAS only; **production Save unavailable**, hosted audit/revision NOT VERIFIED |
| Pharmacy /app/pharmacy | Authorized branch staff | Read-only medicine, batch disposition, expiry and FEFO order, near-expiry/reorder alerts; no dispense, receive, waste, stock count or movement without approved API. No confidential cost fields. | Synthetic Chromium; hosted inventory migration/stock contracts NOT VERIFIED |
| Finance /app/billing /app/invoices | Branch staff / owner | Explicit "Billing read service not integrated" / unavailable owner invoice state, no fake totals, paid status, receipt, ledger or transaction. All mutations unavailable. | Local UI source + synthetic tests; finance backend, immutable ledger/payment/refund and policy entirely BLOCKED |
| Anonymous, wrong owner, expired or revoked account | All protected routes | Redirect/deny, no patient/finance/clinical data, no stale content, no unscoped fallback. No role privilege from URL/JWT metadata. | Synthetic negative tests; actual hosted JWT/RLS/Storage **NOT VERIFIED** |

## 4. Five actual operator/customer scripts (record screen and server outcome)

For every step record the **exact staging commit, backend migration hashes, acting role, branch, time in Asia/Manila, role scope, UI state, matching server result and PASS/FAIL/SKIPPED**. Do not store real patient identifiers in reports or screenshots. Use synthetic fixture IDs in a private test register; do not paste them into public URLs.

### Customer A — signup, verified return and requested booking
- [ ] Open /, /services and /location anonymously. Distinguish Naga and Cavite, confirm informational service text and all external links.
- [ ] Open /book anonymously. Check that unpublished or incomplete policy does not create slots and that no request can be sent before owner verification. If an approved policy exists, choose one published service and selectable time in Manila; check no pet name/ID appears in the URL.
- [ ] Select sign-in. The destination must be exactly /auth/signin?next=%2Fbook; no open redirect. Complete account verification using an approved **synthetic** account. Return to booking with an expiring PII-free intent, and revalidate the service/time against CURRENT backend policy.
- [ ] Open /app/pets. Verify owned pet selection, species/breed dependency and absence of other owners' pets; review optional attachment authorization only after staging Storage approval.
- [ ] Request an appointment with a synthetic concern. Interrupt the first request after uncertain network outcome; retry WITHOUT changing request payload. The backend must return the same appointment and REQUESTED status (no second booking, no "confirmed" state). Reopen /app/appointments and refresh to verify actual persistence only after staged API enabled.
- [ ] No spontaneous email/text, invoice, prescription, stock transaction or appointment confirmation may occur.

### Customer B — cross-owner isolation
- [ ] Sign in with a separate confirmed synthetic owner B and different patient. B can see only B's own pets/appointments/profile.
- [ ] Revisit A's booking/pet links or attempt forged identifiers from a safe isolated negative test. B must get 403/not-found without identity oracle, private chart, attachments, invoice or owner A record. Clear prior A state across account switch, tab refresh and delayed network response.
- [ ] Confirm B cannot see clinic Operations or Clinical routes just because A or staff previously used the same browser. Staff access requires real current role membership.

### Receptionist — day/weekly queue and restrictions
- [ ] Sign in as confirmed receptionist of Naga; select only Naga. Verify branch-scoped dashboard counts (not global registrations), requested booking in queue and local Asia/Manila times.
- [ ] Switch board to day schedule, then week view; verify seven bounded daily queries, weekday focus/keyboard operation and no invented provider assignments/hours.
- [ ] Toggle requested versus confirmed: a requested appointment must disappear under confirmed filter until the authorized backend transition actually persists. Unavailable confirm/reschedule buttons remain disabled.
- [ ] Open patient chart from verified queue. Appointment context may appear, but diagnoses, medical-record notes, drafts and prescriptions must not. Attempt role mismatch where branch says veterinarian but global says receptionist; least privileged effective role wins.
- [ ] Simulate >250 rows, loss of session or branch membership and network failure. Incomplete warning, denial, retry and clearing of old content must be visually distinct.

### Veterinarian A/B — longitudinal history and conflict safety
- [ ] Confirm both veterinarians independently have **active global and exact branch** roles. Choose a legitimate branch-linked patient appointment; no URL patient parameter grants permission.
- [ ] Review demographics, prior appointments and provenance-attested clinical history; reject legacy NULL/unlinked records and foreign branch data. Load exactly 50 then the 51st page; check no duplicate/lost patient.
- [ ] Open the correct appointment's existing DRAFT and review creator/last-editor identity separately. Change complaint/examination/assessment/plan; observe "Unsaved local edits" until an actual verified server response.
- [ ] On approved staging only, vet A saves revision N, vet B independently edits the same encounter with stale revision N, and receives conflict without overwrite. Vet B reloads current revision, reconciles and saves with a **new** request UUID. Exact same nonce+payload replay must be idempotent; changed payload under same nonce denied.
- [ ] Refresh in a new browser and verify actual persisted revision, private append-only audit actor and attribution. No final sign, prescription, vaccination, dispensing, clinical billing or notification occurs because these APIs/policies are not approved.

### Administrator — overview, branch isolation, billing safety
- [ ] Sign in as confirmed administrator with explicit global and branch authorizations. Dashboard counts and schedule must remain branch scoped, including multi-branch Naga/Cavite switching.
- [ ] Review staff chart permissions and distinguish unavailable clinical history from genuinely empty. Administrator chart access is not veterinarian write authority.
- [ ] Open read-only pharmacy: batch lots, FEFO order, expiry and replenishment alerts; check restricted cost fields and that inventory buttons remain disabled.
- [ ] Open Billing: invoice, payment, paid status and receipt are **unavailable**, not zero, unless signed/approved source and real scoped finance reader exist. Test branch switching and revocation; do not create/void/refund/issue any financial document.
- [ ] Audit end-to-end errors with actual server response IDs in a private audit log; no real clinical data, payment screenshots, personal details or credentials in public PR comments.

## 5. Accessible and responsive acceptance — repeat the complete six-cell matrix

| Viewport | Light | Dark | Keyboard/screen-reader checks |
| --- | --- | --- | --- |
| 360 px phone | [ ] PASS / FAIL | [ ] PASS / FAIL | No horizontal body overflow; mobile navigation keyboard Enter/Escape and visible focus; form labels/errors readable and stacked; pagination and disabled actions announced |
| 768 px tablet | [ ] PASS / FAIL | [ ] PASS / FAIL | Branch picker and week calendar operable with Tab/Arrow keys; every selected tab has aria-selected/aria-controls; dialogs/alerts remain visible |
| 1440 px desktop | [ ] PASS / FAIL | [ ] PASS / FAIL | Skip to main, semantic landmarks and H1; roving tab focus where provided; statuses not encoded by color alone, readable contrast and focus outlines |

- [ ] Use a screen reader (NVDA/VoiceOver) to check headings, input names, live status/alerts, disabled actions, tab panels and explicit denial versus empty. DOM/ARIA assertions in Chromium are **not** equivalent to a manual screen-reader audit.
- [ ] Test browser back/forward, refresh, new tab, a second signed-in account, branch switch mid-request, patient switch mid-request, and stalled network completion. No stale clinical or finance details may reappear.
- [ ] Assert no patient name, owner ID, appointment ID, token, clinical note, cost data or other PII is placed in URL/search/hash/telemetry/cross-origin requests. The local QA fixture uses only its own synthetic UUIDs; production logging/privacy requires separate hosted audit.
- [ ] No unapproved 24/7 message, Sunday hours, prices, slots, services, vaccine/care advice or patient medical facts.

## 6. Executable local QA (Node 22+; actual Chromium available)

From the repository root at the proposed child SHA:
1. cd web
2. npm ci --ignore-scripts --no-audit --no-fund
3. CHROMIUM_BIN=/usr/bin/chromium node --test tests/release-clinic.browser.test.mjs
4. CHROMIUM_BIN=/usr/bin/chromium npm test
5. npm run typecheck
6. npm run build
7. For targeted regression: CHROMIUM_BIN=/usr/bin/chromium node --test tests/frontend-release-integration.browser.test.mjs tests/staff-ops-connected.browser.test.mjs tests/clinical-chart-integration.browser.test.mjs tests/billing-workspace.browser.test.mjs

The tests create Vite on localhost with VITE_SUPABASE_URL pointing to the **fake, intercepted** issue51-fixtures.supabase.co origin and a synthetic publishable key. Chromium's fetch interception rejects any unexpected provider origin, unscoped staff read, clinical table write or finance/inventory transaction. Only local synthetic fixture routes may fabricate persistence acknowledgements and only for explicit test cases. The tests clean process env on completion and never modify app config files or production flags.

Re-run PR-head React web, anonymous Chromium, static release-preparation and legacy PHP workflows; read actual logs. Do not change source-integrity/pinned Git blobs or CI allow-lists for a tests-only branch unless ASTRA independently owns a later narrow exact-source CI child. If a job is skipped, write SKIPPED—not PASS.

## 7. Required negative-acceptance register

| Scenario | Expected result |
| --- | --- |
| Owner A request first reply lost | One unchanged UUID/body retry; one requested visit; never automatic confirmation |
| Guest, unverified, password failure or expired JWT | No booking submission or protected patient; safe sign-in return |
| Owner B guessing A pet/appointment | Denied or not_found with no A data; no unscoped fallback |
| Naga staff selecting Cavite without membership | Denied, or explicit authorized Cavite empty state; never Naga queue |
| Branch, patient or account switch during slow GET | Old response discarded; no stale patient/clinical/invoice content |
| Global receptionist + branch veterinarian mismatch | Effective receptionist; appointments only, no notes/drafts |
| Revoked staff or branch membership | Clear all rows and counts, show denial, do not retain dirty draft |
| 250 vs 251 appointments | 250 exact complete; 251 first 250 with explicit incomplete/lower bound |
| 50 vs 51 clinical entries | Page one 50; page two 1; immutable createdAt draft keyset, no duplication/omission |
| Clinical migration absent / unreviewed contract | Unavailable, not an empty chart; Save disabled |
| Wrong patient owner/branch returned in response | Fail closed; nothing from malformed response rendered |
| Concurrent veterinarian revision | Stale revision conflict; reload, no overwrite; separate creator/editor |
| Network 401/403/404/500 | Explicit denied, missing, network/error and truthful retry states |
| Pharmacy FEFO and expiry | Only authorized branch batches; no movement or dispensing |
| Financial reader absent | No invoice, money or receipt fabricated; no payable action |
| External link and responsive breakpoints | HTTPS/safe rel, semantic focus, no horizontal scroll in 6 viewport/themes |

## 8. Release blocker register and owner actions

**BLOCKED — clinical/security:** SOL reviewed backend PR109 at 08713ddc9a3ef984426807f475cf7829631c5326 and returned NEEDS FIX (one P2 recovery authorization/ACL fidelity). ASTRA must repair on an isolated child and SOL must PASS the new exact head; no clinical migration/Save activation before hosted Auth/RLS and signed recovery verification. Proposed #16/#17 are not installed on the hosted Supabase project.

**BLOCKED — actual hosted integration:** Unreviewed clinical reader and record provenance, backend migration chain, staff bootstrap, real customer A/B JWT denial, private Storage access, cloud backup/restore and provider Auth recovery must be accepted against the exact integrated release candidate. Browser tests against localhost mock APIs do not fulfill these gates.

**BLOCKED — pharmacy and finance:** Read-only inventory API proposals and active staff/membership must be staged and verified; no approved inventory movement/dispensing workflow. No audited branch/owner-scoped invoice ledger/payment/receipt/refund API; financial UI correctly refuses to claim any transaction.

**BLOCKED — clinic policies and outward actions:** Owner-approved service publishing, precise working/booking hours and holiday calendar, pricing/tax, encounter sign-off policies, vaccination/prescription authority, communication consent, approved message delivery, and staff operational training are required before public clinic-live release. Customer-facing "requested" is not "confirmed".

**RELEASE GOVERNANCE:** PM checks independent SOL security, Qwen QA, ASTRA exact-source full-tree CI and Manus/provider integration evidence. Only the human Project Owner can approve migrations/SQL, real messages, production hosting/DNS, clinical publication, release and expenditure. No self-merge. Any unresolved P0/P1/P2, failed verification, missing recovery or uncertain patient authorization is a hard NO-GO.

**One next owner after CLOUD test delivery:** PM, to route a separate exact-source review to Qwen and backend/security recovery remediation to ASTRA/SOL. Preserve PR112 and all reviewed parents unchanged.
