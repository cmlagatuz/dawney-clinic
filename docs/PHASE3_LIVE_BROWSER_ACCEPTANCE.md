# Phase 3 — Owner-gated live browser, staff, scheduling and recovery acceptance

**Checkpoint:** 2026-11-13 (Asia/Riyadh). **Preview/testing only; never enter real clinic records.**
This is an executable acceptance checklist, **not evidence that a browser, hosted application or real clinical Storage recovery has passed**. See [supervisor plan](PHASE3_SUPERVISOR_PLAN.md), [HTTP smoke](PHASE3_HTTP_STORAGE_SMOKE.md), and [Pages release](PHASE3_DEPLOY_RELEASE.md).

## Evidence already verified

- [Clinic Auth contract #43438147911](https://github.com/cmlagatuz/dawney-clinic/actions/runs/43438147911) and [#43438358753](https://github.com/cmlagatuz/dawney-clinic/actions/runs/43438358753): `master`, `operation=test`, both successful. Each authenticated HTTP job logged 1/1 passing real HTTPS test, with distinct confirmed disposable A/B identities, two persisted owner profiles, owner SELECT isolation, denied direct staff self-escalation, logout and re-login persistence. This workflow **does create owner profiles**; it did not create pets or appointments.
- Connected Supabase read-only checkpoint immediately after the runs: project healthy; six applied migrations; two confirmed accounts and two owner profiles; seven public RLS tables; one active appointment resource; zero pets, appointments, staff memberships and private objects; bucket `clinical-attachments` private with exact 5 MiB limit. These are point-in-time counts, not future guarantees.
- The separate `Phase 3 authenticated security smoke` **read-only** run is still unverified. There is no verified Cloudflare Pages URL, real-browser run, clinical/Storage negative HTTP test or complete live recovery drill.

## Gate 1 — Owner dispatches READ-ONLY Auth/RLS smoke (safe for existing application rows)

1. Open [Phase 3 authenticated security smoke](https://github.com/cmlagatuz/dawney-clinic/actions/workflows/phase3-security-smoke.yml) → **Run workflow**.
2. Choose **branch `master`**, `operation=read-only`, and leave `allow_synthetic_writes=false`.
3. Confirm the `authenticated-smoke` job passes and emits all three sanitized PASS checkpoints: distinct HTTPS Auth sessions, owner RLS isolation/session rehydration, and anonymous-owner privacy.
4. Record the exact run ID, `master` SHA, timestamp and result in the shared handoff. If it fails, **stop**; inspect sanitized job logs. Do not re-register test accounts, alter RLS to avoid a denial, or run `clinical`/`storage` as a retry.

**Scope:** This workflow authenticates disposable users and reads rows; it makes **no patient, appointment or Storage writes**. Auth sign-in may update Supabase-managed session/sign-in metadata. SDK adapter rehydration is not a real browser reload.

## Gate 2 — Cloudflare Pages Free preview and static checks

Owner connects the existing Git repository via [Cloudflare Pages Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/) using: production branch `master`; **root `web`**; Vite/React; Node 22; build `npm run build`; output `dist`. Only public `VITE_SUPABASE_URL=https://lgimhirgvresvbsdugac.supabase.co` and `VITE_SUPABASE_PUBLISHABLE_KEY` (an actual `sb_publishable_...` value copied privately by the owner) belong in browser build variables. Never add service-role keys, passwords or real documents.

After an **actual** `https://<project>.pages.dev` origin is known, set exact Supabase Auth Site URL and callback/recovery redirect allowlist entries; do not add broad wildcard redirect origins. Run the existing optional GitHub Actions **Phase 3 static release preparation** workflow with the exact Pages origin. Its public HTTPS probe now checks **all ten explicit SPA entry paths** including sign-up, verification, forgot-password and appointments; it does not authenticate or render a browser. Check CSP and `nosniff` on each response. No Github tag is necessary; the workflow only uploads an ephemeral build artifact when manually dispatched.

## Gate 3 — Real-browser PRE-WRITE acceptance (only the existing disposable accounts)

Use two isolated Chromium profiles/incognito contexts, desktop and narrow mobile viewport, keyboard-only navigation, and light/dark and reduced-motion preferences. Record observations and screenshots **without bearer tokens, email addresses, medical data or browser localStorage**.

| Check | Expected result | Evidence |
| --- | --- | --- |
| Anonymous route deep links | Hard refresh `/auth/signin`, `/auth/signup`, `/auth/verify`, `/auth/forgot`, `/auth/callback`, `/auth/recovery` returns app shell; no server 404 | Preview URL, commit and browser result |
| Protected route guard | Anonymous hard refresh `/app/profile`, `/app/pets`, `/app/appointments` requires login | Browser observation |
| Authentication | A and B independently log in from separate contexts; wrong password never signs in | Sanitized observation |
| Existing profile persistence | A's pre-existing synthetic profile loads after actual full browser refresh and after signed-out/new sign-in; B sees only B's profile | Sanitized observation; no screenshots of personal fields |
| Logout and context isolation | A logout removes UI access; A and B contexts remain isolated; browser back/refresh does not reveal private data | Sanitized observation |
| Accessibility | Tab navigation and visible focus on interactive elements; labels/errors announced; no horizontal scroll at 360px; reduced motion honored | Browser/manual checks |
| Developer tools | No `sb_secret_`, service-role credentials, real patient data, passwords or token logs in network console or built files | Findings-only record |

**Limitations:** The two-account HTTP tests already prove owner-row isolation at API level. These checks are still needed for the deployed browser lifecycle and UX; they do not test pet/booking persistence until authorized Gate 4.

## Gate 4 — Clinical and private Storage (BLOCKED until owner explicitly approves synthetic writes)

After Gates 1–3 pass, owner may individually approve `operation=clinical` then `operation=storage` and tick `allow_synthetic_writes=true` in the manual security smoke action. **Do not dispatch either mode without a fresh explicit owner instruction.** The tests write synthetic pets, bookings and potentially PDF files, leave artifacts by design, and require the exact run-ID-marker cleanup procedure in [the HTTP smoke runbook](PHASE3_HTTP_STORAGE_SMOKE.md). Preserve denial assertions (foreign owner/pet, clinical note, overlapping slot, private Storage B/anon access), cancellations and post-refresh persisted history. A failed access-denial assertion is a hard release stop; no weakening of RLS. Do not create synthetic clinic data from this runbook alone.

## Gate 5 — Staff authorization and revocation (BLOCKED for real staff)

- Existing database-only controls: verified Auth identities for staff grants; trusted operator `bootstrap_first_administrator` / `grant_verified_staff`; deny client self-escalation; audited role changes; prevent revocation or deletion of last active admin.
- Before any staff onboarding, approve a named privileged operator, verify identity out of band, require admin MFA, define job-based least privilege and a second-person review for privileged role grants. Store the operator approval in owner-controlled records; do not publish staff credentials.
- Review revocation semantics: removing a staff row does not necessarily immediately invalidate already-issued JWTs; exercise new requests using old/refresh tokens and verify RLS denies sensitive operations after revocation. Current audit ledger records SQL activity but may not identify the real human approving it; a trusted admin service with explicit actor/reason/step-up is still needed.
- Protect break-glass procedure, dual approval and recovery identities; never expose privileged helpers through the browser, and never enable a demo account with admin rights.

## Gate 6 — Scheduling policy signoff (BLOCKED for actual clinic hours)

Owner must specify the **actual clinic time zone**, weekly openings and closures, holidays, visit type/duration, lead time, practitioner/resource identities and maximum concurrent appointments. Do not infer the clinic location from the developer's location, or use the temporary 30-minute UI booking duration/75-day test slot as real policy.

Once approved, define and test: local-time to UTC conversion including DST if applicable; opening/closing-boundary requests; simultaneous A/B booking of one capacity-one resource (PostgreSQL exclusion SQLSTATE `23P01`); cancellation and freed-slot reuse; staff confirmation/check-in/completion transitions; closing exceptions; resource holidays and practitioner availability; authorized reschedules. Record which rules are DB-enforced vs advisory client UI. Current overlap constraint/lifecycle tests do **not** enforce unprovided working hours.

## Gate 7 — Full disaster-recovery acceptance (BLOCKED; synthetic PostgreSQL restore alone insufficient)

The existing PostgreSQL 17/GPG CI verified a real **synthetic** encrypted app-only backup, tamper rejection and isolated restore. Do **not** claim full clinic recovery based on that drill.

Before go-live, owner must authorize a segregated Supabase-compatible recovery environment and private encrypted backup process for: (1) application schemas and migrations/RLS/triggers, (2) `auth.users` identities and safe sign-in recovery, (3) private Storage **object bytes and metadata**, (4) provider-specific Auth/site URLs, MFA, SMTP and file policy configuration, (5) historical Laravel/MySQL extraction and legacy ID mapping, and (6) offline encryption keys and audit evidence. A database SQL dump alone cannot reconstruct Storage binaries or hosted Auth configuration.

Rehearse **isolated** restoration in dependency order (Auth identities → schema/FKs/RLS → app rows → Storage object bytes/metadata → safe Auth redirect/config), compare counts, object sizes/hashes and ownership links, and run fresh A/B JWT denial tests on the destination. Do not transplant production login/session secrets to untrusted environments or restore over the live project. Record measured time, data-loss window, audit, key custody, rollback and owner approval. No RPO/RTO or production readiness claim until real evidence exists.

## Release gate summary

| Gate | Current status |
| --- | --- |
| Real A/B Auth + owner HTTP RLS and persisted owner profile | **PASSED** (two owner-dispatched actions) |
| Additional read-only Auth/security smoke | **PENDING OWNER DISPATCH** |
| Cloudflare preview and real Chromium browser | **PENDING** |
| Pet/appointment real JWT writes/denials | **PENDING OWNER APPROVAL** |
| Private Storage authenticated A/B and anonymous deny tests | **PENDING OWNER APPROVAL** |
| Real staff authorization and approved operating hours | **PENDING** |
| Full actual Supabase/Auth/Storage + legacy migration restore | **PENDING** |
| Clinical go-live | **BLOCKED** |
