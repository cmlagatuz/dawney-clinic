# Dawney Veterinary Clinic

**Veterinary clinic management system — modernization in progress**

> **Project status (13 November 2026): Phase 1 security fixes merged; Phase 2 baseline Supabase schema and RLS applied and SQL policy tests passed. Real Auth/HTTP integration, migration and live deployment remain pending.** This repository is not currently a production-ready or live Supabase-powered veterinary system.

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
| Modern Supabase-backed frontend | Proposed React + TypeScript + Vite migration | Not yet implemented |
| Supabase schema | Two version-controlled migrations applied to the connected Dawney project; 7 public RLS tables and one private mapping table | Baseline applied and SQL policy tests passed; not ready for live clinical use |
| Cloud hosting and live URL | Cloudflare Pages Free proposed; no verified deployment URL | Not deployed |
| Production backups, restore drill and cutover | Required before handling real operational records | Not verified |

**Audit scope:** Source review and targeted regression tests, not a full browser-based security test or a validated production environment. Do not enter real clinic records into an unverified deployment.

## Progress and evidence

- **Phase 1 completed (2026-11-13):** [Legacy audit and modernization gates](docs/PHASE1_LEGACY_AUDIT.md), security hardening for patient appointment ownership and forged foreign-pet bookings, bounded booking inputs, regression tests and GitHub Actions legacy PHP checks.
- **[PR #2](https://github.com/cmlagatuz/dawney-clinic/pull/2):** Phase 1 merged to `master`; CI passed **5 tests / 11 assertions**, with PHP 7.4 and a compatibility install. See [the passing Actions run](https://github.com/cmlagatuz/dawney-clinic/actions/runs/43378768881). This is targeted coverage, not a guarantee of full-system correctness.
- **[PR #1](https://github.com/cmlagatuz/dawney-clinic/pull/1):** Claude's accessible UI foundation (dark/light mode, components, layouts, responsive styling) is **open and draft**, with integration/rendering verification outstanding. Do not describe it as merged or deployed.
- **Phase 2 foundation (2026-11-13):** [Supabase schema, security tests and recovery contract](docs/PHASE2_DATA_SECURITY.md), [Phase 2 PR #3](https://github.com/cmlagatuz/dawney-clinic/pull/3). Two migrations applied, RLS and appointment overlap constraint verified with rollback-only test fixtures. Real Auth login/RLS HTTP checks and backup/restore rehearsal are still required.
- **Supabase:** 7 public application tables have RLS enabled; no real user/patient data imported or stored in the application schema. No live data migration has occurred.
- **Deployment:** No confirmed Cloudflare Pages connection, domain, or deployed application URL.

For live agent ownership and new changes, read **[docs/AI_HANDOFF.md](docs/AI_HANDOFF.md)**. This README is a project overview rather than a replacement for the frequently updated handoff.

## Modernization stages

| Phase | Goal | Gate / evidence |
| --- | --- | --- |
| **1 — Legacy assessment** | Feature inventory, security findings, minimal high-risk fixes, tests | **Merged**; focused CI green |
| **2 — Data contract and access** | Legacy export/backup plan, Supabase schema migrations, authenticated roles, RLS allow/deny tests | Initial schema and policy SQL tests verified; live Auth, backup restore and import rehearsal pending |
| **3 — Modern frontend foundation** | Separate React/TypeScript/Vite application, accessible responsive shell, authentication and first persisted workflow | Pending |
| **4 — Core clinical parity** | Owners, pets, appointments with atomic conflict prevention, medical history and records | Pending |
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

The legacy project is an old Laravel/PHP application with dependencies that may require an isolated, compatible environment. Do not blindly upgrade runtime or Composer or deploy it publicly. A constrained PHP 7.4 compatibility setup was used for the Phase 1 GitHub Actions regression job. See [the workflow](.github/workflows/legacy-static-audit.yml) for the actual test setup and [the Phase 1 audit](docs/PHASE1_LEGACY_AUDIT.md) for unresolved issues. The modern application's installation and deployment instructions will be added once its framework, lockfile and hosting are implemented.

## Outstanding security and operations risks

Legacy code includes overlapping-booking race conditions, charged SMS behavior, unsafe password onboarding, disabled purchase flows, incomplete DB constraints and legacy dependency vulnerabilities. The baseline Supabase schema now enforces row-level security (RLS), trusted staff roles, client ownership and two-account SQL deny tests. Private storage, real Auth HTTP verification and migration rehearsal are still required. Paid SMS must not be required. Before any real-world clinic launch: reconcile old IDs and records, export and restore backups, confirm data retention and secure staff permissions, run integration tests, and verify the live URL.

## Project links

- [Source and active branches](https://github.com/cmlagatuz/dawney-clinic)
- [Pull requests](https://github.com/cmlagatuz/dawney-clinic/pulls)
- [GitHub Actions](https://github.com/cmlagatuz/dawney-clinic/actions)
- [Shared AI handoff](docs/AI_HANDOFF.md)
- [Phase 1 audit](docs/PHASE1_LEGACY_AUDIT.md)

**Documentation policy:** Update verified feature statuses and hosting URL on each major merge/release. Do not turn anticipated capabilities into completed claims.
