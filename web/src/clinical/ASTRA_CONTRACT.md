# ASTRA HANDOFF — clinic clinical workspace, secure backend contracts

**Proposed by CLOUD, 20 Nov 2026. Not implemented / not approved.**
Preview route: `/app/clinical`, feature flag `VITE_CLINICAL_WORKSPACE_UI` **OFF**.
Current source ancestor: PR #99 `c1f2751740792b069ca2a3da38efa7ce538f7489`.
This document is a typed backend request, not authorization to modify Supabase,
bootstrap staff, publish clinical services, or migrate live data.

## Verified current contracts (connected in the preview)

- `verifiedStaffSession(user)`: Auth `getUser`, verified email and RLS-backed
  active staff membership; roles administrator/veterinarian/receptionist.
- `listOwnBranchMemberships(user)` and `listClinicBranches()`: the current
  account's active staff_branch_memberships rows intersected with catalog.
- `assertStaffBranch(user,branchId)`: RLS-aware RPC `assert_staff_branch`.
- `listBranchQueueWindow(user,branchId,fromUtc,toUtc)`: branch-filtered appointment
  rows, 250 maximum + hasMore, UTC half-open day, repeated membership assertion.
  This is the **only** source of patient references/visits currently displayed.

## Security gaps (not wired)

- `listClinicPatients(user)` reads `pets` via staff-wide membership, not
  `pet_id + branch_id`. DO NOT reuse for branch-scoped charts.
- `listClinicClinicalRecords(user,petId)` reads clinical_records by patient and
  staff-wide RLS; there is no branch scope in its signature, no cursor/hasMore.
  Do not expose it as “medical history” in a branch chart.
- Existing `clinical_records` stores `pet_id, performed_at, procedure,
  temperature_c, weight_kg, comments, authored_by`, but no direct branch
  membership linkage or encounter version. Its generic RLS INSERT must not be
  interpreted as approval for a modern encounter workflow.
- No reviewed persisted treatment course, vaccination administration, medication
  prescription, clinical sign-off, revision-concurrency, signed/void states or
  clinical idempotency APIs are connected. No clinical write buttons may be enabled.

## Required read contract (first backend increment)

A single typed server-authorized API, name proposed
`read_staff_patient_chart(p_branch uuid, p_pet uuid, p_after timestamptz|null,
p_limit int <= 50)`, or an equivalent *documented* hardened interface.
Return (after validating the payload against a stable schema):

```ts
type PatientChartRead =
 | {kind:'ok'; accountId:string; branchId:string; patient:{
      id:string; ownerId:string; name:string; species:string;
      breed:string|null; sex:'male'|'female'|'unknown';
      birthDate:string|null; taxonomyReviewNeeded:boolean
    }; appointments: Array<{
      id:string; branchId:string; petId:string; startsAt:string; endsAt:string;
      status:'requested'|'confirmed'|'checked_in'|'completed'|'cancelled'|'no_show';
      concern:string
    }>; records:Array<{
      id:string; petId:string; branchId:string; performedAt:string;
      procedure:string; temperatureC:number|null; weightKg:number|null;
      comments:string|null; authoredBy:string|null
    }>; nextCursor:string|null; hasMore:boolean; revision:string}
 | {kind:'denied'} | {kind:'not_found'} | {kind:'unavailable'};
```

Backend assertions, not UI predicates, must establish: actual authenticated JWT
and non-anonymous confirmed actor; active role and **active membership for
p_branch**; patient belongs to that permitted branch using a reviewed visit
association; each returned appointment and clinical record is individually
permitted for that branch and pet. Never use arbitrary URL IDs as grant.
Apply bounded pagination, deterministic ordering and access checks to each page.
There must be no cross-branch fallback if a patient has no local visit. Records
created before branch migration require explicit, non-destructive ownership
mapping and an approved policy for legacy/unattributed entries; hide uncertain
records rather than guessing their branch.

For denied/nonexistent patient avoid existence-oracle information. An empty
verified authorized history MUST be distinguishable from a refused/failed read.
No privileged service key in frontend; don't rely on JWT user metadata for role.
Current backend role `receptionist` may read only the fields approved by clinic
policy; treatments/medications may require a narrower clinical-role RLS view.
Use real server audit entries and preserve the historical Chow Chow patient and
appointment unchanged.

## Required write contracts (separate review/approval)

An exact schema and migrations for encounters, treatments, vaccinations and
prescriptions must be reviewed with the veterinary director before wiring.
Proposed RPC `save_staff_clinical_encounter` accepts:
`p_branch`, `p_pet`, verified `p_appointment`, `p_request_id UUID`
(idempotency nonce), `p_expected_revision`, and bounded validated fields
`complaint, examination, assessment, plan`. The server determines
`auth.uid()`, created/updated timestamps and current branch; **not** browser
supplied authorship, eligibility or a free-form active/signed status.
Persist atomically with immutable audit trail. Draft vs signed must have
explicit server-owned transitions and readable revision. Repeating an identical
`request_id` returns the original outcome; changed payload same nonce returns
a conflict. Concurrent stale revision must return a deterministic conflict
without overwriting reviewed notes. Deny receptionists and unauthenticated
actors on write. Never perform a clinical write from a plain staff SELECT.

For `treatment`, `vaccination` and `prescription`, define separate typed
versioned entities, server-owned clinician attribution, units and allowed
values (species-specific dosage, route, frequency, prescription validity,
vaccine product/lot/date, contraindication checks are **clinical-policy
decisions**, not generic UI input rules). Return explicit `pending`, `saved`,
`signed`, `voided` only when those are persisted database states. No silent
inventory movement, dispensing, reminder or patient notification. Define
adverse event/correction workflow, signed record immutability and RLS/storage
scope. Staff must be able to read the authoritative record after refresh.

## Negative security and acceptance cases for ASTRA

1. Owner/anonymous/non-active staff/expired JWT cannot read a branch chart.
2. Staff with branch A cannot read or write branch B patient or appointments,
   even if they guess IDs; dual-branch staff sees only the selected scope.
3. Wrong pet/appointment/branch relationships fail with no row leaks.
4. Role revocation between first read and final write fails; never insert.
5. Cursor or result limit cannot bypass branch scope; errors not treated as empty.
6. Two concurrent note submissions with same nonce only create one record;
   changed payload with same nonce and stale revision fail safely.
7. Signed visit edits require explicit authorized correction/audit;
   patient chart refresh returns committed records only.
8. Real denied and network failures are distinguished from empty histories.
9. Off-by-default flags, migrations, Chow Chow row and zero-cost providers
   remain unchanged until a separately approved release.
10. PostgreSQL17 RLS/role tests and hosted staff-account boundary checks
    need independent approval; synthetic browser fixtures alone are insufficient.

## CLOUD integration point

`web/src/clinical/port.ts` exposes ONLY `loadBranches()` and
`readDay(branchId,clinicDay)`. Add a new read function and typed response
only after ASTRA supplies reviewed adapters in `web/src/lib/**` and tests.
`web/src/clinical/PatientChart.tsx` currently labels historical records
unavailable, provides local ephemeral drafts and holds **Save to patient chart**
disabled for every role. A successful “Review unsaved draft” confirms only
local field format, never persistence.
