# Dawney Clinic — Backend Source Integration Candidate
**Status:** non-production, review-only, no self-merge or hosted SQL.

## Immutable source manifest

| Source | Reviewed exact head | Imported paths |
|---|---|---:|
| master (base) | `5fb7972e6844c18fa2f668566c450ea06123b59e` | all existing files retained |
| PR #40 taxonomy/Chow Chow | `7f6b7b4b12c6d5c04a049f5427b77704d560e4f0` | 5 |
| PR #43 booking/security | `2749f810a2d5195e974949cb8e23d4495a8b0d11` | 19 |
| PR #59 staff reads + queue | `0b6ab69f8054d111883e91a1a1a5705ea5ddf281` | 10 |
| PR #62 additive Storage correction | `76009db7dcd3274382444c2f553d75fd7ee85a74` | 8 |
| PR #52 combined PG17 validation | `edc0c731d444b933705cd52f6bc188d331831d50` | 6 |
| PR #49 signed recovery | `034be375d577bf421b9590d68c3599c0067a8b58` | *reference only; not repeated* |

**Exactly 48 source-file entries plus this manifest.** Changes derive from the listed exact GitHub PR source trees, not generated substitutes. The sole conflicting overlap was **`docs/AI_HANDOFF.md`**, modified independently by both PR #43 and PR #59. We intentionally retain the current master version and document both source heads here; do not overwrite another agent's handoff.

## Selected reviewed paths (source tree provenance)

### PR #40 — `7f6b7b4b12c6d5c04a049f5427b77704d560e4f0`
- `.github/workflows/phase4-taxonomy-attachments.yml`
- `docs/PHASE4_P0_TAXONOMY_ROLLOUT.md`
- `supabase/migrations/20261114072200_phase4_taxonomy_trigger_chow_chow_guard.sql`
- `supabase/tests/phase4_taxonomy_p0_fixture.sql`
- `supabase/tests/phase4_taxonomy_p0_regression.sql`

### PR #43 — `2749f810a2d5195e974949cb8e23d4495a8b0d11`
- `.github/workflows/phase4-public-booking.yml`
- `docs/PHASE4_PUBLIC_BOOKING_BACKEND.md`
- `supabase/migrations/20261114090000_phase4_public_booking_contract.sql`
- `supabase/tests/phase4_public_booking_bootstrap.sql`
- `supabase/tests/phase4_public_booking_concurrency.sh`
- `supabase/tests/phase4_public_booking_concurrency_setup.sql`
- `supabase/tests/phase4_public_booking_regression.sql`
- `supabase/tests/phase4_public_booking_species_rls.sql`
- `web/src/booking-contract.d.mts`
- `web/src/booking-contract.mjs`
- `web/src/booking-transition.d.mts`
- `web/src/booking-transition.mjs`
- `web/src/lib/owner-booking-transition.ts`
- `web/src/lib/public-booking.ts`
- `web/src/service-species-reader.d.mts`
- `web/src/service-species-reader.mjs`
- `web/tests/booking-contract.test.mjs`
- `web/tests/booking-transition.test.mjs`
- `web/tests/service-species-reader.test.mjs`

### PR #52 — `edc0c731d444b933705cd52f6bc188d331831d50`
- `.github/workflows/phase4-four-migration-chain.yml`
- `scripts/ci/phase4_combined_source_pg17.sh`
- `supabase/tests/phase4_four_migration_fixture.sql`
- `supabase/tests/phase4_four_migration_regression.sql`
- `supabase/tests/phase4_combined_provider_upgrade.sql`
- `supabase/tests/phase4_combined_source_assertions.sql`

### PR #59 — `0b6ab69f8054d111883e91a1a1a5705ea5ddf281`
- `.github/workflows/phase5a-staff-postgres.yml`
- `docs/PHASE5A_STAFF_READ_CONTRACT.md`
- `scripts/ci/tests/phase5a-staff-workflow.test.mjs`
- `supabase/tests/phase5a_staff_booking_rpc_queue.sql`
- `supabase/tests/phase5a_staff_pg17_bootstrap.sql`
- `supabase/tests/phase5a_staff_pg17_regression.sql`
- `web/src/lib/staff-clinic.ts`
- `web/src/staff-read-contract.d.mts`
- `web/src/staff-read-contract.mjs`
- `web/tests/staff-read-contract.test.mjs`

### PR #62 — `76009db7dcd3274382444c2f553d75fd7ee85a74`
- `.github/workflows/phase3-storage-outer-path.yml`
- `scripts/ci/phase3_storage_outer_path_pg17.sh`
- `supabase/migrations/20261116002500_phase3_storage_outer_object_path_rls_fix.sql`
- `supabase/tests/phase3_storage_outer_path_after_fix.sql`
- `supabase/tests/phase3_storage_outer_path_before_fix.sql`
- `supabase/tests/phase3_storage_outer_path_phase4_preservation.sql`
- `supabase/tests/phase3_storage_outer_path_provider_bootstrap.sql`
- `supabase/tests/phase3_storage_outer_path_synthetic_records.sql`

## Integration-only CI runner amendments (no production changes)
Three imported validation assets are adjusted so the candidate tests its **own local source tree**:
- `scripts/ci/phase3_storage_outer_path_pg17.sh`: remove stale 2026-11-15 PR #52 dependency pin and copy the actual local Phase4 SQL (still checked against exact reviewed Git blobs).
- `scripts/ci/phase4_combined_source_pg17.sh`: pin candidate PR head, ensure master and source PR heads remain unchanged, and run local imported SQL after exact Git blob checks. The other original six migrations and the four-migration sequence remain intact.
- `.github/workflows/phase4-four-migration-chain.yml`: pass candidate head instead of PR #52 head; retain both original historical and combined PG17 test jobs.

## Immutable migration and verification rules

Six **original unchanged** Phase2/3 migrations:
`20261113070302`, `20261113070834`, `20261113074938`, `20261113095318`, `20261113100958`, `20261113101626`.

Four Phase4 migrations, in order:
1. `20261113211600_phase4_taxonomy_attachments.sql`
2. `20261113211700_phase4_animal_catalog_seed.sql`
3. `20261114072200_phase4_taxonomy_trigger_chow_chow_guard.sql`
4. `20261114090000_phase4_public_booking_contract.sql`

Additional isolated correction: `20261116002500_phase3_storage_outer_object_path_rls_fix.sql`, applied on disposable PostgreSQL 17 against already existing policies, before/after Phase4 as separately tested. The historical Dog / Chow Chow patient text, taxonomy mapping, appointment and service zero-default rules must remain intact. No real patient fixture is committed.

Source-level CI includes PR #40 taxonomy trigger/denials, PR #43 service-species RLS and two-session booking retry/conflicts, PR #59 PostgreSQL queue/staff and JavaScript contract, PR #62 read/insert Storage RLS denials, and PR #52 real six+four+fix combined PG17 + historical preservation. Web Node 22 tests, TypeScript and Vite build are required. CI uses only synthetic PostgreSQL and provider shims, unsigned local role claims and dummy public frontend config.

**Explicit exclusions:** no Claude React page/components changes, no permission widening, no hosted Supabase project writes, no live JWT or Storage API validation, no actual managed backup restore, no production activation, no app deployment. Independently accept security review and obtain the owner's release approval before considering merging/applying schema.

