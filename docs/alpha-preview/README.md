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

## Layout correction: fixed banner, header and rail (PR #56)

The Alpha is now a viewport-height app shell (`.alpha` is `100dvh`, `overflow: hidden`). The synthetic-data banner, the dark module header and the desktop rail never scroll. Only `.alpha-scroll` (a focusable, labelled region) scrolls. Nothing uses measured offsets: when the banner wraps, normal flow pushes the header down. On mobile the rail is a flex row under the workspace, not an overlay.

- Before: `08-scroll-before-1440x700.png` (old layout; header scrolled away).
- After: `08-scroll-after-1440x900-schedule.png`, `08-scroll-after-1024-inbox.png`, `08-scroll-after-360.png`, `08-scroll-after-dark-1440.png`.
- Evidence is from a stubbed local Chromium harness, not the live site. Regression coverage: `web/tests/alpha-rail-layout.test.mjs` (structure) plus real wheel/scroll checks of banner, header and rail rects across 8 viewports, 2 themes and 4 modules.
