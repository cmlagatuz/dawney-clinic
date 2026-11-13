# Dawney Clinic — Supervisor Execution Plan

**Latest verified checkpoint: 2026-11-13, 15:28 Asia/Riyadh.** Authoritative current priorities below supersede earlier historical task descriptions in `docs/AI_HANDOFF.md`. Project is NOT deployed or production approved.

## Verified status

- `master` includes merged PRs #2–#11 (latest functional changes via PR #11). Modern `web/` React + TypeScript + Vite app exists, with Supabase Auth, persisted profile code, pets, appointment UI, npm lockfile, automated TS/unit/build checks. Source-level CI passed; **no successful hosted browser trial or real pet/appointment persistence trial** proven.
- Supabase `lgimhirgvresvbsdugac` is `ACTIVE_HEALTHY`: **seven public RLS-enabled app tables**, **six applied migrations**, staff audit, lifecycle constraints, private Storage policies.
- **Latest read-only Auth check**: two Auth accounts, **one confirmed**, zero owner/pet/appointment/staff rows. [Run 43425109459](https://github.com/cmlagatuz/dawney-clinic/actions/runs/43425109459) was a successful **register-a**, reporting `verification_required` — NOT a passed operation `test`. **Do NOT run register-a or register-b again.** Owner should confirm the newly registered test A email (B already confirmed), then run [Clinic Auth contract](https://github.com/cmlagatuz/dawney-clinic/actions/workflows/clinic-auth.yml) on `master` with operation `test`. Review sanitized logs. Preserve disposable test account identities/secrets privately.
- `storage.buckets` does **not** yet contain `clinical-attachments`. Owner must create it in [Supabase Storage](https://supabase.com/dashboard/project/lgimhirgvresvbsdugac/storage/buckets) as **private**, file limit 5 MB, allowed MIME `application/pdf,image/png,image/jpeg`, followed by real cross-account Storage API negative tests. Do not create storage.buckets via SQL.
- Supabase security advisor: informational no-public-policy on two intentionally isolated `clinic_private` tables; warning leaked-password protection disabled, investigate Free-plan availability and fallback without paid upgrades.
- Claude's [PR #1](https://github.com/cmlagatuz/dawney-clinic/pull/1) is **open, no longer draft**, with passing frontend/legacy CI, but **unmerged**. It modifies legacy Laravel Blade assets, not target React `web/`; latest `master` diverged from it. Do not auto-merge it or expend Claude's Free allowance on repeated old Blade conflict work. Preserve as design reference and close only after work is ported and reviewed.
- No verified Cloudflare Pages deployment URL or comprehensive restore rehearsal. Application is not approved for real clinical information.
- Two recent `master` commits `c4e45965` ("Initial commit") and `65032983` ("Complete merge of unrelated histories") changed Git history; the current file tree and workflows still exist. Before modifying Git history or merging old branches, inspect and assess those commits. Never force-push or reset `master`.

## Parallel AI ownership — next work

### Claude Sonnet (Free): modern React UX, new branch

1. Read this plan, current `master`, `AGENTS.md`, React `web/` code, and PR #1 **for design reference only**.
2. Start a new branch `ai/claude/react-ux-foundation` from current `master`, NOT the old PR #1 head. Own visual design and accessibility in `web/src/styles.css`, `web/src/components/Layout.tsx`, and optional *new presentational* components/files that do not overlap Astra's current changes.
3. Deliver an accessible responsive clinic interface: light/dark neutral or slate/purple themes (avoid eye-straining green), mobile navigation, meaningful dashboards/empty/loading/error states, keyboard focus/reduced motion, readable forms/cards/tables, visible booking and patient status. Preserve all Supabase calls and RLS-backed functionality; no mock clinical data masquerading as live.
4. Verify TS build, unit tests, Chromium viewport/a11y smoke tests when possible. Push a scoped PR with before/after screenshots if supported and add a concise handoff. Do not touch `supabase/`, Auth integration, GitHub Actions, legacy Blade, or Astra-owned clinical logic.
5. Review and suggest whether old PR #1 should be closed after extracting useful design insights. Do not merge it.

### ChatGPT GPT-6 Astra: security/operations/deploy, separate branch(es)

1. Inspect the newest `master` and the unrelated-history merge; verify current workflows and Auth test state. When owner triggers operation `test`, review its actual HTTPS success/failure and fix verified issues, with no credential disclosure. Do not repeat registration.
2. Continue owner-independent safety engineering in `supabase/`, `scripts/`, `.github/workflows/`, `docs/` and focused tests; **avoid Claude's `web/src/styles.css`, `web/src/components/Layout.tsx` and presentation-only components**. Prioritize actual JWT owner A/B, pet/appointment/Storage denies, attachment safety, clinic timezone/hours contracts, and complete backup/restore rehearsal (not just archive inspection).
3. Prepare Cloudflare Pages Free hosting connection/preview/release with `web` root, `npm run build`, `dist`, Node 22, public-only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. These are public build config (never service-role). If provider dashboard access is unavailable, provide exact owner actions; do not claim hosted success.
4. Audit unresolved legacy risks (GET paid Nexmo, raw HTML notes, admin plaintext invite). Do not expose obsolete PHP production environment. Require owner-provided schedule/timezone before final booking rule rollout.
5. Small verified `ai/chatgpt/*` PRs only; inspect conflict/CI; merge safe work and update docs/README with verified milestones.

## Owner tasks, in order

1. Confirm test **A** from its trusted mailbox (Supabase currently reports 1 confirmed of 2 users). Then [run test mode](https://github.com/cmlagatuz/dawney-clinic/actions/workflows/clinic-auth.yml), not register.
2. Create the private `clinical-attachments` bucket exactly as described in `docs/PHASE3_PRIVATE_STORAGE.md`. Run follow-up verification via Astra.
3. Connect Cloudflare Pages Free to `master` only when ready for a **test/preview environment**; use `docs/PHASE3_WEB_FOUNDATION.md`. Keep real patient records disabled until tested.
4. Supply actual clinic timezone, operating hours and booking resource capacity when scheduling gates are ready. Do not assume Saudi Arabia based on owner's location.

## Release gates

Require passing real JWT multi-user HTTP isolation; real browser profile/pet/booking persistence and re-login; tested private Storage cross-account access denial; back-up and **isolated restore** including relevant Auth/Storage; authorized staff role lifecycle; privacy review; hosted HTTPS URL, deep links and rollback; owner go-live approval. Zero paid services; no guarantee of Free-tier always-on support.
