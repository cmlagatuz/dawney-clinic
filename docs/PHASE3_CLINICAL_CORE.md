# Phase 3 — real pet and booking workflow foundation

**2026-11-13 · ChatGPT-owned.** This work builds on merged Phase 3 `web/` app, leaves legacy Laravel and Claude PR #1 untouched, and does not create clinical demo records.

## Features

- **Patients:** RLS-scoped list, add and edit backed by `public.pets`; no client-side owner transfer, no unsupported delete. Empty/loading/error/saving states and mobile-friendly forms. Only the patient's actual owner or authorized clinic staff may access it, as enforced by the existing database policies.
- **Appointments:** Only already-owned pets can be selected, live active `appointment_resources` list, new requested appointments with a fixed 30-minute duration, date/time stored in UTC, persisted owner-specific booking history and cancellation for requested/confirmed bookings. Postgres `appointments_no_active_overlap` exclusion constraint prevents race-condition double booking; the UI handles SQLSTATE `23P01` with a retry message.
- **Scheduling safeguards:** Additive migration `20261113095318_phase3_appointment_lifecycle.sql` prevents ordinary authenticated clients booking in the past and rejects invalid status transitions at the database layer. Staff booking lifecycle matrix: requested → confirmed/cancelled/no_show; confirmed → checked_in/cancelled/no_show; checked_in → completed; terminal statuses cannot reopen. This guard supplements existing RLS, column grants, FK and exclusion rules; it does not backfill or modify existing appointments.
- **Limitations:** The exact clinic timezone, opening hours, appointment types, resource capacity and holidays have **not yet been approved**. The UI displays scheduling times in the *user's device time zone* and expressly labels reservations as requests pending clinic confirmation. Do not open to real patients before those operational settings are confirmed and tested.

## Verification evidence

- `web/tests/clinical.test.mjs`: patient validation and owner ID forgery stripping, time normalization, 30-minute appointments and status/ownership-injection rejection. Offline Node tests are not actual database access proof.
- `supabase/tests/phase3_appointment_lifecycle.sql`: transaction-only synthetic SQL checks for past-booking denial, illegal direct completion and terminal reopening denial, and allowed requested→confirmed→checked_in→completed transitions. Test fixtures are rolled back.
- Existing `supabase/tests/phase2_rls_regression.sql` was rerun successfully after lifecycle migration, confirming existing two-account simulated RLS isolation, conflict rejection, cancellation and event audit still work. These SQL tests simulate authenticated database roles, not real GoTrue JWT HTTP sessions.
- Supabase migration ledger shows `20261113095318` applied alongside earlier three migrations; after tests no clinical pet/appointment rows were persisted. Supabase security advisor still reports an intentional private mapping INFO and Auth leaked-password-protection WARN (dashboard feature requires a free-tier availability check).
- GitHub Phase 3 web workflow must pass `npm ci`, Node tests, TypeScript checks and Vite build on the PR before merge.

## Pending release gates

1. Owner launches `Clinic Auth contract` **operation=test** after confirming both test Auth accounts; observe successful real two-session HTTP RLS and persistence. Registration already succeeded and must not be repeated.
2. Owner confirms clinic time zone and working hours/holidays, workflow duration and actual appointment resource capacity; then add DB-enforced operational validation and corresponding tests.
3. Verify pet and appointment cross-account denial with **real** Supabase Auth tokens in a controlled browser/HTTP test and remove all temporary test data afterward. Do not create real clinical patient data during testing.
4. Staff management service, medical notes, private file storage policies, GDPR/local privacy considerations, encrypted backup and isolated restore proof, legacy migration rehearsal, Cloudflare Pages Free and live smoke testing remain outstanding.