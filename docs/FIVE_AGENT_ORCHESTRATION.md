# Dawney Clinic — Five AI Agents + GPT-6 Supervisor

**Purpose:** Owner-approved roles, safe handoffs and efficient parallelism. **Updated 2026-11-14**. This **supersedes** the role table in the historical `docs/FOUR_AI_COLLABORATION.md` for new task routing; other security rules in `AGENTS.md` remain binding.

## Authority and non-overlap

| Agent | Strength / exclusive default ownership | Acceptable output | Independent validation |
| --- | --- | --- | --- |
| **GPT-6 supervisor (ChatGPT)** | Architecture, priority, dependency sequencing, release GO/NO-GO recommendation; owner liaison | Verified source reviews, bounded directives and approvals requested | Cross-check GitHub/CI/DB directly; owner authorizes production |
| **Astra (GPT-6 backend)** | Supabase schema/RLS/Auth/Storage, booking RPC, security code and PostgreSQL CI | Small reviewed branch/PR, PG17 evidence and recovery notes | Qwen source review/Grok threat audit + supervisor |
| **Claude Sonnet** | React website, owner portal, veterinary staff CRM UX, branding and accessibility | Component PR, real build/browser tests and screenshots honestly labeled | Qwen QA + supervisor |
| **Qwen Chat** | Independent customer-path QA, accessibility, adversarial inputs, reproducible test suggestions | <=5 code-grounded defects, one optional test patch; label NOT EXECUTED | Astra/CI executes suggested tests; supervisor validates |
| **Grok Build** | Independent security assessment, misuse and threat model, minimum-privilege review | Severity-ranked confirmed vs hypothesis; no fake live test | Astra regression + supervisor; currently quota-paused |
| **Manus** | GitHub+Cloudflare connector-based PR/CI triage, operational release readiness, automated summaries and issue handoffs | Evidence-driven single-owner routing, deployment log investigation, no source edits | GPT-6 supervisor; owner controls connectors and changes |

**Exactly five specialist AIs + supervisor role**, even if GPT-6 and Astra share a model family. Access to connected apps **does not imply** Manus can read or control other AIs' private conversations/accounts. GitHub Issues/PRs are the communication bus. Do not put clinical records in that bus.

## Immediate release queue (recheck each run)
1. CI browser reliability #46; dependent Claude shell #34. Validation #47 may be closed as redundant only after review.
2. Source migration #40 before booking backend #43 (which already contains #50 privacy), recovery checklist #49, regression suite #52 **after source dependencies**.
3. Claude #41 patient catalog UI and #48 public website/owner booking (latest #48 already implements #51 transition) require safe retarget/reconciliation after #34/#43 merges.
4. Production data: backup including Auth+Storage and actual restoration rehearsal; four migrations in order; real owner A/B/anon and staff clinical tests; clinic-approved services, holidays and scheduling; separate owner sign-off.
5. Phase5 clinic CRM from `docs/CLINIC_OPERATIONS_CRM_VIDEO_REFERENCE.md`, Telegram-first shared inbox/WhatsApp contact/Viber optional #53, only AFTER Phase4 customer-booking MVP.

## Integration gates
- **Task claimed:** owner and output recorded on a GitHub issue/PR; no duplicate issue.
- **Source ready:** current mergeable PR, exact head SHA, relevant green CI, independent check, no unexplained high-risk finding.
- **Merge approval:** supervisor reviews and requests owner authorization where release side effects are possible. Never self-merge.
- **Staging accepted:** deployed commit identified, browser/auth/route tests grounded, public site does not claim unapproved service or patient information.
- **Live approved:** tested recovery/rollback, real DB negative JWT/RLS/Storage tests with permission, clinical business rules confirmed and formal owner GO.

## Token budget and failover
Manus Free plan reportedly offers **one concurrent task**, **two scheduled automations** and a finite daily credit budget (verify account UI; pricing/limits can change). Use one high-impact operational review per task, not simultaneous recursive AI prompting. Claude/Grok free caps mean PAUSED, not reassigned ownership without supervisor review; no paid AI API bridging or unattended credentials. Qwen's read-only findings are not CI execution. Avoid full repeated audits when a targeted PR diff suffices.

## Team check-in format
`[AI] | PR/Issue | SHA | DONE + CI URL | BLOCKED | NEXT SINGLE ACTION`. Share only redacted facts. If a run has not executed write `NOT TESTED`; if a connector cannot reach a platform write `NOT CONNECTED`.
