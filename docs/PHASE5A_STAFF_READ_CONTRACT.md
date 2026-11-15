# Phase 5A — connected staff queue and schedule read contract

**Status: source-only / NOT LIVE VERIFIED.** No Supabase schema changes, account creation, actual clinical writes, source merges, or provider activation.

## Authorization and persistence boundaries

The existing web/src/lib/staff-clinic.ts public functions are retained. Before fetching staff rows, verifiedStaffSession(user) calls Supabase Auth getUser, requires the exact same confirmed/non-anonymous identity and an active matching staff_memberships RLS row with role administrator, veterinarian, or receptionist. Owner-only accounts, inactive/revoked memberships, mismatched identity, forged role and Auth errors fail closed. These browser checks **never replace server-side RLS**. Existing private trusted-operator admin bootstrap remains unchanged and is not exposed in the browser.

The existing `listClinicQueue(user,fromUtc,toUtc)` retains `Promise<ClinicQueueItem[]>` for backwards-compatible complete windows; it now **throws** if more than 250 matching rows exist instead of returning a silently incomplete schedule. The new typed `listClinicQueueWindow(user,fromUtc,toUtc): Promise<ClinicQueueWindow>` returns `{items: ClinicQueueItem[], hasMore: boolean}`. Both verify the active staff session and query persisted RLS-scoped appointments inside an explicit positive interval up to 24 hours, bounded by an **approved clinic timezone** (never the viewer device). The SQL request uses `limit(251)` and returns at most 250 displayed rows. `hasMore=false` with exactly 250 rows means complete; `hasMore=true` means **at least one extra** visit and the UI must clearly warn, label the view incomplete and ask staff to narrow the UTC window. This is not a paging cursor and does not claim an exact total. One-day/week views use separate bounded reads; 0 rows are valid only on a successful read. Database denial, malformed result (including the lookahead row), or invalid time bounds fail closed.

Existing getClinicDashboardCounts reads exact persisted row counts; a genuine zero is valid but missing/malformed counts or API errors now throw rather than silently displaying fictitious zero totals.

## Current persisted status vs synthetic demo

Actual supported appointment statuses: requested → confirmed → checked_in → completed, plus allowed cancellation/no-show transitions subject to existing server constraints. The Alpha demo's In consult lane is **not** a persisted appointment status. Add a clinician-approved encounter model and audit trail *separately* before writing consultation status. Undo cannot overwrite a completed clinical/appointment event; later correction must be privileged, reasoned, immutable and audited.

## Frontend handoff / testing gates

Claude owns the future staff UI on a separate feature-OFF integration branch. It may consume staff-clinic.ts adapters only when sources are integrated. Must show real loading, deny, empty, error and `hasMore=true` incomplete states; never display synthetic fixtures as connected clinic counts/visits or fall back to demo data. No anonymous staff route. Do not merge the synthetic-only /alpha/* demo.

Node tests cover 0/249/250/251+ rows, legacy array overflow rejection, database denial and malformed lookahead responses. They use **mock/injected Supabase responses**, not actual Postgres or live JWT. Existing PostgreSQL role/appointment SQL regression and synthetic restore checks remain separate evidence. Live owner A/B JWT denials, Auth+Storage restore, approved working hours, initial administrator onboarding, human privacy/clinical signoff and a controlled migration window remain **OWNER-GATED / NOT VERIFIED**.

**Rollout:** PR review + CI → ordered safe source integration (#46/#34/#40/#43 then #41/#48), with #49/#52 recovery/test evidence → owner-authorized restorable baseline and Phase4 migration plan → staged staff permission checks → real data read/refresh persistence → later clinician-approved status mutations. Do not bootstrap real staff, publish schedule, or change Supabase live until approved.
