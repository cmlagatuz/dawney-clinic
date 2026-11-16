# Phase 4 — owner-operated staging Auth/JWT/RLS/Storage verification

**Status: READY TO EXECUTE only. NOT live-verified.** This is an **opt-in**, local Node 22+ HTTP verifier designed for an **independent, disposable Supabase staging project**. It is **not** a Supabase migration, registration tool, staff-role bootstrap, production deployment or backup utility. Do not run hosted tests until the owner and Supervisor separately authorize staging test operations. No credentials, JWTs, private data, staging URLs or fixture IDs belong in GitHub, Actions, PR comments, shared screens or CI artifacts.

## Evidence this does NOT replace

- `scripts/recovery/tests/synthetic-full-set-restore.sh` on PR #49 already passed a **signed/encrypted synthetic five-component restore** of application PostgreSQL 17, Auth identities, Storage metadata, private object bytes and provider-config manifest; corrupt/missing components fail before restore. The new verifier **does not modify or rerun** that drill and cannot certify provider backup/restore.
- PR #52 previously verified the **four** Phase 4 migrations on disposable PostgreSQL 17; its passing run does **not** prove hosted HTTP/JWT or Storage service permissions.
- PR #43 booking RPC is guarded by separately approved clinic services, species, hours and resource capacity. This staging harness does **not** create, approve or submit bookings. PR #59 read-only staff queue contract is not permission evidence without actual JWTs. This verifier tests RLS on the underlying persisted `staff_memberships`, patients, appointments and clinical records; no new staff UI or SQL grant is introduced.

## Owner-only staging prerequisites — required before any execution

1. **Owner approval:** Supervisor and owner explicitly approve testing a **separate staging project**, using no genuine patient, appointment, owner or clinical data. The project must have a **different project ref** from production `lgimhirgvresvbsdugac` and a fully isolated database/Auth/Storage. No mandatory paid plan. Confirm environment is staging before sharing credentials with any local process.
2. **Trusted operator:** An owner-authorized staging database/Auth/Storage administrator separately installs the intended **versioned and reviewed** Phase2/3 and (if approved) Phase4 migrations in order. Do not paste production backups or restore real data into staging. The verifier itself requires no privileged API key and **never creates users, owners, patients, appointments, staff memberships or objects**.
3. **Exactly two confirmed synthetic Auth accounts** A and B, created **outside this harness** in the staging project. Both must be non-anonymous, have verified emails and be unbanned. The operator privately records each account's email, password, `auth.users.id` (UUID), linked `public.owners.id` (UUID), and owned `public.pets.id` (UUID); each pet must be an artificial fixture with no real owner details.
4. **Synthetic appointments:** Stage one appointment per owner and privately record its UUID; preserve immutable expected owner/pet references. Stage one clinical record attached to A's pet, and record its UUID. Ensure appointment and clinical record are accessible only through RLS as intended. The test verifies A's record exists before asserting B cannot read it.
5. **Revoked staff identity:** Using **only an operator-authorized staging fixture operation**, create or deactivate a single `public.staff_memberships` row for **B** with an allowed role (`veterinarian`, `administrator` or `receptionist`) and `is_active=false`. Respect the last-active-administrator safeguard; never temporarily give this access to a real clinical user. The test requires B's **visible own membership row to exist and be false**, then denies B's read of A's patient, appointment and clinical record. An absent membership is not accepted as verified revocation.
6. **Private synthetic Storage:** Create staging bucket `clinical-attachments` with `public=false`, max file size **5,242,880 bytes**, MIME allowlist `application/pdf`, `image/png`, `image/jpeg`, and intended Storage RLS. Pre-upload **one tiny non-sensitive, immutable** synthetic file under each existing patient's `pets/<pet-id>/owners/<auth-user-id>/<random-uuid>.pdf` (or `.png/.jpg/.jpeg`), each through the respective approved authenticated path. Privately record the full object paths and SHA-256 digests of **original bytes**. Verify no Storage public-bucket access or dangerously broad grants. The harness checks both own-object reads and SHA-256 equality before negative probes, so missing objects cannot generate false PASS.
7. **Use a private owner-controlled computer/terminal**, not GitHub Actions, shared CI or the connected **production** Supabase project. Do not commit `.env`, use shell tracing (`set -x`), terminal screen sharing, CLI debug output, process-argument secrets or export reports with sensitive contents. Do not send any secret to an AI tool. Prefer a short-lived password manager/environment injector and keep values only in that machine's environment for the run.

## Required environment names (owner supplies values privately)

The verifier runs only with **all** required keys present. The project ref must be exactly the 20 lowercase-letter ref in the canonical `https://<ref>.supabase.co` URL. A `sb_publishable_...` client key is allowed; **`service_role` and other privileged API keys are not**. Do not reuse the production project ref or provide a custom proxy host.

| Environment variables | Value / purpose |
| --- | --- |
| `DAWNEY_STAGING_URL`, `DAWNEY_STAGING_PROJECT_REF` | Staging HTTPS origin and its exact matching ref; different from production |
| `DAWNEY_STAGING_PUBLISHABLE_KEY` | Staging publishable **public** key only |
| `DAWNEY_STAGING_TEST_A_EMAIL`, `DAWNEY_STAGING_TEST_A_PASSWORD` | Confirmed synthetic owner A login |
| `DAWNEY_STAGING_TEST_A_USER_ID`, `DAWNEY_STAGING_TEST_A_OWNER_ID`, `DAWNEY_STAGING_TEST_A_PET_ID` | UUIDs of pre-existing A fixtures |
| `DAWNEY_STAGING_TEST_A_APPOINTMENT_ID`, `DAWNEY_STAGING_TEST_A_CLINICAL_RECORD_ID` | Synthetic appointment + clinician record UUIDs |
| `DAWNEY_STAGING_TEST_A_OBJECT_PATH`, `DAWNEY_STAGING_TEST_A_OBJECT_SHA256` | Already-uploaded private object path and expected digest |
| `DAWNEY_STAGING_TEST_B_EMAIL`, `DAWNEY_STAGING_TEST_B_PASSWORD` | Confirmed synthetic owner B login and **revoked staff** identity |
| `DAWNEY_STAGING_TEST_B_USER_ID`, `DAWNEY_STAGING_TEST_B_OWNER_ID`, `DAWNEY_STAGING_TEST_B_PET_ID` | B account/owner/pet UUIDs |
| `DAWNEY_STAGING_TEST_B_APPOINTMENT_ID` | B's existing synthetic appointment UUID |
| `DAWNEY_STAGING_TEST_B_OBJECT_PATH`, `DAWNEY_STAGING_TEST_B_OBJECT_SHA256` | B's already-uploaded private object + expected digest |
| `DAWNEY_STAGING_RUN=I_APPROVE_STAGING_HTTP_TESTS` | Explicit local hosted-test approval; omit by default |
| `DAWNEY_STAGING_FIXTURE_ACK=TWO_VERIFIED_SYNTHETIC_OWNERS_ONLY` | Explicit no-real-data acknowledgement |
| `DAWNEY_PRODUCTION_PROJECT_REF` | Optional **additional** production project ref to block |
| `DAWNEY_STAGING_DENIED_UPLOADS=I_APPROVE_DENIAL_WRITE_PROBES` | **Separate optional** opt-in for four denied upload probes; omit for read-only mode |

Do not put these values in the checked-in workflow or repository. In a private local shell already holding the approved environment variables, execute:

```bash
node --version                        # Node 22+
node --test scripts/staging/tests/*.test.mjs  # Offline/mock-only, no credentials needed
node scripts/staging/verify-staging.mjs       # Actual hosted test, only AFTER owner signoff
```

**Safety behavior:** The program refuses to run in `CI`, `GITHUB_ACTIONS`, or `TF_BUILD`, rejects missing consent/fixtures, wrong or production origins, mismatched account IDs, invalid object paths/digests, service keys, ambiguous API results and unapproved upload-probe values. Requests never follow HTTP redirects; JWTs/passwords are memory-only. It deliberately prints only a sanitized PASS/FAIL message, **never** HTTP responses, email, identities, files, project URL, body content, header values or tokens. Diagnostic details remain a private operator task; never paste secrets into issues.

## Actual validation matrix

- Auth password login for A and B via `/auth/v1/token`, then independent `/auth/v1/user` introspection: distinct known IDs, matching email, verified, non-anonymous and unbanned.
- Positive owner/pet/appointment SELECT for both; positive A clinical-record SELECT; exactly one B revoked membership row with `is_active=false`. **No inserts or updates** in database.
- Denied A→B and B→A owner/patient/appointment SELECT, denied B→A clinical-record SELECT after verifying A's record exists; anonymous/invalid-JWT patient/appointment/owner queries fail or return no rows.
- Private object download bytes SHA-256 for A and B, own prefix list positive, cross-owner (including revoked B), anonymous and invalid-JWT file reads denied; foreign and anonymous object prefix listings must return **zero** entries or permission denial.
- Fresh Auth session after the first read; original appointment owner/pet/status snapshot must remain stable. This checks read persistence, **not persistence of new writes**.
- **Optional WRITE-DENIAL probes**, separately authorized: attempt four tiny, random-name, no-PHI PDF uploads under forbidden paths (revoked B→A, A→B, owner→clinic, anonymous→owner). These **should** return HTTP 401/403/404. If the policy is broken they **might actually create files**. The verifier fails closed and operator must immediately inspect and remove any unexpected disposable objects through a trusted audited staging cleanup. Never enable against production or when cleanup approval is missing.

A `PASS` proves only these pre-provisioned staging HTTP checks; it **does not prove** two-account login on real clinic data, live production Auth or storage, verified backup restoration, a true server-side revocation of already-issued JWTs, frontend UI integration or public service appointment approval. An Auth user who retains a valid token after revocation can still be logged in; the staff role **must** be checked against RLS/current `staff_memberships` (not stale JWT user metadata). Preserve the existing five-component synthetic recovery rehearsal separately.

## CI and rollback

`.github/workflows/phase4-staging-harness-offline.yml` runs only parser + Node fake-HTTP/guard tests; **it cannot connect to hosted Supabase** and is deliberately not manually dispatchable. On failure in staging: stop, preserve private operator-only notes/aggregate checks, review RLS/policy/role differences, clean up any synthetic objects by trusted staging-only controls and rerun only after a reviewed fix. Do not edit production SQL, delete live data or force a migration history repair. Owner signs off any future production test in a **separate** directive.
