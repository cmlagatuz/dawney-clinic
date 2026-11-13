# Phase 3 — Staff authorization lifecycle and audit hardening

**Date:** 2026-11-13 · ChatGPT-owned · Backend safety milestone, **not** a staff administration application.

## Database change and preservation

Additive applied migration `20261113101626_phase3_staff_membership_audit.sql` adds:

- Private `clinic_private.staff_role_events` append-only-from-application audit ledger with unique event IDs and event types: `grant`, `role_change`, `activation`, `revocation`, `assignment_refresh`, `delete`.
- A **SECURITY INVOKER** BEFORE trigger on `public.staff_memberships`: active roles require a verified, non-anonymous, non-deleted/non-banned Supabase Auth identity, even if trusted SQL bypasses the normal invitation helper.
- A transaction-level advisory lock shared with initial administrator bootstrap. Prevents concurrent changes that would leave **no active administrator** once the first admin exists. Attempts to disable, demote or delete the last active admin are rejected.
- A private **SECURITY INVOKER** AFTER trigger records staff membership changes with previous/new role and active state, authorized-by UUID, request actor UUID (if any), database role, and timestamp.
- Both private trigger functions and their storage table remain unreachable to `anon` and `authenticated` clients. `staff_role_events` has RLS enabled **with no public policies** by deliberate design. No service-role or database secrets added.

No existing staff records are modified. The prior 5 migrations remain unchanged. This is a single-clinic role ledger, not a credential store.

## Verified tests

- `supabase/tests/phase3_staff_role_audit.sql` executed against the connected Supabase project using **BEGIN ... ROLLBACK**: three verified synthetic role grants, veterinarian revocation, private audit event counts, rejection of direct unverified staff insert, rejection of last-admin revocation, authenticated SQL role denied private ledger reads.
- Re-ran existing rollback-only `phase2_rls_regression.sql`, `phase2_staff_roles_regression.sql`, `phase2_verified_auth_bootstrap.sql`, and `phase3_appointment_lifecycle.sql` successfully after the migration.
- At the checkpoint, two real Auth test accounts exist, but **zero clinic staff memberships and zero persisted staff events**. No first administrator was assigned to any real account.
- Security advisor: two **INFO** findings for deliberately policy-less, RLS-locked private tables (`legacy_user_links`, `staff_role_events`) and one **WARN** for leaked password protection (Pro-only on Supabase; do **not** upgrade).

## Operator-only assignment (NOT a browser endpoint)

Once an owner-controlled real administrator identity has been verified, a trusted project SQL operator may call the pre-existing `clinic_private.bootstrap_first_administrator(verified_user_id)` exactly once. To grant staff after verified invitation and explicit admin approval, call `clinic_private.grant_verified_staff(verified_user_id, role, authorizing_admin_id)`. The new triggers apply on top of these helpers. Both functions remain inaccessible via frontend or ordinary authenticated role. For operational steps see `docs/PHASE2_AUTH_INTEGRATION.md`.

**Revocation limitation:** A trusted operator can currently update `staff_memberships.is_active=false` and the event logs the database role/timestamp and any existing `assigned_by`. This **does not guarantee attribution of the person making that SQL Editor change**, as `auth.uid()` can be null and `assigned_by` may reflect the previous assignment. Future server-only admin UI must require an explicit authorizing actor, reason, MFA/step-up check, and write an immutable-request audit in a trusted function, then verify a two-person recovery/break-glass procedure. Treat the event history as a technical audit aid, not tamper-proof legal evidence.

**Last-admin safeguard limitation:** The guard applies to ordinary table DML while triggers are active. Privileged project operators can disable triggers or bypass database safeguards; owner-controlled external backups and operational reviews remain necessary. The lock ensures serial checks for concurrent role updates but does not replace human approval.

## Remaining release gates

- Real Supabase Auth-issued JWT HTTP owner-vs-owner deny/persistence verification (`Clinic Auth contract` manual **test**, not register).
- Reviewed authenticated admin invitation/revocation service, actual staff user acceptance, role-change API negative tests and admin MFA.
- Full encrypted Auth, Storage and patient database recovery/restore rehearsal; approved clinic operating hours/timezone.
- Cloudflare Pages Free connected deployment, actual browser and staff role tests; no live go-live approved.
