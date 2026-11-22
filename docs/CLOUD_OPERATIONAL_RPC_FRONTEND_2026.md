# CLOUD — Operational staff/stock RPC frontend integration

**Source stage:** One DRAFT frontend-only child of frozen PR125 \`226abbca830212f298f5849dac2229b89971deb2\`. Exact ASTRA contract PR126 \`fd91f7b0e60408764a507df4e1c7efbbd707e5b2\` at \`web/src/lib/operational-rpcs.ts\` blob \`010c4662aefe5cfafd5327878311a48bba1cfeca\` and \`docs/STAFF_INVENTORY_OPERATIONAL_CONTRACT.md\` blob \`1dcb3132b2f42f1a82b4bdb7f08964bd91912219\`. **PR126 is not in this frontend ancestry and still needs independent SOL approval.** No SQL/RLS/migration/backend source copied.

## Frontend-only interface and exact published wire names

ASTRA's exported types remain canonical; this PR has a temporary exact wire-shape declaration at \`web/src/operational/contract.ts\`, runtime envelope validation at \`model.mjs\` and a real authenticated Supabase PostgREST invocation adapter \`port.ts\`. No credentials beyond the existing publishable Auth client. **When ASTRA creates unified RC0**, replace these local type aliases with imports from ASTRA's \`web/src/lib/operational-rpcs.ts\` and preserve route/component behavior. Do NOT merge the two branches by copying the backend SQL or rewriting the canonical ASTRA file.

| RPC (all source-only, proposed hosted deployment) | Exact client parameters | Response required for UI |
| --- | --- | --- |
| \`request_staff_access\` | \`p_branch,p_note\` | \`staff_request\`: pending, revision, branchId; then \`get_my_staff_access\` confirms pending |
| \`get_my_staff_access\` | no args | \`my_staff_access\`: none/pending/approved/rejected/inactive/revoked; role and effective branches |
| \`list_staff_access_requests\` | \`p_branch\` | \`staff_requests\`: branchId, items: userId/requestedBranchId/state/revision/requestedAt/reviewedAt |
| \`review_staff_access\` | \`p_target,p_action,p_role,p_branches,p_expected_revision,p_request_id\` | \`staff_review\`: role, branches, revision, state; reload roster before success |
| \`create_branch_inventory_item\` | \`p_branch,p_request_id,p_product_code,p_name,p_description,p_category,p_unit,p_formulation,p_strength,p_reorder_point,p_lot,p_expiry,p_supplier,p_opening_units\` | \`inventory_item\`: itemId/branchId/code/category/unit/revision/onHand/batchId; follow with existing scoped catalog and exact balance |
| \`receive_branch_inventory_stock\` | \`p_branch,p_medicine,p_request_id,p_lot,p_expiry,p_supplier,p_quantity\` | \`stock_received\`: actorId/batchId/itemId/eventId/receivedUnits/lotOnHandUnits; reread balance and \`stock_movements\` exact event |
| \`edit_branch_inventory_item\` | \`p_branch,p_medicine,p_expected_revision,p_name,p_description,p_reorder_point,p_expiry_warning_days\` | \`inventory_item_updated\` with revision and fields; check new rule, profile and current balance; no blind CAS retry |
| \`get_branch_inventory_balance\` | \`p_branch,p_medicine\` | \`inventory_balance\`: id/revision/onHand/available/reserved/quarantined; server-proven, not local mutation |

**Write gating:** \`VITE_STAFF_APPROVAL_WRITES_ENABLED\` and \`VITE_INVENTORY_WRITES_ENABLED\` must be **explicitly \`true\`** AND backend applied/reviewed to be callable; default is OFF. The independent prior \`VITE_PHASE5B_PHARMACY_UI\` stays OFF. No preview-mode impersonation, local fake writes, auto first-admin, app user_metadata role, unapproved API, service_role or provider SQL. The operator read adapter reuses the existing scoped \`createPharmacyPort\` reader, and the readback reads cost-free public branch \`branch_medicine_rules\`, validated \`stock_movements\` and real RPC balance under live \`assert_staff_branch\`; browser does not change tables.

## Working journeys once owner enables *reviewed and hosted* operations

1. **Signup → verify → staff request:** GoTrue Auth routes unchanged. Verified nonstaff member selects a clinic branch from public \`clinic_branches\`; optional note is submitted, **desired role stays a visual preference and is not sent to RPC**. Pending appears only after the server returns \`pending\` and a fresh own-status RPC agrees. Pending/approved/revoked account is never given privileges from its own request.
2. **Administrator review:** fresh branch role \`administrator\` asserted by backend; read roster is branch scoped, response has no applicant email. Review uses selected user/revision, exact allowed action and selected administrator-owned branches. Branch/role are NULL for reject, inactivate and revoke. Response must match fresh roster row; caller's admin branch is reasserted. Accountant is distinct and receives no inherited staff, clinic, inventory or finance navigation.
3. **Add Item:** receptionist/admin chooses the actual permitted branch; enters medicine/consumable/supply category, product code, name, description, unit, formulation/strength where applicable and reorder point. Current source does **not** accept controlled-drug or refrigeration policy fields; selecting either blocks write rather than silently dropping the classification. Supplier without opening stock is only passed to RPC but **not claimed to be stored with a batch**. Item is created with \`p_opening_units=0\` (stock is received separately), then catalog+branch rule+balance are re-read before saved status.
4. **Receive ten units:** select an existing branch-configured, server-read item UUID (never arbitrary code→ID), lot and expiry, supplier and 10 whole units; received day is a validated branch-local server date, not arbitrary historical date. Generate **one UUID per action**; if ACK or readback is uncertain, retain frozen original payload and UUID for retry. A successful response needs matching actor, branch, item, receipt event, exact quantity and batch \`after_on_hand\` on a separately authorized stock ledger read plus updated balance; no optimistic increase. Same nonce replay can never display 20.
5. **Edit branch item:** \`p_expected_revision\` from server balance, current profile fields fetched under branch auth, only display/name/description/reorder/warning changed. Server must return revision+1, and a new rule/profile/balance must agree. This RPC has no idempotency nonce: on timeout, do not blindly retry; reconcile first.

## Fail closed and limitations

- Owner, unconfirmed, wrong branch, veterinarian, revoked and accountant accounts have no inventory writer or administrator roster. Only server-proven admin branches are offered for review; server itself rechecks every affected branch.
- Error mapping: \`42501\` denied/recheck; \`22023\` field invalid; \`23505\` idempotency/code conflict; \`23514\` rejected stock/state; \`40001\` stale revision; \`PGRST202\` missing RPC; network/unknown = **uncertain**, preserve original request UUID and fields, never show success.
- Catalog and branch-rule source readers are bounded to 100; if a new item is beyond that window, success stays unconfirmed rather than assuming full visibility. Item category may read as a generic medicine label in inherited pharmacy view until ASTRA accepts category display improvements. The exact stock event is verified by existing \`stock_movements\` SELECT rather than a fabricated endpoint.
- An uncertain tab close or browser reload loses the in-memory nonce: before creating a new stock receipt, re-check the server's item balance and immutable movement history. A durable user-authorized recovery journal would need separate security/privacy review. No such feature is silently created.
- **No hosted persistence evidence.** Source PR126 still requires SOL security acceptance, ASTRA exact full-tree/PG17 source-pin integration, verified backup/restore, owner-approved disposable hosted Auth JWT/session/RLS acceptance, and a staged 10-unit event proof. First admin still requires individually owner-approved trusted bootstrap. No real accounts, inventory, patients, import, deployment or spend authorized.

## Test evidence

Inherited PR125: 270/270 Node+real local Chromium synthetic tests, 4/4 CI. New: \`web/tests/operational-contract.test.mjs\` (8 exact field/error/response and no-escalation tests), \`web/tests/staff-inventory-operational.browser.test.mjs\` (real localhost Vite Chromium using \`fixtures/operational-http.mjs\` synthetic PostgREST: signup/pending/readback, admin approve/revoke/accountant, receptionist Add Item/Receive 10/refresh, exact lost ACK idempotency, denied/revoked/wrong branch, 360/768/1440 light/dark, keyboard, network error). Exact head CI status must be recorded on PR after GitHub Actions actually finishes. Synthetic fixture storage is test-only and does not attest managed Supabase persistence.

## One next owner

**ASTRA via Project Manager** — merge only independently SOL-accepted PR126 source into one unified RC0 with this frontend child using reviewed shared type imports and exact source integrity gate pins; run complete PG17, Chromium, Auth/RLS and signed recovery. Then Qwen independent functional QA and owner-authorized hosted synthetic acceptance. Preserve unchanged historical Dog/Chow Chow and appointment. No self-merge.

Signed **CLOUD**.
