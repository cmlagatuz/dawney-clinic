# Phase 4 public booking backend — staged contract, owner approval REQUIRED

**Issue:** [#42](https://github.com/cmlagatuz/dawney-clinic/issues/42). **Only backend SQL/API/CI and docs in this PR. No public React pages, branding or styles changed.** Existing Cloudflare Pages landing route still redirects to owner portal; Claude owns future public marketing UI.

## Dependency and rollout

- New additive `20261114090000_phase4_public_booking_contract.sql` depends on [Phase 4 animal catalog + Chow Chow P0 correction PR #40](https://github.com/cmlagatuz/dawney-clinic/pull/40) because service eligibility references `species_catalog`. Never apply standalone or before the three approved taxonomy migrations.
- **No seed services published.** `clinic_services` defaults to `is_active=false`, `published_at=NULL`, `owner_approved_at=NULL`. Only a privileged operator may insert, approve and publish. RLS exposes **only approved, active, published** service data to `anon` and `authenticated`; neither role can create/edit services or approve policy.
- `clinic_service_species` and `clinic_service_resources` link each approved service to veterinarian-approved animal types and existing approved resources. Existing `appointments_no_active_overlap` allows **capacity 1** only; model rejects greater capacity. No livestock treatment or services silently enabled.
- Single `clinic_booking_policy` draft row proposes `Asia/Manila` with `is_approved=false`, seven empty weekday windows, no presumed holidays/hours, and unspecified lead/horizon/step. No public availability is claimed until the real clinic approves policy and actual service/resource mappings.
- Anon discovery is read-only. `request_service_appointment` is **SECURITY INVOKER**, callable by verified signed-in owners only, derives owner ID from `auth.uid()`, checks pet ownership, approved service, eligible animal/resource and approved clinic-local slot, writes `requested` only. Existing appointment RLS and GiST exclusion enforce isolation/concurrency. `request_nonce` makes exact retry idempotent. Direct inserts with a service must pass a separate BEFORE INSERT trigger; after schedule approval, legacy service-less inserts are rejected to prevent bypass. All existing rows retain `service_id=NULL` and keep their status/events.
- **Critical release coordination:** once schedule is approved, the existing old owner appointment form will no longer work for **new** bookings until Claude switches to the service-aware RPC. Do NOT approve schedule or release incompatible UI before the new flow and owner validation pass. All schema/DB changes need separate backup/supervisor approval.

## TypeScript contract to Claude

`web/src/lib/public-booking.ts`:
- `listPublicClinicServices()` returns only owner-approved public `id,slug,display_name,summary,duration_minutes`. Empty is a normal state while there are no approved services.
- `readApprovedPublicSchedule()` returns `null` unless approved; never render invented hours/available slots.
- `listPublishedServiceResources(serviceId)` returns only publicly approved policy's resource mapping.
- `requestAuthenticatedServiceBooking(user,{petId,serviceId,resourceId,startsAtUtc,requestNonce,concern,details?})` authenticates, verifies profile/pet, calls atomic RPC, re-reads persisted status for exact retry. Do not claim confirmed or email/SMS sent.
- `freshBookingRequestNonce()` must be generated **once per submission** and reused on network retry; a different nonce represents a new attempt.

`web/src/booking-contract.mjs` and `.d.mts`:
- `saveBookingIntent(sessionStorage, {serviceId,resourceId?,startsAtUtc?})` stores only whitelist non-PII values for 30 min in **sessionStorage**, no owner/pet ID, symptoms, name, phone, email or tokens. `readBookingIntent`, `clearBookingIntent`, `signinForBooking('signin'|'signup')` and `safeBookingReturnPath` restrict return to exact `/book` (no open redirects).
- `clinicSlotToUtc(date,HH:mm,approvedTimezone)` and `utcToClinicSlot(utcISO,timezone)` convert using IANA zone; ambiguous/nonexistent DST wall-clock times fail closed. UI must never use browser/Saudi local time as the Cavite clinic clock.
- **Claude's React pages are not modified.** Existing auth pages may require explicit support for a validated fixed `next=/book` and after-auth intent recovery.

## Security & verification boundary

The new public catalog is deliberately empty; admin/user onboarding and owner/vet signoff are not implemented by this PR. Operators must audit each planned service, durations, species/treatment, resources and operating hours before any manual approval. SQL fixture contains **explicitly fictitious** 09–17 Monday hours and a synthetic test service ONLY in disposable PG17; not live or clinic claims. Tests cover RLS/anon, owner B, idempotency, conflict exclusion, invalid duration/slots, holiday closure, staff-only confirmation, full clinic-time UTC conversion and legacy appointment persistence.

### Workers vs Pages

GitHub [PR #40 check runs](https://github.com/cmlagatuz/dawney-clinic/pull/40/checks) show **`Workers Builds: dawney-clinic` FAILURE** and separate **`Cloudflare Pages` SUCCESS** for same branch. The previously created Worker still appears connected to Git; its failed check has a different Cloudflare Worker build URL. This is not proof that Pages failed. Owner must inspect [Worker build logs](https://dash.cloudflare.com/) and, if redundant, use **Workers & Pages → Worker `dawney-clinic` → Settings → Builds → Disconnect** *only the Worker Git integration*, preserving the Pages `dawney-clinic` project; then verify Pages Git deployment remains connected to `master`. Do not blindly delete Worker or GitHub App.

**Remaining release gates:** full owner-approved backup/recovery, all Phase 4 migrations approved and applied in order, exact business details and service approvals, actual hours/resources, live authenticated JWT RLS and conflict tests with explicit synthetic-write authorization, Claude/Qwen/Grok browser/security verification, no paid services.
