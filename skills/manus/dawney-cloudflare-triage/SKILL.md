---
name: dawney-cloudflare-triage
description: Diagnose Dawney Cloudflare Pages success versus Workers Builds failure using authorized read-only GitHub/Cloudflare logs, especially Issue 45. Use when deployment check fails or owner asks about production hosting.
---

# Pages vs Workers incident triage

**Never change Cloudflare settings or DNS.** A connector that can write is still used READ-ONLY.

1. Read `MANUS.md`, #45, the latest tested PR SHA and `docs/PHASE3_DEPLOY_RELEASE.md` if present. Check repo build topology: frontend static React/Vite under `web/`, Pages output `dist`; independent Workers build is a potentially separate integration, not assumed needed.
2. In GitHub PR head checks, identify exact `Workers Builds: dawney-clinic` and `Cloudflare Pages` states **for the same SHA**. Record links and timestamps.
3. If owner connected Cloudflare, read build log (specific failed command, project/service, status) and non-secret routes/deployment references; *do not request passwords, customer data or API tokens*. Establish whether Worker has routes/traffic or is redundant.
4. If access denied, output `CLOUDFLARE LOGS NOT ACCESSIBLE` and provide user steps: Cloudflare dashboard → Workers & Pages → Worker `dawney-clinic` → Builds (select failing build) → view command/log; separately Pages → project `dawney-clinic` → Deployments. Do not guess root cause.
5. Classify `REQUIRED WORKER — FIX` / `DUPLICATE WORKER — DISCONNECT CANDIDATE` / `UNKNOWN — OWNER VERIFICATION REQUIRED`. A failed Worker build by itself does not prove Pages failure.
6. Propose exactly one reversible owner action and a rollback plan, but do **not** execute without explicit owner consent. No automatic check reruns or billable calls.
7. Max 300 words, with evidence links, `NO CONFIGURATION CHANGED` and next owner. If already documented for current SHA, `NO MATERIAL CHANGE`.
