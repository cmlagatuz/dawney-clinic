# Dawney — ACTIVE EXECUTION ORDERS (3 available AIs)

> **LATEST OVERRIDE (2026-11-14):** The CURRENT FIVE-AGENT tasks and verified source/DB/CI checkpoint are in [PHASE4_FIVE_AGENT_DISPATCH_2026-11-14.md](PHASE4_FIVE_AGENT_DISPATCH_2026-11-14.md). **This supersedes the older 3-AI / Grok-paused / Claude-paused task assignments below.** Claude #48 `a147f53` finished the booking-mode compatibility UI, Astra #52 passed the four-migration rehearsal, Manus onboarding is prepared but not confirmed completed. Next tasks: Astra restore rehearsal, Claude animal eligibility UX, Qwen independent QA, conditional Grok security, Manus Cloudflare #45 diagnostics. No live migration or source merge authorized by this update.

> **Operational override — 2026-11-14 13:32 Asia/Riyadh: GROK PAUSED (Free quota exhausted).** GitHub shows draft PR #39 unchanged at `5210ec9336`, last PR discussion update only supervisor instruction at ~10:16 Riyadh; **no verifiable execution or final audit for GROK-005**. Do not treat its earlier partial audit as security clearance or ask owner to pay. Claude remains on interrupted frontend task. **Active now: ASTRA + QWEN only.** Astra has already fixed mergeability on #40/#49, fresh PG17/CI passing; do not repeat. New Astra next step: run a single disposable full-chain 4-migration cross-PR integration rehearsal with booked/pet legacy fixture + negative owner A/B/anon and privacy probes; first check existing tests for coverage and only add missing critical assertions on a scoped test branch. Supply exact CI links and one concise source-merge GO/NO-GO, with no self-merge/live SQL. New Qwen next step: continue current 5-issue customer journey report but reallocate final portion to **independent read-only security substitute for Grok's missing final report**; inspect public booking PR #43 (#50 incorporated), UI #48 and Issue #51, highlight confirmed vulnerabilities in column SELECT/RLS, replay/rate-limit, staff confirmation, owner isolation. Deliver <=5 code-grounded findings + read-only security PASS/FAIL/UNTESTED matrix; no claim of executed tests. **Supervisor retains final independent review before any source merge, and production activation remains blocked until proper security validation.** Do not create overlapping tests/branches or expand feature scope.


**Supervisor directive — 2026-11-14.** No owner deadline. Optimize for an **approved customer-booking MVP first**, not broad clinical-suite completion. **Claude is quota-paused; do not interrupt or overwrite Claude #34/#41/#48 branches.** Existing source-of-truth release order: [accelerated MVP plan](PHASE4_ACCELERATED_MVP_RELEASE_PLAN.md). This task sheet supersedes older agent prompts.

## Current verified baseline

- `master` at execution dispatch: `351e2ca3a210`. Phase 4 open PRs **#34,#39(draft),#40,#41,#43,#46,#47,#48,#49**. **#50 merged into #43's head only**, not master.
- PR #43 source head `e8853f302`: PG17/Node/React/Chromium CI green; new booking compatibility adapter and regression tests already exist. **Do not repeat the work**.
- PRs #41 and #48 are stacked on Claude #34, not master; public site preview is not production. Live Supabase Phase 4 migrations not applied. No production SQL, deletion, release merge, booking policy approval, paid services.
- Exact Dog/Chow Chow mapping already exists in #40; preserve patient and appointment and stop reopening breed discussion.
- #46 standalone Chromium CI fix passed; #47 validation on Claude #34 passed; initial #34 run succeeded on rerun. Cloudflare `Workers Builds` fails separately from Pages and needs owner inspection #45.

## Execution policy — all agents

1. **Do not write new plans or generalized status essays.** Read only active brief, relevant PR diff and tests. Deliver code or concrete QA/security findings.
2. **One focused working branch / artifact per agent**; don't rewrite other agents' components or create overlapping parallel PRs.
3. Spend effort on implementation and validation; at most two repeats on an unexplained failure before reporting precise blocker. No token-consuming re-audits of settled issues.
4. **CI or isolated execution evidence is mandatory** for claims that tests passed. Qwen Chat may only propose code and test patches; it has no verified shell.
5. No self-merge, no production migrations/writes, no release activation, no new external/paid integrations. STOP at owner-controlled operations.
6. Final handoff maximum **400–600 words**: changed file(s)/commit/PR, tests with URLs (or NOT RUN), up to 3 blockers, one explicit approval request or next action.

## ASTRA — OWNERSHIP: CI, booking backend and merge readiness

**Primary deliverable:** make current backend/CI PRs **READY FOR SUPERVISOR REVIEW**, not build extra features.

1. Review #46 browser preflight and #47 test evidence; inspect latest #34 native browser success. If #46 is clean, recommend exact safe merge path and whether #47 should be closed as validation-only after fix. Update #46 **only if tests find a real flaw**.
2. Inspect latest #43 (already includes #50 privacy and #51 compatibility adapter) and rerun/extend a **small, high-value isolated PG17 regression** proving: legacy service-less request accepted only while policy unapproved; approved policy blocks legacy insert; verified-owner approved-service RPC writes only `requested`; anonymous and owner B cannot see private actor columns or book pet A; nonce retries are idempotent and resource conflicts fail closed; existing appointments unaffected.
3. Inspect #40 and #49 current mergeability/SQL fingerprints. Report exact merge ordering: #46 -> #34; #40 before #43; #49 checklist; #41 and #48 must be retargeted only after #34 and booking contracts land. If #40 or #49 is unmergeable, diagnose **actual conflict** and propose minimal safe repair; do not mistake a pending GitHub mergeability calculation for a proven conflict.
4. If one untested backend gap is real (e.g. booking denial/abuse), submit **one bounded test-first fix on #43 or a scoped review branch** with passing CI. Don't design a new clinic scheduling subsystem.
5. Deliver a short **READY / NEEDS CHANGE / OWNER-GATED** table for each PR. DO NOT merge, touch Claude files, apply live migrations or approve schedule.

## QWEN CHAT — OWNERSHIP: independent customer journey QA, read-only

**Primary deliverable:** five evidence-backed defects/test gaps with reproducible steps **plus a compact executable test patch when source access permits**.

1. Read diffs for #48 public site, #41 patient form, #43 service-aware booking and Issue #51. Check public route deep links/404/empty services, accessible login, mobile focus, screen-reader labels and owner-session protection.
2. Audit customer journey `/ -> /services -> /book -> signup -> email verify (new tab) -> pet -> request -> Requested`: identify exactly where sessionStorage intent can be lost, what is displayed when service policy unapproved, where nonce/fresh request could duplicate, and what timezone is shown.
3. Review legacy `/app/appointments` compatibility when policy changes, existing pet eligibility (not all catalog species are treated), private upload failures, and customer-visible statuses.
4. Top **5** severity-ranked findings only, with file path/line evidence, expected/actual behavior and suggested test. Add a minimal copy-ready `web/tests/` test patch for **the highest-priority failure** if file contents available.
5. **DO NOT** claim browser execution, repo push, PR, or live Supabase verification; leave those to Astra/GitHub CI.

## GROK BUILD — OWNERSHIP: final independent security threat verification

**Primary deliverable:** release security gate with **confirmed** vulnerabilities vs owner-policy decisions, not another broad taxonomy audit.

1. Analyze current #43 **after #50**, #48 booking UI, #40 migration, and draft #39. Confirm column-level anon/auth SELECT denial for actor UUID fields without breaking SECURITY INVOKER RPC, RLS for pet/owner A/B, staff-only confirmation, direct insert fail-closed behavior, replay/nonces, resource conflict and explicit public services restrictions.
2. Evaluate real abuse surface: appointment spam/calendar fill, session intent and login-return open redirect/data leakage, unauthorized receptionists confirming, metadata/private clinical attachment reads. Only mark a finding confirmed with code-level evidence; label unexecuted cases NOT TESTED.
3. If a P0/P1 flaw found, provide **one narrowly scoped SQL/test patch** on Grok's own audit branch or as copy-ready diff; no changes to Astra or Claude branches. Avoid false positive old 'missing trigger' (second seed already installs it).
4. Clear or explicitly retire stale findings in draft #39; recommend **GO / NO-GO for backend source merge** separately from production activation.
5. No live Supabase writes, clinical records, secrets, free quota waste or paid operations.

## Completion / handoff gate

After Astra/Qwen/Grok evidence arrives, supervisor independently checks #46/#34 and #40/#43/#49, approves or rejects each merge; Claude resumes existing work before next UI task. Next release-critical UI task after Claude finishes: replace/redirect service-less `/app/appointments`, correct verification return and remove temp copied typed adapters from #48 after backend merge. Only owner can approve full data recovery, 4 ordered Phase4 migrations, real service publication/hours/resources, Cloudflare Worker disconnection and any live write acceptance.

**This file assigns work; it does not execute AI sessions by itself.** Owner should send three corresponding agent prompts.