# Dawney Clinic — modern web client

React + TypeScript + Vite, static-only, Supabase Auth and RLS-backed owner profiles. Preserves legacy Laravel source in repository root. See [Phase 3 setup and verification](../docs/PHASE3_WEB_FOUNDATION.md).

```bash
npm ci
cp .env.example .env.local
# Add only VITE_SUPABASE_PUBLISHABLE_KEY to .env.local
npm run dev
```

**Never** put `service_role`, `sb_secret_`, database credentials or clinic records in browser environment variables. The preview is an in-progress application, not approved for live medical records.