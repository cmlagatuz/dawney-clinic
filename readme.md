# Dawney Veterinary Clinic

**Veterinary clinic management system — modernization in progress**

> **Project status (13 November 2026): Phases 1–2 security foundations and Phase 3 React frontend, pet/appointment workflows, staff safeguards, private Storage RLS, and recovery tools are merged. Six Supabase migrations are applied. Real two-account Auth HTTP verification, clinical data migration, full backup/restore and deployment remain pending.** Not approved for real clinic records.

## Overview

Dawney Veterinary Clinic aims to provide a practical, secure, accessible, and responsive workflow for clinic administrators, staff, veterinarians, pet owners and patients. The project is modernizing an existing 2019-era Laravel application, preserving legacy data and useful behavior while planning a free-tier deployable architecture.

**Repository:** [cmlagatuz/dawney-clinic](https://github.com/cmlagatuz/dawney-clinic)  
**Default branch:** `master`  
**Collaboration:** ChatGPT GPT-6 Astra (architecture, security, backend, integration) + Claude Sonnet Free (UI/UX, accessibility, frontend), coordinated through GitHub.  
**Budget:** No paid backend, hosting subscription, mandatory payment API or compulsory purchase. Free service limits apply; no uptime or backup SLA is implied.

## Current implementation — distinguish existing code from planned features

The checked-in **legacy application** uses Laravel 5.8, PHP 7.1-era requirements, Blade, Bootstrap 4, Vue 2, Laravel Mix, and a MySQL database configuration. Because several dependencies are end-of-life, **do not publish the legacy PHP application as a production clinic system without appropriate security modernization**.

| Area | Current evidence | Status |
| --- | --- | --- |
| Login, registration and email verification | Laravel authentication routes and controllers | Legacy source present; production behavior not verified |
| Pet owner and user management | Existing users/owners models and admin workflows | Legacy source present |
| Patients/pets and clinical records | Models, views, controllers and migrations | Legacy source present |
| Appointments | Legacy create/list/detail flow; targeted owner-scoping and input validation fixes | Security fixes merged; conflict handling still needed |
| Admin dashboard | Legacy dashboards and patient/appointment views | Legacy source present; UI PR in progress |
| Inventory / purchasing / orders | Models, controllers and views present; main routes commented out | Disabled; not safe to enable unchanged |
| Modern Supabase-backed frontend | Standalone `web/` React/TypeScript/Vite with Supabase Auth, profile, pets and booking workflows; TypeScript/Vite CI green | Source implemented; real browser/API persistence checks and deployment pending |
| Supabase schema | Six applied migrations: 7 public RLS tables, staff audit, appointment lifecycle/overlap and private Storage object policies | SQL tests passed; live Auth and Storage API negative tests pending |
| Cloud hosting and live URL | Vite static build and Cloudflare Pages Free Git setup runbook | Not connected or deployed |
| Production backups, restore drill and cutover | GPG-encrypted app-schema export and archive-inspection tools merged | Mock tests passed; real export/complete Auth+Storage restore pending |

**Audit scope:** Source review and targeted regression tests, not a full browser-based security test or a validated production environment. Do not enter real clinic records into an unverified deployment.

## Progress and evidence

- **Phase 1 completed (2026-11-13):** [Legacy audit and modernization gates](docs/PHASE1_LEGACY_AUDIT.md), security hardening for patient appointment ownership and forged foreign-pet bookings, bounded booking inputs, regression tests and GitHub Actions legacy PHP checks.
- **[PR #2](https://github.com/cmlagatuz/dawney-clinic/pull/2):** Phase 1 merged to `master`; CI passed **5 tests / 11 assertions**, with PHP 7.4 and a compatibility install. See [the passing Actions run](https://github.com/cmlagatuz/dawney-clinic/actions/runs/43378768881). This is targeted coverage, not a guarantee of full-system correctness.
- **[PR #1](https://github.com/cmlagatuz/dawney-clinic/pull/1):** Claude's accessible UI foundation (dark/light mode, components, layouts, responsive styling) is **open and draft**. Blade view compile/render tests and frontend/legacy PHP CI passed on its branch; production browser/MySQL integration and lead review remain outstanding. After the Phase 2 merge, GitHub reports the PR as conflicted with updated `master`; it must be reconciled before merging. Do not describe it as merged or deployed.
- **Phase 2 foundation (2026-11-13):** [Supabase schema, security tests and recovery contract](docs/PHASE2_DATA_SECURITY.md), [Phase 2 PR #3](https://github.com/cmlagatuz/dawney-clinic/pull/3). Two migrations applied, RLS and appointment overlap constraint verified with rollback-only test fixtures. Real Auth login/RLS HTTP checks and backup/restore rehearsal are still required.
- **[PR #4](https://github.com/cmlagatuz/dawney-clinic/pull/4):** adds a third verified-user/security migration and a dependency-free Supabase Auth/owner profile integration contract, unit tests, and an opt-in live two-account HTTP test workflow. See [Phase 2 Auth verification and owner steps](docs/PHASE2_AUTH_INTEGRATION.md). Real sign-up/verification and HTTP RLS testing require owner-controlled temporary mailboxes and GitHub Actions secrets; **not yet verified live**.
- **Latest integration checkpoint (2026-11-13):** Two disposable Supabase Auth accounts now exist and both have confirmed emails. [Registration workflow](https://github.com/cmlagatuz/dawney-clinic/actions/runs/43398422483) passed in `register` mode; **the `test` mode end-to-end JWT/RLS/persistence run has not been verified**. Run the existing workflow with `operation=test` on `master`, do not register again. See [Phase 3 supervised execution plan](docs/PHASE3_SUPERVISOR_PLAN.md) for the backend and modern frontend priorities while Claude's legacy UI PR stays draft/conflicted.
- **Supabase:** 7 public application tables have RLS enabled; no real user/patient data imported or stored in the application schema. No live data migration has occurred.
- **Phase 3 merged:** [PR #5](https://github.com/cmlagatuz/dawney-clinic/pull/5) modern React/Vite app; [#6](https://github.com/cmlagatuz/dawney-clinic/pull/6) persisted pet/appointment workflows; [#7](https://github.com/cmlagatuz/dawney-clinic/pull/7) encrypted export tools; [#8](https://github.com/cmlagatuz/dawney-clinic/pull/8) private Storage policies; [#9](https://github.com/cmlagatuz/dawney-clinic/pull/9) staff safety/audit. See [web](docs/PHASE3_WEB_FOUNDATION.md), [clinical workflows](docs/PHASE3_CLINICAL_CORE.md), [private Storage](docs/PHASE3_PRIVATE_STORAGE.md), [staff safeguards](docs/PHASE3_STAFF_AUDIT.md) and [recovery](docs/PHASE3_FREE_RECOVERY.md). All PR GitHub checks passed; connected DB SQL tests were transaction scoped.
- **Limitations:** The successful Auth registration action was not the live two-account `test` run. At last check two email-confirmed test users existed but zero owners, patients, appointments or staff. Storage bucket/objects absent. No full recovery snapshot.
- **Deployment:** No confirmed Cloudflare Pages connection, domain, or deployed application URL.

For live agent ownership and new changes, read **[docs/AI_HANDOFF.md](docs/AI_HANDOFF.md)**. This README is a project overview rather than a replacement for the frequently updated handoff.

## Modernization stages

| Phase | Goal | Gate / evidence |
| --- | --- | --- |
| **1 — Legacy assessment** | Feature inventory, security findings, minimal high-risk fixes, tests | **Merged**; focused CI green |
| **2 — Data contract and access** | Legacy mapping, Supabase schema, roles and RLS | Six applied migrations, SQL tests pass; real JWT HTTP and restore rehearsal pending |
| **3 — Modern frontend foundation** | React/TypeScript/Vite and accessible authenticated owner UI | Merged and CI built; live UI/HTTP verification and deployment pending |
| **4 — Core clinical parity** | Owners, pets, appointments, medical history | Owner/pet/appointment UI built with RLS; medical records UI and real-data migration pending |
| **5 — Operations** | Vaccines, prescription flows, inventory stock ledger, invoices/receipts, reporting and audit logs | Pending |
| **6 — Pilot and deployment** | Free GitHub-linked hosting, migration rehearsal, restore drill, live security/persistence smoke tests | Pending |

No phase is considered complete solely because screens, migrations or code were drafted; integration and verification gates are required.

## Proposed free-only deployment architecture (not yet implemented)

```text
GitHub master + verified CI
          |
          v
Cloudflare Pages Free (static frontend: React + TypeScript + Vite)
          |
          v
Supabase Free (Postgres + Auth + private Storage + RLS)
```

Cloudflare Pages **cannot run Laravel/PHP** in this static architecture. The team must build a separate frontend, migrate the required functionality and data safely, and verify access control before cutover. Free quotas, potential Supabase project pausing, email limits and lack of free managed database backups must be addressed; see the [Phase 1 audit](docs/PHASE1_LEGACY_AUDIT.md). No paid provider is authorized.

## Development and collaboration

Before making changes, agents and contributors must read:

1. **[AGENTS.md](AGENTS.md)** — shared engineering, privacy, branches, release and verification rules.
2. **[CLAUDE.md](CLAUDE.md)** — Claude-specific scoped-work guidance.
3. **[docs/AI_HANDOFF.md](docs/AI_HANDOFF.md)** — current branch/PR ownership, blockers and upcoming task.
4. **[docs/PHASE1_LEGACY_AUDIT.md](docs/PHASE1_LEGACY_AUDIT.md)** — feature parity and migration/security requirements.

Use separate `ai/chatgpt/*` and `ai/claude/*` branches; propose tested changes through PRs, check conflict status and checks before merge, and update the shared handoff. Do not store credentials, raw client/animal records or private backups in GitHub.

### Supabase skills

When running a compatible terminal-based development agent inside the repository, install official skills with:

```bash
npx skills add supabase/agent-skills
```

This command installs agent skills in a compatible local environment; **it does not automatically add tools to ChatGPT.com or Claude.ai browser conversations**. GitHub and Supabase connectors remain separate. Read current documentation and verify every database migration and RLS policy; do not expose any service-role/secret key in frontend code.

### Legacy local testing (maintenance only)

The legacy project is an old Laravel/PHP application with dependencies that may require an isolated, compatible environment. Do not blindly upgrade runtime or Composer or deploy it publicly. A constrained PHP 7.4 compatibility setup was used for the Phase 1 GitHub Actions regression job. See [the workflow](.github/workflows/legacy-static-audit.yml) for the actual test setup and [the Phase 1 audit](docs/PHASE1_LEGACY_AUDIT.md) for unresolved issues. The modern app's pinned dependencies, lockfile, build and deployment instructions are in [web/README.md](web/README.md) and [Phase 3 web guidance](docs/PHASE3_WEB_FOUNDATION.md).

## Outstanding security and operations risks

Legacy code includes overlapping-booking race conditions, charged SMS behavior, unsafe password onboarding, disabled purchase flows, incomplete DB constraints and legacy dependency vulnerabilities. The baseline Supabase schema now enforces row-level security (RLS), trusted staff roles, client ownership and two-account SQL deny tests. Private Storage RLS exists but the bucket is not created; real Auth HTTP verification, full Auth/Storage backup and migration rehearsal are still required. Paid SMS must not be required. Before any real-world clinic launch: reconcile old IDs and records, export and restore backups, confirm data retention and secure staff permissions, run integration tests, and verify the live URL.

## Project links

- [Source and active branches](https://github.com/cmlagatuz/dawney-clinic)
- [Pull requests](https://github.com/cmlagatuz/dawney-clinic/pulls)
- [GitHub Actions](https://github.com/cmlagatuz/dawney-clinic/actions)
- [Shared AI handoff](docs/AI_HANDOFF.md)
- [Phase 1 audit](docs/PHASE1_LEGACY_AUDIT.md)

**Documentation policy:** Update verified feature statuses and hosting URL on each major merge/release. Do not turn anticipated capabilities into completed claims.
