# Dawney Animal Clinic — Owner, Patient, Private Storage & Booking UAT
CLOUD · 21 November 2026 · Draft PR116 · Source + localhost synthetic evidence only

## Source and release boundary
Frozen parent: PR114 at 081047d5652615df7936f4158772fa648b835af4.
Child branch: ai/cloud/owner-patient-release-hardening-20261121.
No backend libraries, migrations, RLS, SQL, source-integrity CI guards, original Qwen fixtures, clinical, Operations, pharmacy, billing, production env or feature flags are modified. The production catalog patient-form flag remains OFF. Fake files and responses are generated in disposable localhost Chromium only; none are uploaded to a real provider.

## Source-confirmed pre-fix defects

| Defect | Pre-fix risk | Changed frontend component and correct outcome |
| --- | --- | --- |
| Owner switch during eligibility lookup | Patient list stayed in React state until effect cleanup; a reused serviceId could inherit another account's species permission | usePatientEligibility and useServiceSpecies now derive loading from account identity and request revision synchronously; prior account pets never render as current |
| Failed owner-profile read | Null profile and editable new-owner form could be shown even though backend lookup failed | ProfilePage now remounts by account, refuses edit/create until a successful owner read, and offers explicit retry |
| Default patient form state | Previous owner’s patients or form could persist through account switch, and save-state cancellation/reentry was not completely locked | PetsPage now remounts by account, distinguishes denied read from true empty and blocks conflicting actions |
| Patient insert succeeds, subsequent list refresh fails | User saw a generic “could not save” and might create a duplicate patient | Both default and catalog patient forms retain authoritative returned patient ID before refresh, and warn “saved, list could not be verified” instead of repeating a new INSERT |
| Failed owner appointment refresh | Previous history could stay visible after a denied or failed current read | AppointmentsPage clears the old history when refresh starts; failures never imply zero appointments; cancellation success requires returned matching ID and cancelled status |
| Private metadata finalization and retry | Concurrent retry before React busy paint could create another Storage key; a stale metadata list could clear saved pending UI | Catalog upload is synchronously single-flight, retains object key after unindexed finalization, verifies exact persisted metadata ID before clearing pending files, and distinguishes local selection from metadata saved |

These are source-derived UI issues, not claims of observed live patient exposure.

## Owner A / Owner B verification and safe return
- [ ] Browse anonymous Home, Services, Location and Book. Naga shows information only until approved schedule, resources and published services exist. Cavite remains contact-only until separately approved.
- [ ] Confirm signup, OTP/link verification, expired confirmation, sign-in, forgotten password, recovery, invalid password and unverified-account paths. A return link may carry only the constant /book hint, never patient, contact, clinical text, object path or session token. A returned service/time must be rechecked against CURRENT approved schedule.
- [ ] Create or edit a verified owner profile. Simulate a denied or disconnected owner read: show error and retry, not “Setup required” and not a second owner creation.
- [ ] Customer A creates/edits a pet. Switch to Customer B while reads are delayed, in another browser tab and after refresh. B must see only B pets, history and private documents; stale A forms, preview images, fetch responses and errors must disappear. Repeat B-to-A. All hosted cross-owner checks require RLS validation with real separate synthetic Auth accounts.
- [ ] Keep original Dog/Chow Chow patient and appointment unchanged. Validate species selection then dependent breed; Mixed, Unknown and NA separate and available when catalog says so, breed reset on species switch, disabled pending breed read, clinic-supported versus registered-only animals, bad or revoked taxonomy. Current patient-form feature flag is OFF, so catalog use is staging-only pending human approval.
- [ ] Exercise Save, Cancel, duplicate Save, POST succeeds/read fails, account switch mid-save, denied read, and retry without creating another patient. True empty is only after authorized success.

## Three private attachment categories

| Slot | Allowed | Never allowed | Status evidence |
| --- | --- | --- | --- |
| Profile photo | PNG/JPEG, magic signature and <=5 MiB | PDF, SVG, HTML, wrong signature, fake/oversize/empty | Local file pending -> private object uploaded -> metadata server-acknowledged -> refreshed exact metadata found |
| Health card | PDF/PNG/JPEG <=5 MiB | Foreign patient object path, arbitrary MIME, unsupported filename | If uploaded but metadata INSERT fails, keep original object key and offer metadata-only retry, without Storage upload |
| Vaccination card | PDF/PNG/JPEG <=5 MiB | Unsigned public URL or unauthenticated read | Only current authorized metadata permits private download; never use unsaved file as download source |

- [ ] With a network outage **before** Storage success, normal retry may upload a fresh immutable object. With Storage success but metadata failure, retry must only finalize the existing key. Verify three uploads and three metadata rows after one metadata-only retry; no fourth Storage object.
- [ ] With a metadata INSERT that commits but its response is lost, backend must supply idempotency / unique-object conflict resolution. Current browser-only retry cannot establish whether metadata already committed; do not claim this hosted gate passes.
- [ ] Verify account/patient switching during in-flight upload/download, malformed path, stale metadata list, private object 404, Storage 403, expired Auth, failed browser download, local File invalid signature, and mismatch between returned metadata and selected patient. A denied read must not be represented as “No document saved yet.”
- [ ] Never expose identifying patient details, Storage keys, tokens, or real file bytes in screenshots, query strings, public logs, third-party telemetry, CDN URLs or reports.

## Requested booking owner contract
- [ ] The Naga branch must be verified, published policy owner-approved, resource active/capacity-one, service published, and eligible species offered by THIS service. Cavite remains contact-only until approved; no fabricated hours or prices.
- [ ] Only a verified account with existing owner profile and registered, authorized pet can submit a request. Missing/revoked policy or schema means unavailable; no legacy write fallback.
- [ ] Validate Manila timezone, 15-minute server-defined midnight grid, lead/horizon inclusive UTC boundaries, slot duration fitting an approved interval, holiday exclusions, impossible DST wall times and server revalidation after Auth return.
- [ ] Simulate a lost request response: replay identical request nonce/payload; changing pet/time/concern creates a new attempt. Two clients requesting one capacity-one resource need the backend exclusivity/nonce contract. No UI may invent a confirmed appointment.
- [ ] Read owner appointment list only from an authorized server response after booking/refresh, not an optimistic client record. On errors, clear stale rows and show explicit retry; a cancellation notice needs a matching authoritative cancelled row. Owner B cannot see Owner A's appointment.

## Accessibility and six visual cells

| Viewport | Light mode | Dark mode | Manual screen reader / two-tab |
| --- | --- | --- | --- |
| 360 px | Local real Chromium routed owner screens | Local real Chromium routed owner screens | NOT EXECUTED |
| 768 px | Local real Chromium owner plus 3-file catalog fixture | Local real Chromium routed owner screens | NOT EXECUTED |
| 1440 px | Local real Chromium routed owner screens | Local real Chromium routed owner screens | NOT EXECUTED |

- [ ] Check semantic page heading, fieldset/legend, labels and accessible name, keyboard Tab/Enter/Escape, visible focus, announced role=status/role=alert, dark contrast and no horizontal scroll. DOM/ARIA assertions do not replace NVDA/VoiceOver testing.
- [ ] Owner return after two browser tabs, real concurrent backend mutations and clinical authorization require separately authorized hosted staging; single-page CDP tests are not multi-tab tests.

## Reproduce local tests at exact new head
Run from the web directory:
1. npm ci --ignore-scripts --no-audit --no-fund
2. CHROMIUM_BIN=/usr/bin/chromium node --test tests/owner-patient-hardening.browser.test.mjs
3. CHROMIUM_BIN=/usr/bin/chromium npm test
4. npm run build (strict tsc --noEmit + Vite build)
5. node --test tests/owner-patient-hardening.test.mjs tests/attachment-load.test.mjs tests/patient-form-logic.test.mjs tests/booking-contract.test.mjs

The inherited exact-source full-tree CI guards are frozen to previously reviewed AppointmentsPage and other blobs. A changed approved-frontend child WILL trip that guard until ASTRA separately builds and reviews a new CI-only exact-source pin from this accepted SHA; CLOUD MUST NOT alter or bypass the guard. Report those jobs BLOCKED/FAIL, not PASS. Independent native web CI TypeScript, Vite, Node and actual Chromium must be independently verified.

## Hosted integration requirements / NO-GO
- ASTRA: actual approved owner and two-account Auth/JWT/RLS, taxonomy and private bucket migrations, secure object path and metadata idempotency, revocation during upload, persisted appointment retry/idempotency and conflict, private signed download policy, staff/clinic availability.
- SOL: independent exact-source security audit of owner authorization and private Storage; unresolved recovery/ACL/fixture safety dependencies must be accepted. All provider Auth/Storage/Postgres backup restore remain gated.
- Qwen: independent functional exact-head review with mobile/dark, screen-reader and two-tab scenarios. Clearly label mocked/CI observed versus personally executed.
- Manus and PM: hosted release evidence after explicit human approval; only the Project Owner approves live SQL, real messages, identifiable exports, clinic publication, spending and production deployment.

**Release decision: SOURCE CANDIDATE ONLY. NO clinic-live claim, real uploads or release actions. Single next owner: PM for independent Qwen verification and ASTRA/SOL backend/CI acceptance. Signed CLOUD.**
