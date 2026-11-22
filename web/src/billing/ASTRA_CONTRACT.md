# CLOUD -> ASTRA: Billing and receipts backend handoff

Status: PROPOSED ONLY. No authorized finance/owner invoice readers, pricing policy,
tax rules, payment processing, receipt series or finance migrations are integrated
at PR #108. The historical Laravel orders/lines are not an audited payment ledger.

## RLS identity, privacy, branch scope

- Staff: server verifies signed JWT and confirmed active identity, current active
  global staff membership and active membership in the requested clinic branch;
  Finance and the human owner must approve the least-privilege read/write role
  matrix for administrator, veterinarian and receptionist separately. A role that
  reads appointments does NOT automatically earn read access to paid amounts.
- Owner: server derives actual owner id exclusively from verified auth.uid()
  relationship, not browser-supplied ownerId, user metadata, route, or JWT
  custom claim. Every invoice, line, payment and receipt must bind to the same
  owner; deny other owners without an existence oracle.
- Branch: invoice.branch_id must match selected authorized branch and the
  appointment/pet/owner link must be established by server. Unknown historical
  branch attribution blocks finance publication, never silently assigns Naga.
- Least-privilege RLS for every parent and child row including receipt storage.
  Never select inventory unit_cost_minor, procurement costs or supplier costs;
  patient medical details and other-owner amounts are confidential.
- Server reauthorizes after reads to detect revocation during slow queries.

## Proposed typed read functions: NOT deployed

- Staff list: list_staff_branch_invoices(p_branch uuid,p_after cursor|null,
  p_limit integer <=100): {items:InvoiceHeader[],hasMore:boolean,next_cursor?:string}.
  Must return a stable DESC(created_at,id) page and 101st-row sentinel for
  accurate hasMore; never fall back to unscoped global SELECT.
- Staff detail: read_staff_branch_invoice(p_branch uuid,p_invoice uuid):
  {header:InvoiceHeader,lines:InvoiceLine[],payments:Payment[],receipts:Receipt[]}.
  All child arrays must be truly complete or carry cursor/hasMore; no false empty.
- Owner list and detail: list_own_invoices(p_after,p_limit<=50) and
  read_own_invoice(p_invoice uuid); owner identity is derived on server.
  Only owner-approved, legally publishable statuses can be returned.
  Receipt downloads must independently reverify owner+invoice+payment+receipt,
  use short-lived signed private Storage URLs, and obey privacy/retention policy.

InvoiceHeader provisional fields: id,branch_id,owner_id,pet_id,appointment_id|null,
invoice_no,kind,status,created_at,currency_code,minor_scale,
totals:{subtotal_minor,discount_minor,tax_minor,total_minor,paid_minor,
refunded_minor,balance_minor}. All money safe integer minor units from server.
InvoiceLine provisional fields: id,invoice_id,category,description,quantity,
unit_label,unit_price_minor|null,line_total_minor. Categories include service,
medication, fee, adjustment; client must never infer medication retail price from
inventory unit acquisition cost. Payment: id,invoice_id,occurred_at,
amount_minor,status,method_label. Receipt: id,invoice_id,payment_id,receipt_no,
issued_at,amount_minor. All references must be validated and scope-bound.

Status proposals (not clinic-approved): invoice draft/issued/paid/voided/refunded,
kind estimate/invoice, payment pending/settled/reversed. ASTRA and Finance must
review/version the enums before API publication. A payment attempt is NOT a
settled payment, and an estimate is NOT a final invoice.

## Financial truth and policies

- Confirm clinic-approved fee schedule, pharmacy retail tariffs, transaction
  currency/scale, discounts, rounding, tax/exemption jurisdiction, refund and
  cancellation policies. No VAT %, FX rate or tariff can be assumed from
  legacy paid_price/total_price.
- Calculations, allocation, reconciliation, status transitions and rate version
  are server-owned ACID operations. Client may only format returned approved
  money and display server status; never derive paid from a booking request.
- No checkout/payment gateway is selected or assumed. Any future payment
  processor integration needs signed webhook verification, replay protection
  and asynchronous settlement/reconciliation.

## Proposed write actions: ALL DISABLED in CLOUD frontend

Separate reviewed, branch-scoped, server-authorized transactional functions for:
create estimate, issue/finalize invoice, apply adjustments, record/reconcile
settled payment, void, refund, generate receipt, render/download and send invoice.
Every action must have immutable ledger/audit append (actor, branch, UTC time,
reason, pre/post revisions, monetary deltas), explicit transition rules,
expected invoice revision and optimistic conflict handling, row-level locking
for competing payment/refund requests, and idempotency key bound to signed
actor+branch+invoice+payload hash. Identical retries replay exactly the same
result; mismatched payload nonce conflicts. Receipt/invoice numbering must be
allocated atomically per approved legal sequence and cannot be guessed by the
client; void/reprint history retained. No direct browser table UPDATE.

## Delivery and verification gate

ASTRA owns separate backend migration, typed readers, revocation/RLS/owner A/B
and branch Naga/Cavite negative tests, payment race and double-charge rejection,
signed hosted JWT acceptance, recovery and independent SOL audit. Qwen runs
real UI functional review. Human Project Owner approves clinical finance policy
and deployment. CLOUD production billing adapter currently verifies staff
membership/branch then throws BILLING_READER_NOT_INTEGRATED, with ZERO finance SQL
and ZERO financial writes. Owner billing route displays unavailable without
calling any financial endpoint. VITE_PHASE5C_BILLING_UI remains OFF.
