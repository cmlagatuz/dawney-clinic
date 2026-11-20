# ASTRA handoff — Issue #78 branch-safe veterinary pharmacy

**CLOUD scope:** frontend-only draft child of PR102 `dc1c7570fc43a2168b7fb5669db9389b4baf6429`.
**Feature:** `VITE_PHASE5B_PHARMACY_UI` — **OFF** unless set to `true` at build time.
**Status:** schema migration #15 `20261118225000_issue78_inventory_read_only_foundation.sql`
is **SOURCE ONLY / UNAPPLIED**. Do not infer hosted inventory stock, verified real
staff sessions or completed clinical dispensing from synthetic browser tests.

## Reviewed source contract consumed (read-only)

The frontend-owned `web/src/inventory/port.ts` uses the existing
`web/src/lib/staff-branch.ts`, `web/src/lib/staff-clinic.ts` and
`web/src/clinical/port.ts` **unchanged** for live verified account+branch
membership and server `assert_staff_branch`. Every read rechecks the authorized
selected branch before and after a bounded query. The branch must have been
offered by current active membership — a URL/query string cannot authorize it.
Supabase uses the ordinary publishable client key, never a service-role key.

### Actual #15 read calls

| Query | Input | Exact result and safety |
| --- | --- | --- |
| `medicine_catalog` SELECT | list (max 101) | Only `id,product_code,generic_name,formulation,strength,stock_unit,minimum_shelf_life_days,requires_refrigeration,is_controlled,is_active`; shared with currently authorized staff |
| `branch_medicine_rules` SELECT | `branch_id=eq.<authorized UUID>`, max 101 | `branch_id,medicine_id,reorder_point_units,expiry_warning_days` (30/60/90) |
| `list_branch_medicine_alerts(p_branch uuid)` | verified branch, max 101 | `medicine_id,product_code,available_units,reorder_point_units,out_of_stock,low_stock,expiry_warning_days,near_expiry_batches,expired_batches,quarantined_batches` |
| `branch_stock_batches` SELECT | `branch_id`, `medicine_id`, max 101 | Exact `id,branch_id,medicine_id,lot_number,received_on,expiry_date,disposition,on_hand_units,reserved_units,quarantined_units` |
| `list_branch_medicine_fefo(p_branch uuid,p_medicine uuid)` | verified branch+medicine, max 101 | `batch_id,lot_number,expiry_date,available_units,received_on` in **database FEFO order** |
| `stock_movements` SELECT | `branch_id`, `medicine_id`, max 51 | `id,branch_id,medicine_id,batch_id,event_id,event_type,delta_on_hand,delta_reserved,delta_quarantined,after_on_hand,after_reserved,after_quarantined,reason_code,recorded_by,recorded_at` |
| `clinic_branches` SELECT | `id=eq.<authorized UUID>` | `id,timezone`; client local day is **for display only** |

Cost fields `unit_cost_minor` and `currency_code` are **not requested or returned
to UI objects**, even when an incorrectly configured synthetic HTTP provider
injects extras. RLS and column grants are the real cost-privacy boundary.

PostgREST RPC transport is HTTP POST, but both list RPCs are
**SECURITY INVOKER STABLE read-only SQL**; those POSTs must never be confused
with a stock mutation. No other POST/PUT/PATCH/DELETE stock methods exist.

**Important PR92 correction:** both RPCs evaluate expiry from a single
transaction timestamp at the authorized `clinic_branches.timezone`. The
earlier PR86 documentation describing session `CURRENT_DATE` is outdated.
The frontend **must not recalculate FEFO eligibility or server alert flags**.
A 30/60/90 UI expiry preview uses the browser date translated to the branch
timezone and explicitly labels itself a display-only estimate; RPC results
remain authoritative near midnight or with client clock drift. An unconfigured
medicine has **unknown branch stock**, not zero stock; an incomplete bounded
read is labelled incomplete, not complete.

## Current functionality and limits

- **Works only if #15 is applied in authorized environment:** branch-specific
  catalog + reorder/expiry alerts, batch lot metadata, FEFO ordered candidates,
  read-only ledger, search/sort/filter, explicit empty/denied/network/retry,
  date-horizon presentation, account/branch reset.
- **Never enabled by this frontend PR:** receipt, stock adjustment, dispense,
  reservation, quarantine/release, stock threshold edit, catalog edit,
  inventory procurement, expiry write-off, patient encounter link, and
  branch transfer. All stock operation controls are always disabled.
- Truncation caps: 100 catalog/rules/alerts/batches/FEFO; 50 ledger.
  This is a safe preview, **not full paginated inventory**. Next backend
  iteration must provide cursor pagination with totals and consistent snapshots.
- The read-only #15 branch-scoped ledger **already has authorized RLS SELECT**;
  showing it does not constitute a movement write.
- Historical Dog/Chow Chow patient, its appointment and original migrations
  stay untouched; synthetic Alpha and PR89 remain isolated.

## ASTRA: mandatory transactional write API (NOT implemented)

**Do not enable a button until exact contracts below or safer reviewed
equivalents are implemented and independently tested on PostgreSQL 17.**

Proposed server function interfaces (names intentionally **proposed**):

```ts
type InventoryActor = {
  // Never caller-supplied: derive auth.uid(), verified email, active global role,
  // matching active branch membership(s), delegated permissions FROM DATABASE.
  actorId: string
}
type InventoryCommand = {
  branchId: string           // UUID and server-scoped membership
  medicineId: string         // UUID; catalog active and permitted
  batchId?: string           // UUID bound by (id,branch_id,medicine_id) FK
  eventId: string            // Client UUIDv4, server-bound action+actor+payload
  expectedBatchRevision?: string
  reasonCode: string         // server enum/allowlist; justification required
  units: number              // safe positive INTEGER in catalog stock_unit only
}
type StockMutationResult =
  | {kind:'committed'; eventId:string; movementIds:string[];
      branchId:string; medicineId:string; batchIds:string[];
      currentRevision:string; balances:{onHand:number;reserved:number;quarantined:number}[]}
  | {kind:'replayed'; eventId:string; originalResult:StockMutationResult}
  | {kind:'conflict'; code:'revision'|'event_payload_changed'|'insufficient_stock'|'expired'|'held'|'short_shelf_life'}
  | {kind:'denied'} | {kind:'unavailable'}
```

1. **Receipt / opening stock:** approve supplier reference and lot details,
   `received_on <= expiry_date`, quantity positive and unit exact. Atomic
   new/update batch and append `receipt` ledger event with durable actor,
   reason, branch, observed revision and unique event ID; no browser-provided
   unit cost or staff/approval identity.
2. **Adjustment/quarantine/write-off:** administrator-approved reason plus
   second-person approval when policy requires; atomically update
   `on_hand,reserved,quarantined`, retain nonnegative invariant and immutable
   before/after movements; no past-row deletion or rewriting.
3. **Dispense:** link verified patient+encounter/prescription and clinician
   eligibility through a separately approved clinical API; enforce veterinarian/
   administrator and clinic policy. **Inside one database transaction**, lock
   candidate batches in deterministic `(branch,medicine,expiry,received,lot,id)`
   order, rederive branch-local current date, minimum shelf life,
   nonquarantined/nonrecalled disposition, `available > 0` and FEFO order.
   Reject oversell, expiry and unit mismatch. Commit batch balances plus all
   movement rows atomically or roll back everything.
4. **Branch transfer:** two distinct signed/authorized actor acknowledgements
   (source and destination); reserved/in-transit phase, linked
   `transfer_send` / `transfer_receive` events, compatible receiving lot/unit,
   reconciliation/timeout/return or cancellation; both memberships/permissions
   independently checked. No implicit Cavite rights from Naga membership.
5. **Idempotency:** unique `(actor,branch,action,event_id)` bound to a
   cryptographic canonical request digest and durable original response.
   Same nonce/payload returns the same event without duplication, different
   payload with same nonce is a **conflict**. Concurrency locks and an
   expected server revision prevent lost updates; browser disabled-button
   state alone is not concurrency protection.
6. **Role and security tests:** current global and branch role match; real
   confirmed nonanonymous JWT; negative tests for owner/anon/revoked staff,
   forbidden branch/medicine/lot, guessed IDs, cross-branch ledger FK,
   cost-column SELECT, expired/quarantined/recalled lots, FEFO tie-breaks,
   reserved/negative stock, concurrent independent PG clients,
   replay and alter-payload nonce, transaction rollback, insufficient and
   inactive catalog scenarios. No `SECURITY DEFINER` privilege bypass.
7. **Read consistency/pagination:** one consistent snapshot API returns
   `asOf` instant, `branchToday` from verified timezone, role-authorized
   stock/catalog/alerts counts, cursor-bound ledger/batch pages, and durable
   `etag/revision` for update conflicts. A session/branch change invalidates
   all cursors; denied/nonexistent must not disclose medicine existence.
8. **Human clinical signoff:** drug classification, dose/unit conversion,
   audit retention, cost roles, controlled substance management, receipt/
   supplier approvals, dispensing and patient identifiers require a signed
   veterinary owner/policy decision. This document does **not** grant it.

**Integration gate:** ASTRA supplies a reviewed typed `web/src/lib/**`
read/write adapter (and migrations/PG17 RLS suite) independently; CLOUD then
wires only approved calls to the existing disabled controls in a separate
frontend assignment, followed by SOL/Qwen, real staff-hosted verification and
owner release approval. No self-merge, production SQL, trial stock seeding,
procurement, messages, medicines or spending.
