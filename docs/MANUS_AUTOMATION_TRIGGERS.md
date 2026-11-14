# Manus — Event Triggers and Credit-Smart Scheduled Tasks

**Owner setup, NOT active by committing this file.** In Manus Project `Dawney Clinic — AI Operations`, use **Triggered tasks** or **Automations** only when the account actually exposes a compatible trigger. Never imply Manus can autonomously log into Claude/Grok/Qwen/ChatGPT or read their private chats. Shared evidence travels through Github.

## Priority-based triggered tasks

### T1. PR becomes ready for review — preferred event
**Trigger:** a GitHub PR in `cmlagatuz/dawney-clinic` is newly opened or changed from draft to ready, **or** its head SHA changes and the task has `ready-review` label. If Manus does not expose this GitHub event, manually run `/dawney-pr-gate` with PR number.

**Task prompt:** "Compare the current PR head SHA and base with last reviewed SHA. List CI conclusions, required checks, changes since last review, migrations and deployment side effects, and the single responsible reviewer. Flag source merge GO/NO-GO separately from clinical production GO/NO-GO. Do not push, merge or publish. Return <=220 words with evidence URLs. If unchanged, say NO MATERIAL CHANGE."

**Scope:** do not process PR #39 draft as security clearance, #47 validation-only as a feature, or #1 obsolete Laravel UI as part of Phase4.

### T2. Deployment or CI failure — condition
**Trigger:** Cloudflare Workers build fails while Pages succeeds OR a newly passing PR's required GitHub Action turns red. Filter to **one new failure per unique (head SHA, check name)** to prevent noisy loops.

**Task prompt:** "Open the failed check and provider log using read-only connectors. Redact tokens and PII. Separate failing check from Pages/app behavior, quote minimal diagnostic, owner of the fix, and one reversible option. Do not disable Worker integration, rerun billable jobs, merge or change DNS. Return <=250 words."

**First target:** [#45](https://github.com/cmlagatuz/dawney-clinic/issues/45) Cloudflare Workers Builds, not broad CI re-testing.

### T3. Handoff / quota interruption — manual or GitHub issue label
**Trigger:** supervisor applies label `ai-handoff` or `agent-paused`, OR human explicitly asks to rebalance work. Use manual prompt if GitHub labels/events unsupported.

**Task prompt:** "Read only this issue/PR's latest evidence and our ownership table. Classify DONE, PAUSED, BLOCKED or READY; assign one next AI and non-overlapping changed files. If another AI already delivered the task, do not reassign. Never infer a private chat state from an issue label."

### T4. Owner announces a production release — ALWAYS manual
**Trigger:** explicit human command only: `Review release readiness for commit <SHA>`.

**Task prompt:** "Invoke /dawney-release-brief. Verify current source, independent security tests, real data backup/restore rehearsal, signed clinic configuration, live JWT/RLS/Storage tests, paid providers and Pages/Workers gate. Produce GO/NO-GO with named owner actions. Do not deploy or run SQL."

## Free-plan scheduled automations
Manus's publicly documented Free plan advertises up to **two scheduled automations** and **one concurrent agent task**, subject to account quotas. Start with **S1 only**. Add S2 after user confirms low credit burn.

**S1: Daily delta digest**  
- Schedule: Mon–Fri **17:30 Asia/Riyadh**; maximum one run per weekday; use the project's GitHub connector.
- Prompt: "Compare changes since previous successful digest for Dawney repo: PR heads/merges, GitHub Actions fail/pass, new blockers/owner decisions. Report at most 5 changes, each issue/PR/CI URL, next responsible AI, and owner-required approval. If none, output NO MATERIAL CHANGE, no broad scans, no comments or edits. Do not inspect patient data, Cloudflare secrets or run commands beyond read-only retrieval."
- Destination: Manus Project task output for owner's review; no automatic public GitHub comment/email unless owner separately enables it.

**S2: Weekly release gate** *(optional; do not enable initially)*  
- Schedule: Mondays **09:00 Asia/Riyadh**.
- Prompt: "Review the existing Phase4 release critical path, NOT a fresh roadmap. For #46 #34 #40 #43 #49 #52 #41 #48 show latest SHA, check condition and actual next review gate; include #45 Worker build classification, #39 security review status, #53 future CRM. Return 300 words max, no external actions. If no new facts, link S1 and stop."

## Deduplication / stop rules
- One Manus Agent task at a time. If quota runs out, stop and let reset occur; no paid upgrade or API spending.
- Read *metadata first*; only fetch the diff/log associated with an actual change. Avoid recursive tasks, polling every minute, daily token-consuming full source audits.
- Event labels and GitHub Events are only **proposed configurations**. Do not claim triggers exist without actual Manus UI setup and one observed successful run.
- If a connector fails twice, report the actionable permission request; do not scrape or guess.
- All alerting and notes are redacted; no patient identities, clinical images, mail addresses, secrets or raw communication threads in AI reports.
