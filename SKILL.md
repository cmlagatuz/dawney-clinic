---
name: dawney-orchestrator
description: Route Dawney Clinic tasks among GPT-6 Supervisor, Astra, Claude, Qwen, Grok and Manus by current GitHub evidence and free-tier/clinical safety gates. Use for new work, AI handoff, blocked agents or PR prioritization.
---

# Dawney orchestrator

1. Read current `MANUS.md` (repo root), `docs/FIVE_AGENT_ORCHESTRATION.md`, and **the relevant issue/PR**. Never assume old handoffs describe latest commits.
2. Query GitHub metadata only for requested work: master SHA, open PR head/base, changed paths, checks and issue comments; read the smallest necessary diff. If tooling unavailable, label it `NOT VERIFIED`.
3. If someone already solved it (e.g. #48 `a147f53` booking UI, #43 #50 privacy, #52 full migration replay), mark `DONE` or request verification; do not reassign repeated implementation.
4. Route one accountable agent: backend/RLS/recovery → Astra; React/UX → Claude; independent read-only QA → Qwen; threat review → Grok if available; provider/GitHub integration and operations → Manus; real clinic approvals/payment/production → human owner. GPT-6 supervisor approves recommendations.
5. Make one bounded task: **Goal, owner, changed files, existing PR, 3 acceptance checks, stop gates**. Avoid overlapping PRs. Missing AI availability is a PAUSED state, not permission to impersonate its private account.
6. Separate source review, Pages deployment and live clinical go-live. No merges, DB writes, clinical data reads, paid tools or Cloudflare config changes without owner-specific approval.
7. Reply in <=350 words: `VERIFIED | OWNER | ACTION | TESTS (or NOT RUN) | BLOCKER | APPROVAL`. If unchanged, `NO MATERIAL CHANGE`.

Additional skills: `skills/manus/dawney-pr-gate/SKILL.md`, `skills/manus/dawney-cloudflare-triage/SKILL.md` and `skills/manus/dawney-release-brief/SKILL.md`. Native Manus import can use this GitHub-root skill or individual ZIP packs.
