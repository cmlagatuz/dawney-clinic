# Phase 1 — Legacy Laravel Audit and Modernization Gates

2026-11-13 | Lead: ChatGPT GPT-6 Astra | Source baseline: master @ da7f7cc25c25575b4c4deef231feedaa9e982e1c

**Audit type:** static source review. No production Laravel runtime, clinical database, or live website verified. All existing code and data remain preserved.

## Architecture decision (proposed)

Keep the Laravel/MySQL repository intact as a migration reference. Develop an isolated React + TypeScript + Vite client on Cloudflare Pages Free, with Supabase Free Postgres, Auth and private Storage, plus narrowly scoped Edge Functions only when needed. A static host **cannot run Laravel/PHP**. Do not copy secrets or service-role keys into the browser; RLS is mandatory on every exposed table. Final data migration, live cutover and deletion require an owner-approved, tested backup and rollback.

The connected Supabase project named Dawney Animal Clinic Veterinary System was confirmed ACTIVE_HEALTHY on 2026-11-13, Postgres 17; the public schema currently contains **zero** application tables and security advisors reported zero current lints. No schema writes were made. Empty-schema lints are **not** proof of future app security.

## Source coverage and feature-parity inventory

Reviewed: complete repository tree, Laravel routes, all controllers (admin, appointment, user, auth), auth middleware, all Eloquent models, ten DB migrations, Composer/NPM manifests, configuration, legacy tests and representative public/client/admin Blade layouts. A full end-to-end visual/runtime audit remains pending.

| Area | Existing implementation | Reuse and modernization requirement |
| --- | --- | --- |
| Landing | Public home/Blade | Branding, responsive navigation |
| Auth | Laravel login, register, email verification, reset | Supabase Auth onboarding/invites and verified sessions |
| Owner accounts | User plus Owner records, admin CRUD, profile/password | Owner identity/contact, explicit roles, privacy |
| Pets | Owner's pet CRUD and detail views | Keep pet fields, lineage and owner relationships |
| Medical records | Procedure, temperature, weight, comments | Preserve history; add encounters, units, authorship/audit |
| Booking | 16 half-hour slots, 08:00-12:00 and 13:00-17:00, Sunday closed, 5 concerns + Other | Calendar, scheduling, clinic timezone, atomic conflict handling |
| Admin | Upcoming appointments, users, patients, medical notes | Accessible dashboard, staff roles and verified persistence |
| Reminders | Paid Nexmo SMS after booking and via admin GET | In-app/ICS or verified free email alternative |
| Inventory | Product and stock models/controllers/views | Historical mapping; stock ledger and safety gates |
| Orders | Order, line items and purchase code/views | Historical mapping; invoice/receipt workflows |
| Inventory and order routes | Commented out | Keep disabled until safe redesign |
| Vaccination, prescription, reporting/audit trail | No complete features found | Later staged implementation, not declared operational |

### Ten legacy migrations and proposed mappings

| Legacy table | Modern target | Preservation requirement |
| --- | --- | --- |
| users, password_resets | auth.users + profiles | UUID re-onboarding, unique legacy ID map; no plaintext credentials/hash copying |
| owners | owners or owner_profiles | Legacy owner ID and contact mapping |
| pets | pets | Legacy pet ID, owner FK, species/gender encoding, DOB |
| pet_records | clinical_records, later encounters | Original note text, measurements, timestamps |
| appointments | appointments | Start/end, concern text/code, user/pet link and timezone |
| products | inventory_products | Old prices/quantities; currency/precision clarified |
| product_stocks | inventory_movements or stock_lots | Reconcile physical balance and historical totals |
| orders, order_products | invoices/lines or legacy imported orders | Reconcile total_price and paid_price before migration |

Legacy numeric foreign-key fields are **not declared** as foreign-key constraints, and owners.user_id lacks a unique constraint. Data mapping requires exports, stable legacy-ID -> UUID map, orphan/duplicate detection, count/relationship reconciliation, timezone and attachment checks, private temporary fixtures, two-account security tests, backup restore rehearsal and a reversible cutover. Owner passwords require secure reset/invite onboarding rather than assumed hash compatibility.

## Source security findings

**Critical**
1. UserController::viewAppoint uses an unrestricted appointment ID and reveals associated owner details to another authenticated user. Patch on Phase 1 branch scopes by auth account; regression test added.
2. AppointmentController::store trusts arbitrary pet_id; cross-account pet booking was possible. Patch adds owner-scoped exists validation plus scoped lookup.

**High**
3. Server-side overlap rejection is commented out; client checkDate alone cannot prevent duplicate/concurrent bookings. Implement atomic overlap protection with DB-level constraints/locking and multi-session tests in Stage 2.
4. Unbounded hour input accesses an array index; concern input later indexes a fixed list. Phase 1 patch validates hour [0..15] and concern [1..5,10]. Check clinic timezone, DST and Sunday handling.
5. Admin appointmentRemind uses GET for a chargeable Nexmo send. Make authorized CSRF-protected POST; remove paid-SMS requirement. Booking sends SMS *after* saving, risking partial success on provider failure.
6. AdminController::patientCreateStore emails a generated plaintext password. Replace with invitations/reset and transactional account provisioning.
7. Laravel 5.8, PHP 7.1-era packages, Vue 2 and older CDN scripts are out of support. Do not expose unsupported legacy runtime as the final production system.

**Medium**
8. No DB FK, appointment uniqueness or audit metadata. Define safe constraints only after data reconciliation and explicit retention rules.
9. AdminController::patientUpdatePost passes unfiltered request values to Pet::update, allowing owner_id assignment as an incidental form field; use explicit validated allowlist.
10. Disabled purchase implementation has no transaction, inadequate quantity/stock checks, null stock dereference and miscomputed order line total_price. Never reenable unchanged.
11. Dashboard groups by day-of-month, so different months can be merged. Group by ISO full date.
12. Appointment concern accessor/user view can index unknown concern codes rather than safely displaying "Other" text.
13. Boolean admin roles and special-case user ID 1 lack staff-level permissions. Role changes must be trusted server-side, not editable JWT user_metadata.
14. Only example PHPUnit tests existed at baseline; app behavior, accessibility, cross-browser and client/server persistence are not currently verified.

These are source findings, **not** claims of exploitation or comprehensive dynamic penetration testing.

## Free-only architecture verified 2026-11-13

| Service | Quota | Caveat |
| --- | --- | --- |
| Cloudflare Pages Free | 500 builds/month, 1 concurrent build, 20-minute build timeout | Static SPA, NOT PHP; GitHub deployments can be connected |
| Supabase Free Postgres | 500 MB DB/project, up to two free active projects | May pause for low activity after ~7 days; no always-on SLA |
| Supabase Auth Free | 50,000 MAU | Email has provider-specific free/rate limits |
| Supabase Storage Free | 1 GB files, 50 MB max file upload | Private bucket and access policies mandatory |
| Supabase Edge Functions Free | 500,000 calls/month | Keep privileged actions narrow and server-only |
| Supabase egress Free | 5 GB/month | Monitor usage; do not enable paid overages |
| Backups | Manual exports and restore rehearsals | Free tier does NOT include automatic backups or PITR |
| URL | Provider-assigned pages.dev | No domain purchase required |

Official references:
- https://supabase.com/pricing
- https://supabase.com/docs/guides/platform/billing-on-supabase
- https://supabase.com/docs/guides/platform/free-project-pausing
- https://supabase.com/kb/faqs/platform/free-plan-backups
- https://developers.cloudflare.com/pages/platform/limits/
- https://supabase.com/docs/guides/database/postgres/row-level-security

$0 recurring cost is viable for development or pilot at small scale; it cannot guarantee high-availability clinical production or managed recovery. No mandatory SMS or payment gateway.

## Authorization and functional acceptance criteria

Anon: no clinic PII or private file access. Client: own profile/pets/appointments and permitted records only; may book own pet; cannot create clinical notes/change roles/prices. Staff/reception/vet: only allowed clinic functions with author and audit. Admin: authorized role changes and settings. RLS enforced for every exposed table with ownership predicates and UPDATE WITH CHECK, not solely TO authenticated; private storage and validated file paths. Test both user A and B, anonymous callers, forged owner/pet IDs, role revocation, expired tokens and RLS-advisor output. No service_role in frontend.

## Modernization stages (each requires an exit gate)

1. **Phase 1 baseline:** audit/parity, fix cross-account exposures and input bounds, add tests and PHP syntax CI, document limitations; PR review before merge.
2. **Data and RLS contract:** backup/export legacy MySQL, reconcile records, define entities/roles, create versioned Supabase SQL migrations, test deny/allow policies with two real test users, verify restoration and advisors.
3. **Modern frontend foundation:** add separate web/ React/Vite/TS app, accessible layout and dark/light modes, Supabase auth guards and real persisted profile.
4. **Core parity:** owner/pet management, appointments/calendar with race-safe nonoverlap, records and encounter history; migration fixture checks.
5. **Clinic operations:** vaccines, prescriptions, in-app reminders, inventory stock movements, invoices/receipts, reporting, exports, audit trail.
6. **Pilot and cutover:** redacted migration rehearsal, restore drill, GitHub-linked Cloudflare Free deployment, live role/persistence tests and owner sign-off.

No existing code removed, existing DB changed, credentials moved, inventory routes enabled or hosting deployed as part of Phase 1.

## Dual-AI ownership and blockers

ChatGPT owns PHP controllers, security tests, architecture, Supabase contracts/migrations, CI and release. Branch: ai/chatgpt/phase1-audit-security.

Claude owns only UI screen parity/design and accessibility component inventory, publishing docs/UI_PARITY_AND_DESIGN.md through ai/claude/phase1-ui-inventory and a review PR. **Do not edit** backend, schema or this audit. Review PR with ChatGPT before merge.

GitHub Issues API currently responds HTTP 410, "Issues has been disabled in this repository"; owner may enable repository Settings > General > Features > Issues. Until then task claims live in the handoff and PR descriptions.

**Verification:** PHP dependency runtime/Composer not available in this execution environment; static CI added, PHPunit regression suite written but not run. Supabase project healthy, application public tables empty, no migrations executed. No Cloudflare connection/live URL verified.
