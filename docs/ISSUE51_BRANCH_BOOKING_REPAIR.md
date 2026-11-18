# Issue #51 — Source-only branch booking authorization repair

**Status:** DRAFT ONLY. Base PR #82 is frozen at `b0633b2e8d073e9328462d29f4bfca280c70eaa7`. This PR is a separate unmerged backend-only source candidate. **No Supabase/staging/production migration, approved hours, patient booking, Storage/Auth object, or staff permissions were changed.**

## Real reproducibility evidence

The first, pre-repair GitHub Actions commit runs the **original 11 unchanged source blobs** + proposed twelfth branch migration in a disposable `postgres:17` service, then synthesizes a confirmed owner A, Naga-only approved branch, active room, approved published dog service and CI-only booking window. Cavite stays OFF. `set role authenticated` with local synthetic PostgreSQL JWT settings performs a **direct** `appointments` INSERT that omits `service_id` and `request_nonce`; a **COMMIT** is followed by a new privileged statement asserting the forbidden row remains persisted. It confirms the old singleton SELECT policy hides the singleton while both the original Phase4 validator and proposed branch INSERT policy permit the service-less row once Naga-only branch approval is toggled.

Reproduction case source: `supabase/tests/issue51_branch_booking_pre_repair_pg17.sql`. It always runs against the **unrepaired 11+12** database; it is not a live clinical exploit and is deliberately retained as a regression prerequisite.

## Minimal additive security correction

**13th, explicitly future-ordered and UNAPPLIED:** `supabase/migrations/20261118203500_issue51_branch_booking_security.sql`. This only `CREATE OR REPLACE`s the **existing** `clinic_private.validate_service_appointment()` SECURITY INVOKER trigger function, leaving all original 11 migrations and proposed 12th SQL byte-identical. No broadened grants, no SECURITY DEFINER, no modified role/Storage policies, no new service/branch publication. PG17 BEFORE INSERT trigger ordering is checked: `appointment_branch_guard` first derives `appointments.branch_id` from the existing resource; `appointment_service_booking_guard` then enforces branch-aware booking. Historical rows are never updated or attributed.

Every NEW branch appointment (including direct Data API INSERT) must now supply a same-branch published/owner-approved service and UUID request nonce, be created by a real active email-confirmed non-anonymous owner of its pet and have `status='requested'`. The validator requires the service/resource match, active resource/capacity=1, supported species and an owner-approved `branch_booking_policies` row **for the resource-derived branch** and `clinic_branches.booking_enabled`. Its schedule validates timezone, shape, supported lead/horizon/slot bounds, duration, weekday interval and holiday. It **does not** re-enable the globally hidden `clinic_booking_policy` singleton; marketing display hours remain non-authoritative. The original permissive `clinic_service_resources` SELECT depended on that hidden singleton, so the additive migration also adds `clinic_service_resources_branch_invoker_read`: an **authenticated-only** narrow permissive read alternative gated on published service, active same-branch resource and approved/enabled branch. PR80's **unchanged restrictive** service-resource RLS policy remains mandatory; no anonymous broadening, no staff/clinical write grant.

The existing `public.request_service_appointment(uuid,uuid,uuid,timestamptz,uuid,text,text)` function (7 parameters, SECURITY INVOKER) is untouched: it derives `owner_id` from `auth.uid()`, preserves exact-payload nonce replay, throws on changed-payload reuse, uses the existing GiST exclusion for overlapping active resource appointments and leaves initial status `requested`. A subsequent staff confirmation remains a separate authorized update; owner replay of that original nonce returns the existing ID, not a new confirmed booking.

## Offline CI boundaries

The isolated `.github/workflows/issue51-branch-booking-pg17.yml` has two independent `postgres:17` jobs:

- **Pre-fix reproduction**: original 11 + unchanged 12th, commit-and-readback confirmation of service-less bypass with fake Naga approval.
- **Post-fix regression**: original 11 + unchanged 12th + new 13th, rollback-only synthetic fixture testing branch OFF, Naga approval, Cavite denial, verified owner vs other account/anonymous/unconfirmed, dog/Chow Chow species eligibility, direct INSERT mandatory service/nonce, RPC replay/conflict, invalid schedule/holiday/slot/timezone, staff branch isolation, true requested → confirmed event, historical Dog/Chow Chow and NULL unknown branch.

The original 11 source blob hashes remain checked verbatim in both CI jobs. The unified full-tree gate retains all earlier release source pins and adds the exact new SQL/workflow/test/doc blobs to the closed source allowlist.

## Release NO-GO and known compatibility gaps

1. **Frontend not wired for branch-aware public schedule selection.** `web/src/lib/public-booking.ts` still reads hidden singleton `clinic_booking_policy`, and `booking-mode.mjs` can mistake a missing schedule for legacy. Claude must deliver a separately reviewed branch-aware reader and eliminate the service-less UI fallback before any booking flag activation.
2. All Naga and Cavite clinical booking policies are **OFF by default**. Synthetic CI windows have no relationship to owner-approved public display hours; clinical hours, consent, services, eligible species, resource capacity, true owner/operator approval, recovery and real JWT/Auth/PostgREST/Storage tests remain release gates.
3. Existing legacy staff-assisted identity intake/upload remains deliberately fail-closed by PR80; no bypass of prior branch P1 RLS is implemented. No cross-branch admin privilege escalation.
4. Independent security review of this **new PR head** is still required following Kimi's separate frozen PR82 review. Inherited npm high-severity audit failures are NOT waived.

**No merge, deployment, operational staging upgrade, policy approval, production write or billable cloud action is authorized by this source proposal.**
