# Phase 3 — Real authenticated HTTP, patient, appointment and Storage smoke

**Status:** Source and safety tests prepared; **real hosted clinical/Storage workflow has not run**. No real patient data is authorized. Tests use two existing, confirmed disposable Supabase accounts. The project is NOT production approved.

## Two distinct verification paths

**A. Existing baseline Auth contract** (must be run first):

[Actions → Clinic Auth contract](https://github.com/cmlagatuz/dawney-clinic/actions/workflows/clinic-auth.yml), select branch `master`, operation **`test`**. It signs in two existing test users, writes at most their synthetic **owner profiles**, verifies owner-to-owner reads and admin escalation denies, signs out and logs back in. **DO NOT run registration again.** **Verified live PASS:** `operation=test` on `master` succeeded in [run 43438147911](https://github.com/cmlagatuz/dawney-clinic/actions/runs/43438147911) and [run 43438358753](https://github.com/cmlagatuz/dawney-clinic/actions/runs/43438358753), 1/1 authenticated HTTPS test each. This created two persisted synthetic owner profiles. **Do not repeat registration or baseline test unnecessarily.** Next run the separate `read-only` security smoke; no synthetic clinical/Storage writes are authorized.

**B. Additional manual Security Smoke workflow**:

[Actions → Phase 3 authenticated security smoke](https://github.com/cmlagatuz/dawney-clinic/actions/workflows/phase3-security-smoke.yml)

| Operation | Persists data? | Prerequisites | Verifies |
| --- | --- | --- | --- |
| `read-only` | **No** | A & B verified; baseline Auth contract `test` passed and profiles exist | Real GoTrue JWT/login, `getUser()`, cross-owner SELECT denies, session rehydration through SDK storage adapter, anon owner read deny |
| `clinical` | **YES, synthetic only** | Owner selects `allow_synthetic_writes=true`; two synthetic profiles; no real clinic data | Pet creation, cross-owner pet read/update denial, forged owner/pet relationship denial, appointment insert/history/foreign booking deny, DB GiST overlap conflict, cancellation/slot reuse, clinical-record write denial |
| `storage` | **YES, synthetic pets, appointments and PDFs** | Owner explicitly opts in and creates **private** `clinical-attachments` bucket with max 5MB, PDF/PNG/JPEG MIME allowlist | All `clinical` checks plus private PDF upload/download for A and B, A/B foreign download denial, anonymous denial, owner clinic-path upload denial |

**The dangerous modes are never triggered by pushes or PRs.** The workflow exists solely as `workflow_dispatch`, requires `master`, has no privileged secret, prevents parallel smoke jobs, and demands affirmative synthetic-write consent before any network request. `read-only` does not create owners; if profiles are absent, run the original baseline Auth test first.

### How synthetic tests work

- Uses public Supabase publishable key and the six existing private GitHub Actions Secrets. Uses the official, pinned `@supabase/supabase-js` package already in `web/package-lock.json`. Does not print email addresses, bearer tokens or credentials.
- Fixture names have exact prefix `DAWNEY_SMOKE_<github-run-id>_A` / `_B`, species `Synthetic test`, and appointments have concern `Synthetic integration smoke` / details `DAWNEY_SMOKE_<github-run-id>`. Future test slot is 75 days ahead and 30 minutes in duration, **not** a clinic-approved business-hours rule.
- `storage` creates small **synthetic PDFs only**, under `pets/<pet-uuid>/owners/<auth-uuid>/<random-uuid>.pdf`. It deliberately verifies that the anonymous API and other signed-in user cannot download. It does not read, copy, or export real medical records.
- Synthetic patients and their cancelled bookings, history events, and file objects **persist after the test**, because normal API clients must not have DELETE rights on medical/clinic data. An operator must carry out controlled cleanup; do not leave them in a future live clinic dataset.
- SDK-memory storage restoration is verified by initializing another Supabase client using the same controlled storage adapter. This is **not** a real Chromium/browser reload; a deployed browser session reload remains a separate release gate.
- A pass shows RLS for actual test accounts and actual synthetic records at the time of execution; it does not prove all roles/medical flows or production suitability.

## Controlled cleanup (operator only, never automatic in CI)

**1. Before cleanup**, record the run ID and its exact `DAWNEY_SMOKE_<run-id>` marker from Actions job logs, inspect the `public.pets`, `public.appointments`, `public.appointment_events`, and Storage objects that match; verify the objects are synthetic and belong only to the two disposable test identities. Never delete a row solely because its name happens to contain `test`.

**2. Storage files:** using [Supabase Storage Dashboard](https://supabase.com/dashboard/project/lgimhirgvresvbsdugac/storage/buckets), for the **two specific test patient UUID paths**, delete only the synthetic PDFs created by the corresponding run through the Storage API/Dashboard (not direct SQL on `storage.objects`). Verify that no real document exists under these paths.

**3. For application rows:** review `scripts/recovery/phase3-smoke-cleanup.sql` in the repository. Replace the single `DAWNEY_SMOKE_REPLACE_WITH_RUN_ID` placeholder with the exact fixture marker. The SQL runs a preview transaction with **ROLLBACK by default**, bounds the affected synthetic rows to at most two pets/two bookings and checks that no clinical note references them. Only once the counts, marker, owner identities and related Storage paths have been approved should a privileged operator change the last statement from `ROLLBACK` to `COMMIT`. Perform a verified app-data backup beforehand once genuine records exist. This runbook does not touch `auth.users`, `owners`, staff grants, real clinical records or bucket settings.

**4.** Verify the specific fixture rows are gone; archive only sanitized test evidence (not JWTs, private documents, email addresses or passwords). Keep test accounts until further explicit owner-approved cleanup.

## Security caveats

- No service role, secret Supabase key, DB password or SMTP secret is required by CI. The Github test accounts stay in repository Secrets.
- If a negative security assertion **fails** (for example, account B reads account A's patient, or an unauthenticated download unexpectedly succeeds), **stop immediately**, do not onboard clinic data, examine persisted synthetic fixtures through trusted console, and fix policies in reviewed migrations. Never weaken RLS to make tests pass.
- If the Storage bucket is absent or public, do not run the `storage` operation. Supabase Storage policies alone cannot make a public bucket confidential.
- A failed staged test may leave partial synthetic fixtures; inspect via run marker. Do not run duplicate tests repeatedly to \"fix\" an authorization failure.
- User-entered HTML, attachments and clinical notes require an additional XSS/content-safety review before real-world deployment. File MIME/extension restrictions are not antivirus.
- Auth passwords may satisfy the currently requested 8-character min with letters/digits, but a unique generated 12+ character password is still recommended. The Free plan's leaked-password warning remains a known residual risk.
