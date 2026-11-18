# Issue #58 — Secure Naga/Cavite staff Operations branch read contract

**Status: source-only DRAFT / not wired into live Operations.** Base: exact PR83 `0edeeb152d306fe5c652d289ec5f4e69f00c2f11`. Existing 11 original, 12th branch-RLS and 13th booking migrations are byte-identical. Proposed **14th migration is NOT applied** to any Supabase project. Both booking flags and `VITE_PHASE5A_OPS_UI` remain OFF.

## Authoritative branch access

The original PR80 `public.staff_branch_memberships` has self-only SELECT RLS; `public.assert_staff_branch(uuid)` delegates to live Auth-user state, active global staff role **matching** the active branch role and branch membership. Never use selected branch, JWT `active_branch_id`, URL or storage as authorization. Existing restrictive `appointments_branch_read` and `clinical_records_branch_read` remain unchanged: a Naga receptionist/administrator must never see Cavite appointments or clinical information. A receptionist cannot read medical charts even at Naga; a Naga administrator/veterinarian may see relevant Naga care history only.

The new source-only `supabase/migrations/20261118215500_issue58_staff_branch_read_contract.sql` adds **only** `public.get_branch_dashboard_counts(p_branch uuid)` as SECURITY INVOKER (one explicit authenticated EXECUTE grant; anonymous/PUBLIC revoked). It first calls the existing `assert_staff_branch(p_branch)` and then counts directly over `appointments WHERE branch_id=p_branch` with existing RLS. Counts are **real SQL aggregates**, never global patients: `patients` = number of **distinct pets with at least one appointment at the selected branch**, `requestedAppointments` and `confirmedAppointments` count that branch's appointments in the two stored statuses across all dates. Unattributed historical appointments (`branch_id=NULL`) are not assigned to Naga or Cavite and do not inflate counts. No `SECURITY DEFINER`, source policies, service approvals or table write grants are added.

## Backend adapter / exact Claude hookup contract — NOT ENABLED HERE

The exported functions in `web/src/lib/staff-branch.ts` match PR81's `OpsBranchDeps` **exactly**:

| Function | Source / validation |
| --- | --- |
| `listOwnBranchMemberships(user)` | `verifyStaffFromRls` (current `auth.getUser()` + global active staff row), then SELECT own `staff_branch_memberships`, never other users |
| `listClinicBranches()` | public `clinic_branches` catalog fields only; never authorizes a branch |
| `assertStaffBranch(user,branchId)` | current verified staff session + `rpc('assert_staff_branch',{p_branch:branchId})` with exact UUID echo; reject `42501` |
| `listBranchQueueWindow(user,branchId,fromUtc,toUtc)` | verify actual session; assert server branch; SELECT real RLS `appointments` with **`eq('branch_id',id)` before a `[fromUtc,toUtc)` UTC bound**, stable `starts_at,id` order, `limit(251)`; validate every row's branch, UUID, persisted status and time; return `{items: first 250,hasMore: true}` when 251st exists. Reverify session and branch after fetch before releasing records to prevent stale-account/revocation disclosure |
| `getBranchDashboardCounts(user,branchId)` | current session; read new branch-scoped invoker count RPC, validate exactly one nonnegative safe-integer response; reverify current account and branch before returning typed counts. Never convert read errors to zero |

The pure mock-testable module `web/src/staff-branch-read-contract.mjs` and exact `.d.mts` types implement the RLS-bound query. They reuse existing `verifyStaffFromRls` and `validateClinicUtcWindow` from `staff-read-contract.mjs`. No clinic events, mutations, fake patient totals, demo messages or service credentials are introduced.

**ONLY after independent review, successful database migration of prerequisite 11+12+13+14, real staff memberships, and owner-gated live acceptance, Claude may wire the existing `web/src/ops/port.ts` (Claude-owned and UNCHANGED here):**

```ts
import {createReadPortFor,createBranchPortFor} from './port-adapter.mjs'
import {
 listOwnBranchMemberships,listClinicBranches,assertStaffBranch,
 listBranchQueueWindow,getBranchDashboardCounts
} from '../lib/staff-branch'
const base = {verifiedStaffSession,listClinicQueueWindow,getClinicDashboardCounts}
const branch = {listOwnBranchMemberships,listClinicBranches,assertStaffBranch,
  listBranchQueueWindow,getBranchDashboardCounts}
export const createOpsReadPort:OpsReadPortFactory = user => {
 const port=createReadPortFor(base,user)
 return port ? {...port,branch:createBranchPortFor(branch,user) ?? undefined} : null
}
```

**Do not enable this yet.** Current `createOpsReadPort` remains unscoped; the visible page is still behind `VITE_PHASE5A_OPS_UI=false`. PR81 `useBranchScope` controls account-scoped selection, hides revoked branch choices, and already ignores late responses. It must not call a global/unscoped queue when the branch adapter is unavailable.

## Actual offline CI and interpretation

`.github/workflows/issue58-staff-branch-read-pg17.yml` replays **eleven exact original source-hashed migrations**, unchanged proposed 12th, PR80 negative RLS tests and then seeds 251 independent-resource Naga appointments in one Manila-local day plus a same-UTC Cavite negative sentinel (genuine GiST exclusion still in force). After those synthetic historic fixtures, it applies unmodified proposed 13th and only the **new 14th migration**, then executes branch read/count denial tests. The new SQL test runs under `SET ROLE authenticated` with CI-only synthetic auth user rows and JWT session variables, **not signed hosted JWTs**. It proves no Cavite queue/count or medical leakage for Naga receptionist/admin (including global admin), and rejects forged browser selected branch, inactive branch/global memberships, switched account, unconfirmed/anonymous roles. Positive checks include one Naga distinct patient count, requested/confirmed totals, exact 250/251 pagination in `[local-midnight UTC, next-midnight UTC)`, and historic Dog/Chow Chow and `UNKNOWN` branch preservation.

`web/tests/staff-branch-read-contract.test.mjs` also tests empty versus error states, 0/249/250/251+ pagination, malicious/malformed RLS responses, revocation mid-read, account changes, half-open Asia/Manila days and contiguous seven-day calendar windows. Neither fake server tests nor disposable PG prove hosted JWT/Storage acceptance.

## Explicit release blocks

- **Unmerged, uninstalled:** 14th SQL proposal and all 12th/13th predecessors are uninstalled in real staging/production; no approved staff branch grants. Existing 11 migration hashes unchanged.
- **Owner and medical authorization:** no real staff bootstrap, no Auth A/B hosted JWT/PostgREST/Storage validation, no clinical account/appointment writes, no live staging dataset or verified restore.
- **Frontend not wired:** Claude must separately integrate and independently test the `OpsBranchDeps` adapter; feature OFF until reviews, owner approval, and staged acceptance. Read-only by design—no appointment transition RPC added.
- **Independent security and release:** SOL must review exact new-head SQL function and RLS read scope, including `SECURITY INVOKER`; inherited npm high-severity advisory remains a release blocker. No waiver, deployment promotion, merges, force push, paid resources or production changes.
