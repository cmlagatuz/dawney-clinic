# Dawney Clinic — Shared AI Handoff

Updated: 2026-11-13 (supervisor checkpoint; Phase 1 merged, Phase 2 pending). Shared source of truth: GitHub master + active PRs. Read AGENTS.md and CLAUDE.md first. No deployment is verified.

## Confirmed baseline
- Repo: https://github.com/cmlagatuz/dawney-clinic ; default branch master.
- Legacy Laravel 5.8 / PHP 7.1-era / MySQL, Blade/Bootstrap 4/Vue 2; preservation required.
- Existing working-in-code areas: authentication, owners, pets, basic medical history and appointments, admin dashboard; inventory/order code exists but routes are disabled. Not independently runtime verified.
- Connected Supabase project is named **Dawney Animal Clinic Veterinary System**, checked healthy (Postgres 17) on 2026-11-13; public app tables: 0; security advisor: no current lints. **No Supabase writes or migrations performed.**
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

**Claude Sonnet Free — PR #1 SYNCED WITH MASTER, CI GREEN, DRAFT AWAITING LEAD REVIEW** (status section at end of file; original text below kept for the record)
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

## Claude status - PR #1 integration (2026-11-13, after supervisor review)
**Branch/PR:** `ai/claude/admin-ui-foundation`, [PR #1](https://github.com/cmlagatuz/dawney-clinic/pull/1), still **DRAFT** pending focused lead review. Merged current `master` (merge `356f788`); fixes in `0307d6d`. GitHub reports `mergeable: true`. Only conflict was this file: master's version taken in full, so the Phase 1 record is intact; every Phase 1 file (controllers, `AccountIsolationTest`, `legacy-static-audit.yml`, audit doc, README) is byte-identical to master.

**Scope kept frontend-only:** no controller, route, migration, Supabase or lead-owned workflow touched. New frontend-owned files: `tests/Feature/AdminViewsRenderTest.php`, `tests/frontend/contrast_check.py`, `.github/workflows/frontend-ui-checks.yml`.

**Dashboard count:** "Upcoming" and "Still to come today" now count only appointments that have not started (`isFuture()`), stated in the view. Note: the controller query is already `appointment_start >= now()`, so I could not reproduce a wrong number against current backend code; the old view relied on that implicit filter and `isToday()` alone does not mean "still to come". Pinned by a frozen-clock test.

**Verified (GitHub Actions, PHP 7.4, Laravel 5.8, in-memory SQLite):**
- `php artisan view:cache`: all Blade views compile.
- `AdminViewsRenderTest`: 4 tests / 28 assertions OK (empty, populated, paginated, still-to-come rule). Run 43382302482.
- Phase 1 `AccountIsolationTest` still 5 tests / 11 assertions OK on the merged branch; PHP lint OK. Run 43382302242.
- Contrast gate: 42 pairings, 0 failures (both themes; text >= 4.5:1, focus ring and input borders >= 3:1).
- Local Chromium on static fixtures: 30 page x theme x width combinations (320-1440px; dashboard, patients, empty state) with 0 a11y/overflow/JS-error findings; keyboard order and a consistent 3px focus ring on all 16 stops. Found and fixed: Bootstrap's `.btn:focus{outline:0}` was suppressing the ring on buttons/inputs.

**NOT verified (do not claim):** real-browser render of the actual Laravel app on MySQL data; screen-reader behaviour (mobile card layout is CSS-only and may drop table semantics in some readers); Bootstrap mobile nav collapse (CDN scripts unreachable in sandbox); Summernote/Tempus Dominus in dark mode (third-party, stay light); the new test was not mutation-checked against the old `isToday()` logic (reasoned: old logic yields 3/4 vs expected 2/3).

**Backend/security items for ChatGPT - NOT fixed, NOT touched by Claude (unchanged):**
1. `{!! $record->comments !!}` in `admin/patient/recordView` renders unescaped Summernote HTML: stored-XSS risk; needs server-side sanitising.
2. `admin.appointment.remind` is a GET with a chargeable-SMS side effect: unsafe for the free final release; needs POST + CSRF and a zero-cost design. The Remind link is still in the UI.
3. `AdminController@dashboard` groups by day-of-month only (same date in different months merges).
Reminder: the UI still *calls* both hazards; fixing the UI cannot make them safe.

**Needs from lead:** (1) focused review of PR #1 before draft is removed; (2) decide whether `frontend-ui-checks.yml` stays separate or is folded into your workflow; (3) Issues remain disabled (owner action, see Collaboration blocker).
**Next Claude task:** none started. Per supervisor, no new UI branch until PR #1 is reviewed/merged; then form restyle (patient/user/record create+update) and user-facing pages, unless the React migration makes legacy Blade work redundant.
