# Supervisor decision checklist — Phase 4 database rollout and recovery

**Prepared 2026-11-14.** This document does not authorize migration, real-data export, clinical writes, service publication, staff bootstrap or deployment. No live schema changes from this review. The controlling approvals are owner + supervisor; clinic medical services/species and working hours additionally need clinic owner/veterinarian approval.

## Release dependency gates

| Review gate | Source PR / required work | Release rule |
| --- | --- | --- |
| Anonymous browser / branded shell | [CI fix #46](https://github.com/cmlagatuz/dawney-clinic/pull/46), [Claude validation #47](https://github.com/cmlagatuz/dawney-clinic/pull/47), [Claude #34](https://github.com/cmlagatuz/dawney-clinic/pull/34) | Claude #34 **original SHA 08bc40a also passed** on [run #43568477414 attempt 2](https://github.com/cmlagatuz/dawney-clinic/actions/runs/43568477414) after retry, confirming transient preflight fragility; still incorporate #46 fix for durable reliability before calling CI root cause resolved |
| Taxonomy + private attachment metadata | Base migration `20261113211600_phase4_taxonomy_attachments.sql` then seed `20261113211700_phase4_animal_catalog_seed.sql` on master | Only after owner backup/restore review. Second migration **already installs** `pet_taxonomy_before_write` |
| Lossless Chow Chow P0 | [#40](https://github.com/cmlagatuz/dawney-clinic/pull/40) `20261114072200_phase4_taxonomy_trigger_chow_chow_guard.sql` | Third migration only: verifies exact-one enabled trigger, adds AKC Chow Chow and changes taxonomy IDs/review flag, **not** original text; must execute after first two |
| Public booking schema | [#43](https://github.com/cmlagatuz/dawney-clinic/pull/43) `20261114090000_phase4_public_booking_contract.sql` | Fourth migration, requires species_catalog and #40. Does not create/publish services, approve hours or update appointments. Retain unapproved state |
| Marketing column privacy | [stacked security #50](https://github.com/cmlagatuz/dawney-clinic/pull/50) against #43 | Both anonymous AND authenticated owner Data API clients must NOT SELECT service/schedule approval actor IDs; PG17 RLS and booking RPC passed after restricting column grants. Incorporate before #43 supervisor merge or migration |
| UI and workflows | Claude [#41](https://github.com/cmlagatuz/dawney-clinic/pull/41) feature flag OFF, future public #42 frontend | Switch catalog-backed form/booking only after compatible backend verified; keep existing working owner screens |
| Provider | [Worker #45](https://github.com/cmlagatuz/dawney-clinic/issues/45) | Check redundant Worker log separately; successful **Pages** preview is not a successful Worker build |

**Critical compatibility:** `web/src/pages/AppointmentsPage.tsx` on Claude #34 uses old `bookAppointment()` direct insert with **no service_id** and device-local 30-minute slot. The fourth migration preserves existing rows and permits new legacy requests **while `clinic_booking_policy.is_approved=false`**. When policy becomes approved, the new trigger rejects *all* new service-less requests; this is deliberate anti-bypass enforcement, and would break the current owner booking form. **Never mark policy approved until Claude has a tested service-aware RPC booking UI or an separately approved compatibility flow.** A Cloudflare Pages rollback of the old form is not safe once that gate is active.

## Exact owner approval checklist

- [ ] Owner verifies the active project and independently approves a **no-write** baseline snapshot window, with old booking submissions paused to prevent fingerprints changing during the window
- [ ] Owner establishes an **encrypted, access-limited** backup/export and offline inventory for: PostgreSQL schema/migration history/RLS/grants/row data including `auth.users` and `auth.identities`, staff, clinical history, appointments/events, private Storage bucket metadata and the **object bytes** (Storage objects are NOT backed up by a plain relational schema dump), storage policy, Auth providers/redirect/MFA settings and any provider-specific secrets/configurations
- [ ] Owner securely verifies checksums + record counts and a restorable isolated PostgreSQL/Auth/Storage recovery process. **Existing synthetic PG17 CI is not a real-data restore rehearsal.** Supabase Free should not be assumed to include full backups/PITR. If owner cannot confirm a safe restore path, **stop**
- [ ] Supabase Auth and Storage exports are done **only by authorized operator**; never place backups, identifiers, credentials, patient names or contact details in GitHub/AI tools
- [ ] Run `supabase/checks/phase4_preflight_readonly.sql` under trusted owner account, privately preserve counts, fingerprints and bucket settings. Expect 6 applied Phase2/3 versions before Phase4; STOP for unexpected schema/migration drift
- [ ] Supervisor reviews #40 and #43 CI, current merge conflict/base state, Grok audit and any extra applicable grants or Storage scope decisions; staff receptionist document access needs **explicit owner/vet privacy model**
- [ ] Approve migration maintenance window, DB permissions/owner operator, and specific compatible UI release. Keep feature `VITE_PHASE4_PATIENT_FORM` OFF until schema is verified. Do not create production clinical test records or upload files during schema installation
- [ ] Apply each versioned migration exactly ONCE, in SQL file order: **1** `20261113211600`; **2** `20261113211700`; **3** `20261114072200`; **4** `20261114090000`. Do not use legacy PR #1, modify previously applied migration history, rerun historic version or force-push
- [ ] Run `supabase/checks/phase4_postflight_readonly.sql` immediately under controlled window; compare the same three original-field fingerprints, counts, Chow Chow ID mapping and attachment byte totals; verify exactly one enabled species/breed trigger, RLS and grants, draft policy `is_approved=false`, zero public service rows, no unexpected service/resource/animal treatment approvals
- [ ] Investigate **any** mismatch before releasing frontend. Postflight changes to taxonomy IDs alone are intended; original `pets.species`/`pets.breed` must remain byte-for-byte unchanged, as must existing appointment identities and data
- [ ] Have Qwen/Grok inspect owner A/B and anonymous JWT denial, staff authorization, file privacy, duplicate nonce, and concurrent booking race tests. **Live synthetic-write clinical/Storage checks remain separately owner-gated**. No fake go-live or email/SMS claims
- [ ] After owner/veterinarian explicitly approves real services, treatments, exact `Asia/Manila` hours, holidays, appointment durations, real resource capacity=1, cancellation rules and authenticated booking UX, a trusted operator may separately configure/publish services/policy through audited SQL (no browser write grants); only then enable public-booking UI and prove persisted request-versus-confirmed behavior

## Rollback / restoration decision tree

1. **Migration not yet started:** leave current Supabase untouched; roll back only preview branch as needed.
2. **Migration stopped or errored:** stop traffic to affected booking writes, record the actual migration history and schema without disclosing data. Verify whether the migration runner committed a partial transaction **before** any retry. Prefer a new reviewed *forward repair* migration. Never blindly drop new tables/columns or replay version numbers.
3. **Migrated but frontend defective:** keep the database intact and the owner booking policy **unapproved**; serve only a previously verified schema-compatible Pages build. A static rollback cannot reverse database validation/triggers. Test legacy direct insert compatibility before serving any old frontend.
4. **Real-data corruption discovered:** stop writes, preserve evidence, validate the offline backup and manifest **in an isolated restoration target**. Owner signs off on destructive restore only after Auth identities, row relationships, migrations, clinical data and private object bytes/configuration are verified. No destructive restoration is authorized here.
5. **Recovery completion criteria:** restore separately proves Auth sign-in/rehydration and owner-to-patient relationships, two-account RLS isolation, exact historical species/breed and appointment invariants, immutable clinical notes/events, complete private Storage object bytes/metadata and access policies, and documented rollback of the static Pages release. Without this **do not claim full recovery**.

## PR #40 backend review (ready for supervisor code review; NOT live-ready)

- Source check: first taxonomy migration creates trigger function; second seed creates actual patient trigger; third guards against missing/duplicate/disabled trigger. CI checks two synthetic PostgreSQL 17 variants and replay. It preserves `pets.species`/`pets.breed` originals while backfilling Chow Chow identifiers, and does not modify appointments or bucket configuration.
- **Additional evidence still needed before live rollout:** owner-private before/after fingerprints, verified provider backup/restore, active clinician species decisions, and live RLS/Storage JWT denial under approved test mode. No human reviewer has approved those gates yet.

## PR #43 backend review (ready for supervisor code review, dependency blocked)

- Requests require verified Auth and an owner row/pet belonging to the signed-in account; DB function is `SECURITY INVOKER`. `clinic_services` is RLS public-readable only if active, explicitly approved and published; zero services seeded. Clinic hours are deliberately absent and `Asia/Manila` is merely proposed.
- `request_service_appointment` creates `requested` (never `confirmed`). Existing staff-only update policy plus status audit/transition triggers govern confirmation. Existing GiST exclusion and capacity=1 enforce conflicts; stable owner `request_nonce` handles exact replays. An unapproved animal type/resource or mismatched patient owner fails closed.
- **Public API review correction:** #43 previously granted full service/schedule SELECT to anon/auth, exposing approval actor UUIDs. Stacked [#50](https://github.com/cmlagatuz/dawney-clinic/pull/50) restricts both roles to public columns while preserving SECURITY INVOKER booking checks; [isolated PG17 run #43571587345](https://github.com/cmlagatuz/dawney-clinic/actions/runs/43571587345) passed. Include fix before #43 merge. **Remaining compatibility and trust boundaries:** old 30-minute direct-insert form must not be used after policy approval; actual service-aware login return is not wired in Claude's AuthPages; no public read-only instantaneous conflict-free availability API exists. Frontend should show only *requests*, never guaranteed available slots; unsigned anonymous visitors may browse published services but not create patient/booking rows.
- **No live deployment or clinical persistence claim:** synthetic PostgreSQL / Node unit success is not live two-account HTTP or clinical use.

## Claude frontend integration — exact source contracts

Import from `web/src/lib/public-booking.ts` in future Claude-owned routes:

| API | Returns / required inputs | UI behavior |
| --- | --- | --- |
| `listPublicClinicServices()` | `PublicClinicService[]` (`id, slug, display_name, summary, duration_minutes, published_at`) | Public `/services` and `/book`, no Auth required. If empty, clear no-approved-services state, not mock data |
| `readApprovedPublicSchedule()` | `ApprovedClinicSchedule|null` | `null` means no official hours or booking availability published; provide contact/callback guidance, **no made-up slots** |
| `listPublishedServiceResources(serviceId)` | `PublishedServiceResource[]` | Only approved policy/resources; capacity=1; **not** a real-time free-slot guarantee |
| `freshBookingRequestNonce()` | UUID | Generate **once per logical submission**, retain on network retries, never regenerate on a retry |
| `requestAuthenticatedServiceBooking(user,input)` | Persisted appointment row with true `status` | `input={petId,serviceId,resourceId,startsAtUtc,requestNonce,concern,details?}`. Require logged-in confirmed account, persisted owner, owned pet. Status starts `requested`; exact retry may show later staff-confirmed state, not a new confirmation |
| `saveBookingIntent(sessionStorage,input)` | Safe return path `/book` | Preauth whitelist ONLY `{serviceId,resourceId?,startsAtUtc?}`; 30-min expiry, no patient/PII/symptoms in session storage |
| `readBookingIntent` / `clearBookingIntent` / `signinForBooking` / `safeBookingReturnPath` | Validators and fixed login return | Signin `/auth/signin?next=%2Fbook`, signup `/auth/signup?next=%2Fbook`; reject arbitrary redirect. Clear intent on successful booking, explicit cancellation or expiry |
| `clinicSlotToUtc(date,time,timezone)` / `utcToClinicSlot(utcIso,timezone)` | UTC timestamp or clinic-local date/time | Use only approved `Asia/Manila` (once approved); reject ambiguous/nonexistent times, never use customer's device timezone |

**Exact current auth integration gap:** Claude #34 `web/src/pages/AuthPages.tsx` unconditionally navigates to `/app/overview` on successful login and email verification/callback; it **does not yet read the `next=/book` parameter**. Claude must implement allowlisted return on login, signup/verification and callback (including when the user is already authenticated), and preserve only the PII-free intent. Do not modify Claude's React files in Astra branches.

## External Worker

[Issue #45](https://github.com/cmlagatuz/dawney-clinic/issues/45): Workers Builds failing separately from successful Pages builds. The Worker is not proven unused. Owner checks its routes/build logs in Cloudflare dashboard before disconnecting **only its Git build**. Do not delete Worker, uninstall GitHub app, or disable Pages.
