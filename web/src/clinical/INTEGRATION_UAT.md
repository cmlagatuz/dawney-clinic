# CLOUD — clinical patient chart / encounter draft acceptance and ASTRA integration handoff

**Scope:** PR #112, isolated child of PR #110 frozen at aa414f61261a28e17953ba55f3825516c1080244.
**Contract reference only:** ASTRA PR #109 at 08713ddc9a3ef984426807f475cf7829631c5326. SQL #16 and #17 are UNAPPLIED and #109 requires independent SOL PASS. This frontend does NOT import that branch's web/src/lib/clinical-chart.ts, send any real clinical RPC, or enable VITE_CLINICAL_WORKSPACE_UI.

## Source ownership / trust boundary

- Production selection remains **verified active global role + branch membership -> server assert_staff_branch -> bounded branch/day appointment queue**. The selected exact appointment supplies **branch, patient, owner and visit IDs**. No patient identifier in the navigation query/hash, no local/session/IndexedDB note storage.
- CLOUD clinical/chart-model.mjs accepts only scoped page envelopes with exact accountId, branchId, petId and expected **queue ownerId**, valid chart-only types, a 50-item maximum and immutable descending (timestamp,id) keyset. Draft cursor uses **createdAt**, never updatedAt. It rejects duplicate IDs, out-of-order pages, owner/branch/patient mismatch, cursor inconsistency, nonfinite ranges, unknown statuses, malformed dates and invalid revision metadata before rendering.
- Only a verified server response may reveal pet demographics, appointment history, provenance-attested records and creator/last-editor draft rows. An empty server-authenticated page is **verified empty**; missing migrations, network errors, malformed data, wrong branch, not-found and denial are different states. A denied page clears the parent selected patient as well.
- The actual production ClinicalChartPort is **unconnected** and has **no saveDraft implementation**. The synthetic-only fixture injects a local HTTP port and an opt-in write simulator. There is no route from that injected fixture into the production App. No direct table DML, service_role, unscoped clinical_records fallback or clinical POST exists in the production component.
- The encounter editor separates memory-only unsaved edits from server-acknowledged drafts, displays immutable creator and most recent editor separately, guards appointment-level create when older draft pages remain, and uses exact revision + stable request UUID for unchanged retries. Conflict locks further edits until reload. A returned acknowledgement must match actor, patient, appointment, branch and expected revision. Only synthetic fixture can exercise Save; it cannot reach Supabase.
- Receptionist: appointments only; no records/drafts request and no clinical editor. Administrator: chart read only. Veterinarian: editor; **write unavailable in production**. All clinical sign-off, vaccination, treatment publication, prescription, dispensing, billing/payments, appointment transitions, receipts and messaging are absent/disabled.

## Behavior and gating matrix

| Journey / state | Current production preview behavior | Synthetic test coverage | Hosted gate |
| --- | --- | --- | --- |
| Branch queue and patient selection | Only RLS-authorized exact-branch rows, 250 cap / incomplete warning; no unscoped fallback | Existing clinical-workspace and staff-ops Chromium | Real confirmed/revoked multi-branch staff JWT |
| Patient demographics | Unavailable pending approved chart port; no guessed name | Scope/owner/pet validated and shown only on valid response | #16/#17 approved and applied, actual read_staff_patient_chart |
| Appointment pages | Preview still has verified selected-day queue; longitudinal RPC unavailable | 50/51 immutable cursor, duplicate/out-of-order rejection | Actual server pagination across concurrent inserts |
| Clinical history | Unavailable, **not empty** | 50/51, verified empty and malformed/foreign entries | Clinical provenance link + RLS, historical NULL rows remain invisible |
| Draft history | Unavailable | Creator != last editor, revision, immutable createdAt pagination | SQL #17 2-vet CAS and append-only audit |
| Local encounter edits | In-memory only; cleared on account/branch/patient/date change | 4 text fields, 4000-char controls, dirty tracking | Clinical policy and veterinary owner sign-off |
| Save and retry | **Disabled**; no production RPC | Synthetic-only acknowledged save, uncertain retry same UUID, changed text/new nonce unit, CAS conflict lock | SOL PR109 PASS + approved adapter and real persistence reload |
| Wrong owner/branch/pet, 401/403, revoked staff | No chart content | Synthetic deny/error/late response / patient switch | Real expired, revoked and cross-branch JWT denials |
| Pharmacy and billing context | Generic navigation only, no patient ID or side effects; own feature flags OFF | Existing parent pharmacy/billing/owner booking test suites | Independently approved inventory/finance readers |
| Responsive/accessibility | Semantic sections, labelled controls, focus-visible styles, no implicit save | Real local Chromium 360/768/1440 light/dark, select/keyboard, no overflow | Additional independent Qwen accessible browser acceptance |

## Executable synthetic UAT (never production)

Repository: web/ (Node >=22.12; Chromium executable available in CI).

- node --test tests/clinical-chart-model.test.mjs
- node --test tests/clinical-chart-integration.browser.test.mjs
- node --test tests/clinical-workspace.browser.test.mjs
- npm run typecheck
- npm run build
- npm test
- node --test tests/*.browser.test.mjs (includes existing integrated journeys)

**Only test fixture route:** /tests/fixtures/clinical-chart-fixture.html?case=ok (loaded by local Vite Chromium).
Additional **non-identifying** case selectors: pages, missing, not-found, network, wrong-owner, wrong-branch, wrong-patient, wrong-account, malformed, bad-date, bad-amount, empty, expired, revoked, late, write, conflict, uncertain. The synthetic case switches are never available on production /app/clinical.

Manual UAT: open owner /book with synthetic fixture (previous release regression), sign into synthetic confirmed staff, visit /app/ops branch queue, choose verified patient in /app/clinical, switch appointments -> clinical history -> encounter; inspect unavailable state on production, then use synthetic browser fixture for 50/51 and draft-revision behavior. Visit generic /app/pharmacy and /app/billing separately; verify no status, inventory or financial mutation. Switch patient, branch and account; old text must disappear immediately. Run 360/768/1440 light/dark, keyboard focus, receptionist role, malformed responses and revoked staff. **Hosted end-to-end remains NOT TESTED and requires owner consent.**

## Precise ASTRA / SOL / PM handoff

1. **SOL** independently audits exact PR109 head and the two original clinical P2s; no approval implied by this frontend work.
2. **ASTRA** after SOL PASS prepares a separately reviewed frontend/backend integration source tree. Import only **approved** web/src/lib/clinical-chart.ts into a minimal CLOUD-owned adapter; forward user, branch, pet, section, cursor and limit; retain caller-side ownerId check from the verified queue. For drafts, only vet passes expectedRevision, requestId and 4 bounded fields. An unauthenticated, expired or revoked account must fail immediately and clear chart. Never use listClinicClinicalRecords, generic clinical INSERT, owner-provided role metadata or legacy branch guessing.
3. **PM and human owner** authorize migrations #12–#17 in order only after signed/rehearsed provider Auth+Storage+Postgres recovery. Test real owner A/B, receptionist, one- and two-branch vets, global/branch revocation mid-session, 50/51/251, legacy NULL provenance, exact appointment idempotency and two-vet revision conflicts. No live SQL or clinical writes without specific consent.
4. **CLOUD** on a new approved integration assignment replaces the unconnected port and test-only synthetic write switch with a release-gated real API; must update copy from synthetic acknowledgement to real verified save only on actual RPC success. Add real hosted browser UAT then rerun all 223+ baseline Node tests, strict TS/Vite, Chromium and the reviewed full-tree source guard.
5. **Qwen** independently tests changed UI after this draft's exact-head CI; PM remains next owner for routing. Never self-merge or publish clinical advice.

Historical Chow Chow / appointment unchanged. No personal data, real credentials, PDF export, dispensing, notification, clinical publication, deployment authorization or spending.
