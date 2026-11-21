# DAWNEY — Two-Track Public Frontend Release Package
**CLOUD | 21 November 2026 | DRAFT SOURCE + LOCAL TESTS, NOT AN AUTHORIZED DEPLOYMENT**

Frozen parent: PR #116 at b4129cdf6318cf43f27bc709ad8d1b2e87dfe669.
Child: ai/cloud/two-track-public-release-20261121, targeting ai/cloud/owner-patient-release-hardening-20261121.

This is ONE owner-selectable frontend package with two independent build profiles. Neither grants server privileges, publishes veterinary services or confirms appointments. Source-only and synthetic Chromium evidence do not establish hosted Auth, Storage, RLS or clinic-live readiness. The preserved Dog/Chow Chow patient and its appointment are unchanged.

## 1. Choose one source-only build profile

| Gate | A — Informational website, safest DEFAULT | B — Conditional connected owner booking CANDIDATE |
| --- | --- | --- |
| Reproducible build | From web/: npm ci --ignore-scripts --no-audit --no-fund; npm run build | From web/: supply ONLY the approved public Supabase URL and publishable key; npm run build:connected |
| Selection | Empty/invalid release selector and ordinary Pages preview all remain informational; build command clears inherited backend config and forces sensitive flags OFF | Explicit connected build command ONLY; syntactically validated nonsecret public Supabase config; refuses staff/clinical/pharmacy/billing/patient-form flags ON |
| Public routes | Home, Services, About, Location, Contact, Booking information, unknown-route 404 | Same public routes; currently approved Naga service/resource/schedule reader can conditionally render a request form |
| GoTrue/owner routes | NO AuthProvider; /auth and /app display a friendly unavailable state, no private data reads | Existing confirmed account flows, owner profiles, patient records, appointment requests/history, all subject to server Auth and RLS |
| Booking | Disabled completely. No time, price, duration, booking form, RPC, stored optimistic receipt or confirmation | Request-only. Existing approved Naga policy and typed service/patient/species/resource/UTC checks, exact-nonce retry after uncertain outcome, real persisted owner history |
| Cavite | Contact and directions only | Contact and directions only. No automatic Cavite policy activation |
| Clinical, pharmacy, staff, finance | Unavailable | Excluded from both public release build commands; independently reviewed workflows only, with specific owner permission |
| No backend config | Fully functional public informational routes | Fail closed to Profile A informational routes; do not offer disabled-looking login that would try an unauthorized session |

The selector is BUILD-TIME only. URLs, query strings, local storage, cookie values, preview hostnames and a publishable key alone NEVER select connected booking. A connected selection means only that the UI MAY CHECK the backend, not that the clinic approved publication or that appointments are available.

No staff, clinical, inventory, finance, payment or message actions are authorized by either release profile. Existing individual preview flags remain OFF by default. Local inherited synthetic tests are deliberately run with the connected profile selector and may toggle synthetic flags inside disposable Vite test processes; production build commands reject them.

### Commands

1. cd web
2. npm ci --ignore-scripts --no-audit --no-fund
3. npm test — the entire inherited Node/Chromium suite plus this profile suite, with synthetic intercepted HTTP and explicit test-only connected selector.
4. npm run build — DEFAULT Profile A, includes strict TypeScript and Vite.
5. npm run build:connected — Profile B candidate only when an approved public URL + publishable key are provided via local environment variables; NOT a release action.
6. node --test tests/two-track-release.test.mjs tests/two-track-release.browser.test.mjs — targeted two-profile source, access, and real Chromium checks.
7. node ../scripts/release/verify-static.mjs dist — public static headers, source-map/secret marker checks, safe artifact only.

No output is deployed by these commands. Running a connected build with a real public key is not approval to perform a live request or any patient write.

## 2. Public content contract for the clinic owner

| Path | Profile A content | Profile B conditional content | Always forbidden |
| --- | --- | --- | --- |
| / | Existing Naga branding, address, owner-approved displayed hours, Facebook contact and maps; Cavite as secondary | Same; see booking status page for any currently approved options | Fabricated appointment availability, treatment claims, prices, 24/7 or Sunday hours |
| /services | Eight informational Naga categories; explicitly not bookable/guaranteed care | Separate server-approved published Naga services and durations only after real typed read | Inferring priced/clinical procedures from marketing categories |
| /about | Existing branch descriptions and contacts | Same | Identifying patient facts |
| /location | Both verified addresses, external HTTPS map and Facebook links | Same | Location-tracking embeds, invented map destination |
| /contact | Clear Contact H1, each branch's public link and address | Same | Unapproved telephone, WhatsApp, third-party message widget |
| /book | Booking unavailable, contact Naga, Cavite contact-only; no form | Approved resource/service/date/time only on current backend approval; anonymous must sign in and own eligible pet to submit | Fake confirmed status, optimistic appointment saved, invoice, email/SMS delivered |
| /auth/* and /app/* | Accessible unavailable message; NO AuthProvider or private component | Existing verified GoTrue/owner routes only with valid build config and backend | Unverified patient information, unsupported staff shortcuts |
| Unknown URL | Accessible H1 Page not found, safe Home/Services links | Same for unknown public routes | Blank crash or private debug details |

**Content owner verification remains mandatory:** Naga and Cavite branch identity, addresses, maps, Facebook pages, displayed Monday–Saturday 8 AM–5 PM supplied hours and distinct Sunday-unconfirmed note, informational eight Naga categories, logo license and consent, clinic privacy wording, whether public search indexing may be enabled. Do not invent opening hours, prices, species eligibility, treatments, published clinic services, clinic holidays, physician schedules or telephone numbers. The existing robots.txt remains Disallow: / pending an explicit owner decision. Existing index.html OG metadata describes public branch facts only; no clinic customer data.

## 3. Static Cloudflare Pages routing

Cloudflare Pages documents that with no top-level 404.html it treats static output as a single-page application, serving index.html for unknown non-asset paths so React Router can display an accessible client-side Page not found. See https://developers.cloudflare.com/pages/configuration/serving-pages/ .

This source intentionally does not add public/404.html or a wildcard _redirects rule. The latter can take precedence over static-asset handling and potentially rewrite real JS/image URLs; see https://developers.cloudflare.com/pages/configuration/redirects/ . Static CSP, Referrer-Policy and frame restrictions stay in web/public/_headers. No Cloudflare account or DNS configuration is changed.

New browser tests validate /, /services, /about, /location, /contact, /book, /unknown-page, and deep /auth and /app fallbacks with direct navigation, browser refresh and back/forward. An isolated temporary Vite production build + real browser preview validates direct Pages-style root and nested paths plus actual PNG/WebP asset response. This is **LOCAL PREVIEW**, not hosted Cloudflare acceptance or a real HTTP 404 status (React displays the 404 UI after SPA fallback 200).

## 4. Release verification matrix

| Viewport/theme | A public routes, 404, no provider | B synthetic Naga/owner booking and unavailable contract | Manual WCAG/screen reader |
| --- | --- | --- | --- |
| 360 px / light | Real Chromium route matrix | Existing owner Chromium + new profile contract | NOT EXECUTED |
| 360 px / dark | Real Chromium, mobile menu Enter/Escape/focus | Existing owner Chromium + new profile contract | NOT EXECUTED |
| 768 px / light | Real Chromium route matrix | Synthetic approved Naga service, user, patient and history | NOT EXECUTED |
| 768 px / dark | Real Chromium route matrix | Synthetic approved Naga service, user, patient and history | NOT EXECUTED |
| 1440 px / light | Real Chromium route matrix | Existing owner Chromium + new profile contract | NOT EXECUTED |
| 1440 px / dark | Real Chromium route matrix | Existing owner Chromium + new profile contract | NOT EXECUTED |

### Browser acceptance to reproduce

- [ ] Profile A without ANY Supabase public URL/key: all six public routes render direct, show safe links, readable H1, per-route title, no horizontal overflow, keyboard focus, valid Naga/Cavite contact, light/dark. No booking form, login or appointment/patient placeholder; zero third-party HTTP.
- [ ] Profile A WITH a dummy public Supabase config accidentally inherited: same informational result with NO AuthProvider, no browser getUser, no network/Storage/booking calls.
- [ ] Explicit B with missing backend config: same unavailable informational fallback. Never fake a connected portal merely because the preview URL looks production-like.
- [ ] Explicit B with synthetic-approved Naga: service and duration only from approved branch/service/resource and schedule fixture, actual login form only when connected, eligible owner patient, request-only status. Cavite still contact-only. Staff, clinical, pharmacy and finance route links remain OFF for public builds.
- [ ] B unapproved, missing schema, offline policy, denied Auth/401/403, account A-to-B switch and stale appointments: render unavailable, deny booking submission, show error vs empty accurately. Retry policy reads safely; do not fallback to legacy insert or claim confirmation.
- [ ] Lost request response then exact nonce/payload retry; separate changed payload uses a separate user action, and conflicts require server enforcement. Never display a fake pending booking as persisted.
- [ ] Browser direct, back/forward, and refresh on deep /contact and unknown route. Static logo request returns an image, not HTML.
- [ ] Keyboard Tab/Enter/Escape and visible focus on menu and links; role=status and role=alert messages. Manual NVDA/VoiceOver and full contrast audit are still separate gates.
- [ ] External target=_blank links rel=noopener noreferrer, HTTPS; metadata and current route must not put pet IDs, names, symptoms, Auth tokens or Storage object keys in public URLs, browser console or third-party requests.
- [ ] No unexpected provider HTTP in synthetic browser sessions. Zero real Auth, SMS, clinical, Inventory, pharmacy, billing or Storage writes.

## 5. CI and independent exact-source obligations

The older PR116 full-tree CI failed closed BEFORE running its mandatory PG17/Node/Chromium jobs because historical source-blob pins and ASTRA's two-path CI allowance rejected a legitimate changed frontend AppointmentsPage. CLOUD MUST NOT touch the strict CI source guards or describe those jobs as successful. Existing normal frontend tests, static build, PHP and anonymous browser are independent evidence; their results must be taken from the exact final SHA and accurately distinguished from blocked full-tree tests.

ASTRA must later create an isolated, reviewed CI-only child with all exact approved Git blobs from PR116 and this PR117. This includes public App.tsx, SiteLayout, Home, Services, About, Book, NotFound, safe auth-return, release-mode, release-profile declaration/logic, portable release CLI, package scripts, env example, new Node/browser tests and this UAT; do not glob-allow arbitrary changes or bypass the historical migration/booking/storage guards. PM reviews proposed source ancestry. SOL independently verifies privacy/security and Qwen independently reruns functional browser coverage.

### Required hosted integration — NOT EXECUTED

1. ASTRA: ordered applied migrations, approved RLS/Auth and private Storage subject/object ownership, real two disposable verified owner accounts and safe patient registration with no historical Chow Chow mutation.
2. ASTRA: Naga exact branch, published service/species/resources/scheduling policy, timezone Asia/Manila, lead/horizon and holidays, server idempotent request nonce and conflict exclusion, persisted requested vs staff-only confirmed.
3. ASTRA/SOL: verify no private patient data in public information bundle, typed adapter responses, access denial and metadata finalization after lost acknowledgment. Independent recovery-ACL acceptance and signed restorable full PostgreSQL/Auth/Storage rollback.
4. Qwen: exact-head independent keyboard, dark-mode, two-tab account switch, direct refresh and denied/offline checks; manual screen reader and clinician operator evidence.
5. Manus/PM/human owner: provider staging evidence and content approval; production hosting, DNS, service publication, live SQL, patient exports, real messages, financial operations and spending each require specific human permission.

**Suggested release choice:** Profile A is only a source candidate for a polished informational launch after owner-reviewed content, exact-source CI and hosted static-route acceptance. Profile B is NOT clinic-live ready without all security, persistence and clinic policy gates. Either option requires explicit human release approval. **Single next owner: PROJECT MANAGER** — coordinate independent Qwen review, ASTRA/SOL contract/CI reconciliation and owner-approved hosted acceptance. CLOUD will not merge or deploy.
