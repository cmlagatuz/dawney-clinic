# Dawney Clinic — Accelerated MVP Delivery and Release Gates

**Supervisor checkpoint:** 2026-11-14. This is a scope-controlled release plan, not authorization to merge, migrate, approve clinical policies or perform destructive production operations. Owner deadline NOT YET PROVIDED. Keep free-only services and existing owner/pet/appointment data intact.

## Two definitions of "finished"

**Customer-facing MVP (FIRST):** public Home/Services/Location/Book, verified real Dawney identity in General Trias Cavite, owner-approved services/eligibility/hours/resources, Supabase signup/login, profile and patient registration, service-aware clinic-time request -> persisted `requested`, safe authenticated return, protected owner booking history, clinic-authorized confirmation, tested responsive UI, accessible navigation, private data RLS, and successful real owner-approved smoke/backup/rollback checks. No fake appointments, hours, clinical services, confirmation, reminders, or launch claims.

**Full clinical platform (AFTER MVP):** staff clinical dashboard, encounters/medical records, vaccinations, prescriptions, inventory, billing, clinically approved role-based access and tested complete data recovery. These MUST NOT be implicitly included in a short MVP deadline without owner scope/requirements and dedicated verification.

## The critical path — work in sequence, minimize branches

| Gate | Work | Conditions |
|---|---|---|
| **A — CI + brand** | Review/merge [#46](https://github.com/cmlagatuz/dawney-clinic/pull/46) browser reliability fix; verify [#47](https://github.com/cmlagatuz/dawney-clinic/pull/47) Claude-head validation (then close if redundant); approve [#34](https://github.com/cmlagatuz/dawney-clinic/pull/34) branding/shell | Real browser rerun passed, supervisor source review, no unrelated backend edits |
| **B — schema in Git only** | Review [#40](https://github.com/cmlagatuz/dawney-clinic/pull/40) Chow Chow exact mapping (no patient deletion); [#43](https://github.com/cmlagatuz/dawney-clinic/pull/43) booking with already-integrated #50 actor privacy, and [#49](https://github.com/cmlagatuz/dawney-clinic/pull/49) recovery checklist | Source merge after independent review. **Merge != database deploy**. No public service/hour approval yet |
| **C — user-facing integration** | Retarget independently stacked [#41](https://github.com/cmlagatuz/dawney-clinic/pull/41) patient UI (OFF by default) and [#48](https://github.com/cmlagatuz/dawney-clinic/pull/48) public site onto master after #34; drop copied #43 contract blobs; fix booking [#51](https://github.com/cmlagatuz/dawney-clinic/issues/51) legacy form and email-verification return | CI Chrome/React, no sensitive intent in URL/session storage, zero-service empty states, QA fixes |
| **D — owner-operated rollout** | Verify encrypted restorable PostgreSQL+Auth+private Storage backup/recovery, clinic services/animals/address/phone/hours/resource and receptionist policy approvals; approved four migrations in order, read-only postflight; verify anon/owner A/B JWT, private file, real service-aware booking `requested` and staff confirmation | Owner explicitly approves real-scope write tests, service/schedule policy, production release and domain; halt on any data drift |
| **E — website launch** | Confirm Pages production SHA and routes; resolve separate Worker Git build only if unused; enable public SEO / robots after business text approved; monitor failures + rollback support | No patient data in public logs/SEO, no confirmation/email claims without provider verification |

## NO-GO problems already confirmed

1. The current `/app/appointments` uses legacy service-less INSERT and will stop accepting new bookings once `clinic_booking_policy.is_approved=true`. Keep schedule unapproved until UI switched to approved service RPC, with isolated and end-to-end tests.
2. Opening email verification in new tab loses `sessionStorage` booking intent; show explicit safe return to `/book` and re-selection without private PII/open redirect.
3. Public site `robots.txt` is `Disallow: /`; deliberate until owner approves public launch.
4. Cloudflare **Workers Builds** failures are independent of successful **Cloudflare Pages**; inspect owner-only Worker logs, and disconnect only unused Worker Git build without touching Pages.
5. No full clinical staff workflow, verified production migration, live storage/RLS negative test or approved service availability yet. No public-facing clinic go-live claim.

## Ownership and quota-aware plan

- **Astra (available):** focus on source integration, resolving booking #51 backend tests/contract and CI, no new architecture expansions and NO live schema writes. Review/GO-NOGO, request supervisor decision on merges.
- **Qwen Chat (available read-only):** independent concise reproduction matrix: public routes, booking verify new-tab, 30-min non-PII intent, legacy/new appointment compatibility, mobile/accessibility, private attachments. Results are review recommendations, not executed CI proof.
- **Grok.com Build (available):** narrow security release gate: RLS, column grants, staff confirmation, replay/nonce, slot double booking, spam, links/redirects. Complete/close draft #39 accurately; no live audit writes.
- **Claude (Free quota limited):** owner will resume its interrupted existing #34/#41/#48 work before any new assignment. Claude owns visual presentation and bounded integration patches only; supervisor/Astra can take over small compatible React patches if the quota becomes critical after approved review, using isolated branches, not concurrent edits.
- **Supervisor GPT-6:** independently inspect PRs/test evidence; coordinate code via existing GitHub connection; do not self-merge unreviewed work, and never promise asynchronous unattended coding.
- **Owner:** decides deadline, whether deadline means customer MVP or complete clinic, site content and clinical schedule, Cloudflare Worker settings, secure backup/restore and migration/test approvals.

## Deadline assessment

No deadline can be promised before scope and production gates. The short-path is a **customer-booking MVP** rather than full veterinarian operations. An accelerated schedule is plausible only if: (a) owner provides definitive clinic services/business data promptly, (b) available AIs can turn around small PR changes within Free quotas, (c) schema/recovery approvals and live tests actually pass, and (d) any Workers build is confirmed redundant. A full clinical system requires separate milestones after the MVP. If owner supplies a specific date, classify as feasible / at-risk / unrealistic and identify precise scope cuts; never cut security, backup or safe appointment confirmation.

**Do not let exact Chow Chow mapping, long narrative handoffs or redundant code branches consume new feature cycles:** #40 already supports it, no live deletion or nearest-breed substitution.
