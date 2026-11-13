# Dawney Clinic — Current Supervisor Execution Plan

**Checkpoint:** 2026-11-13, approximately 16:43 Asia/Riyadh. Use current GitHub/Supabase data to refresh before executing. **No live deployment or clinical go-live approval.** This supersedes older dated checkpoints in the longer handoff.

## Current verified source-of-truth

- GitHub `master` @ `9233c9cceb356b617cac02d0632e4c9b80d5b7ba`. **PRs #2–#16 merged**, including Astra PRs #12–#16: HTTP/Storage smoke-test tooling, free static release readiness, actual PostgreSQL 17/GPG **synthetic isolated** restore, integration audit, and non-network syntax checks. Latest affected Actions CI green. No real hosted clinical security smoke run or production Pages URL is verified.
- React + TypeScript + Vite client under `web/`; Supabase Auth/profile/pet/appointment source present, automated build and tests passed. Legacy Laravel stays historical reference; never deploy PHP through static Pages.
- Connected Supabase project `lgimhirgvresvbsdugac` is healthy; **7 public app tables all RLS enabled; 6 applied migrations**. Read-only verification: **2 Auth accounts, 2 email-confirmed; 0 owner/pet/appointment/staff records**.
- Private Storage bucket `clinical-attachments` **EXISTS**: `public=false`, **5,242,880 bytes (5 MiB)**, allowed `application/pdf,image/png,image/jpeg`, 0 stored objects. SQL Storage policy checks already passed per handoff. Actual JWT Storage access-denial workflow has NOT run.
- `Clinic Auth contract` manual workflow: newest known manual run [43425109459](https://github.com/cmlagatuz/dawney-clinic/actions/runs/43425109459) used **register-a**; two users are now email-confirmed. **DO NOT register either account again.** No subsequent manually dispatched `operation=test` was found among current retrieved GitHub Actions runs.
- No GitHub Releases published. [Cloudflare Pages Free deployment setup](PHASE3_DEPLOY_RELEASE.md) is documented, but **Cloudflare live URL is unverified**.
- [Claude PR #1](https://github.com/cmlagatuz/dawney-clinic/pull/1) remains OPEN/UNMERGED (not draft); changes outdated Laravel Blade screens, not React. Keep as design reference, do not merge without explicit review. No new React UX PR surfaced yet.
- Auth password advisor WARN `auth_leaked_password_protection` disabled; avoid Pro/paid upgrades; two INFO findings for deliberately isolated private RLS tables. No secrets, fake live results, or real patient data.
- Git history includes prior `65032983` unrelated-history merge with equal tracked trees. Do not rewrite/reset/force-push history.

## Owner immediate next actions — in order

1. Run [Clinic Auth contract](https://github.com/cmlagatuz/dawney-clinic/actions/workflows/clinic-auth.yml) on `master`, **operation `test`**. It makes at most two synthetic owner profiles and checks real JWT login, A/B RLS, staff-escalation deny, logout and persistence. Accounts are confirmed; **do not register again**. On any error, inspect sanitized logs before making changes.
2. After baseline Auth `test` PASSES, run [Phase 3 authenticated security smoke](https://github.com/cmlagatuz/dawney-clinic/actions/workflows/phase3-security-smoke.yml) on `master`, mode **`read-only`** (no writes). Only after verifying that, explicitly opt into `clinical` and `storage` synthetic modes, understanding they persist synthetic test data and require careful operator cleanup. Read [smoke runbook](PHASE3_HTTP_STORAGE_SMOKE.md). A failure of security isolation is a stop sign, not permission to weaken RLS.
3. Connect a **test/preview** Cloudflare Pages Free Git deployment from `master` (root `web`, Node 22, `npm run build`, `dist`), public `VITE_SUPABASE_URL` + publishable-key-only `VITE_SUPABASE_PUBLISHABLE_KEY`. Follow [deployment runbook](PHASE3_DEPLOY_RELEASE.md). Add exact Supabase Auth callback/recovery redirect URLs once the real `*.pages.dev` URL is issued. Never expose service-role keys.
4. Supply **actual clinic** timezone, weekly opening hours, closed days, booking duration(s), and practitioner/resource concurrency. User location must not be assumed to be clinic location.

## Parallel AI task split (when available)

**ChatGPT GPT-6 Astra, new conversation if former chat won't load**:
- Read `AGENTS.md`, `readme.md`, this plan, and newest section of `docs/AI_HANDOFF.md`. Reconstruct from actual GitHub/Supabase, not chat memory.
- Verify exact workflow status/result after owner actions; debug concrete failures on new isolated `ai/chatgpt/*` PRs.
- Investigate full owner-controlled Auth/Storage/clinical backup and isolated restore (current proven restore uses synthetic Postgres only); prepare secure browser live tests, staff admin onboarding/revocation, scheduling rules; configure/verify Pages only with an actual provider connection. Avoid Claude's React visual files.
- Work in focused PRs with CI, track verified vs pending, update readme/handoff; no paid services and no fake success.

**Claude Sonnet Free** (available after user-provided 7:20 PM reset):
- Do **not** spend free turns merging legacy PR #1 simply to preserve old Blade UI. Start a fresh `ai/claude/react-ux-foundation` branch from newest master when available, scoped to `web/src/styles.css`, `web/src/components/Layout.tsx`, and new **presentational** components.
- Improve responsive accessible React UX, light/dark colors, patient and appointment screen styling, keyboard/focus/reduced motion, real error/loading/empty states. Preserve Supabase/Auth/business logic and tests. Push PR for supervisor review, do not independently merge.

## Release exit gate

No clinic go-live until genuine Auth/JWT A/B isolation, real clinical/Storage deny tests, hosted browser profile/pet/booking persistence and deep-links, private files, staff authorizations, authorized data migration, **full relevant Auth+Storage+database restore rehearsal**, rollback, privacy review and owner approval are demonstrated. Free tiers have no guaranteed 24/7 uptime/backup SLA. 
