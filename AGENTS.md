# Dawney Veterinary Clinic — Shared AI Development Contract

Last reviewed: 2026-11-13. Repository: https://github.com/cmlagatuz/dawney-clinic. Default branch: `master`.

## Mandate
Develop a usable, secure, accessible, responsive veterinary clinic management system using **no paid hosting, backend subscription, paid API, or mandatory purchase**. Never enable a billable product or upgrade without explicit owner approval. Show actual free-tier quotas and consequences; $0 plans are limited and not guaranteed always-on. Build real persisted workflows, not demos or disconnected UI.

## Repository truth (do not assume a new stack)
The current codebase is a 2019-era **Laravel 5.8 / PHP 7.1+ / MySQL**, Blade, Bootstrap 4, Vue 2, Laravel Mix application. Its `master` branch contains login/verification, appointment, owner/user, pet/patient, record, and admin routes. Inventory, purchase, and order code exists but relevant routes are commented out. There is no confirmed hosting configuration or deployed URL in the repository. Laravel 5.8 is out of security support. First audit controllers, migrations, relationships, routes, tests, dependencies, and deployed state; produce a feature-parity inventory and preservation/migration plan. Never imply this PHP app can run unchanged on static hosting or that Supabase already replaced MySQL.

## Architecture choice and zero-cost hosting
Prefer, **if justified after audit and approved for substantive migration**, a modern, maintainable static SPA (e.g. React + TypeScript + Vite) on Cloudflare Pages Free, using Supabase Free for PostgreSQL, Auth, Storage, and narrowly scoped server-side functions. Cloudflare Pages only serves the static frontend in this architecture; it cannot execute Laravel/PHP. Preserve existing core entities, behavior, and data through explicit migration mapping and tests. If retaining Laravel is demonstrably better, research a PHP-capable free host and document sleep, storage, uptime, and deployment limitations. Treat free hosting as suitable for prototypes/pilots, not as guaranteed high-availability clinical production. Never delete old implementation before verified feature parity and rollback are available. Choose architecture based on evidence, not fashion.

## Functional roadmap (implement incrementally; don't claim unbuilt modules work)
Patient/pet and owner registration; staff roles and clinic access; appointments and calendar; clinical encounters/medical history; diagnoses, vaccination and reminders; prescriptions; inventory and stock movements; invoices/receipts without paid payment gateway; reporting, dashboard, audit trail, settings, exports and recovery. Preserve functioning legacy behavior. Scope multi-clinic tenancy only if explicitly needed. Design for desktop/mobile, professional visual hierarchy, usable dark/light mode, keyboard/accessibility, loading/empty/error states, and verified persistence after refresh.

## Supabase tooling and safety
GitHub and Supabase connectors are reportedly connected; check capabilities rather than assuming shell, hosting, or database write access. Where a terminal exists, install the official reusable skills in project scope:
```bash
npx skills add supabase/agent-skills
```
Use installed `supabase` and `supabase-postgres-best-practices` skills as applicable; read current Supabase changelog/docs before DB work. Installing CLI skills does not automatically install them into ChatGPT.com or Claude.ai web chat. Prefer project-scoped installation and commit non-sensitive generated skill files when appropriate. Do not repeatedly reinstall each turn.

Keep schema changes in reviewed version-controlled `supabase/migrations/` files (or a clearly documented migration path); synchronize actual schema and history. Enable RLS on exposed tables, verify realistic owner/staff/administrator permissions with deny tests and cross-account tests, and ensure UPDATE permissions include needed SELECT and WITH CHECK rules. Do not rely on user-editable metadata for authorization. Never expose `service_role`, secret keys, database passwords, private health/contact data, or deployment credentials in source, logs, AI handoff, screenshots, frontend bundles, or commits. Use example env files only. Make backups/export procedures. Do not create fake live clinical data.

## Dual-agent collaboration
**ChatGPT GPT-6 Astra:** lead architect, legacy audit, data models, Supabase security/migrations, integration tests, deployment design and release verification.
**Claude Sonnet Free:** frontend design, responsive UX, component implementation, accessibility, targeted review and small well-scoped fixes. Claude may suggest architecture changes but coordinate with lead first.

Each task must have one owner. Use GitHub Issues/PRs to claim specific areas. Work on separate `ai/chatgpt/<topic>` and `ai/claude/<topic>` branches, based on current `master`. Never edit the same files or schema concurrently without explicit coordination. Check latest commits/PRs/issues and fetch the affected current files before editing. Commit and push actual code to GitHub; do not merely output code snippets when write access is available. Include clear, small commit messages, tests, change summary, and links. Merge tested work to `master` after a conflict check. No force push, unrelated rewrites, secrets, or destructive database operations. If write tools fail, clearly report the exact blocker and give owner-ready steps; do not claim success.

## Deployment
Once the owner connects a free hosting provider and necessary non-secret config, configure **GitHub-linked auto-deployment from `master`** plus preview builds where supported. Both agents can ship through GitHub branches/PRs and verified merges. Check build logs, live URL, auth, permissions, app persistence and rollback after every release. Do not report deployment without a verified provider response/live URL. If hosting access is absent, provide exact dashboard steps and configuration values for the owner; never pretend GitHub push alone makes a site live.

## Token-efficient, persistent handoff
The **shared source of truth is GitHub**, not either AI's private chat memory. Read `docs/AI_HANDOFF.md`, current issues/PRs, and only the specific relevant files before new work; retrieve earlier conversation memory only when materially needed. Claude must not repeatedly consume tokens on full-repo dumps, pasted logs or repeat analysis. Ask for concise diffs and summaries, narrow queries and incremental edits. Before usage limits or at task end, update `docs/AI_HANDOFF.md` with concise facts: branch, changed files, commit/PR, tests, blockers, DB/migration state, deployment URL/status and next owner. The next agent must reread that file and current GitHub state, not trust outdated chat. Keep documentation short and scrubbed of sensitive info.

## Owner intervention
The user can complete initial OAuth, Cloudflare Pages project setup, DNS, Supabase dashboard-only actions, secrets/environment variables, or approvals when connector permissions do not permit them. For each intervention provide: location/navigation, exact non-secret values, numbered steps, verification, and rollback. Minimize repeated questions; proceed independently on safe reversible tasks.

## Done means done
A task is complete only if it is implemented, tested (build/lint/unit/integration where applicable), pushed, reviewed or merged as appropriate, deployed if configured, and checked for working end-to-end persistence/security. Report what is verified versus pending. Stay within free quotas. Avoid claiming invisible work, background execution, or nonexistent services.
