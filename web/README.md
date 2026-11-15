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

The `web/` client is built and checked by GitHub Actions and is deployed as a static public Pages site from `master` at [dawney-clinic.pages.dev](https://dawney-clinic.pages.dev/). The current verified production deployment is commit `2a29019c52152b7d1944012df1e66018d6cb2101` (Cloudflare deployment `764624c4-4baa-428d-896f-766cca47e08b`). Open PRs are not automatically part of that deployment.

[PR #34](https://github.com/cmlagatuz/dawney-clinic/pull/34) contains the React foundation. [PR #41](https://github.com/cmlagatuz/dawney-clinic/pull/41) contains a feature-flagged patient catalog and private attachment form. [PR #48](https://github.com/cmlagatuz/dawney-clinic/pull/48) contains the public website and service-aware booking UI. These remain unmerged and require the dependency order and owner approvals documented in the root README.

The separate [synthetic Alpha PR #56](https://github.com/cmlagatuz/dawney-clinic/pull/56) is not clinic staging and must remain isolated from `master`.

## Clinical workflow and security boundaries

The owner portal contains source-level pet and appointment workflows backed by Supabase contracts and RLS tests. The public booking flow represents a request, not a confirmed appointment. Service catalog availability, authenticated patient eligibility, hosted JWT/RLS/Storage behavior, real clinical writes, and clinic policy are not implied by a successful build or Pages preview.

The patient catalog and private attachment UI in #41 remains feature-flagged off until its independent review findings are resolved and the backend/migration rollout is approved. Private Storage calls must remain owner-scoped and fail closed; no real files or patient data belong in tests or previews.

## Verification boundaries

- GitHub CI proves only the checks named in the linked run; stubbed browser tests do not prove hosted Auth.
- Synthetic or disposable PostgreSQL checks do not prove the connected Supabase project is ready for clinical use.
- Hosted two-account JWT/RLS and private Storage negative tests require explicit owner authorization and controlled cleanup.
- Real Auth/database/Storage backup and restoration, approved clinic hours/time zone/services/species/resources, and post-deploy rollback verification remain required before a clinical launch.
- Free-tier limits apply. No paid service, mandatory payment API, production SQL, staff bootstrap, credentials, patient records or spending is authorized by this README.
