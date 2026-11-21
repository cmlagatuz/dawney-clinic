# Manus Project Setup — Dawney Clinic

**Manual owner setup required; this document is not evidence that connections or tasks have been activated.**

## 1. Create a persistent Manus Project
In [Manus](https://manus.im/), create Project **Dawney Clinic — AI Operations**. Open Project **Instructions** and paste **the entire root [MANUS.md](../MANUS.md)** from current master; optionally attach `docs/FIVE_AGENT_ORCHESTRATION.md`, `docs/PHASE4_ACCELERATED_MVP_RELEASE_PLAN.md`, `docs/CLINIC_OPERATIONS_CRM_VIDEO_REFERENCE.md` and `docs/MANUS_AUTOMATION_TRIGGERS.md` as Files & sources. Treat files as snapshot context; always read current GitHub PR/CI state. Do not upload real patient records or secrets.

## 2. Connector least-privilege matrix
Use Project > Connectors or global [Manus connectors](https://manus.im/features/connectors), authorize individually via the owner, and verify exposed actions. Start small:

| Priority | Connector | Initial permission and exact use | Forbidden by default |
| --- | --- | --- | --- |
| **Required A** | **GitHub** `cmlagatuz/dawney-clinic` | Read repo, Issues, PRs, commits, workflows/check runs; propose triage and release matrix | Merge PR, edit source, delete repo, publish release, write issues without approved task |
| **Required B** | **Cloudflare** | **Read-only** Pages project and the separate `dawney-clinic` Workers build/logs, deployment SHA, routes and Git integration; diagnose #45 | DNS/route changes, disconnect Worker, deploy, edit secrets, disable Pages |
| **Optional C** | **Supabase** project `lgimhirgvresvbsdugac` | Read-only migration/schema/index/policy metadata and aggregate stats *only after owner approves* | INSERT/UPDATE/DELETE, migration apply, unrestricted patient/owner/clinical data, storage download, secret access |
| **Optional D** | Figma or Canva | Approved design references for Phase5 staff CRM; read-only for initial review | Publication/brand replacement without visual approval |
| **Later** | n8n or Make | Owner-approved issue/CI triggers and notifications only once tested with inert payload | Paid workflows, production endpoints, secret-bearing webhooks |
| **Not needed** | Gmail, WhatsApp, Telegram, Viber personal accounts | None for current Phase4 orchestration | Account takeover, unauthorized messages, bulk broadcasts, scraping |

GitHub provides collaboration **between AIs through Issues, PRs and commits**, not magical cross-connection of Claude/ChatGPT/Grok/Qwen sessions. Manus's advertised Custom MCP/API features could connect **specific supported external tool endpoints** only when the account/tool actually offers them, and may involve fees. Do not add general-purpose personal API keys or impersonate other AIs.

Start by asking Manus to list connected service names and allowed actions; require explicit confirmation before anything beyond reading.

## 3. Skills — native import and explicit invocation
Manus supports `SKILL.md` with YAML front matter and Skills > **+ Add** > **Upload a skill** (`.zip`/`.skill`) or import from a suitable public GitHub repository. This repo has **root [SKILL.md](../SKILL.md)** as the `dawney-orchestrator` skill. It can be imported by root GitHub URL if Manus offers that feature. Other skill sources in `skills/manus/<name>/SKILL.md` can be packaged individually into ZIP and uploaded, then added to this Project's Skills library. Do not assume a nested folder URL imports directly.

Suggested slash commands:
- `/dawney-orchestrator` — assign work with existing GitHub evidence.
- `/dawney-pr-gate` — review current PR check runs and source merge readiness.
- `/dawney-cloudflare-triage` — investigate Pages vs Workers CI, especially #45.
- `/dawney-release-brief` — generate evidence-based GO/NO-GO handoff.

## 4. Triggered and scheduled tasks
Manus Project "Triggered tasks" and Manus Automations availability/connector events depend on your account. See [triggers runbook](MANUS_AUTOMATION_TRIGGERS.md). On Manus Free, reserve a maximum of **two** scheduled automations, prefer **one** until usage measured; event-based tasks require explicit setup and proof the event source is supported. No automation is live until you create and enable it in Manus.

## 5. First permitted mission
Copy the first mission from [MANUS_FIRST_MISSION.md](MANUS_FIRST_MISSION.md) into a new task *inside the Project* after GitHub and Cloudflare access are granted. Require a **read-only diagnostic** of Issue #45 and a <=350-word report. No credentials pasted into chat; no Cloudflare configuration changes.

## 6. Verification checklist
Manus must show: (a) correct public repo + current `master` SHA; (b) GitHub PR #48 latest `a147f53` without claiming merge; (c) #45 Worker failure separate from Pages success; (d) connected Cloudflare build log access or a truthful NOT CONNECTED; (e) **no source/deployment/database changes**. Only then expand Manus permissions or automate anything.
