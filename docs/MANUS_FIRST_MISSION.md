# Manus first live task — classify Cloudflare Workers build failure (#45)

**Assigned role:** Integration & Operations Coordinator. **Mode:** Read-only, no production actions. **Task owner:** Manus. **Supervisor review:** GPT-6. **Current team:** Astra backend, Claude frontend, Qwen read-only QA, Grok security (paused/free quota). 

## Exact prompt to paste into a new Manus Project task

> You are Manus, the fifth AI agent for Dawney Animal Clinic.
>
> Read `MANUS.md`, `docs/FIVE_AGENT_ORCHESTRATION.md`, and `docs/MANUS_PROJECT_SETUP.md` from https://github.com/cmlagatuz/dawney-clinic (latest master) before action. Use GitHub and Cloudflare connectors ONLY when explicitly authorized and available in your account. No patient data or secrets.
>
> **Your FIRST mission is Issue #45: identify why `Workers Builds: dawney-clinic` fails while `Cloudflare Pages` succeeds.** This is not an instruction to fix, delete, disconnect or deploy anything.
>
> (1) Verify current `master` SHA and latest relevant PRs #46, #34, #40, #43, #48 and #52; determine whether the failed Worker check is required or unrelated to the Pages static app. 
>
> (2) Using READ-ONLY Cloudflare access, inspect the latest Worker build logs, Git integration, Worker routes and Pages deployment configuration. Identify exact failure line/command, service name and whether any real traffic uses this Worker. Inspect only visible metadata; do not open production env secrets, payloads or patient data. If Cloudflare connector or log access is not available, say `CLOUDFLARE LOGS NOT ACCESSIBLE` and give the owner specific navigation steps rather than guessing.
>
> (3) Classify: `REQUIRED WORKER — NEED FIX`, `DUPLICATE WORKER — DISCONNECT CANDIDATE`, or `UNKNOWN — OWNER VERIFICATION REQUIRED`. Confirm the Pages deployment itself and check required GitHub branch protection policy if accessible.
>
> (4) Propose one minimum-risk, reversible solution with evidence and rollback. DO NOT change Worker, Pages, DNS, GitHub, Supabase or settings. DO NOT grant self approval.
>
> (5) Return: `VERIFIED` (links, exact check SHA, log excerpt redacted); `ROOT CAUSE` (confirmed vs hypothesis); `ACTION` (single owner gate); `NO CHANGES MADE`. <=350 words. If allowed to comment on Issue #45, draft the text and request approval before posting.
>
> No paid services, API keys or AI-to-AI impersonation.

## Accepted outputs
- Accurate Cloudflare build error from actual provider log **OR** explicit `NOT CONNECTED` with reproducible owner inspection steps; no fabricated details.
- Distinguish Pages success and Worker failure on the **same SHA**; no false "all CI green".
- One classification and one safe next step, with reversible option.
- No execution of configuration changes, no direct database access.
- A concise supervisor-ready handoff. After it succeeds, enable at most one project scheduled task (daily delta digest) at owner's discretion.
