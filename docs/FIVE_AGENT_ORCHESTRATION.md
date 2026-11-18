# Dawney Clinic — Five Active Specialist AIs + GPT-6.2 Astra Project Manager

**Effective:** owner decision 2026-11-18. The current five specialist lanes are **ASTRA, CLOUD, Qwen, Manus and SOL**. The **Project Manager** is a separate governance role, never ASTRA. This document supersedes the historical [four-agent arrangement](FOUR_AI_COLLABORATION.md) for new task dispatch. All `AGENTS.md` safety rules remain binding. Confirm fresh GitHub/CI/provider evidence for every status update; this document is policy, not proof of an active AI chat.

## Current authority and non-overlapping ownership

| Role | Accountable scope | Required output | Independent validation |
| --- | --- | --- | --- |
| **Project Manager (GPT-6.2 Astra)** | Priorities, single-owner delegation, SHA/PR verification, review and release GO/NO-GO recommendations | Copy-ready task prompts, GitHub directives, evidence checks and owner decisions | Human Project Owner approves live/production actions |
| **ASTRA (GPT-6; separate ASTRA project)** | Exclusive backend, Supabase/PostgreSQL Auth/RLS/Storage, booking RPCs, migrations, backend CI/recovery implementation | Isolated source PR, exact-SHA PG17 and denial tests, recovery effects | **SOL** independent security, Qwen functional QA where assigned, Project Manager |
| **[CLOUD](../CLOUD.md) (GPT-6.2 Sol)** | Exclusive React/Vite public/owner/staff UI, accessible mobile/dark frontend, browser tests | Frontend-only PR, exact SHA, real Node/Vite/Chromium evidence | Qwen functional QA; SOL audits security-relevant changes |
| **Qwen** | Independent read-only functional QA, reproducible defects and test suggestions | Code-grounded functional verdict; label any unexecuted tests | Project Manager verifies evidence; implementer fixes defects |
| **Manus** | GitHub PR/CI and Cloudflare deployment/recovery evidence, release operations, authorized connector actions | Direct GitHub report with exact source/provider evidence and one next owner | Project Manager; human owner approves operations |
| **SOL (GPT-5.6; separate SOL project)** | **Sole active independent security auditor** of ASTRA and other security-sensitive source; RLS/JWT/Storage, branch/booking threats, exact-SHA re-review | Direct PR security verdict SOURCE SECURITY GO / NEEDS FIX / NOT VERIFIED, confirmed vs hypothetical findings and tests actually run | Project Manager reviews independent evidence; human owner controls release |

**Critical separation:** SOL is **not ASTRA**. ASTRA implements backend/security fixes; SOL independently audits them. Never credit one for the other's work. Do not duplicate a single review or silently substitute Qwen QA for SOL security acceptance.

## Historical tooling (preserve history, stop active assignments)

- **Claude** authored the existing frontend work. CLOUD inherits open frontend follow-ups, including on Claude-named branches. The transfer preserves commit history and reviews. Use the handoff on [Issue #51](https://github.com/cmlagatuz/dawney-clinic/issues/51) for the current assignment.
- **Grok:** former independent security reviewer. Historical findings, including its owner-relayed pre-fix PR #80 owner/pet write P1, remain attributed to Grok; it is **retired from active project tasks regardless of future free quota**. [Historical GROK.md](../GROK.md).
- **Kimi:** short-lived provisional security-backup evaluator. An interim PR #82 source review was owner-relayed, but a complete Kimi-authored GitHub verdict was **not verified**. It is **retired from active assignments**.
- OpenCode/Terra and CodeRabbit remain historical/supplemental tools where evidenced; neither is a security-release substitute. Do not erase old source records or misattribute signoffs.

## Release checkpoint recorded when PR #84 opened (historical)

Consult the latest review per exact head. At the frontend handoff, the proposed booking reader is #87, Issue #51 follows it, and #86 has a [SOL NEEDS FIX inventory-date finding](https://github.com/cmlagatuz/dawney-clinic/pull/86#issuecomment-6988122815). The earlier npm result below applies to that earlier commit.

1. **DRAFT PR #82** source-integrates Naga public site #79, staff selector #81 and corrected four-branch RLS #80; exact reviewed source `b0633b2` is **unmerged**. **DRAFT PR #83** separately proposes a 13th branch-booking guard migration after reproducible synthetic legacy direct-insert bypass; exact head `0edeeb1`, **unmerged** and pending SOL independent verdict.
2. Original **11 migrations installed on separate staging Supabase**, production still **6** at last provider check. Proposed migrations **12 and 13 NOT APPLIED**. Preserve historical Dog/Chow Chow patient and appointment, unapproved policies/services, and feature flags OFF.
3. Release blockers include independent SOL security acceptance, unresolved high-severity npm/picomatch audit, actual hosted Auth/JWT/RLS/Storage and recovery evidence, frontend branch booking/real staff hookup and verified clinical policies.
4. Production Cloudflare Pages deployment and merges can have release side effects. **No self-merges, live SQL/bootstrap, clinical services or scheduling publication, patient exports, real messages, production DNS/hosting edits or spending** without explicit action-specific owner authorization.
5. Telegram/WhatsApp/Viber (Issue #53) and branch medicine inventory (Issue #78) are planned; do not call provider integrations or clinical inventory live without verified evidence.

## Evidence and gate definitions

- **ASSIGNED/NOT STARTED** = GitHub directive only. **EXECUTING** requires observed activity or owner-provided active-session evidence. **COMPLETED** = implementer/owner-reported work done; **VERIFIED** = Project Manager checked exact SHA, tests, diff, CI and effects. **BLOCKED** and **PAUSED** stay explicit.
- **SOURCE READY** = source exists with tested/reviewed exact SHA, no unexplained blocker; **PREVIEW DEPLOYED** = provider built that SHA; **STAGING VERIFIED** = owner-authorized provider/hosted checks pass; **CLINIC LIVE** requires owner release GO. These are never synonyms.
- **Task claimed:** one accountable owner, existing issue/PR, exact SHA, acceptance and prohibited actions; no duplicate branches or overlapping assignments.
- **Review:** SOL independently checks security-sensitive deltas after ASTRA fixes. No reuse of an old security signoff for a new SHA.
- **GitHub as communication bus:** each AI posts its attributed exact-SHA result to the relevant PR/issue if authorized. Posting comments does NOT launch or monitor its private chat. The Project Manager checks GitHub upon owner request; unattended execution requires separately configured/tested automation.
- **Budget:** free tiers only; quota exhaustion is PAUSED, not a reason to assign inactive retired agents. No paid APIs or background automation claims without proof.

## Compact AI check-in contract

`[AI] | AVAILABLE / UNKNOWN / PAUSED | PR/Issue + head SHA | EXECUTING / COMPLETED / VERIFIED / BLOCKED | evidence URL | ONE next action`

Do not copy private patient identifiers, messages, credentials or clinical records into GitHub.
