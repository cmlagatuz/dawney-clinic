# CLOUD — Staff approval and inventory operator UX

**Source-only frontend child of frozen PR123** (54ad3ccbc614d0c22ffb0acaa7624a7f28efc6d3). No real staff invitation, inventory seed, stock receipt, SQL/RLS change, flag activation, hosted data, deployment or merge.

## Real routes delivered

- /app/staff-access: authenticated self-registration/verification is REUSED, verified prospective staff can inspect existing server-asserted access, express an **unsubmitted** role interest and recheck. No pending request is falsely claimed; request status reader and submission writer do not exist. Accountant is explicitly distinct and unsupported, with no admin grant.
- /app/staff-management: administrator-only current verified branch assertion. The pending roster and approval/reject/role-update/revocation controls are visible as unavailable, NOT as a fake empty queue; no private roster is fetched without an approved backend reader.
- /app/inventory: currently authorized receptionist/administrator branches only, scoped draft Add Item and Receive Stock forms with local validation, product types medicine/consumable/supply, item code/description/unit/formulation/strength/reorder/supplier, optional controlled/refrigerated classification and lot/date/whole quantity. Existing pharmacy list/search/alerts/FEFO/movement read workspace is reused when its separate existing feature flag is deliberately enabled. Save, edit and receive never call an unapproved writer.

All routes use current Auth Guard. They clear stale data on account/branch change and revalidate on focus/refresh. New staff-nav links require independently asserted active branch; direct URLs do not authorize anything. Feature-OFF is unchanged: existing VITE_PHASE5B_PHARMACY_UI remains OFF and new mutation capabilities are compiled false. Local form validation cannot prove an item exists or that a stock transaction was accepted.

## Frontend/API compatibility matrix

| Workflow | Reviewed source backing | Working frontend | Missing ASTRA contract |
| --- | --- | --- | --- |
| Sign up, verify, sign in | GoTrue via existing AuthPages/AuthProvider | Fully reused; no role metadata as authorization | Hosted JWT/verification UAT separately authorized |
| Staff branch membership | staff_memberships, staff_branch_memberships, assert_staff_branch | Verified current access and private nav | Staff self-request/own pending status, admin pending roster with scoped RLS |
| Admin staff management | Current admin branch verification only | Authorized admin UI, disabled actions | Audited atomic approve/reject/update/revoke; owner-approved first-admin bootstrap; accountant distinct least-privilege role |
| Medicine list, low-stock, FEFO and movements | Read-only proposed migration #15 and existing inventory/port.ts | Existing PharmacyPage reused behind feature flag; no cost SELECT | Hosted rollout and JWT/RLS/Storage negative acceptance |
| Add item (medicine/consumable/supply) | No accepted catalog mutation or non-drug schema | Item editor/validator, Add Item unavailable | Branch-scoped item create/update API; UUID and revision readback; unique code/unit/category and controlled-drug policy |
| Receive 10 units and reconcile | No accepted atomic stock writer; immutable ledger structural constraints only | Receipt lot/quantity/expiry validator, Receive Stock unavailable | Transactional receive with idempotency event UUID, row locking, lot and quantity checks, immutable ledger event and exact readback |

No RPC name in this document or UI is callable by the current frontend. Backend must publish exact typed signatures only after review; CLOUD must then bind these pages to approved adapters and convert an action to enabled only after authorization, atomic persistence, retry/readback and negative tests.

## Mandatory future backend contract requirements

A. Staff request: one verified nonanonymous Auth subject, pending/rejected/approved state machine, immutable submission/decision audit, duplicate nonce prevention. Staff can't self-grant. Admin reader must scope to asserted active admin branch; approvals and revokes independently revalidate current role, target subject, branch, version and active state; no service key in browser. Accountants must be a distinct staff role with RLS and no inherited administrator, medical or financial access.

B. Inventory: catalog item ID, type, code and stock unit, immutable actor/branch and audit; bounded staff reader with categories medicine/consumable/supply; atomic receipt request ID, branch, item UUID, lot, supplier, received/expiry date and positive whole unit quantity; single DB transaction inserts an immutable movement and updates one batch. Replaying same ID+payload must return original event, changed payload must conflict; timeout requires server event lookup before retry. Controlled meds and expired lots fail closed. No direct browser INSERT/UPDATE/DELETE, no item balance computed from unsaved local forms. Exact paid/financial values remain unavailable.

## Source and tests

Baseline: 259/259 exact-head PR123 Node plus local Chromium tests passed in its prior CI. New tests: web/tests/staff-inventory-operator.test.mjs (8 pure/source tests) and web/tests/staff-inventory-operator.browser.test.mjs (3 localhost Vite+Chromium browser tests using intercepted synthetic HTTP). The inherited workflow will run Node, TypeScript, Vite and real Chromium; see child PR for **actual** exact-head outcomes rather than assuming success. No Playwright/PG17 full-tree pin is changed.

Future owner-authorized hosted synthetic UAT: self-sign-up/verified request -> pending ID -> trusted first admin -> scoped approval/rejection/revocation -> receptionist create SKU -> receive 10 units in single lot -> reload sees 10 plus exactly one immutable movement -> same nonce lost-ack replay still 10 -> wrong branch, accountant, unconfirmed and revoked denied -> rollback/restore hash parity.

**One next owner: PROJECT MANAGER** to coordinate ASTRA's independently reviewed secure staff/stock API, then SOL/Qwen exact-head source and hosted synthetic acceptance. Signed **CLOUD**.
