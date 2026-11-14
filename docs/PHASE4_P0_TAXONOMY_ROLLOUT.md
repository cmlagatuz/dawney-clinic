# Phase 4 P0 — safe taxonomy correction & controlled rollout

**Status:** staged SQL only, **not applied** to the connected Supabase project. Backend owner Astra; reviewer/supervisor must approve deployment separately. Read [Issues #35](https://github.com/cmlagatuz/dawney-clinic/issues/35), [#38](https://github.com/cmlagatuz/dawney-clinic/issues/38) and [Grok draft #39](https://github.com/cmlagatuz/dawney-clinic/pull/39). No clinical go-live.

## Source correction: the trigger was already in the seed migration

`20261113211600_phase4_taxonomy_attachments.sql` creates `clinic_private.resolve_pet_taxonomy()`. The *next* `20261113211700_phase4_animal_catalog_seed.sql` **already contains** `CREATE TRIGGER pet_taxonomy_before_write ... ON public.pets`. Thus Grok's report that no migration installs it is incomplete. This intentionally avoids running the normalization trigger during the initial archival backfill. The true failure mode is **partial/missing-trigger rollout and weak trigger assertions**, not a missing statement across the full two-migration sequence.

The **new third** migration `20261114072200_phase4_taxonomy_trigger_chow_chow_guard.sql` checks the installed trigger's name, procedure, enabled state and uniqueness, and creates it *only if absent*. A conflicting/disabled trigger fails closed. It keeps the function SECURITY INVOKER, empty search path and revoked API EXECUTE, checks active/reviewed catalog identifiers, rejects label/identifier mismatches, preserves historical text on *valid ID-only backfills* and adds official [AKC Chow Chow](https://www.akc.org/dog-breeds/chow-chow/) as `dog-chow-chow`. The backfill updates **only taxonomy IDs and review flag** for case-insensitive Dog/Chow Chow rows; it never changes their `species`/`breed` strings, owner IDs, appointments, clinic-supported flags or clinical/Storage objects. Pre-existing unmatched text stays grandfathered and flagged.

## Staged rollout gate (stop on any mismatch)

1. **Before owner approval:** keep current deployed owner UI and database unchanged. Confirm Claude's new patient form handles `species_id`/`breed_id` and does not deploy API-dependent UI before tables exist. Agree veterinarian species support separately.
2. **Owner recovery preflight:** review free-tier backup limitations and an owner-controlled *encrypted*, access-restricted backup of schemas, Auth identities, patient/appointment data and private Storage objects/configuration. Verify recovery manifest and **isolated** restore procedure; a successful synthetic restore is **not** a full real-data rehearsal. Do not extract real records through AI tools without permission. Stop if a usable point-in-time/recovery path is not accepted.
3. **Read-only preflight under privileged owner supervision:** record migration history (six Phase 2/3 migrations expected at prior checkpoint), number of patients/appointments, known Dog/Chow Chow group, catalog table/trigger existence, RLS policies and grants, and private bucket (5 MiB, PDF/PNG/JPEG, `public=false`). Avoid revealing patient names/IDs/contacts in reports.
4. **Order:** apply versioned migrations `20261113211600`, `20261113211700`, **then** `20261114072200`. On an already partially applied database, inspect migration history and actual schema objects first; do not re-run an already-applied migration or edit its historical body. Stop if any guard fails.
5. **Read-only postflight:** compare counts, verify every original patient and appointment persists, query `lower(trim(species))='dog' AND lower(trim(breed))='chow chow'` for `species_id='dog'`, `breed_id='dog-chow-chow'`, `taxonomy_review_needed=false`; compare original text against the owner's private preflight snapshot. Check exactly one enabled trigger calls `clinic_private.resolve_pet_taxonomy`, new catalog rows have RLS, `anon` has no private grants and catalog rows are not `clinic_supported` by default. Ensure Storage object count unchanged.
6. **Only after separate explicit authorization:** run disposable JWT owner A/B negative tests against live RLS/Storage in approved test mode, with careful rollback/cleanup. No routine synthetic clinical or Storage writes. QA and supervisor sign off before clinician onboarding.
7. **Rollback strategy:** do **not** drop new columns/tables or restore real data destructively merely to roll back the React site. If new UI is defective, revert only the Cloudflare static deployment to a **verified compatible** previous build and pause writes. Because migrations are additive but enforce validation, an old free-text form may no longer be compatible; test compatibility first. If SQL migration fails within a transaction, confirm migration history and all objects before retrying. Repair via a new reviewed forward migration or an isolated restoration plan authorized by owner, never force-edit `supabase_migrations` history. Full Auth/Storage restoration remains unverified.

### Example read-only checks (no patient identifiers exposed)

```sql
select version,name from supabase_migrations.schema_migrations order by version;
select (select count(*) from public.pets) as pet_count,
       (select count(*) from public.appointments) as appointment_count;
select count(*) as chow_chow_records,
       count(*) filter(where species_id='dog' and breed_id='dog-chow-chow'
                      and not taxonomy_review_needed) as linked_records
from public.pets where lower(btrim(species))='dog'
 and lower(btrim(coalesce(breed,'')))='chow chow';
select t.tgname,t.tgenabled,p.proname
from pg_trigger t join pg_proc p on p.oid=t.tgfoid
where t.tgrelid='public.pets'::regclass and not t.tgisinternal;
select id,public,file_size_limit,allowed_mime_types
from storage.buckets where id='clinical-attachments';
```

## Evidence and unresolved Storage/role risk

CI uses disposable PostgreSQL 17 with **two execution variants**: the normal seed-installed trigger and a simulated missing-trigger partial rollout. Tests cover active Dog/Chow Chow, cross-species Dog/Cattle forgery, mismatched text/ID, inactive and pending catalog entries, legacy grandfather updates, case/spacing preservation, appointment preservation, new grants/RLS and unchanged attachment metadata. Existing attachment negative tests remain in the workflow. This is not proof of real live JWT or Storage bytes access.

**Grok receptionist finding:** The existing `clinical_attachments_read_scoped` Storage SELECT policy and `pet_attachments_read_scoped` metadata SELECT policy allow any **active receptionist** (as well as veterinarian/administrator) to read both `owners/` and `clinic/` paths for *any* existing patient. It is not a confirmed exploit absent an approved clinic-role privacy rule, but is a potential least-privilege issue and matters because personal health/vaccination cards are sensitive. The live staff table was empty at prior checkpoint; no receptionist test account has been created. **Do not broaden, narrow or remove** receptionist permissions without owner/veterinarian decision and two-account real JWT deny tests. Proposed least-privilege approach for review: receptionists may see permitted demographic/profile/administrative files only, while clinicians see medical/vaccination cards and clinic documents. A category-aware trusted policy or separate vetted metadata function may be required; Storage paths alone do not encode category reliably, and blindly changing only one layer causes drift.

**Storage integrity residual:** metadata trigger compares object MIME and size against Storage metadata (not an independent virus scan/content proof); client magic-byte checks are defense-in-depth, not malware protection. Object uploads and DB metadata inserts are not atomic, so unindexed private objects need a trusted owner-controlled orphan-reconciliation runbook. No UPDATE/DELETE rights added to private Storage or metadata, no public signed URLs, no client service keys.

**No migration or synthetic-write live operation was authorized by this PR.**
