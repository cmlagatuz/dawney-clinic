# Phase 5A — connected staff queue and schedule read contract

**Status: source-only / NOT LIVE VERIFIED.** No Supabase schema changes, account creation, actual clinical writes, source merges, or provider activation.

## Authorization and persistence boundaries

The existing web/src/lib/staff-clinic.ts public functions are retained. Before fetching staff rows, verifiedStaffSession(user) calls Supabase Auth getUser, requires the exact same confirmed/non-anonymous identity and an active matching staff_memberships RLS row with role administrator, veterinarian, or receptionist. Owner-only accounts, inactive/revoked memberships, mismatched identity, forged role and Auth errors fail closed. These browser checks **never replace server-side RLS**. Existing private trusted-operator admin bootstrap remains unchanged and is not exposed in the browser.

The existing listClinicQueue(user,fromUtc,toUtc) requires a canonical explicit UTC interval of 1–24 hours and queries *persisted* RLS-scoped appointments. Reads include only appointment IDs, patient/owner/resource IDs, UTC start/end, current status and concern; sorted by start, capped at 250. Day/week UI must derive bounds from an **approved clinic timezone** instead of the viewer's device and use separate bounded daily reads for week view. Results at the 250-row cap may be truncated: UI must show an incomplete-results notice / narrow-window guidance. Empty list is valid only on successful query, while invalid response and permission/network error throw.

Existing getClinicDashboardCounts reads exact persisted row counts; a genuine zero is valid but missing/malformed counts or API errors now throw rather than silently displaying fictitious zero totals.

## Current persisted status vs synthetic demo

Actual supported appointment statuses: requested → confirmed → checked_in → completed, plus allowed cancellation/no-show transitions subject to existing server constraints. The Alpha demo's In consult lane is **not** a persisted appointment status. Add a clinician-approved encounter model and audit trail *separately* before writing consultation status. Undo cannot overwrite a completed clinical/appointment event; later correction must be privileged, reasoned, immutable and audited.

## Frontend handoff / testing gates

Claude owns the future staff UI on a separate feature-OFF integration branch. It may consume staff-clinic.ts adapters only when sources are integrated. Must show real loading, deny, empty, error and 250-limit states; never display synthetic fixtures as connected clinic counts/visits or fall back to demo data. No anonymous staff route. Do not merge the synthetic-only /alpha/* demo.

Node tests in web/tests/staff-read-contract.test.mjs use **mock/injected Supabase responses**, not actual Postgres or live JWT. Existing PostgreSQL role/appointment SQL regression and synthetic restore checks remain separate evidence. Live owner A/B JWT denials, Auth+Storage restore, approved working hours, initial administrator onboarding, human privacy/clinical signoff and a controlled migration window remain **OWNER-GATED / NOT VERIFIED**.

**Rollout:** PR review + CI → ordered safe source integration (#46/#34/#40/#43 then #41/#48), with #49/#52 recovery/test evidence → owner-authorized restorable baseline and Phase4 migration plan → staged staff permission checks → real data read/refresh persistence → later clinician-approved status mutations. Do not bootstrap real staff, publish schedule, or change Supabase live until approved.
