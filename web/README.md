# Dawney Clinic — modern web client

React + TypeScript + Vite static client using Supabase Auth and RLS-backed owner workflows. The repository also preserves the legacy Laravel application in its root. See the [Phase 3 web foundation](../docs/PHASE3_WEB_FOUNDATION.md) and the current [root README](../readme.md).

## Local development

```bash
npm ci
cp .env.example .env.local
# Add only the public VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY values.
npm run dev
```

Never put `service_role`, `sb_secret_`, database credentials, tokens or clinic records in browser environment variables.

## Current status

The `web/` client is built and checked by GitHub Actions and is deployed as a static public Pages site from `master` at [dawney-clinic.pages.dev](https://dawney-clinic.pages.dev/). The current verified production deployment is commit `5fb7972e6844c18fa2f668566c450ea06123b59e` (Cloudflare deployment `15168ca6-f88e-4d30-9915-1dcc2cf5b75a`). The previous successful deployment `764624c4-4baa-428d-896f-766cca47e08b` at `2a29019` is the known rollback baseline. Open PRs are not automatically part of that deployment.

[PR #34](https://github.com/cmlagatuz/dawney-clinic/pull/34) contains the React foundation. [PR #41](https://github.com/cmlagatuz/dawney-clinic/pull/41) is currently at `59f8cb1`; its four CodeRabbit findings are fixed, but Qwen re-review and hosted JWT/RLS/Storage verification remain open. [PR #48](https://github.com/cmlagatuz/dawney-clinic/pull/48) contains the public website and service-aware booking UI. These remain unmerged and require the dependency order and owner approvals documented in the root README.

The separate [synthetic Alpha PR #56](https://github.com/cmlagatuz/dawney-clinic/pull/56) is not clinic staging and must remain isolated from `master`.

## Clinical workflow and security boundaries

The owner portal contains source-level pet and appointment workflows backed by Supabase contracts and RLS tests. The public booking flow represents a request, not a confirmed appointment. Service catalog availability, authenticated patient eligibility, hosted JWT/RLS/Storage behavior, real clinical writes, and clinic policy are not implied by a successful build or Pages preview.

The patient catalog and private attachment UI in #41 remains feature-flagged off until the current source review is independently rechecked and the backend/migration rollout is approved. Private Storage calls must remain owner-scoped and fail closed; no real files or patient data belong in tests or previews.

## Verification boundaries

- GitHub CI proves only the checks named in the linked run; stubbed browser tests do not prove hosted Auth.
- Synthetic or disposable PostgreSQL checks do not prove the connected Supabase project is ready for clinical use. PR #49 additionally has an honest recovered-schema-to-Phase-4 compatibility blocker: its simplified restored fixture lacks `anon` and other Phase 3 schema elements needed for a positive migration rehearsal.
- Hosted two-account JWT/RLS and private Storage negative tests require explicit owner authorization and controlled cleanup.
- Real Auth/database/Storage backup and restoration, approved clinic hours/time zone/services/species/resources, and post-deploy rollback verification remain required before a clinical launch.
- PR #59 currently has two pending CodeRabbit workflow findings: migration path filters and mutable #40/#43 ref fetching versus its fail-closed SHA guard. Astra must verify or correct them without weakening exact-head safety. Free-tier limits apply. No paid service, mandatory payment API, production SQL, staff bootstrap, credentials, patient records or spending is authorized by this README.
