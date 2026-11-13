# Phase 3 Supervisor Plan — Parallel Progress While Claude Is Paused

**Status checked:** 2026-11-13 (Saudi Arabia). **Owner:** Project supervisor. **Execution lead:** ChatGPT GPT-6 Astra. **Frontend reviewer:** Claude Sonnet, when available.

## Verified facts and blockers

- `master` has merged [PR #2](https://github.com/cmlagatuz/dawney-clinic/pull/2), [PR #3](https://github.com/cmlagatuz/dawney-clinic/pull/3), and [PR #4](https://github.com/cmlagatuz/dawney-clinic/pull/4). Auth integration and database baseline are merged; a modern deployed application is not.
- Supabase project `lgimhirgvresvbsdugac` reports **ACTIVE_HEALTHY**, seven public application tables with RLS and **three applied migrations**. Read-only account counts at this checkpoint: **2 Auth users, both email-confirmed**, 0 owner profiles, 0 pets, 0 appointments, 0 staff memberships. Never put their addresses, passwords or tokens in a report.
- [GitHub Actions run 43398422483](https://github.com/cmlagatuz/dawney-clinic/actions/runs/43398422483) passed **registration**, not `test`. The run log explicitly says to verify mailboxes before live RLS tests; both Auth emails now show confirmed. There is **no verified successful live two-account HTTP RLS/persistence run**. The owner should dispatch `Clinic Auth contract` on `master`, operation `test`; do not register again. This test creates at most two synthetic owner profiles.
- Supabase security advisor: INFO for deliberately RLS-locked private `clinic_private.legacy_user_links`; WARN that Auth **leaked password protection is disabled**. Determine whether enabling is possible within Free without upgrade; don't assume it is free or silently enable billing.
- [Claude PR #1](https://github.com/cmlagatuz/dawney-clinic/pull/1) is open/draft/conflicted with later `master`. Claude's isolated admin Blade theme and UI tests passed on its branch. **Do not merge or edit this branch in ChatGPT work.** Legacy Blade UI is not the deployment target if the agreed React migration proceeds. Retain the PR as a design reference and review the value of a legacy merge before consuming Claude's scarce tokens.

## ChatGPT-owned sequential implementation work

**Gate A — Live Auth verification (highest priority):**
1. After the owner launches operation `test`, check the exact workflow outcome and sanitised logs. Verify sign-up, two actual JWT sessions, owner profile creation, ownership denies, privilege escalation deny, persistence after re-login, and safe logout. Fix defects on a **new** `ai/chatgpt/*` branch with regression tests; never log secrets.
2. If missing owner setup or test failure is the only blocker, report precise *nonsecret* steps and continue other independent work. Do not label Phase 2 fully completed without this gate and restore/security review.

**Gate B — Deployable modern frontend foundation, independent of Claude (new branch and PR):**
1. Create isolated `web/` React + TypeScript + Vite app. Keep Laravel root, Blade files, controller routes and PR #1 untouched. Choose a maintained, free-licensed stack with locked dependencies.
2. Install/configure an appropriate official Supabase client with verified package/API docs, secure browser session persistence, PKCE/email redirects, verified auth state, loading/empty/error states, resilient refresh, and sign-out. Reuse or safely supersede the existing `packages/clinic-auth` contract; document compatibility. Never ship service-role/secret keys.
3. Build neutral accessible layout scaffolding only: navigation, sign-in/sign-up/confirmation/reset, role-aware route guards, owner profile view/edit, and one **real persisted** owner profile flow. Placeholder screens must be labeled nonfunctional. Do not imitate/merge Claude's Blade source; preserve its design ideas for later React polish.
4. Provide `web/.env.example`, precise Vite environment variable names, scripts, lockfile, unit/integration tests, CI build and a Cloudflare Pages Free configuration guide (root `web`, build command, output `dist`, SPA fallback). Do not claim a deployment until live URL verified; hosted static pages cannot run Laravel/PHP.
5. Verify account A/B isolation at database level and via real signed-in browser/HTTP tests when available. Do not use mock-only tests as evidence of real persistence. Produce PR with checks and a narrowly scoped handoff.

**Gate C — Clinical backend operations (new separate PRs after Gate B base):**
1. Pet/owner CRUD and relationship rules; actual Supabase PostgREST persistence and cross-account negative tests.
2. Appointment lifecycle using existing non-overlap exclusion constraints; timezone/hours, valid transitions, duplicate requests and concurrent scheduling tested. Confirm clinic timezone/operating hours before release rather than hardcoding an unapproved assumption.
3. Private Storage bucket and owner/staff file policies + access-deny tests; clinical notes rendered safely and never as unsanitized HTML. Set conservative size/type restrictions.
4. Staff role invitation and revocation through reviewed server-only path, first-admin owner authorization, lifecycle audit; avoid browser-exposed privileged service keys.
5. Backups and restore rehearsal using free methods, migration mapping/legacy MySQL export plan, privacy checks, email/in-app reminders without paid Nexmo/SMS, operational quotas. Production data migration requires explicit authorized owner access and approval.

**Gate D — Deployment preparation:**
- GitHub-linked Cloudflare Pages Free preview/production for the `web/` app, with protected production credentials, build/deploy CI, preview safeguards, environment config, rollback and smoke tests. Host connection can require owner intervention.
- Build and deploy early with the verified auth/profile MVP, then expand functionality incrementally. Keep clinical production access disabled until cross-account privacy tests, backups and realistic end-to-end tests pass.
- Update `readme.md` and `docs/AI_HANDOFF.md` with **verified** claims only, at each merge. The final go-live remains owner-approved.

## Cross-AI rules and Claude handoff
- ChatGPT owns `web/` technical foundation, Supabase schema/migrations/policies, tests, release plumbing. Use `ai/chatgpt/<topic>` branches and small PRs from current `master`.
- Claude owns **future design system and UI/UX enhancement for the modern `web/` app**, not new legacy Blade maintenance. When Claude returns, show it the modern `web/` structure and PR #1 so useful tokens/layout ideas can be ported into React. It must coordinate files/PRs before editing.
- PR #1 stays unmerged until explicitly reviewed for legacy preservation value. Never waste free Claude usage resolving repeated conflicts in code planned to be replaced without benefit.
- Every task: audit current PRs and repo state; implement and run tests; commit/push; open reviewable PR; merge only after verified conflict/check review; record test results, branch, commit, deployment status and blockers; no false success claims. Do not create or upgrade paid services.

## Owner action checklist
1. In [GitHub Actions Clinic Auth contract](https://github.com/cmlagatuz/dawney-clinic/actions/workflows/clinic-auth.yml), run **operation: test** on `master` (both confirmed test users now exist). Do **not** rerun `register`.
2. Review the conclusion without exposing secrets; if failed, tell supervisor `What's next?` and the supervisor will inspect sanitised logs. Keep only synthetic test accounts.
3. When ready for a preview site, connect Cloudflare Pages Free and follow the exact `web/` environment setup guide ChatGPT will commit. No domain purchase or paid subscription.
