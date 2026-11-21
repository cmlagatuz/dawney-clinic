# Phase 4 — Real Chromium browser acceptance without clinical writes

**Implementation:** independent `scripts/browser/` scripts; no Playwright subscription or dependency, no frontend presentation modifications. GitHub CI runs a real headless Chromium on a **local** Vite static preview using an **inert publishable key**, with no Auth credentials or clinical writes. It is not a deployed Pages test.

## CI / local safe tests (automatic)

- `.github/workflows/phase4-browser.yml` runs on relevant PRs/master: `npm ci`, TypeScript/Vite build, Node harness guards, and headless Chromium anonymous protected-route redirects from `/app/profile`, `/app/pets`, `/app/appointments`, plus 360px/1280px login viewport no-horizontal-overflow assertions.
- Reproduce on a trusted developer machine with Node 22+, free Chromium/Chrome installed, using an **inert** frontend key:
```bash
cd web
npm ci
VITE_SUPABASE_URL=https://lgimhirgvresvbsdugac.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_offline_browser_test_dummy npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
# From another terminal, repository root:
node scripts/browser/anonymous.mjs http://127.0.0.1:4173
```
- Local test browser starts in a temporary blank profile, which is deleted after the test, so it cannot rely on a previously signed-in user. It uses the actual browser DOM and router, unlike Node mock tests. **No network call to a real login endpoint and no synthetic patient or Storage write** is intended.

## Manual hosted READ-ONLY browser acceptance (owner chooses when preview exists)

Do **not** run before Cloudflare Pages Free has a verified `https://<actual-project>.pages.dev` origin and Supabase Auth Site URL/redirects are approved. The test uses **existing confirmed disposable Auth Account A**, not new registrations. It authenticates and reads the existing saved synthetic owner profile, refreshes real browser session, visits existing patient and appointment lists, signs out, and checks protected route redirect. **It NEVER submits an owner, pet, appointment, staff or Storage mutation.** Sign-in/out can update Auth-managed session metadata.

On an owner-controlled machine, set environment variables locally (not through command-line arguments, GitHub logs, screenshots or git files):
- `DAWNEY_BROWSER_PAGES_ORIGIN` = exact deployed `https://<actual-project>.pages.dev`
- `DAWNEY_BROWSER_READ_ONLY=YES`
- `DAWNEY_TEST_A_EMAIL` and `DAWNEY_TEST_A_PASSWORD` = only the **existing disposable** confirmed account
- optionally `DAWNEY_CHROME_BINARY` if Chrome is not on PATH.

Run `node scripts/browser/read-only.mjs` from the repository root. The script refuses non-HTTPS/non-Pages URLs, never prints user credentials, and keeps its temporary browser profile off disk after exit. Do **not** run this against production with real users. Its assertions cover login, existing owner profile persisted after real browser reload, patient and appointment list accessibility (read-only), logout and unauthorized route protection.

**Excluded intentionally:** patient create/edit, booking create/cancel, clinical-record updates and private file upload/download. These all require fresh explicit owner authorization for synthetic writes and controlled cleanup. Browser test passing does not prove those workflows. For Storage deny tests and field-level ownership, use separate owner-approved HTTP security workflow; never weaken RLS.

## What remains

- A hosted Pages build, correct exact Supabase callback allowlist, consent to use disposable accounts in preview, and controlled browser completion evidence.
- Full browser clinic persistence/negative write workflows after explicitly approved synthetic clinical/Storage tests.
- Responsive visual checks by Claude on all new screens; independent accessibility audit with screen reader and keyboard, production CSP/redirect tests, deployed rollback verification and live data recovery rehearsal.
