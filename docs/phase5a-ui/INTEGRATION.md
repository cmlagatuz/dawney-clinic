# Phase 5A staff Operations UI — integration notes

**Status: source-only, feature-OFF, stubbed-harness evidence. Not live verified.** Branch `ai/claude/phase5a-ops-ui`, stacked on PR #48 (`58f15c0`). Backend contract: PR #59 `0b6ab69` (`docs/PHASE5A_STAFF_READ_CONTRACT.md`).

## Flag
`VITE_PHASE5A_OPS_UI=true` at build time adds route `/app/ops` and a "Clinic staff (preview)" nav link. Unset/anything else: no route, no link, no staff reads. The route sits behind the existing auth `Guard` (no anonymous access).

## What the UI depends on
`web/src/ops/read-port.ts` defines `OpsReadPort` (`verify`, `window`, `counts`) mirroring #59. `web/src/ops/port.ts` currently returns `null`, so the page shows **"Staff read contract not integrated"** and requests nothing. It never falls back to the legacy truncated queue or to sample rows.

## One-file wiring after #59 is merged into the stack
Replace the body of `web/src/ops/port.ts` (keep it the only file that imports `lib/`):

```ts
import type {OpsReadPortFactory} from './read-port'
import {getClinicDashboardCounts, listClinicQueueWindow, verifiedStaffSession} from '../lib/staff-clinic'

export const createOpsReadPort: OpsReadPortFactory = user => ({
  verify: async () => { const s = await verifiedStaffSession(user); return {userId: s.userId, role: s.role} },
  window: (fromUtc, toUtc) => listClinicQueueWindow(user, fromUtc, toUtc),
  counts: () => getClinicDashboardCounts(user),
})
```
Do not use `listClinicQueue` (array form). The UI validates every response (`validateWindow`/`validateCounts`) and treats anything malformed as an error, never as empty.

## Display contracts (honest by construction)
- Lanes use persisted statuses only: Expected (requested, confirmed), Checked in, Visit complete, plus a *Cancelled/no-show* group. **"With veterinarian" is a labelled gap**: no `in_consult` status exists.
- KPIs: counts derived from loaded rows; with `hasMore=true` they render "≥ N". Waiting time and room occupancy are "Not available" (no data stored). Patients / requested / confirmed come from `getClinicDashboardCounts` (all dates) and show "Not available" if that read fails, never 0.
- `hasMore=true` is always an *incomplete* warning; "Time range" (6-hour clinic-local slices) lets staff narrow. Week view makes seven separate ≤24h reads, each with its own state.
- Day boundaries use `Asia/Manila` (display setting only); clinic hours, breaks, holidays and providers are not published, so none are drawn.
- Rows show abbreviated real `pet_id`/`owner_id`/`resource_id` refs, because the #59 read contract returns no names. A joined, staff-scoped read (names, vet) is a backend dependency.
- All status-change actions are rendered disabled and labelled "(not enabled)".

## Remaining dependencies
1. Merge/stack #59 (Astra), then apply the wiring above.
2. Astra: staff-scoped read returning pet name, owner name, assigned vet/resource name.
3. Astra + clinician: encounter model + audited transitions before any "With veterinarian"/check-in action.
4. Owner: approved clinic timezone/hours before schedule hours are drawn; real staff onboarding and RLS tests on hosted Supabase.

Screenshots (`ops-*.png`) come from a stubbed local Chromium harness, not live data.
