# Dawney — Staff Approval & Inventory Operational API (#18/#19)

**Status:** SOURCE-ONLY DRAFT descendant of frozen PR #124 `ebe6caf8a1f9f17fb00739986b1ebdb83e2d9d0d`. No provider migrations applied; no accounts invited or real stock added. Requires independent SOL security acceptance and PM-controlled integration.

## Migration and invariant chain
Apply original 17 ordered migrations without rewriting any historical blob, then:
1. `20261121201000_staff_self_service_approval_accountant.sql`
2. `20261121202000_inventory_transactional_branch_ops.sql`

The first administrator signs up with ordinary Supabase Auth, verifies email, and is bootstrapped only by separately authorized owner/trusted SQL using the existing private `clinic_private.bootstrap_first_administrator`. Owner must separately approve the exact branch-membership grant. **Never run bootstrap through browser RPC, automatic signup hook or migration seed.** Do not import/stage real staff identities or credentials.

All new mutations run through PostgreSQL SECURITY DEFINER functions with empty `search_path`, verified current auth.users, active `auth.sessions` matching the signed `session_id` JWT claim and nonexpired JWT, and matching current global + selected branch membership. No client table mutation grants. The provider must validate the signed JWT; synthetic PG17 GUC-based tests **do not** replace hosted JWT acceptance. The accountant role is distinct, deliberately excluded from all clinical/inventory/administrator reader/writer role lists. Finance remains OFF.

## Exact PostgREST RPC signatures and JSON

- `request_staff_access(p_branch uuid,p_note text DEFAULT NULL) RETURNS jsonb` — authenticated self-request pending only, no grant; `{kind:"staff_request",state:"pending",revision,branchId}`. Pending replay returns same response. Existing approved/revoked actors cannot make themselves pending.
- `list_staff_access_requests(p_branch uuid) RETURNS jsonb` — current administrator in p_branch; `{kind:"staff_requests",branchId,items:[{userId,requestedBranchId,state,revision,requestedAt,reviewedAt}]}`. No direct email reads.
- `get_my_staff_access() RETURNS jsonb` — verified actor; `{kind:"my_staff_access",state,role,branches}` only currently authorized effective grants.
- `review_staff_access(p_target uuid,p_action text,p_role text,p_branches uuid[],p_expected_revision integer,p_request_id uuid) RETURNS jsonb` — branch administrator only, not self; actions `approve|reject|inactivate|revoke|role_change`. For approve/role_change, role is one of `administrator|veterinarian|receptionist|accountant`, branches must be nonempty/deduplicated and the acting admin must have live administrator membership in EACH requested and previously assigned branch. Other actions require NULL role and NULL/empty branches. Optimistic revision and stable actor+nonce receipt. Response `{kind:"staff_review",userId,state,role,branches,revision}`; journal and branch mutations in one transaction.
- `create_branch_inventory_item(p_branch uuid,p_request_id uuid,p_product_code text,p_name text,p_description text,p_category text,p_unit text,p_formulation text,p_strength text,p_reorder_point bigint,p_lot text,p_expiry date,p_supplier text,p_opening_units bigint) RETURNS jsonb` — category `medicine|consumable|supply`, uppercase unique product code, lowercase validated stock unit, branch rule, optional positive opening. Positive opening REQUIRES unexpired lot and generates exactly one batch and `opening` stock movement. `{kind:"inventory_item",itemId,branchId,productCode,category,unit,revision,onHandUnits,batchId}`.
- `receive_branch_inventory_stock(p_branch uuid,p_medicine uuid,p_request_id uuid,p_lot text,p_expiry date,p_supplier text,p_quantity bigint) RETURNS jsonb` — noncontrolled active branch item, positive quantity, unexpired lot, supplier/lot identity, atomic batch increment plus exactly one append-only `receipt` movement. Same actor+nonce/payload returns identical JSON, altered payload rejects. Cross-actor same branch/nonce fails unique conflict. `{kind:"stock_received",branchId,itemId,batchId,receivedUnits,lotOnHandUnits,actorId,eventId}`.
- `edit_branch_inventory_item(p_branch uuid,p_medicine uuid,p_expected_revision integer,p_name text,p_description text,p_reorder_point bigint,p_expiry_warning_days integer) RETURNS jsonb` — ONLY local display/description/reorder/expiry-warning (30/60/90), no global product identity edits, quantity changes, batch/ledger edits; revision compare-and-swap. `{kind:"inventory_item_updated",branchId,itemId,revision,name,description,reorderPointUnits,expiryWarningDays}`.
- `get_branch_inventory_balance(p_branch uuid,p_medicine uuid) RETURNS jsonb` — current branch staff admin/receptionist/vet; `{kind:"inventory_balance",branchId,itemId,productCode,revision,onHandUnits,availableUnits,reservedUnits,quarantinedUnits}`. On-hand sums actual batches; usable availability excludes expired, unreleased, recalled, reserved and quarantined lots. Existing FEFO/alerts remain unchanged.

CLOUD TypeScript source: `web/src/lib/operational-rpcs.ts`. PostgREST calls must use the exact `p_` named arguments and send a stable UUID nonce per client action; never retry a failure with a new nonce without reconciliation.

## Feature flags and errors

`VITE_STAFF_APPROVAL_WRITES_ENABLED=false` and `VITE_INVENTORY_WRITES_ENABLED=false` by default. No UI success state before DB RPC success. The backend authorization applies regardless of flags and must remain effective if the frontend is compromised.

SQLSTATE `42501` denied role/branch/session; `22023` invalid fields; `23505` changed replay or unique product; `23514` expired/controlled lot or check violation; `40001` stale version. Treat all unknown failures as no persistence.

## Security acceptance matrix

| Actor | Request staff | Review staff | Inventory writes | Clinical / finance |
| --- | --- | --- | --- | --- |
| Verified owner-only | Yes, pending | Deny | Deny | Own owner/pet only; no finance |
| Pending staff | Repeat own pending | Deny | Deny | Deny staff |
| Administrator with branch | Deny self-elevation | Grant/revoke ONLY scoped branches and other users | Allow, noncontrolled | Existing separately authorized only |
| Receptionist with branch | Deny self-elevation | Deny | Allow, noncontrolled | No vet/finance |
| Veterinarian with branch | Deny self-elevation | Deny | Deny write; existing FEFO read remains | Clinical APIs per current rules |
| Accountant with branch | Deny self-elevation | Deny | Deny, including read | No inherited admin/vet/receptionist/finance |
| Revoked, unconfirmed, stale session | Deny | Deny | Deny | Deny staff |

**PG17 synthetic acceptance**: `supabase/tests/operational_staff_inventory_pg17.sql`, `.github/workflows/operational-staff-inventory-pg17.yml`. Checks verified pending/role-change/revoke/nonce grants, wrong-branch and self-promotion, receipt/FEFO balances, 0/positive/opening, duplicate and negative receipts, immutable direct-table denial, rollback, two-client serial receive and same nonce replay. All tests use disposable synthetic IDs; historical Dog/Chow Chow and unknown-branch appointment remain unchanged.

## Before owner-authorized staging or real data

Owner must approve full migration order, a verified backup and real restoration rehearsal, a real verified account (self-registered), an **explicit first-admin bootstrap** with user UUID + branch IDs, hosted negative JWT/session-revocation and cross-branch probes, product/expiry/supplier/controlled-drug policy, and FE/browser integrated persistence and restore. Do not activate production, import patient records, invite users, purchase services or send messages under this PR. No hosted Supabase verification is claimed.
