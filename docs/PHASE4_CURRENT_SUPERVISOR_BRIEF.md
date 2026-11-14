# Dawney Clinic — Current Four-AI Supervisor Brief

**Verified checkpoint: 2026-11-14.** Read this short brief and [Phase 4 QA contract](PHASE4_PRODUCT_QA_SPEC.md), then current PR/issue diffs. Treat older handoff/checkpoints as historical. **This is a public test deployment, not approved clinical production.**

## One-page status

| Agent | Verified work | Next bounded assignment |
| --- | --- | --- |
| **Astra — Backend** | Merged [#29](https://github.com/cmlagatuz/dawney-clinic/pull/29), [#30](https://github.com/cmlagatuz/dawney-clinic/pull/30), [#31](https://github.com/cmlagatuz/dawney-clinic/pull/31), [#33](https://github.com/cmlagatuz/dawney-clinic/pull/33) with catalog/attachment adapters and isolated PG17 tests. New live schema still **unapplied**. | Fix **[P0 missing trigger #38](https://github.com/cmlagatuz/dawney-clinic/issues/38)** and **[missing Chow Chow #35](https://github.com/cmlagatuz/dawney-clinic/issues/35)**, test lossless legacy data mapping; prepare supervised preflight, no live migrations without owner approval. Own schema/API only. |
| **Claude — React** | [PR #34](https://github.com/cmlagatuz/dawney-clinic/pull/34) OPEN, logo, themed responsive shell and owner overview with tests/screenshots. NOT merged, nor confirmed live. Still raw Species/Breed and no attachment UI. | Finish #34 visual-only review and investigate GitHub Check Run **Workers Builds failure** (other React/Pages workflows passed); protect new Overview route. After reviewed visual merge, second PR for dependent Species→Breed and private optional attachment UI using Astra adapters. Own pages/components/styles/brand. |
| **Qwen — QA** | [Issue #36](https://github.com/cmlagatuz/dawney-clinic/issues/36) OPEN, **no Qwen branch or PR verified**; repo viewing via Qwen Coder reported by owner, GitHub push unproven. | One small `ai/qwen/*` PR: automated `/app/overview` guard, theme/mobile/keyboard tests for Claude #34, and distinguish Workers failure from Pages success. Own tests/QA only; no production code. |
| **Grok — security** | Grok Build reached Free usage limit but **2 commits exist** at `ai/grok/issue-37-phase4-audit`; supervisor preserved them in **[draft PR #39](https://github.com/cmlagatuz/dawney-clinic/pull/39)**. Archive repository exists and is PRIVATE but EMPTY. | Review/fix test correctness in #39; finish evidence-backed audit #37. Do not treat preliminary findings or draft PR as merged. Use Grok.com Build Free for read-only review until terminal quota resets; no paid usage. |

## New critical finding from Grok independently confirmed

- `20261113211600_phase4_taxonomy_attachments.sql` defines `clinic_private.resolve_pet_taxonomy()` **but no trigger installs it on `public.pets`**. Only `attachment_validate` exists on `pet_attachments`. The composite FK blocks mismatched non-null species/breed IDs, but canonicalization, checking catalog active/pending states and marking unmatched legacy rows rely on the missing function. **Issue #38** assigned to Astra.
- Existing live animal breed is **Dog / Chow Chow**. `20261113211700_phase4_animal_catalog_seed.sql` does not include Chow Chow. **Issue #35** assigned to Astra. Legacy text remains intact; block schema activation until mapping verified.
- Grok's preliminary report notes broad receptionist read scope in Storage/metadata; actual clinical access policy for receptionists needs owner/veterinarian approval before calling it an exploitable defect. Never widen access to fix permission errors.
- Grok's current `supabase/tests/phase4_grok_issue37_static_audit.sql` uses `SELECT 1/0 WHERE ...` assertions. PostgreSQL can constant-fold the division, causing false failures. Replace with reliable `DO/IF/RAISE EXCEPTION` or equivalent and prove with isolated PG17 before merging draft PR #39.
- Claude PR #34 head `52a44d2`: four ordinary GitHub workflows are green, and GitHub Check Runs also list a **failed `Workers Builds: dawney-clinic`** alongside successful `Cloudflare Pages`. Determine whether that failed target is required and inspect provider logs before merge/deployment claims.

## Connected Supabase/live status

- Supabase `lgimhirgvresvbsdugac` **ACTIVE_HEALTHY**: six applied Phase 2/3 migrations, seven RLS-enabled public application tables, two confirmed Auth accounts, two owner records, one existing pet, one appointment, one event, no staff/clinical records, zero stored attachments. The two additive Phase 4 migration files remain **unapplied**, and `species_catalog`, `breed_catalog`, `pet_attachments` are not live.
- Existing public static test site: https://dawney-clinic.pages.dev. Previously passed read-only anonymous/browser checks. Actual current Cloudflare deployed SHA and logged-in live Phase 4 patient/attachment tests are **unverified**.
- Private Grok transcript repository `cmlagatuz/dawney-clinic-agent-sessions` is **PRIVATE and EMPTY**. No transcript browser link exists. Do not upload raw chat logs or secrets.
- Site remains **prototype**; no authorized real clinical go-live, migration activation, synthetic-write Storage/patient tests, admin bootstrap or full Auth+Storage recovery.

## Merge/release sequencing and ownership

1. **Astra** fixes #38 and #35 in schema/API-only PR(s), adds positive and negative lossless PG17 regression tests, documents exact additive migration/preflight/recovery. Stop before touching connected Supabase pending explicit owner signoff and safe backup.
2. **Claude** fixes PR #34 visual-only checks, explicitly explains failed Workers status, requests supervisor review; Qwen independently tests the UI. After approval and merge, verify actual Cloudflare Pages deployment. No schema-dependent new form deployed prematurely.
3. **Grok** finishes the independent audit in draft PR #39 and fixes unreliable static assertions. Ask Astra to address evidenced security issues; never have an auditor silently rewrite the schema.
4. **Claude** creates separate patient-form integration PR from current master with grouped Species, Breed locked until selection and reset on switch, Dog→Chow Chow, Cattle breeds and three optional private attachment controls. **Qwen** tests, **Grok** audits, **Astra** verifies backend/RLS. Supervisor coordinates DB rollout/rollback and hosted tests before enabling.
5. Role-aware staff workspace, veterinary records, invoice/inventory and full recovery remain upcoming phases once P0 works reliably.

**No AI self-merges, directly pushes `master`, or authorizes a paid plan.** Agents use their own `ai/chatgpt/*`, `ai/claude/*`, `ai/qwen/*`, `ai/grok/*` branches and PRs. Each report: verifiable commit/PR, tests, unresolved blockers, next owner, <=200 words. Read only relevant diffs and the current brief to conserve Free usage.
