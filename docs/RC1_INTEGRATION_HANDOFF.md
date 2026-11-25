## RC1 source integration — 25 November 2026

Exact PR134 `73067fcdbce7846522e55c33cd0e0ca2051335f4` eight-path correction accepted by PM [7152144119](https://github.com/cmlagatuz/dawney-clinic/pull/132#issuecomment-7152144119), SOL and TERRA; imported without other frontend edits. All 21 migrations remain frozen. Integrated CI and final independent acceptance pending; no clinic-live GO. Memory-only unresolved-operation warning is not durable reload reconciliation. No new SQL contract authorized. Hosted operations and relevant write flags remain OFF.

## ASTRA — RC1 approved frontend source import (CI pending)

PR133 exact `052a97da1e7ff4e95d46331f6b657f199592bd84` accepted by SOL and PM. Nineteen exact frontend/document blobs imported; README reconciles both sources. All 21 backend migration blobs unchanged. Historical CI guards still require explicit RC1 reconciliation; no integrated acceptance or hosted authorization. CLOUD must await green exact-head baseline and PM confirmation.

# RC1 — Source integration preparation and release handoff

**2026-11-24; DRAFT / PREPARATION ONLY — NOT A FINAL COMBINED CANDIDATE AND NOT CLINIC-LIVE.** This child is based exactly on independently SOL-source-PASS PR #130 (`b6ee64b38ca4ce2965f2b02f09a4e5584aa56608`). Its PR targets the PR130 branch. It does not modify SQL, Auth, RLS, clinical data or any deployed environment. The owner and PM have NOT approved hosted migration or release.

## Strict source decision

| Lineage | Frozen head | Evidence |
| --- | --- | --- |
| PR #129 unified RC0 | `078053120774e856c9ddaa8c8027b3c891e9e8f6` | 16/16 workflows reported PASS; source-only, not hosted acceptance |
| PR #130 appointment backend | `b6ee64b38ca4ce2965f2b02f09a4e5584aa56608` | 14/14 reported PASS; SOL exact-head source security PASS at [comment 7116093798](https://github.com/cmlagatuz/dawney-clinic/pull/130#issuecomment-7116093798) |
| PR #131 CLOUD appointment frontend | `00e7f072e58a684970f00ea15d2b9b614ce8aebe` | 302/302 frontend tests reported PASS; full-tree source guard FAIL as intended because PR129 did not include the 12 frontend paths |

PR130 and PR131 are **separate siblings** with PR129 as merge base. Exact migrations #1–#21 are pinned in `docs/RC1_MIGRATION_BLOBS.tsv` (path AND Git blob SHA). The **provisional, not yet imported** 12-path PR131 manifest is pinned in `docs/RC1_PENDING_CLOUD_BLOBS.tsv`. These are explicit individual paths, never a wildcard or a broad source allowlist. Original historical RC0 / #21 source guards remain unchanged here. The 21st migration has blob `969db983facf7082e243d9ebae6e3fe7cdf65a39`.

**Dependency lock:** PM comment [7123365850](https://github.com/cmlagatuz/dawney-clinic/pull/130#issuecomment-7123365850) requires the final CLOUD hardening SHA, its exact PM approval and SOL contract assessment before ASTRA imports/finally pins the frontend. These are NOT established by the baseline PR131 handoff. This preparation branch intentionally contains **no UI import** and must not be represented as completed full-tree RC1.

## Canonical appointment RPC / frontend reconciliation record

- Only server writer: `public.transition_staff_appointment(p_appointment uuid,p_branch uuid,p_action text,p_expected_revision integer,p_request_id uuid)` from proposed #21; result `{kind:'staff_appointment_transition', appointmentId,branchId,status,revision,action}`.
- Exactly six actions: `confirm`, `decline`, `check_in`, `complete`, `no_show`, `cancel`. `decline` persists `cancelled`, not a nonexistent `declined` status.
- PR131 `web/src/appointments/lifecycle.d.mts` and `port.ts` signatures match those names and fields on inspected frozen source. The canonical backend API contract remains `docs/STAFF_APPOINTMENT_LIFECYCLE_CONTRACT.md`; do not introduce a second SQL API or duplicate implementation.
- Confirm: requested→confirmed; decline: requested→cancelled; check_in: confirmed→checked_in; complete: checked_in→completed with matching persisted branch encounter and vet/admin; no_show: confirmed→no_show after start; cancel: requested/confirmed→cancelled.
- Never grant browser direct staff `UPDATE(status)`. Owner's preexisting limited cancellation is preserved. A server revision, stable nonce on lost ACK, server readback and current verified Auth/session/global+branch membership are mandatory; accountant and wrong-branch denied.
- Backend locks active current `auth.users` together with staff membership rows (`FOR SHARE OF sm,bm,u`) through completion and session row through actor helper; SOL independently closed the prior concurrent ban P2 at PR130 exact SHA.
- `VITE_STAFF_APPOINTMENT_WRITES_ENABLED=false`, `VITE_PHASE5A_OPS_UI=false`, `VITE_STAFF_APPROVAL_WRITES_ENABLED=false`, `VITE_INVENTORY_WRITES_ENABLED=false` unless an individually approved staging plan activates a flag ONLY in isolated staging; no default change in this branch.

## Architecture and real source modules

Preserved legacy: Laravel 5.8 / PHP / MySQL, not executable on static hosting; maintain migration mapping. Modern candidate: `web/` React + TypeScript + Vite public site, verified Auth owner portal, species/breed/patient registration, private patient attachments, requested booking, owner history, branch staff queue/day-week scheduling, staff approval, clinical encounter *drafts*, medicine inventory reading and reviewed transactional Add Item/Receive stock backend, branch billing **UI only** where financial backend contracts are missing. Supabase Free PostgreSQL/Auth/private Storage is proposed backend; Cloudflare Pages Free is static preview/frontend hosting. A successful Pages preview is not provider UAT or patient-safety acceptance. Public service catalog/hours/resources must be clinic-approved, not fabricated.

## Agent accountability and historical handoff

Supervisor/PM: owner-authorized release sequence, acceptance decisions and dependencies. ASTRA: exclusive backend, PostgreSQL/RLS/Auth/Storage, signed recovery and combined CI. CLOUD (GPT-6 Sol successor to quota-limited Claude): frontend, usability, accessibility and real local Chromium. SOL: independent read-only security and contract gate. TERRA/OpenCode: independent local functional QA when quota permits; Qwen: separate source-only or test QA as assigned. Manus: operations/handoff when available (currently suspended; no assumed output). Legacy Claude/Grok contributions remain in frozen history. GitHub source is authoritative; these roles are release routing, not automatic agent execution.

## Remaining final integration steps — NOT YET COMPLETED

1. Receive and verify exact CLOUD hardening child SHA, path-by-path delta and PM written acceptance; obtain SOL contract assessment. Recheck all heads before incorporation, including any TERRA confirmed defect requiring PM decision.
2. Import only accepted PR131 + hardening frontend blobs into THIS single child, resolve `readme.md` documentation changes explicitly, never port source from alternative trains. Pin every imported blob and accepted local adapter exception in an RC1 exact-head source guard. Historical migrations, historical source pins and legacy compatibility must remain immutable.
3. Check exact frontend binding against server statuses/nonce/revision and staff access. Do not silently alter independently SOL-passed #21 SQL. Add narrow contract regression only if needed.
4. Run exact-head PostgreSQL17 #1–21, full-tree combined PG17, branch and owner privacy, staff approval/inventory/booking/clinical, concurrent ban/session/nonce, all signed restores, private Storage, npm/secret, legacy PHP, Node/TS/Vite, genuine localhost Chromium. Record EACH workflow run ID, SHA and PASS/FAIL/SKIP; no inherited pass is an exact-head pass.
5. Commission independent SOL exact integrated security and TERRA independent functional reviews. No release GO from Astra. Request separately owner-gated hosted disposable GoTrue/PostgREST JWT, RLS, Storage bytes and true provider restore before clinic-live.

## Environment and release states

| Level | Meaning / current verdict |
| --- | --- |
| SOURCE-READY (components) | Frozen PR129 and corrected PR130 have source-only CI/security evidence; PR131 frontend Node/browser tests PASS separately |
| RC1 combined-source candidate | **NOT YET INTEGRATED**; waiting on two acceptance dependencies; this child is preparation |
| Cloudflare preview | PR131 preview deployment comment exists; preview is a static build, no production API proof |
| Isolated staging | PM reports 11 migrations applied, therefore #12–#21 MISSING; no RC1 hosted acceptance performed |
| Production | PM reports six applied migrations; no promotion, SQL or flag activation approved |
| CLINIC-LIVE | **NO-GO / NOT VERIFIED** until owner approval and all provider/security/recovery gates |

Related: [#120 backend gaps](https://github.com/cmlagatuz/dawney-clinic/issues/120) · [#63 December 3 milestone](https://github.com/cmlagatuz/dawney-clinic/issues/63) · [RC1 isolated staging packet](RC1_STAGING_ACCEPTANCE_ROLLBACK.md) · [RC0 baseline](RC0_INTEGRATION_HANDOFF.md).
