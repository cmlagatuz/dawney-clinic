# Dawney Clinic — Supervisor Release + Alpha Preview Dispatch
**Checkpoint:** 2026-11-14, Asia/Riyadh. **User directive:** all five specialists have new non-overlapping work; **Grok remains unavailable** and may not be represented as running.

## Verified source state (recheck on every action)
- `master` `9388a45b6bb5b823c7f2149a9945e76c46a47576`: recent documentation and Manus automation setup; **no Phase4 source PRs merged**.
- PR #46 Chromium CI `e992732a` and PR #34 Claude React shell `08bc40a` have browser/React/Pages checks passing on HEAD; Manus reviewed each on 2026-11-14 17:42 UTC. Both report mergeable=true, unstable due to stale historic Workers check; recheck latest master, protection rules, and CI immediately before owner-approved source merge. #46 first, then #34. Never pretend historical Workers failures retroactively turn green.
- Cloudflare Workers build integration disconnected and independently Pages successfully deployed on `master`; [Issue #45](https://github.com/cmlagatuz/dawney-clinic/issues/45) CLOSED after Manus posted provider verification.
- #40 taxonomy, #43 booking, #49 synthetic recovery, #52 four-migration rehearsal remain open. Four ordered Phase4 migrations pass in disposable PG17, but **not applied to live Supabase**. Live: 6 Phase2/3 migrations; two confirmed Auth users, 2 owners, 1 pet, 1 appointment, 0 staff, 0 Storage objects. Preserve the Chow Chow and appointment. No live backup/restore guarantee.
- Claude #48 `3c601ce`: React/build/browser/Pages green; patient eligibility UX complete, per-service species reader still requested from Astra #43; #48 is stacked on #34 and contains temporary copies of #43 booking helpers. #41 remains flag OFF.
- No source-backed Qwen final QA report verified in Issue #36. Grok #39 draft incomplete/quota unavailable.

## The owner’s ORIGINAL 11.2-sec CRM reference
Actual original video `WhatsApp clinic CRM dashboard_1920p.mp4` inspected by supervisor. The detailed design interpretation is [CRM video reference](CLINIC_OPERATIONS_CRM_VIDEO_REFERENCE.md):
1. **Patient-flow board** with KPI tiles and Expected/Waiting room/In consult/Seen.
2. **Inbox** with conversation list, tags, unread and quick replies.
3. **Schedule** day/week, provider/room filters, blocked intervals.
4. **Campaigns** template/broadcast cards, opt-out handling and confirmation.
This is a **human-clinic UI example**, not proof of working clinical backend, actual WhatsApp APIs, rates or consent.

## Two-track delivery decision
**Track A: FIRST visible interactive Alpha Preview — [Issue #55](https://github.com/cmlagatuz/dawney-clinic/issues/55).**
Build *one isolated Cloudflare Pages preview branch/PR* (stacked on current #48 if safe), clearly labeled **SYNTHETIC DEMO**, with clickable four modules and no real Supabase queries, writes, messaging, or production feature flag. The user can examine layout and interactions before the production rollout. Never merge the demo route/data to master or advertise it as a live clinic platform. Deliver an actual reachable Pages PR preview URL with HEAD SHA, test evidence and screenshots; if deployment unverified say so. No fixed date can be guaranteed until the agent has executed, built and verified the branch.

**Track B: CONNECTED clinical Alpha — later owner-gated.**
Requires #46/#34/#40/#43/#49/#52/#41/#48 integration, approved restorable real backup, RLS/JWT/Storage/roles, authorized clinical transitions, owner/vet policies and clinic content. Telegram provider actual sending needs separate setup/consent; WhatsApp official API may incur cost; Campaign send disabled in first preview. Scope Phase5A → Schedule → Inbox → Campaigns. Do not confuse visual alpha with connected secure application.

## New specialist assignments
### Claude — ACTIVE, visual Alpha Track A (single owner)
Own Issue #55. New independent demo PR isolated from master/current clinical backend; preserve #48 existing booking. Implement all four interacting synthetic modules responsive + keyboard, preview URL, test screenshots. Avoid CRM API, auth bypass, real messages and unrelated code. Deliver smallest coherent UI first: patient-flow + schedule usable, then add inbox + campaigns to same PR; do not proliferate PRs. Clearly state development/testing is not started until actual code and CI are visible. Existing service-eligibility UI is done; wait for Astra's reader before touching production booking again.

### Astra — ACTIVE, narrow backend integration contract
Own #43 backend. Finish authenticated `listServiceSpeciesIds(serviceId)` or proven safer equivalent per [Claude contract request](https://github.com/cmlagatuz/dawney-clinic/blob/ai/claude/public-website/docs/phase4-ui/appointments/ELIGIBILITY_CONTRACT_REQUEST.md). Use existing RLS; no grant widening, no live DB, distinguishing empty from error; provide one focused negative test/TypeScript CI. Next, prepare a **read-only architecture/permissions handoff** for future staff dashboard status transitions and audit without adding production schema to Phase4 or editing Claude preview. Synthetic restore #49 and four-migration rehearsal #52 are complete; do not repeat.

### Qwen — ACTIVE if reachable, independent read-only QA
Issue #36 + #55. No verified Qwen terminal, so **no tests claimed executed**. Provide a small video-to-alpha acceptance checklist (4 modules, keyboard/mobile, synthetic-data leak/cross-tenant safety) and check remaining existing #48/#43 booking QA. After Claude posts demo PR head, independently inspect actual code and return <=5 severity-ranked source-backed defects and one test proposal. Don't block synthetic demo launch on non-code security speculation.

### Manus — ACTIVE, release/preview operations
Post evidence directly to existing GitHub PRs/issues. #46 and #34 readiness reviews are DONE: no more duplicate broad reviews. **Next:** prepare the exact sequential source merge/deployment go/no-go for #46 then #34 using today's master and current checks (no merge), evaluate required-check policy access; then track Issue #55 new demo PR Pages preview (actual SHA/URL, content is synthetic and no secrets; no false connection claims) and post demo preview verification on #55. Never auto-merge, alter DNS, approve spend, or deploy real clinical data. Existing GitHub `New pull request` automation does not trigger for preexisting PRs.

### Grok — PAUSED, conditional future task only
When Free quota recovers, complete independent source security review #39 against current #43, #48 and #52 (actor metadata privacy, owner isolation, consent/spam, authenticated booking, storage) with <=3 confirmed severe defects and minimum negative tests. No paid reset, no invented security signoff. Grok absence **does not block** a synthetic-only, no-backend CRM UI alpha; it does block claiming an independently cleared production clinical security release.

### GPT-6 supervisor
Own final source merge decisions and coordination. No autonomous source merge, live SQL, clinic approval, staff auth elevation or public campaign activation based on these dispatch notes.

## Acceptance communication
Each AI must post a brief evidence report directly on relevant GitHub Issue or PR: **HEAD SHA | changed | CI/test URLs | Cloudflare preview if applicable | blockers | next single action**; no owner copy/paste needed. A GitHub assignment comment **does not automatically launch an AI session**. Start the Claude demo work via its available active task session or connected trigger.

## Preview links distinct
- Current production Pages `https://dawney-clinic.pages.dev/`: master, **not** the CRM alpha.
- Existing Claude #48 branch preview `https://c489430b.dawney-clinic.pages.dev/`: provider-reported successful public booking UI build at `3c601ce`; **not** the video-inspired staff CRM, web fetch unavailable to supervisor.
- **Actual CRM alpha preview:** **NOT AVAILABLE YET**. It becomes available only after Claude implements Issue #55, green builds and provider-verified branch preview. Do not invent a date/URL.
