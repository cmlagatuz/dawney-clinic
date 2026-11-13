# Dawney Clinic — Shared AI Handoff

Updated: 2026-11-13 (Phase 1). Shared source of truth: GitHub master + active PRs. Read AGENTS.md and CLAUDE.md first. No deployment is verified.

## Confirmed baseline
- Repo: https://github.com/cmlagatuz/dawney-clinic ; default branch master.
- Legacy Laravel 5.8 / PHP 7.1-era / MySQL, Blade/Bootstrap 4/Vue 2; preservation required.
- Existing working-in-code areas: authentication, owners, pets, basic medical history and appointments, admin dashboard; inventory/order code exists but routes are disabled. Not independently runtime verified.
- Connected Supabase project is named **Dawney Animal Clinic Veterinary System**, checked healthy (Postgres 17) on 2026-11-13; public app tables: 0; security advisor: no current lints. **No Supabase writes or migrations performed.**
- No verified Cloudflare Pages link, deployment, backups or production Laravel runtime.
- Free architecture proposal: separate Vite/React/TypeScript SPA on Cloudflare Pages Free + Supabase Free Postgres/Auth/private Storage with RLS and limited server functions. See Phase 1 audit for quotas, risks, source findings and data mapping.
- Source-level architecture and security audit: docs/PHASE1_LEGACY_AUDIT.md in active ChatGPT PR #2 (not yet merged when this handoff was written).

## Task claims — avoid concurrent edits
**ChatGPT GPT-6 Astra — ACTIVE**
- Branch: ai/chatgpt/phase1-audit-security
- PR: https://github.com/cmlagatuz/dawney-clinic/pull/2
- Files: app/Http/Controllers/{UserController,AppointmentController}.php, tests/Feature/AccountIsolationTest.php, .github/workflows/legacy-static-audit.yml, docs/PHASE1_LEGACY_AUDIT.md
- Changes: appointment detail owner scope, foreign-pet booking rejection, bounded hour/concern validation; 5 regression test cases; free CI syntax + PHP 7.4 regression job; complete static audit and migration gates.
- PHP syntax CI verified **passed**: https://github.com/cmlagatuz/dawney-clinic/actions/runs/43378487024 . Functional CI first attempted and blocked by legacy lock requiring Composer 1. A Composer 1 CI retry is underway in PR #2; check latest Actions run before merging. No claim of successful PHPUnit, PHP runtime or live deployment yet.
- Pending: fix CI/test blockers; review PR diff; merge once verified; update handoff with final commit/checks.

**Claude Sonnet Free — RESERVED, READY TO START**
- Sole scope: UI/UX audit and design parity. Branch ai/claude/phase1-ui-inventory from up-to-date master.
- New output only: docs/UI_PARITY_AND_DESIGN.md. Review Blade resources/views, resources/js and resources/sass for screen inventory, accessible form patterns, responsive desktop/mobile, dark/light visual design and React component inventory.
- Do not edit Laravel controllers/routes, DB, migrations, docs/PHASE1_LEGACY_AUDIT.md or ChatGPT's CI and tests. Open separate PR and request review before merge. Keep concise and economical with token use.
- Before editing this shared handoff, reread current master; avoid conflict and append only verified status. No autonomous running has been initiated here: the owner must pass this scoped task to Claude.

## Open high-priority work after Phase 1
1. Booking conflict check is commented out: need concurrency-safe schedule constraints and tests.
2. Chargeable SMS is triggered on GET and after appointment writes; remove required Nexmo dependency and design safe free reminders.
3. Admin-created plaintext passwords are emailed; replace with password reset/invitation.
4. Legacy schema has no foreign keys and purchases are unsafe/disabled; reconcile before data migration.
5. Design security-first Supabase schema and RLS policies, test two-account denial and backup restore before any production use.

## Collaboration blocker
GitHub Issues creation fails with HTTP 410: Issues disabled. To enable: repository Settings > General > Features > Issues (owner action). Until then use PRs, branches and this handoff as task tracker.

## No-secrets rule / release status
No API credentials, medical records, password hashes, patient contact details or operational data in documentation. Zero paid hosting/backends. Do not enable billing, production cutover or deploy unsupported Laravel. No linked hosting means no live URL to report.
