---
name: dawney-release-brief
description: Prepare an evidence-based Dawney customer-booking MVP source/deployment/clinical release gate and rollback checklist. Trigger only on supervisor or owner release-readiness request; do not deploy.
---

# Dawney release gate

**Read-only unless owner separately authorizes each operation.** Read `MANUS.md`, `docs/PHASE4_ACCELERATED_MVP_RELEASE_PLAN.md`, `docs/FIVE_AGENT_ORCHESTRATION.md`, selected PR SHA/check runs, and current Issue #51/#45.

## Source / merge gate
- #46 and #34 CI; #40 -> #43 migrations; #49 recovery and #52 full chain; #41 and #48 frontend integration after base dependencies; independent QA/security evidence.
- Require exact head SHAs, actual GitHub CI URLs and no unreviewed PR conflicts. Distinguish #50 merged into **#43 development branch** from master.
- Browser fixture screenshots and synthetic SQL tests are labeled **ISOLATED, NOT LIVE**.

## Deployment gate
- Cloudflare Pages production deploy points to approved master SHA; login/deep link/public routes work; classify separate Workers build issue #45.
- Public clinic services/hours/location, supported species and holidays **owner-approved**, no invented service calendar. `robots.txt` SEO and official customer channels require explicit signoff.

## Real clinical data gate — never infer from code CI
- Authorized restorable backup including Postgres data, Auth and private Storage; **actual restore rehearsal** completed and owner signed.
- Four Phase4 migrations in order, pre/postflight patient and appointment counts/fingerprints; Dog/Chow Chow original labels preserved.
- Anonymous/owner A/owner B JWT RLS negative tests, private attachment access, staff-only confirmation and resource conflicts; privacy/nonce/idempotency tests.
- Service-aware booking persists `requested` until authorized clinic staff confirmation; no unapproved policy or fake appointment slots.
- Provider costs/secrets and message consent approved before Telegram/WhatsApp/Viber sending; no automatic marketing.

## Output contract
Provide a compact three-row matrix: `SOURCE MERGE`, `PAGES SITE`, `CLINIC LIVE` each **GO, NO-GO or NOT VERIFIED** with evidence links. Include maximum 3 named blockers, one owner approval and rollback prerequisite. Never self-merge, apply SQL, deploy, publish or change provider integrations.
