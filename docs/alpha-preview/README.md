# Interactive CRM Alpha Preview (Issue #55) — SYNTHETIC DEMO

**Route:** `/alpha/clinic-ops` (+ `/schedule`, `/inbox`, `/campaigns`). Branch preview only; **never merge to `master`**.

| Boundary | How it is enforced |
| --- | --- |
| No real data | Invented "Demo Owner NN" contacts, generic weekdays (no dates), placeholder `[DEMO TEXT]` replies. |
| No backend | `web/src/alpha/` imports no Supabase/lib/hooks and calls no network/storage/messaging API — enforced by `web/tests/alpha-model.test.mjs` (source scan). The route bypasses `AuthProvider`. |
| No messages | Inbox sends only append a local bubble marked `SIMULATED — not sent`; Campaign **Send is disabled**; no delivery/read/reply metrics are shown. |
| No production exposure | `alphaPreviewAllowed(hostname)` refuses `dawney-clinic.pages.dev` and any non-`*.dawney-clinic.pages.dev`/localhost host (fail closed); `noindex`; always-visible banner. Not linked from the public site. |
| Existing site untouched | Public/owner routes and booking behaviour unchanged; alpha is a lazy chunk loaded only for `/alpha/*`. |

Screenshots (all synthetic; stubbed local Chromium harness, not live): `01-patient-flow-1440.png`, `02-schedule-1440.png` (+ `02-schedule-drawer-1440.png`), `03-inbox-1440.png`, `04-campaigns-1440.png` (+ `04-campaigns-confirm-1440.png`), `05-flow-768.png`, `06-flow-dark-1440.png`, `m360-*.png`.
