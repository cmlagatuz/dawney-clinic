# Phase 4 clinical architecture — legacy parity, staff role decisions and real API contracts

**Backend planning + limited live-read adapters only.** No staff accounts created; no clinical encounters, vaccination/prescription/inventory/billing tables created by Phase 4 P0 migration. Existing six applied migrations and patient/appointment records are preserved. This document does **not** authorize clinic go-live.

## Audited legacy routes and current Supabase parity

The checked-in Laravel 5.8 `routes/web.php` contains owner appointment create/check/list/detail, owner patients/detail/record-view, owner settings, and administrator dashboard, appointment list/detail/reminder, users list/update/create patient and patient create/update/record create/view. Legacy inventory, purchase and order routes are **commented out** but models/migrations exist: `Product`, `ProductStock`, `Order`, `OrderProduct`. Do **not** present those as actively serving clinical functionality. Baseline Supabase has `owners`, `pets`, `appointments`, `appointment_events`, `appointment_resources`, `clinical_records`, `staff_memberships`; Phase 4 adds catalog and attachment metadata after controlled migration.

| Legacy capability | Current state | Required backend next step |
| --- | --- | --- |
| Owner pet/appointment lists | Actual Supabase adapter + RLS; existing data | Preserve, add catalog, photo/card metadata and approved booking policy |
| Admin appointments/user/patient lists | Legacy Blade only; no working React staff workspace | New `web/src/lib/staff-clinic.ts` read-only staff RLS adapters, then Claude role-aware views |
| Admin patient record create/view | `clinical_records` table with veterinarian/admin INSERT permission; no modern encounter flow | Patient encounter aggregate, author audit, history, diagnosis/procedure codes and read-only owner summary |
| Admin dashboard | Legacy dashboard | Actual count queries from staff RLS, never placeholders/fake KPIs |
| Inventory/purchases/orders | Historical tables/models, routes commented out | Future atomic stock transactions and invoices; do not activate legacy money flows directly |
| Vaccinations/medications | No authoritative modern tables | Reviewed clinical record contracts, inventory/lot/expiry linkage, reminders and signed audit |
| Staff invites, MFA and access | Private staff helper and RLS audit exist; zero active members at checkpoint | Owner-controlled step-up MFA, approval/audit and revocation; no ordinary browser privilege grants |

## Staff role permission contract — actual applied DB takes precedence

| Function | Owner | Receptionist | Veterinarian | Administrator |
| --- | --- | --- | --- | --- |
| Read own owner/pet/appointment data | Own only | Staff read per existing RLS | Staff read per existing RLS | Staff read per existing RLS |
| Read patient clinical history | Own animal records per RLS | Existing RLS permits staff read | Read | Read |
| Create/edit patient demographic data | Own | Existing RLS permits | Read only under current pets UPDATE grants/policy | Staff may update |
| Change appointment lifecycle | Owner cancel only | Staff transitions permitted | Staff transitions permitted | Staff transitions permitted |
| Create `clinical_records` | No | No | Yes (Auth/RLS enforcement) | Yes |
| Insert clinic-scoped documents | No | No | Yes (private Storage RLS) | Yes |
| Read clinic-scoped documents | No | Existing Storage staff SELECT allows | Yes | Yes |
| Assign staff / break-glass | No | No | No | Trusted operator only, not a browser RPC |
| Vaccinations/prescriptions/stock/billing | Not implemented | Not implemented | Not implemented | Not implemented |

**Important detail:** current `public.pets` RLS update roles include receptionist/admin and owners, not veterinarian; the UI may not assume veterinarians can edit demographics. Existing `clinical_records` RLS permits receptionist read. Any narrower clinical privacy requirement needs an approved *new* migration, not fake frontend checks.

`verifiedStaffSession(user)` checks live `auth.getUser` and active `staff_memberships`. `listClinicPatients(user,offset,limit)`, `listClinicQueue(user,fromUtc,toUtc)`, `listClinicClinicalRecords(user,petId)` and `getClinicDashboardCounts(user)` query actual DB/permissions and **error if not authorized**. Queue requires externally approved UTC bounds and refuses arbitrary device-local time. All counts are derived from real rows; null service errors are not disguised as fake statistics. These functions do not grant roles or create patient data.

### Proposed staff roles, not an automatic migration

Actual DB roles: `administrator`, `veterinarian`, `receptionist`. **Veterinary nurse/technician is not authorized**, so no role has been added. If approved later, define `veterinary_nurse` role separately and review all staff role checks, Storage policies, clinical note signing permissions, medication administration approvals, UI affordances and audit before enabling.

## Planned clinical data model contracts (NO tables applied yet)

These are design candidates to be versioned, reviewed and tested in separate P1/P2 PRs. All references use immutable UUIDs, owner/pet foreign keys and timestamps UTC; never trust client-supplied actor IDs or diagnosis authorship.

| Entity | Required fields and relationships | Invariants/security gate |
| --- | --- | --- |
| `clinical_encounters` | `id`, `pet_id`, `appointment_id?`, `attending_vet_id`, `opened_at`, `closed_at?`, `chief_complaint`, `status` | Vet assignment verified, staff-only mutation, signed/closed encounters immutable except audited addenda |
| `encounter_observations` | `encounter_id`, observation code, unit, value, observed_at, author | Controlled numeric ranges, units, append-only corrections |
| `diagnoses` | `encounter_id`, structured code/label, priority, vet actor, review status | No invented codes; typed medical terminology and provenance required |
| `vaccination_events` | `pet_id`, `encounter_id?`, product ID, lot, administered_at, due_at?, vet actor, certificate attachment ID? | Validate lot/expiry, dosage and contraindications, correction audit |
| `prescriptions` + `prescription_items` | `pet_id`, `encounter_id`, prescribing veterinarian, medicine, quantity, dose, route, frequency, duration, signed_at | Immutable signed orders, regulated prescribing rules, no owner self-service issuance |
| `inventory_items`, `stock_lots`, `stock_movements` | SKU/category/unit, lots/expiry, warehouse, in/out/adjustment quantities, actor/transaction | Server-side atomic stock calculation, race-safe depletion and nonnegative inventory, controlled override audit |
| `invoices`, `invoice_lines`, `receipts` | owner + encounter/appointment, itemized amounts, taxes/currency, status, receipt method | Decimal money not JS floats, immutability after issuance, idempotency and fully audited corrections |
| `clinical_audit_events` | entity type/id, operation, actor/approved_by, timestamp, before/after redacted diff, reason | Read protected, append-only and independent forensic retention |

Clinical notes, diagnoses, prescriptions and inventory amounts must be reviewed with an actual veterinarian and local clinical/regulatory requirements before adopting a schema. The application is single-clinic for now: do not inject guessed multi-clinic tenancy. Planned dashboard queries should call live RLS-protected views or server functions with explicit authorizer and zero-fabricated-data empty states.

## Staff adoption and QA-09 gates

- First verified admin bootstrap requires owner-approved operator, independently verified Auth identity and MFA. Never expose privileged SQL to the static SPA.
- Any role/invitation change requires separate actor/reviewer, reason code and audited transaction. Revocation must deny a stale access token at the DB RLS level; session revocation is a separate requirement. Tested offline policy contracts exist but real staff state is not verified.
- Claude should use the `verifiedStaffSession` adapter to show/hide staff navigation only after DB confirmation; hiding a menu **is not** authorization.
- QR/queue KPIs must reflect live appointment statuses and clinic-approved timezone. Existing 30-min booking UI and sample resource are not approved hours.
- No synthetic clinical writes, staff bootstrap, real prescriptions or monetary transactions authorized in this PR.

## Exact integration boundary with Claude

Claude owns page and layout implementation `web/src/pages/**`, `web/src/components/**`, `web/src/styles.css`, `web/public/brand/**`. Backend adapter contracts here are under `web/src/lib/` and do not import any UI components. Read data, display real empty/loading/error states, and respect `clinic_supported=false`. TypeScript build ensures signatures are available; visual UI/screenshot QA remains Claude's responsibility after merge.

**Release blockers:** migrate and test schema safely; live HTTP cross-owner/anonymous Storage denial with explicit synthetic-write owner permission; approved staff onboarding/MFA, medical policy, appointment hours, signed documents, full Auth+Storage backup restore and actual browser persistence.
