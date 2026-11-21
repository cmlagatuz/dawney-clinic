# Dawney Clinic — modern web client

React + TypeScript + Vite, static-only, Supabase Auth and RLS-backed owner profiles. Preserves legacy Laravel source in repository root. See [Phase 3 setup and verification](../docs/PHASE3_WEB_FOUNDATION.md).

```bash
npm ci
cp .env.example .env.local
# Add only VITE_SUPABASE_PUBLISHABLE_KEY to .env.local
npm run dev
```

**Never** put `service_role`, `sb_secret_`, database credentials or clinic records in browser environment variables. The preview is an in-progress application, not approved for live medical records.

## Clinical workflow status

Pet list/create/edit and appointment request/list/cancellation are now backed by Supabase RLS and the existing booking collision constraint. See [the clinical-core scope and limitations](../docs/PHASE3_CLINICAL_CORE.md). Owner-approved clinic hours/time zone, browser verification with real JWTs and deployment are still pending; no live clinical operations are authorized.\n\n## Browser readiness\n\nCI now builds with inert public config and runs actual Chromium anonymous protected-route and 360px/1280px viewport checks (not real hosted Auth). See [Phase 4 browser verification](../docs/PHASE4_BROWSER_TESTS.md) for an owner-only **read-only** hosted browser script against existing confirmed disposable accounts. It is not authorized to create patients, appointments or Storage files; Cloudflare connection and real owner-controlled test are still pending.\n