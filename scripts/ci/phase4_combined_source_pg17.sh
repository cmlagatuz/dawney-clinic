#!/usr/bin/env bash
# Exact-source combined Phase2/3 + Phase4 + PR62 Storage + PR59 staff/booking PG17 gate.
# Source-only and synthetic. Runs on CI's disposable local PG17, NEVER hosted Supabase.
set -Eeuo pipefail
[[ "${GITHUB_ACTIONS:-}" == 'true' && "${PGHOST:-}" == '127.0.0.1' &&
   "${PGPORT:-}" == '5432' && "${PGDATABASE:-}" == 'phase4_combined_ci' ]] ||
  { echo 'REFUSED: only disposable GitHub PostgreSQL 17 service is permitted' >&2; exit 1; }
for command_name in git psql mktemp sha256sum; do
 command -v "$command_name" >/dev/null || { echo "Missing $command_name" >&2; exit 1; }
done
work=$(mktemp -d "${RUNNER_TEMP:?}/phase4-combined.XXXXXXXX")
trap 'rm -rf -- "$work"' EXIT
fail(){ echo "COMBINED SOURCE GATE BLOCKED: $*" >&2; exit 1; }
# For PR events, GitHub checks out a synthetic merge ref. Verify the remote PR
# head still matches the exact commit that triggered this CI run; otherwise
# stale green results must not authorize a newer, untested source head.
if [[ "${GITHUB_EVENT_NAME:-}" == pull_request ]]; then
 [[ -n "${EXPECTED_CANDIDATE_HEAD:-}" ]] ||
  fail 'GitHub event did not supply expected integration candidate source head'
 git fetch --no-tags --depth=1 origin \
  'refs/heads/ai/astra/backend-source-integration-candidate:refs/remotes/origin/combined-candidate'
 [[ "$(git rev-parse refs/remotes/origin/combined-candidate)" == "$EXPECTED_CANDIDATE_HEAD" ]] ||
  fail 'Candidate head changed while the source integration run was executing'
fi
pg(){ psql -X -v ON_ERROR_STOP=1 -q -f "$1"; }

# Check current remote source heads. Merely fetching an old commit is not sufficient.
git fetch --no-tags --depth=1 origin 'refs/heads/master:refs/remotes/origin/combined-master'
[[ "$(git rev-parse refs/remotes/origin/combined-master)" == '5fb7972e6844c18fa2f668566c450ea06123b59e' ]] ||
 fail 'master changed; re-review historical migration inputs'
for spec in \
 '40 7f6b7b4b12c6d5c04a049f5427b77704d560e4f0' \
 '43 2749f810a2d5195e974949cb8e23d4495a8b0d11' \
 '59 0b6ab69f8054d111883e91a1a1a5705ea5ddf281' \
 '62 76009db7dcd3274382444c2f553d75fd7ee85a74' \
 '52 edc0c731d444b933705cd52f6bc188d331831d50'; do
 read -r pr expected <<< "$spec"
 git fetch --no-tags --depth=1 origin \
  "refs/pull/$pr/head:refs/remotes/origin/combined-pr$pr"
 [[ "$(git rev-parse refs/remotes/origin/combined-pr$pr)" == "$expected" ]] ||
  fail "PR #$pr source head drift; re-review before testing"
done
# Execute the actual integrated candidate files. Pin original SQL bytes and
# verify exact remote source heads before any database operations.
while read -r path sha; do
 [[ -s "$path" && "$(git hash-object "$path")" == "$sha" ]] ||
  fail "Original source SQL missing/changed: $path"
done <<'REPO_BLOBS'
supabase/migrations/20261113070302_phase2_core_data_security.sql cf329269e3f38a5ac320d0b60fe82b6165e218d6
supabase/migrations/20261113070834_phase2_index_and_policy_tuning.sql d7f8922de9251bb777430ce4163d2ca501b290f5
supabase/migrations/20261113074938_phase2_verified_auth_and_staff_bootstrap.sql 218b612c15944c811708f4908825d0a969064692
supabase/migrations/20261113095318_phase3_appointment_lifecycle.sql f12c39c4b75462aa9597d38065c70216e872c478
supabase/migrations/20261113100958_phase3_clinical_storage_policies.sql b47363bfdc3af3081a2af2f422be44a40c967e54
supabase/migrations/20261113101626_phase3_staff_membership_audit.sql 0fc85dd437eac7d8d89fe69025df917ab79d3e0e
supabase/migrations/20261113211600_phase4_taxonomy_attachments.sql 4296a5dcf84324cd83eea226e6054b0cd4f56658
supabase/migrations/20261113211700_phase4_animal_catalog_seed.sql cc03606d3d47b0d573f431a1a1161ba243a314d3
REPO_BLOBS
# Copy the integrated local SQL (not separately fetched dependency SQL).
while read -r pr filename sha source; do
 cp "$source" "$work/$filename" ||
   fail "Missing integrated dependency SQL: $source"
 [[ -s "$work/$filename" && "$(git hash-object "$work/$filename")" == "$sha" ]] ||
   fail "PR #$pr SQL blob altered: $source"
done <<'PINNED_BLOBS'
40 guard.sql 028cbdcfb96e15d297a9458322e1108c46a8b035 supabase/migrations/20261114072200_phase4_taxonomy_trigger_chow_chow_guard.sql
43 booking.sql 929f327141d9e5bb2be220d5685c6ce3f28c253c supabase/migrations/20261114090000_phase4_public_booking_contract.sql
59 bootstrap.sql 6f678342a71faa64a93b310f82b2d3ebd51c3e50 supabase/tests/phase5a_staff_pg17_bootstrap.sql
59 booking_queue.sql 9fd4a627f471391b192968af57f81384a5121a5a supabase/tests/phase5a_staff_booking_rpc_queue.sql
59 staff_queue.sql a1b9781325724885188099075d8c36e9ed223b1b supabase/tests/phase5a_staff_pg17_regression.sql
62 fix.sql 4d78cb2aef1104379d6fd29797705a6188c4c6dc supabase/migrations/20261116002500_phase3_storage_outer_object_path_rls_fix.sql
62 fixture.sql 33015d0972b08f5080d997653c66c7f4f4a6b66e supabase/tests/phase3_storage_outer_path_synthetic_records.sql
62 before.sql 857328b24611a5a6d28c7fcaa38bae2c7edd1379 supabase/tests/phase3_storage_outer_path_before_fix.sql
62 after.sql 293abc90a168f6157aa0b0055d2e78fea8f59a8f supabase/tests/phase3_storage_outer_path_after_fix.sql
62 preserve.sql 70ec39773cc5623fe26cdcb085e2c16593e13fd0 supabase/tests/phase3_storage_outer_path_phase4_preservation.sql
PINNED_BLOBS
echo 'PASS: candidate-tree original migrations and local PR40/43/59/62 SQL match reviewed source; PR52 pin checked.'

# PR59 supplies the minimal provider Auth/Storage shim. This additive CI-only
# upgrade supplies nullable emails/Auth identities and Storage metadata so
# PR59 and PR62 original, unchanged test suites can coexist in one PG17 DB.
pg "$work/bootstrap.sql"
pg supabase/tests/phase4_combined_provider_upgrade.sql
for migration in \
 20261113070302_phase2_core_data_security.sql \
 20261113070834_phase2_index_and_policy_tuning.sql \
 20261113074938_phase2_verified_auth_and_staff_bootstrap.sql \
 20261113095318_phase3_appointment_lifecycle.sql \
 20261113100958_phase3_clinical_storage_policies.sql \
 20261113101626_phase3_staff_membership_audit.sql; do
 pg "supabase/migrations/$migration"
done
echo 'PASS: original six Phase2/3 migrations applied without alteration.'

# Use the same database to exercise the exact four reviewed Phase4 migrations.
pg supabase/migrations/20261113211600_phase4_taxonomy_attachments.sql
pg supabase/migrations/20261113211700_phase4_animal_catalog_seed.sql
pg "$work/guard.sql"
pg "$work/booking.sql"
echo 'PASS: exact Phase4 migration chain 1 -> 2 -> 3 -> 4 on the original Phase3 schema.'

# Original PR59 booking-to-queue suite has its own BEGIN/ROLLBACK.
# The standalone staff suite has no transaction, so bound the entire suite
# in a transaction and ROLLBACK to leave the database empty for PR62 fixtures.
pg "$work/booking_queue.sql"
psql -X -v ON_ERROR_STOP=1 -q \
 -c 'BEGIN' -f "$work/staff_queue.sql" -c 'ROLLBACK'
[[ "$(psql -XAt -v ON_ERROR_STOP=1 -c 'select count(*) from auth.users')" == 0 &&
   "$(psql -XAt -v ON_ERROR_STOP=1 -c 'select count(*) from public.appointments')" == 0 ]] ||
 fail 'PR59 staff and booking test fixtures leaked into combined database'
echo 'PASS: original PR59 secure booking RPC -> staff queue and 0/249/250/251/300 staff RLS matrix, all changes rolled back.'

# PR62's original fixture preserves a synthetic preexisting Dog/Chow Chow
# appointment; PR52's separate existing job already proves PRE-migration
# historical text fidelity. This source-combination job verifies post-chain
# compatibility with corrected Storage and exactly the original PR62 SQL tests.
pg "$work/fixture.sql"
pg "$work/preserve.sql"
pg "$work/before.sql"
pg "$work/fix.sql"
pg "$work/after.sql"
pg "$work/preserve.sql"
pg supabase/tests/phase4_combined_source_assertions.sql
echo 'PASS: corrected Storage owner/staff SELECT/INSERT, cross-owner/anon/revoked/path denials, original Dog/Chow Chow appointment, booking + staff queue preserved.'
echo 'NOT VERIFIED: hosted JWT signatures, Supabase Storage APIs or real clinical data recovery.'
