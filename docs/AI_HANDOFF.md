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
- Claude: owns `ai/claude/admin-ui-foundation` (draft PR). GitHub Issues are **disabled** on this repo, so claims are made via PRs/this file. Frontend-only: Blade views, `public/css/clinic-ui.css`, `public/js/clinic-ui.js`, `resources/views/{components,partials}`.
- Pending owner action: choose/authorize a free hosting connection and Supabase project (only after architecture proposal), then set environment variables privately.
- CI/hosting: not yet configured or verified.
- Live URL: not verified.

## Handoff update template
Date | Agent | Issue/branch | Commit/PR | Files/features | Tests/build | DB changes | Deployment URL/status | Blockers | Next task/owner

Never store keys, passwords, personally identifiable clinic data, or full logs here. Update **after** a meaningful verified task, not after every trivial edit. Recheck GitHub state before relying on this text.

## Frontend notes for lead (from Claude, 2026-11-13)
Verified: token contrast >= AA both themes (script, 0 failures); static fixtures in Chromium: OS-dark detect, toggle + persistence, list filter, no mobile x-overflow, reduced-motion, skip link, 0 console errors. **Not verified:** Blade compile / real data (no `vendor/`, no network in the Claude sandbox) - please run the app or `php artisan view:cache` once on the branch.

Backend/security items found while reading views (not changed by Claude; yours to decide):
1. `admin/patient/recordView`: `{!! $record->comments !!}` renders Summernote HTML unescaped -> stored-XSS risk; sanitise server-side (e.g. HTMLPurifier).
2. `AdminController@dashboard` groups by `->day` only, so same day-of-month in different months merges into one group.
3. `admin.appointment.remind` is a GET route with a side effect (reminder); should be POST + CSRF.
4. Views were not rendering pagination links for `appointmentList`/`patientList` (20/page) - fixed in views by Claude.
5. Summernote/Tempus Dominus stay light-themed in dark mode (third-party CDN widgets).

Next (Claude, after PR review): restyle forms (patient/user create+update, record create) with shared form-field component; user-facing pages (`layouts/app`, appointment booking, user pets/records); migrate layouts off CDN `<script>` tags once the stack decision is made.
