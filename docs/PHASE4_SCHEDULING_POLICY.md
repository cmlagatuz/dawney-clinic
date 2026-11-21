# Phase 4 scheduling configuration — owner decision pending

**Contract draft only. No clinic hours, holidays or timezone have been approved or applied.**
Live booking code continues to use its current 30-minute request model and existing RLS/PostgreSQL `appointments_no_active_overlap` constraint. This document does not enable bookings, enforce new hours, change Supabase records or alter the React UI.

## Owner-provided values

Complete `docs/PHASE4_SCHEDULING_DRAFT.json` **only after the actual clinic operator approves** all fields, including:

- `timezone`: clinic's actual IANA timezone, e.g. values recognized by `Intl.DateTimeFormat`; do **not** infer from the developer's location.
- `hours`: all 7 `sun` … `sat` days, with arrays of local `{"open":"HH:mm","close":"HH:mm"}` intervals; `[]` means closed. Overlapping/overnight windows are unsupported until explicitly designed.
- `holidays`: exact closed dates `YYYY-MM-DD` in the clinic timezone. Future exceptional hours/partial closures require a further contract extension.
- `durationsMinutes`: authorized appointment lengths (5–240-minute, five-minute increments); `slotStepMinutes`: permitted slot boundaries (5–60 minutes).
- `leadMinutes`: minimum notice (0–10,080 minutes); `maxAdvanceDays`: maximum booking horizon (1–365 days).
- `resources`: verified actual clinic resource IDs and `capacity=1`. **No resources are auto-created.** Capacity above one requires a new capacity-aware DB conflict design, so the offline validator deliberately rejects it.
- `approved`: owner approval status. Keep **false** until review/authorization, versioned policy migration and validation steps are scheduled. Committing `true` to an offline JSON file alone is *not* authorization to make production DB changes.

## Offline policy functions

`packages/clinic-scheduling/src/policy.mjs` exports:

- `validateClinicPolicy(policy)`: fail closed unless `approved=true`, IANA timezone valid, all weekdays/holidays/intervals/durations/resources supplied, and capacity compatible with current one-booking-per-resource database exclusion.
- `evaluateSlot(policy, {startsAt, durationMinutes, resourceId}, now)`: pure **advisory** UTC-to-clinic-time evaluation, including DST offsets, local date/closure, lead time and booking horizon. Requires unambiguous UTC `Z` input; does not query DB or handle competing bookings.
- `mayTransition(from,to)`: mirrors the **already applied** database lifecycle: `requested → confirmed/cancelled/no_show`, `confirmed → checked_in/cancelled/no_show`, `checked_in → completed`; terminal states never reopen.

Run offline tests with `node --test packages/clinic-scheduling/tests/*.test.mjs`. They use synthetic America/New_York DST scenarios strictly to test timezone conversions, **not** to assert where Dawney Clinic operates.

## Gates before activating

1. Confirm precise clinic operator-approved configuration, including practitioner holidays, midday closures, provider concurrency and cancellations.
2. Review frontend appointment submission and existing 30-minute duration against proposed choices. Keep draft policy outside production.
3. Implement reviewed versioned **DB-enforced** policy once signed off; client-only validation cannot block forged API requests. This must account for time zone/DST and resource capacity concurrency. Avoid disabling the existing exclusion constraint or adding assumed clinic rules.
4. Rerun rollback-only SQL migration tests, two-account owner RLS, real API slot collision/denial tests **with explicit synthetic-write approval**, and real browser/profile/pet/booking reload tests; inspect scheduled-time display in the clinic timezone.
5. Coordinate deployment/rollback of policy version independently of frontend static Cloudflare Pages rollback. Log audit events and staff overrides.

**Status: offline contract tested only, no Supabase policy enforcement and no owner-approved schedule.**
