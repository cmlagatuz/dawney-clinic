# Dawney Clinic — Shared AI Handoff

Updated: 2026-11-13 (supervisor checkpoint; Phase 1 merged, Phase 2 database baseline merged; Auth integration pending). Shared source of truth: GitHub master + active PRs. Read AGENTS.md and CLAUDE.md first. No deployment is verified.

## Confirmed baseline
- Repo: https://github.com/cmlagatuz/dawney-clinic ; default branch master.
- Legacy Laravel 5.8 / PHP 7.1-era / MySQL, Blade/Bootstrap 4/Vue 2; preservation required.
- Existing working-in-code areas: authentication, owners, pets, basic medical history and appointments, admin dashboard; inventory/order code exists but routes are disabled. Not independently runtime verified.
- Connected Supabase project is named **Dawney Animal Clinic Veterinary System**, checked healthy (Postgres 17) on 2026-11-13; public app tables: 7 and two applied migrations as of latest Phase 2 checkpoint below; review the latest dated checkpoint before assuming state.
- No verified Cloudflare Pages link, deployment, backups or production Laravel runtime.
- Free architecture proposal: separate Vite/React/TypeScript SPA on Cloudflare Pages Free + Supabase Free Postgres/Auth/private Storage with RLS and limited server functions. See Phase 1 audit for quotas, risks, source findings and data mapping.
- Source-level architecture and security audit: docs/PHASE1_LEGACY_AUDIT.md on master, merged via PR #2.

## Task claims — avoid concurrent edits
**ChatGPT GPT-6 Astra — PHASE 1 MERGED; PHASE 2 SECURITY PLAN NEXT**
- Branch: ai/chatgpt/phase1-audit-security (merged)
- PR: https://github.com/cmlagatuz/dawney-clinic/pull/2
- Verified squash merge: https://github.com/cmlagatuz/dawney-clinic/commit/9a0cb7e8d2b36521336cbb24a7b281f8195582b3
- Files: app/Http/Controllers/{UserController,AppointmentController}.php, tests/Feature/AccountIsolationTest.php, .github/workflows/legacy-static-audit.yml, docs/PHASE1_LEGACY_AUDIT.md
- Changes: appointment detail owner scope, foreign-pet booking rejection, bounded hour/concern validation; 5 regression test cases; free CI syntax + PHP 7.4 regression job; complete static audit and migration gates.
- **Verified:** PHP syntax CI passed, and the PHP 7.4 + Composer 1 job passed **5 tests / 11 assertions** (in-memory SQLite): https://github.com/cmlagatuz/dawney-clinic/actions/runs/43378768881 . The original Composer 2 attempt failed due old lockfile; the successful retry did not change dependencies.
- PR #2 was squash-merged after the targeted tests passed. This is targeted security coverage, **not** a complete legacy functional/integration test or live deployment.
- Next ChatGPT task: verified MySQL export strategy, versioned Postgres model and RLS deny tests, booking concurrency and zero-paid notification design; stay on a NEW ChatGPT branch.

**Claude Sonnet Free — PR #1 CHECKS PASS, BUT OPEN/DRAFT AND CONFLICTED WITH UPDATED MASTER**
- [PR #1](https://github.com/cmlagatuz/dawney-clinic/pull/1) from `ai/claude/admin-ui-foundation` is OPEN/DRAFT and GitHub reported `mergeable: false` at supervisor check. It was based on pre-Phase-1 master. Branch `ai/claude/phase1-ui-inventory` exists but is not yet the immediate task.
- Existing PR adds admin theme/accessible components and restyles dashboard, patients, appointment and record views; source-only UI checks are described in its PR. Blade runtime render and actual integration are **not** verified.
- **Immediate task:** update PR #1 branch from current `master`, resolve shared handoff conflict carefully, re-run checks, verify Blade rendering and real routes if tools permit; fix dashboard label/count mismatch: `isToday()` alone includes past appointments while metric claims "Still to come today".
- Do not claim that legacy `{!! $record->comments !!}` stored-XSS hazard or GET/paid-SMS reminder has been fixed; escalate to lead; do not touch unrelated backend.
- Supervisor comment with review gates: https://github.com/cmlagatuz/dawney-clinic/pull/1#issuecomment-6846116179
- Once PR #1 is mergeable, tested and reviewed, consider separate UI inventory/design report for the modern client. Avoid producing a redundant legacy UI overhaul if the React migration direction is confirmed.

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

## Supervisor checkpoint — 2026-11-13
- Updated `readme.md` on master (commit `937cf97410f066bfd93f17e7a166d7b1e0796fb5`): accurate implementation matrix, six-phase roadmap, free-only architecture caveats and explicit live/DB status.
- Supabase `Dawney Animal Clinic Veterinary System`: ACTIVE_HEALTHY (Postgres 17); read-only checks returned **0 public app tables**, **0 migrations** and **0 security lints** (empty schema is not security proof). No DB writes were made during supervisor check.
- GitHub Actions `Legacy PHP checks` on master succeeded before README update; no end-to-end modern build/deployment exists. PR #1 is draft/non-mergeable and needs integration; PR #2 is merged.
- **Next ChatGPT task:** Phase 2 data contract, versioned Supabase schema/RLS design and test plan on new `ai/chatgpt/phase2-data-security` branch. Review PR #1 security integration as needed. Do not modify Claude-owned Blade/assets or claim runtime verification without running it.
- **Next Claude task:** fix and validate PR #1 before starting other UI branches. Both agents must sync to current master and avoid competing writes to this handoff; append only verified status after work.
- **Owner action:** enable GitHub Issues under Settings > General > Features if issue-based task claiming is desired; connect hosting only once a modern deployable frontend exists. Do not paste secrets into chat or GitHub.

## Phase 2 database checkpoint — 2026-11-13 (latest; supersedes Phase 2 pending statements above)

**ChatGPT GPT-6 Astra — Phase 2 baseline MERGED, integration still pending.**
- Source PR: https://github.com/cmlagatuz/dawney-clinic/pull/3 ; squash merge: https://github.com/cmlagatuz/dawney-clinic/commit/52d24a909d104349cc5c0b109cb80a33f2f55b5f
- Work branch: `ai/chatgpt/phase2-data-security` (merged). Scope: `supabase/migrations/*`, `supabase/tests/*`, `docs/PHASE2_DATA_SECURITY.md`, `readme.md`. No Claude Blade/CSS/JS files changed.
- Connected Supabase project: two versioned migrations **APPLIED**, matching committed SQL verbatim: `20261113070302_phase2_core_data_security`, `20261113070834_phase2_index_and_policy_tuning`. Public schema now has 7 RLS-protected application tables and 14 public RLS policies, plus private legacy account mapping; one generic appointment scheduling resource. Atomic GiST exclusion prevents overlaps on the same resource; composite pet/owner FK prevents cross-owner association. No paid products enabled.
- **SQL verified:** `supabase/tests/phase2_rls_regression.sql` passed after advisor tuning (two JWT-claim-simulated owners, foreign-pet deny, colliding booking deny, cancellation/slot reuse, vet note, anon deny, staff revocation and audit trigger). `supabase/tests/phase2_staff_roles_regression.sql` passed (admin helper, role-escalation denial, non-staff isolation and anonymous Auth restriction). Both use `BEGIN ... ROLLBACK`, no persistent test users. Read-only counts after test: Auth 0, owners 0, pets 0, appointments 0, records 0, events 0, staff 0, private mappings 0, resources 1.
- **CI:** GitHub Actions legacy PHP syntax and PHP 7.4 regression checks PASSED on PR head: https://github.com/cmlagatuz/dawney-clinic/actions/runs/43384400332 . No frontend deployment or actual Auth HTTP test.
- **Advisors:** security info only: intentionally no policies on private legacy_user_links (API roles have no access), see https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy . Initial FK index and multiple permissive policy warnings fixed; remaining unused index infos expected with empty data.
- **Claude PR #1** remains independent; security review comment: https://github.com/cmlagatuz/dawney-clinic/pull/1#issuecomment-6846659464 . Raw `{!! $record->comments !!}` remains a stored-XSS risk, plus GET/Nexmo reminder and stale-dashboard count. Claude must resolve before UI merge; do not overwrite their files.
- **Still PENDING before Phase 2 exit:** real Supabase Auth sign-up/invite and real JWT HTTP cross-account tests; verified staff bootstrap workflow and role lifecycle; private Storage policies; clinic timezone/hours/status transitions; legacy MySQL export/import and identity linking; encrypted backup and full isolated restore rehearsal; end-to-end UI persistence; deployed application. No source MySQL or clinical data were accessed or migrated.
- **Next owner:** ChatGPT should implement remaining Auth/RLS/restore integration on a new isolated branch. Claude should complete PR #1 UI tests independently. Owner does not need to intervene for the schema baseline; owner input will be required later for authorized legacy MySQL export, clinic timezone/privacy requirements, and release approval. Do not use paid services or put secrets in GitHub.

## Supervisor latest status — 2026-11-13 (after Phase 2 merge)
- **Claude PR #1 is NOT finished/merged**: GitHub API currently reports `state=open`, `draft=true`, `mergeable_state=dirty` for `ai/claude/admin-ui-foundation` @ `2a2dc66d7d54ec74d6b188565c18227c943d4752`. It last updated before Phase 2 merge. Claude did fix the dashboard count and add frontend tests; branch CI frontend and PHP checks both SUCCESS. PR body says mergeable, but live API disagrees: treat current live status as authoritative.
- Claude usage unavailable until user-reported 2:10 PM. Do not consume Claude quota or start duplicate UI work. When available, ask Claude to resync latest `master`, resolve conflicts (especially this handoff and README, if any), re-run CI, make PR ready for final lead review; leave backend issues to ChatGPT.
- Connected Supabase remains ACTIVE_HEALTHY. Verified **7 public tables with RLS**, 2 migrations (`20261113070302` / `20261113070834`), and **1 informational** security advisor entry for intentionally locked private `clinic_private.legacy_user_links`, not an actionable public RLS exposure. No live application or real Auth tests yet.
- **Astra priority while Claude unavailable:** isolated Phase 2/3 integration branch for real Supabase Auth sign-up/login/owner creation, HTTP token-based cross-account RLS tests, staff onboarding workflow, and small modern frontend proof of persistence **only if safely scoped**. Do not merge or modify Claude PR #1 without resolving conflicts and review. Preserve Phase 2 applied migration history; avoid paid services and secrets. Record verified tests and push a focused PR.
- Source of truth for latest project progress: merged Phase 2 PR #3, `docs/PHASE2_DATA_SECURITY.md`, current Supabase state, and active PR status; earlier superseded statements in this handoff are historical.
