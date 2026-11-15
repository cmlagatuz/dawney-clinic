# Dawney Animal Clinic

**Secure veterinary clinic management system — modernization and release integration in progress**

> **Status date:** 15 November 2026. This README distinguishes source code, CI, synthetic previews, staging evidence and clinical production. The authoritative shared record is the current `master` branch plus linked GitHub Issues, pull requests and check runs.

## Current decision summary

- **Master:** `5fb7972e6844c18fa2f668566c450ea06123b59e` (merge commit for PR #46).
- **First source integration:** [PR #46](https://github.com/cmlagatuz/dawney-clinic/pull/46), head `9b35e08c5d46fbbdeb0e6bd879832e7356f7f9e9`, is merged as `5fb7972e6844c18fa2f668566c450ea06123b59e`. Its seven applicable checks passed; no clinical feature, migration or patient data change was introduced.
- **Current public Pages deployment:** [dawney-clinic.pages.dev](https://dawney-clinic.pages.dev/) is a static React/Vite deployment from `master`. The current verified production deployment is `15168ca6-f88e-4d30-9915-1dcc2cf5b75a` at master commit `5fb7972`; the previous successful deployment `764624c4-4baa-428d-896f-766cca47e08b` at `2a29019` is the known rollback baseline; this is public website hosting, not approval for real clinic records.
- **Clinical release:** **NO-GO / NOT VERIFIED.** No Phase 4 migration has been authorized on live Supabase, and hosted JWT/RLS/Storage security, full recovery, clinic policy and owner clinical approval remain outstanding.
- **Synthetic Alpha:** [PR #56](https://github.com/cmlagatuz/dawney-clinic/pull/56) is an unmerged synthetic CRM preview. It remains isolated from `master` and must not be described as a clinic deployment.

## Team ownership and review

The current operating model is Project Manager plus five specialist AIs:

| Owner | Responsibility | Current status |
| --- | --- | --- |
| **GPT-6 Supervisor / Project Manager** | Architecture, priorities, dependency order, owner decision packets and release GO/NO-GO recommendations | Coordinates approval; does not invent deployment or clinical evidence |
| **Astra** | Supabase schema, PostgreSQL/RLS/Auth/Storage, booking contracts, migrations, recovery and backend CI | Owns [#40](https://github.com/cmlagatuz/dawney-clinic/pull/40), [#43](https://github.com/cmlagatuz/dawney-clinic/pull/43), [#49](https://github.com/cmlagatuz/dawney-clinic/pull/49), [#52](https://github.com/cmlagatuz/dawney-clinic/pull/52) and [#59](https://github.com/cmlagatuz/dawney-clinic/pull/59); all remain unmerged |
| **Claude** | React/Vite website, owner portal, patient form, staff CRM UX, branding and accessibility | Owns [#34](https://github.com/cmlagatuz/dawney-clinic/pull/34), [#41](https://github.com/cmlagatuz/dawney-clinic/pull/41), [#48](https://github.com/cmlagatuz/dawney-clinic/pull/48) and synthetic [#56](https://github.com/cmlagatuz/dawney-clinic/pull/56) |
| **Qwen** | Independent read-only QA, accessibility, customer-path and adversarial test review | Findings are evidence proposals unless actual execution is linked; does not self-merge or claim hosted tests |
| **Manus** | GitHub/Cloudflare operations, CI/PR triage, deployment evidence, release readiness and handoffs | Read-only by default; no source ownership, live SQL or production approval |
| **Grok** | Independent security/threat-model review and negative-test design | **Paused/quota-limited**; draft security work is not release sign-off |
| **CodeRabbit** | Automated code reviewer | Review output is advisory and must be independently validated; no Autofix or paid review is authorized |

The owner controls production, database, clinical-policy, credentials and spending decisions. No AI may merge its own work.

## Source progress and evidence

| Area | Current evidence | Status |
| --- | --- | --- |
| Chromium/browser CI reliability | [PR #46](https://github.com/cmlagatuz/dawney-clinic/pull/46), exact head `9b35e08`; [Pages check](https://github.com/cmlagatuz/dawney-clinic/runs/132632457641) and browser/regression/source/audit/PHP checks pass; merged in `5fb7972` | **SOURCE INTEGRATED; Pages deployed** |
| React foundation | [PR #34](https://github.com/cmlagatuz/dawney-clinic/pull/34), head `85132e0`; build, verify, anonymous browser, Pages, PHP and legacy checks pass | **OPEN; refresh after #46 before merge** |
| Taxonomy and Chow Chow preservation | [PR #40](https://github.com/cmlagatuz/dawney-clinic/pull/40), head `7f6b7b4`; isolated PostgreSQL/RLS, unit, browser-adapter, source-guard and legacy checks pass | **SOURCE EVIDENCE; not live** |
| Secure public/owner booking | [PR #43](https://github.com/cmlagatuz/dawney-clinic/pull/43), head `2749f81`; booking, nonce/concurrency, unit, build, audit and Pages checks pass | **SOURCE READY; migration and clinical policy owner-gated** |
| Recovery/staging harness | [PR #49](https://github.com/cmlagatuz/dawney-clinic/pull/49), head `9c15f79`; offline contract, isolated PostgreSQL drill, recovery-safety and related checks pass; authenticated HTTP is skipped | **SCHEMA COMPATIBILITY BLOCKED; staging NOT VERIFIED** |
| Four-migration rehearsal | [PR #52](https://github.com/cmlagatuz/dawney-clinic/pull/52), head `5272cad`; four-migration legacy-record, unit, PHP, source-guard and Pages checks pass; authenticated HTTP is skipped | **REGRESSION EVIDENCE; no live SQL authorized** |
| Patient form and private attachments | [PR #41](https://github.com/cmlagatuz/dawney-clinic/pull/41), head `59f8cb1`; exact-head build/verify/browser/legacy/PHP/Pages checks pass; four CodeRabbit findings were fixed and independently regression-tested, with Qwen re-review pending | **SOURCE READY; hosted JWT/RLS/Storage NOT VERIFIED** |
| Public website and booking UI | [PR #48](https://github.com/cmlagatuz/dawney-clinic/pull/48), head `e7c070e`; combined #41/#48 checks and Pages pass | **STACKED; reconcile after #34/#40/#43 sequencing** |
| Phase 5A staff read contract | [PR #59](https://github.com/cmlagatuz/dawney-clinic/pull/59), head `df802a7`; PostgreSQL 17 staff/queue and booking-RPC integration checks pass; hosted Auth is skipped; two new CodeRabbit workflow findings await Astra triage | **SOURCE READY FOR SUPERVISED REVIEW; hosted Auth/JWT/RLS NOT VERIFIED** |

Passing CI or a Pages preview proves neither real hosted authorization nor clinical readiness. Historical Workers Build failures are separate from current Pages checks after the redundant Worker Git integration cleanup; do not treat them as current source failures.

## PR #41 CodeRabbit findings: corrected, hosted security still open

The four actionable CodeRabbit findings on [PR #41](https://github.com/cmlagatuz/dawney-clinic/pull/41#issuecomment-6900819954) were confirmed and fixed on head `59f8cb1` without CodeRabbit Autofix: account-switch patient reload race; duplicate-byte attachment finalization retry; save/close while upload retry is in flight; and Download remaining hidden after successful retry. Claude reports Node 46/46, the focused stubbed Chromium finding suite 22/22, attachment 50/50 and responsive checks passing. The feature flag remains off.

This is source and synthetic evidence only. Qwen’s independent re-review is pending; hosted JWT/RLS/private Storage behavior is **NOT VERIFIED** and requires owner authorization. Private immutable Storage behavior, the legacy Chow Chow record, keyboard behavior and fail-closed states must remain preserved.

## New PR #59 CodeRabbit findings pending

The latest completed CodeRabbit review on [PR #59](https://github.com/cmlagatuz/dawney-clinic/pull/59#issuecomment-6900932629) raised two findings for Astra to verify: the workflow path filters may omit `supabase/migrations/**`, and the PG17 job’s mutable #40/#43 ref fetches may conflict with its intended SHA-pinned/fail-closed dependency guard. These are reviewer allegations, not accepted defects; they remain **pending verification and correction or documented intentional-stop disposition**. Do not weaken the exact-head safety guard merely to make a stale dependency fetchable.

## Legacy Laravel context and historical Phases 1–3

The repository preserves a 2019-era Laravel 5.8 / PHP 7.1-era / MySQL application using Blade, Bootstrap 4, Vue 2 and Laravel Mix. It contains legacy authentication, owner/user, pet/patient, medical-record, appointment and admin routes. Inventory, purchasing and order code exists but relevant routes are disabled. Laravel dependencies are end-of-life; do not deploy the legacy application unchanged as a clinical production system.

- **Phase 1 — legacy assessment:** [PR #2](https://github.com/cmlagatuz/dawney-clinic/pull/2) merged targeted appointment ownership, foreign-pet rejection, bounded input validation and PHP regression coverage ([CI](https://github.com/cmlagatuz/dawney-clinic/actions/runs/43378768881)).
- **Phase 2 — data and access foundation:** [PR #3](https://github.com/cmlagatuz/dawney-clinic/pull/3) and [PR #4](https://github.com/cmlagatuz/dawney-clinic/pull/4) established versioned Supabase/RLS/Auth contracts and security tests. Real baseline Auth checks passed for disposable identities, but this does not certify clinical production.
- **Phase 3 — modern web and safeguards:** merged PRs #5–#25 added the React/Vite client, owner workflows, private Storage policies, staff safeguards, recovery tooling, scheduling contracts, browser checks, repository guards and dependency auditing. The synthetic PostgreSQL/GPG recovery drill is not a full real Auth/Storage/clinical restore.

The legacy Blade [PR #1](https://github.com/cmlagatuz/dawney-clinic/pull/1) remains a distinct open UI change and is **not** automatically superseded by React #34. Keep it open/deferred until the owner decides whether the legacy admin surface remains supported; its raw clinical-note rendering concern must be resolved before merge.

## Chow Chow and migration safety

Source-level verification in #40/#52 preserves the historical Dog/Chow Chow patient and appointment through synthetic PostgreSQL 17 migration tests, including taxonomy mapping and regression assertions. **No authorized live Phase 4 migration has occurred.** Do not apply the ordered migrations, rewrite existing patient data, or publish supported species/services until the owner and veterinarian approve the preservation plan, policy and recovery window.

## Deployment, staging and live-clinic boundaries

1. **Unmerged source:** Open PR code and passing branch CI are not in `master` and do not change production.
2. **Synthetic Alpha previews:** Cloudflare previews such as #56 are demos using synthetic UI/fixtures. They are not staging, are not approved for patient data, and remain separate from the source-merge queue. PR #46’s merge does not change this boundary.
3. **Staging verification:** #49, #52 and #59 provide offline or disposable PostgreSQL evidence. Hosted JWT/RLS/Storage, real Auth/Storage restore and owner-controlled staging checks remain unverified unless a linked run proves otherwise.
4. **Public Pages:** Cloudflare Pages serves the static React/Vite `web` build from `master`; a successful public HTTPS response does not prove clinical authorization, migrations, RLS, Storage or backup readiness.
5. **Live clinical deployment:** requires owner approval, approved clinic hours/time zone/services/species/resources, exact migration order, recoverable Auth/database/Storage backup and restoration rehearsal, real A/B/anonymous/staff JWT/RLS/Storage negative tests, and post-deploy rollback verification. It is not approved.

## Current blockers and merge order

The controlled source sequence is **#34 refresh against merged #46/master → #40 taxonomy review → #43 secure booking review → #52 pin refresh and four-migration regression → #49 recovery/schema compatibility gate → #41 Qwen re-review → #48 frontend reconciliation → #59 CodeRabbit triage/staff review**. The exact order may be revised by the Project Manager when current dependency evidence changes.

Remaining blockers are: **(1)** refreshing each open PR onto current master and obtaining owner approval; **(2)** #49’s reproducible recovered-schema-to-Phase-4 compatibility blocker, including missing `anon` and other Phase 3 schema elements in the simplified restored fixture; **(3)** Qwen re-review of #41 and Astra triage of #59 CodeRabbit findings; **(4)** hosted JWT/RLS/Storage security and real Auth/database/Storage recovery verification; and **(5)** veterinarian/owner clinical-policy approval for services, species, resources, hours and live cutover.

## Free-tier and safety restrictions

The project remains free-tier and zero-cost by default. No paid backend, hosting subscription, mandatory payment API, paid AI API or upgrade is authorized. Free plans may pause, limit email, storage, database capacity, concurrency and availability; no uptime or backup SLA is implied. Never commit credentials, service-role keys, database passwords, tokens, private owner/animal records or private backups. No production SQL, synthetic clinical/Storage writes, staff bootstrap, DNS change, deployment setting change, merge, release tag or external messaging is allowed without the specific owner approval required by the current operating instructions.

## Project links

- [Repository and branches](https://github.com/cmlagatuz/dawney-clinic)
- [Pull requests](https://github.com/cmlagatuz/dawney-clinic/pulls)
- [GitHub Actions](https://github.com/cmlagatuz/dawney-clinic/actions)
- [Integration and release issue #58](https://github.com/cmlagatuz/dawney-clinic/issues/58)
- [Shared AI handoff](docs/AI_HANDOFF.md)
- [Five-agent orchestration](docs/FIVE_AGENT_ORCHESTRATION.md)
- [Legacy audit](docs/PHASE1_LEGACY_AUDIT.md)
- [Web client README](web/README.md)

## Local web client

See [web/README.md](web/README.md) for the React/Vite client setup. Keep browser variables limited to the public Supabase URL and publishable key; never expose `service_role`, `sb_secret_`, database credentials or clinic records.

**Documentation policy:** update verified statuses, exact heads and deployment evidence after material merges. Do not turn planned capabilities, synthetic fixtures or unmerged branches into completed clinical claims.
