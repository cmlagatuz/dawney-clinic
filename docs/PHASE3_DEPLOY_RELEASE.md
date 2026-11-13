# Phase 3 — Cloudflare Pages Free and versioned GitHub release readiness

**Date:** 2026-11-13 · ChatGPT-owned engineering. **No Cloudflare Pages project or live URL verified.** The site is **NOT approved for clinical use** and must remain a test/preview until owner go-live authorization.

## Reconciled Git repository history

The current `master` ancestor `650329834fb03943abcd226cdcc4df787b0bcda5` is the two-parent commit labeled "Complete merge of unrelated histories". Its **Git tree SHA `32048b53372dd6a8cf5497e092aa78a0580b7bc5` is identical to both its parents** (`c4e45965` and `d5c4f631`), so that merge changed history ancestry, **not tracked application file content**. Two later commits updated shared planning/handoff. **Never force-push, reset, or drop either parent**. New work branches from latest master and merges after review.

## Exact owner Cloudflare Pages Free Git setup

As Cloudflare does not have a connected management action in this session, owner action is required. Use [Cloudflare Pages Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/).

1. Sign in to [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**. Select the GitHub account with authorization to `cmlagatuz/dawney-clinic`. If GitHub requests access, grant only the repository scope needed.
2. Create a Pages project for **this** Git repo. Production branch: **`master`**. **Root directory:** `web` (monorepo subdirectory).
3. Select framework **React (Vite)** (or **Vite** preset if shown). **Build command:** `npm run build`. **Build output directory:** `dist`. Set build environment `NODE_VERSION=22`. The committed `web/package-lock.json` is required; use locked dependencies and review logs.
4. Add the following **public build variables** to both intended Production and Preview build environments:
   - `VITE_SUPABASE_URL=https://lgimhirgvresvbsdugac.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY=<the actual enabled sb_publishable_... key from Supabase Project Settings → API Keys>`
   - `NODE_VERSION=22`
   **Never** set `SUPABASE_SERVICE_ROLE_KEY`, `sb_secret_` or database passwords in any frontend `VITE_` value.
5. Before exposing clinical functionality, review deployment previews. **Connect to Git causes changes on the configured production branch to trigger automatic builds/deployments**, and PR branches can create public `*.pages.dev` previews. Verify access to preview pages is appropriately limited; use only synthetic accounts and records.
6. Cloudflare provides a `https://<project>.pages.dev` URL after a successful Pages deployment; record the **actual verified URL**, project slug and deployed commit in the handoff (never invent them).
7. In [Supabase Authentication → URL Configuration](https://supabase.com/dashboard/project/lgimhirgvresvbsdugac/auth/url-configuration), set **Site URL** to the approved HTTPS Pages origin and allow exact redirect URLs `https://<project>.pages.dev/auth/callback` and `https://<project>.pages.dev/auth/recovery`. Also add only explicitly approved preview URLs; avoid a broad `https://**` wildcard. Leave email confirmation enabled.
8. Open the deployed root and **directly refresh** `/auth/signin`, `/app/profile`, `/app/pets`, `/app/appointments`; inspect network/CSP headers, installability and mobile viewport. The app is a client-side SPA, so fallback deep links must deliver `index.html`. A non-authenticated HTTP probe is available in this repo (see below).
9. Do **not** invite real owners or accept patient documents until real A/B JWT security, end-to-end clinical persistence, private Storage deny testing, complete data/identity/Storage backup, measured isolated restore and owner privacy sign-off have passed.

### Rollback

Open **Cloudflare Pages project → Deployments → All deployments**, find the previous **successful production** deployment, three-dot menu → **Rollback to this deployment**. The rollback changes **static frontend content only**; it does not undo Supabase migrations, Auth users, clinical rows or Storage. Never run destructive DB restoration in the active project. Keep a separate migration and recovery decision record.

## CI and automated GitHub Releases

`.github/workflows/phase3-release.yml` is a separate **release artifact** workflow, not a Cloudflare deployment credential integration.

- **PR verification** (paths: web/, scripts/release/, workflow): Node 22, `npm ci`, domain tests, TypeScript/Vite build, security-header/static-output scan, release safety unit tests. PRs build with **inert public dummy configuration**; no clinical secrets.
- **Manual workflow_dispatch**: builds the verified static artifact using the public URL and publishable key already saved as repository GitHub Actions Secrets. Downloads are temporary 7-day CI artifacts; manual mode **does not publish a Release**. Owner can optionally provide an approved `https://<project>.pages.dev` origin to check public HTTP deep links and headers.
- **Automated GitHub Release**: a newly pushed **`vMAJOR.MINOR.PATCH`** tag whose commit is in `master` triggers the workflow. CI requires the public publishable key, validates commit ancestry, builds/tests the frontend, checks the bundle for backend credentials and then **automatically publishes** `dawney-clinic-vX.Y.Z-static.tar.gz` plus matching `.sha256` on GitHub Releases using only the built-in `GITHUB_TOKEN` (no paid provider token). It refuses to overwrite an existing release.
- A GitHub Release is a **build archive**, **not** proof of a Cloudflare Pages deployment or clinic go-live. Do not tag a real clinic release until the owner approves the test gates. Archive filenames are checksum-protected; no database backups or secret credentials are included.
- To prepare a safe build-only rehearsal now: [Actions → Phase 3 static release preparation](https://github.com/cmlagatuz/dawney-clinic/actions/workflows/phase3-release.yml) → **Run workflow** → `master`, optional approved Pages URL if available. Inspect the run and artifact. No tag, release or deployment is created by a manual run.

**Post-Auth acceptance update:** The owner-dispatched baseline A/B Auth contract has passed; this does not itself verify Pages hosting or private clinical documents. The HTTPS probe now covers all ten explicit React entry routes (root, six Auth, three protected pages). Follow [browser, staff, scheduling and recovery acceptance gates](PHASE3_LIVE_BROWSER_ACCEPTANCE.md) after a real Pages origin exists. No clinical records or credentials are needed for this public HTTP probe.

### Optional live Pages header/deep-link smoke

After owner provides the verified `https://<project>.pages.dev` URL, use:

```bash
node scripts/release/check-pages.mjs https://<project>.pages.dev
```

This performs unauthenticated HTTPS GETs of the root, sign-in, callback, recovery, profile and pet deep links. Every route must return React index HTML, HTTP 200, CSP and `nosniff`. **This is not a browser test or Auth/RLS verification**, and does not create patient data. It accepts HTTPS `*.pages.dev` hosts only, with no URL credentials or query strings.

### Free-only and residual risks

- Cloudflare Pages Free is quota-limited, not guaranteed 24/7; Git-linked deployment comes from owner setup. Cloudflare currently describes Workers as its primary platform, but Pages remains a supported static Git deployment path. Do not migrate this React SPA into Workers without a separate review.
- Existing code uses public publishable key only. A public key in compiled browser JS is **not a secret**; RLS remains the security boundary.
- The Git history merge did not delete tracked files. The legacy Laravel application remains historical reference, not something Pages executes.
- Current Supabase Free security advisors: `rls_enabled_no_policy` INFO for locked internal legacy mapping and staff audit tables; `auth_leaked_password_protection` WARN (dashboard indicates Pro-only). No zero-cost upgrade to Pro is authorized. The project uses confirmed accounts, RLS, unique passwords (8 minimum with letter/digit; 12+ recommended) and staff isolation; add free MFA to privileged users before onboarding. Five unused-index INFO advisories reflect no real app traffic and are not reasons to drop FK-support indexes.
- Keep real clinical data off Pages and GitHub Actions. A real authenticated clinical/browser persistence check and isolated full restore are still missing.
