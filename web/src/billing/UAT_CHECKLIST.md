# Dawney billing client-facing UAT checklist (source-only release proposal)

Labels: SOURCE = inspected source, SYNTHETIC = intercepted offline Chromium only,
HOSTED = real signed Auth/RLS/Storage acceptance not performed. No clinical
financial acceptance or payment is claimed.

- [ ] Owner A signs in; sees only server-published invoices bound to owner A.
  Owner B and anonymous cannot read Owner A invoice, receipt or print URL. HOSTED
- [ ] With no owner financial reader, My invoices displays clear unavailable
  state, not a "zero balance", paid claim or sample receipt. SOURCE/SYNTHETIC
- [ ] Naga-only active staff sees only Naga; Cavite selection is not offered. HOSTED
- [ ] Staff with Naga+Cavite grants chooses one explicitly; branch switch clears
  prior invoice list/detail/payment/receipt before fetching new branch. SYNTHETIC
- [ ] Revoked, inactive, wrong-account and expired staff members have no data;
  retry checks fresh membership and no previous amount flashes. SYNTHETIC/HOSTED
- [ ] Verified successful empty read says "no invoices in verified read", not
  "no money due"; unavailable/403/offline/malformed states are distinct. SYNTHETIC
- [ ] Invoice and estimate numbers, statuses and appointment/pet references
  only from scoped server row; no patient name or owner medical details inferred. SOURCE
- [ ] Approved itemization distinguishes services, medication retail items,
  fees, adjustments, signed units/prices, taxes and discounts with server
  currency and decimal scale, never inventory purchase cost. SYNTHETIC/HOSTED
- [ ] Server approved total, paid/refunded and remaining balance reconcile.
  No client invented currency, tax %, price, payment/receipt status. SYNTHETIC/HOSTED
- [ ] Receipt sequence, issue time, payment linkage and optional receipt URL
  are immutable/audited, and unauthorized downloads are denied. HOSTED
- [ ] Payment history distinguishes pending/settled/reversed and does not
  show "paid" merely because a browser form was submitted. HOSTED
- [ ] Filters and search apply only to verified loaded rows, and the 100/101
  hasMore boundary is explicitly shown with incomplete-count warning. SYNTHETIC
- [ ] Keyboard Tab/ArrowUp/ArrowDown/Home/End, screenreader labels,
  focus indicators, high contrast and 360/768/1440px light/dark no overflow. SYNTHETIC
- [ ] Create estimate/invoice, finalize, record payment, void, refund, export,
  send receipt, online pay and download controls remain disabled. SOURCE
- [ ] Browser records zero finance-table writes, payment calls, messages,
  unauthorized owner queries, or purchase-cost fields. SYNTHETIC
- [ ] Human clinic owner approves price/tax/refund/receipt policies; SOL and
  ASTRA verify real JWT/RLS/Storage/payment reconciliation and backup/restore.
  HOSTED / HUMAN APPROVAL

**Release NO-GO:** Billing flag OFF. No finance API, confirmed pricing,
tax/currency policy, audit/receipt-numbering contract, real payment processor,
signed hosted financial negative tests or customer UAT approval exists.
