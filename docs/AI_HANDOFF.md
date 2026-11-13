# Dawney Clinic — Cross-AI Handoff (single source of truth)

Updated: 2026-11-13. This is a **baseline**, not evidence of a deployment.

## Current repository snapshot
- Repo: https://github.com/cmlagatuz/dawney-clinic
- Default branch: `master`
- Existing stack: Laravel 5.8 / PHP 7.1-era / MySQL; Blade / Bootstrap 4 / Vue 2.
- Existing route areas: auth & verified users, appointment scheduling, user pet/medical record views, admin patients/owners/records. Inventory/order routes currently commented out.
- No verified hosting deployment or production Supabase schema as part of this baseline.
- Laravel 5.8 is no longer supported for security fixes. Architecture and safe migration are pending analysis.
- Workflow contract: `AGENTS.md`; Claude pointer: `CLAUDE.md`.
- Official Supabase skill installer: `npx skills add supabase/agent-skills` (requires terminal; has NOT been run by this setup).

## Suggested first task
Lead (ChatGPT): audit DB migrations, feature-parity and deployment options, propose staged migration + no-cost architecture with explicit tradeoffs.
Claude: wait for scoped task, then analyze legacy UI and propose modern accessible layout and component map without overwriting lead's files.

## Task ownership / status
- ChatGPT: unassigned until next project session.
- Claude: unassigned until next project session.
- Pending owner action: choose/authorize a free hosting connection and Supabase project (only after architecture proposal), then set environment variables privately.
- CI/hosting: not yet configured or verified.
- Live URL: not verified.

## Handoff update template
Date | Agent | Issue/branch | Commit/PR | Files/features | Tests/build | DB changes | Deployment URL/status | Blockers | Next task/owner

Never store keys, passwords, personally identifiable clinic data, or full logs here. Update **after** a meaningful verified task, not after every trivial edit. Recheck GitHub state before relying on this text.
