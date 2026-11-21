# Dawney Clinic — Four-AI Collaboration Protocol

**Version 2026-11-14.** No subscriptions/purchases for new AIs or application hosting. Repository: https://github.com/cmlagatuz/dawney-clinic; active source of truth is latest `master`, PRs, issues, current supervisor brief, and small verified handoffs. Agents can use their available history retrieval where useful, but do not rely on model memory instead of current git state.

## Team and file ownership

| Agent | Accountable for | Allowed primary files | Avoid |
|---|---|---|---|
| ChatGPT GPT-6 Astra | Lead implementation/architecture, DB/Auth/Storage API, business domain, security fixes and hosting CI | `supabase/migrations/`, `web/src/lib/`, `web/src/clinical.mjs`, integration contracts, release scripts | Claude presentation; Qwen browser tests; Grok review files |
| Claude Sonnet (Free) | UI/UX implementation and accessibility; brand, interaction and clinical-facing screens | `web/src/pages/`, `web/src/components/`, `web/src/styles.css`, `web/public/brand/` | migrations/RLS and security scripts |
| Qwen4 Max / Qwen3.7 Plus (Free if available) | **QA automation**, regression/browser tests, test coverage and bug reproduction | `web/tests/`, `scripts/browser/`, `docs/qa/`, `qa-*.yml` workflows | production code unless supervisor specifically reassigns |
| Grok (Free if available) | **Independent security and system/process audit**, negative test design, threat modeling | `docs/security/`, `docs/reviews/`, `scripts/security/`, new `supabase/tests/security/` | live migrations, UI changes, production Auth |
| ChatGPT in supervisor chat | Review architecture, acceptance evidence, ownership, next milestones, PR conflicts, safety decisions | GitHub review/coordination docs | claiming tests/merges/deployments without evidence |

Independent auditors **cannot approve their own fixes**. All 4 AIs work on their own branches with PRs. PR success is not a release approval. Existing `master` is the only deploy branch; never push production changes directly. Use the sponsor/user as final owner of real-data and launch decisions.

## Workflow: task → PR → independent verification → merge

1. Supervisor assigns a **single bounded task** with owner, specific files, acceptance tests, branch and dependencies. Check active issues/PRs before claiming.
2. Fetch current `master`, make `ai/chatgpt/*`, `ai/claude/*`, `ai/qwen/*`, or `ai/grok/*`. Use latest changed hunks, not giant repo dumps. Never work on another agent's branch. Open a draft PR early if useful for conflict visibility.
3. Implement code or tests, run relevant local/CI checks, redact sensitive logs, commit and push the assigned branch. Create a GitHub PR with screenshots from real/stubbed sources clearly identified, passing/failing checks, scope and blocker.
4. Opposite independent reviewer checks the change: **Qwen tests Claude frontend**, **Grok audits Astra security/data**, Astra verifies Qwen/Grok test correctness; Claude reviews visual regressions. Supervisor determines merge readiness and needed owner approval. Never self-merge or force-push master.
5. Safe approved merges to `master` trigger the existing GitHub-linked Pages release pipeline. Check actual deployed commit, HTTPS route, authenticated browser behavior and rollback fingerprints. Clinical go-live requires separate security and recovery acceptance.
6. Update a **short section** in `docs/AI_HANDOFF.md` or PR description only after substantial work. Summarize in <=200 words: issue, branch/PR, changed files, tests, outcome, blocker, next owner. Avoid frequent competing edits of one handoff document.

## Current Phase 4 dependency gates

- Astra taxonomy/attachment backend source PRs #29/#30/#31/#33 **merged**; two additive catalog/attachment migrations **not applied** to connected Supabase as of prior checkpoint. [Issue #35](https://github.com/cmlagatuz/dawney-clinic/issues/35) missing Chow Chow must be resolved before rollout; preserve existing patient/appointment.
- Claude [PR #34](https://github.com/cmlagatuz/dawney-clinic/pull/34) is open, visual foundation only (logo/theme/overview, CI green); **no real species/breed dependent UI or document upload** in that PR.
- Qwen first task: **new tests for #34** (overview route, responsive/keyboard/theme, mock-vs-live honesty) without changing Claude screens; then species/breed/upload acceptance tests after integration.
- Grok first task: **review pending migrations and #35 for security/data-loss issues**, deliver specific offline tests and findings; no live writes.

## Security/cost and GitHub safeguards

- No API pay-as-you-go credentials, new paid AI plan, paid hosting or free-tier overage without owner approval. Qwen Chat Free is not proof that Qwen CLI/Action can run for free; Grok free trial may expire. If tools cannot write, acknowledge and give a patch/issue, not an invented commit.
- **Never use `--force` on master, blanket auto-approve permissions, `grok --yolo`, or unreviewed auto-merge.** Use scoped fine-grained GitHub permission (Contents read/write and Pull requests write if required), avoid a broad PAT, and enable branch protection/review/check requirements through GitHub Settings when available.
- Zero real patient data/secrets in screenshots, issues, model prompts and public logs; use artificial fixtures. Never give new third-party agents Supabase privileged credentials. Read-only public/anonymous tests are safe, but clinical/Storage synthetic-write smoke and production recovery require explicit owner approval.
- Latest product contract: `docs/PHASE4_PRODUCT_QA_SPEC.md` (QA-01…QA-12), latest concise `docs/PHASE4_CURRENT_SUPERVISOR_BRIEF.md`. Ignore stale checkpoints when newer verified GitHub state contradicts them.

## Free-tier agent bootstrapping

**Qwen:** `QWEN.md` contains the short specialist prompt. Use `chat.qwen.ai` for review/test planning. `coder.qwen.ai` may provide authenticated repo editing if explicitly enabled; verify that it truly opens an existing repo and creates branch/PR. Official Qwen Code GitHub Action typically requires an API key; do not install paid CI with implicit cost. If lacking free write access, use read-only review and provide supervisor a patch.

**Grok:** `GROK.md` contains the short specialist prompt, and `AGENTS.md` the general rules. Grok Build CLI supports terminal Git if authenticated and within the user's free entitlement; prefer testing with a throwaway branch/PR first, without live credentials. Grok web Build exports new projects; never overwrite Dawney. Expert/Auto for analysis; Build for proven local editor flow.

**Long context is not a license to waste tokens.** Each agent reads the latest short brief once, then only relevant PR diffs and impacted files; no repeated full codebase analysis.
