#!/usr/bin/env bash
# Isolated PG17 regression for additive Phase3 Storage outer-path correction.
# Both reviewed orders: fix BEFORE four Phase4 SQL files, or fix AFTER four.
# Synthetic database only; NO hosted Supabase and no real patient data.
set -euo pipefail
[[ "$GITHUB_ACTIONS" == true && "$PGHOST" == "127.0.0.1" &&
   "$PGPORT" == "5432" && $# == 1 ]] ||
 { echo 'Refusing non-CI/non-local storage security test' >&2; exit 1; }
case "$1" in before|after) order=$1;; *) echo 'Expected before or after' >&2;exit 1;; esac
for cmd in git psql mktemp; do command -v "$cmd" >/dev/null || exit 1;done

# Never pick up a changed dependency or an unrelated SQL blob silently.
while read -r path sha; do
 [[ -s "$path" && "$(git hash-object "$path")" == "$sha" ]] ||
  { echo "Unreviewed Phase2/3 migration: $path" >&2; exit 1; }
done <<'SIX'
supabase/migrations/20261113070302_phase2_core_data_security.sql cf329269e3f38a5ac320d0b60fe82b6165e218d6
supabase/migrations/20261113070834_phase2_index_and_policy_tuning.sql d7f8922de9251bb777430ce4163d2ca501b290f5
supabase/migrations/20261113074938_phase2_verified_auth_and_staff_bootstrap.sql 218b612c15944c811708f4908825d0a969064692
supabase/migrations/20261113095318_phase3_appointment_lifecycle.sql f12c39c4b75462aa9597d38065c70216e872c478
supabase/migrations/20261113100958_phase3_clinical_storage_policies.sql b47363bfdc3af3081a2af2f422be44a40c967e54
supabase/migrations/20261113101626_phase3_staff_membership_audit.sql 0fc85dd437eac7d8d89fe69025df917ab79d3e0e
SIX

# Check current PR40/43 heads; run the candidate's integrated local SQL,
# not an obsolete prerelease PR52 migration snapshot.
work=$(mktemp -d "$RUNNER_TEMP/dawney-storage-fix.XXXXXX")
trap 'rm -rf -- "$work"' EXIT
for spec in \
"40 7f6b7b4b12c6d5c04a049f5427b77704d560e4f0" \
 "43 2749f810a2d5195e974949cb8e23d4495a8b0d11"; do
 read -r pr expected <<<"$spec"
 git fetch --no-tags --depth=1 origin \
  "refs/pull/$pr/head:refs/remotes/origin/storage-fix-pr$pr"
 [[ "$(git rev-parse "refs/remotes/origin/storage-fix-pr$pr")" == "$expected" ]] ||
  { echo "Reviewed PR #$pr head drift: STOP until re-reviewed" >&2;exit 1; }
done
cp 'supabase/migrations/20261113211600_phase4_taxonomy_attachments.sql' "$work/20261113211600_phase4_taxonomy_attachments.sql"
cp 'supabase/migrations/20261113211700_phase4_animal_catalog_seed.sql' "$work/20261113211700_phase4_animal_catalog_seed.sql"
cp 'supabase/migrations/20261114072200_phase4_taxonomy_trigger_chow_chow_guard.sql' "$work/20261114072200_phase4_taxonomy_trigger_chow_chow_guard.sql"
cp 'supabase/migrations/20261114090000_phase4_public_booking_contract.sql' "$work/20261114090000_phase4_public_booking_contract.sql"
while read -r path sha; do
 [[ "$(git hash-object "$work/$path")" == "$sha" ]] ||
  { echo "Unreviewed Phase4 SQL blob: $path" >&2; exit 1; }
done <<'FOUR'
20261113211600_phase4_taxonomy_attachments.sql 4296a5dcf84324cd83eea226e6054b0cd4f56658
20261113211700_phase4_animal_catalog_seed.sql cc03606d3d47b0d573f431a1a1161ba243a314d3
20261114072200_phase4_taxonomy_trigger_chow_chow_guard.sql 028cbdcfb96e15d297a9458322e1108c46a8b035
20261114090000_phase4_public_booking_contract.sql 929f327141d9e5bb2be220d5685c6ce3f28c253c
FOUR
echo 'PASS: six real Phase2/3 and four reviewed Phase4 source SHA/blob guards.'

run(){ psql -X -v ON_ERROR_STOP=1 -q -f "$1"; }
real_phase3(){
 run supabase/tests/phase3_storage_outer_path_provider_bootstrap.sql
 for migration in \
  20261113070302_phase2_core_data_security.sql \
  20261113070834_phase2_index_and_policy_tuning.sql \
  20261113074938_phase2_verified_auth_and_staff_bootstrap.sql \
  20261113095318_phase3_appointment_lifecycle.sql \
  20261113100958_phase3_clinical_storage_policies.sql \
  20261113101626_phase3_staff_membership_audit.sql; do
  run "supabase/migrations/$migration"
 done
 run supabase/tests/phase3_storage_outer_path_synthetic_records.sql
}
phase4(){
 for migration in \
  20261113211600_phase4_taxonomy_attachments.sql \
  20261113211700_phase4_animal_catalog_seed.sql \
  20261114072200_phase4_taxonomy_trigger_chow_chow_guard.sql \
  20261114090000_phase4_public_booking_contract.sql; do
  run "$work/$migration"
 done
 run supabase/tests/phase3_storage_outer_path_phase4_preservation.sql
}
correct(){
 run supabase/migrations/20261116002500_phase3_storage_outer_object_path_rls_fix.sql
 run supabase/tests/phase3_storage_outer_path_after_fix.sql
}
real_phase3
if [[ "$order" == before ]]; then
 run supabase/tests/phase3_storage_outer_path_before_fix.sql
 correct
 phase4
 run supabase/tests/phase3_storage_outer_path_after_fix.sql
else
 phase4
 run supabase/tests/phase3_storage_outer_path_before_fix.sql
 correct
fi
echo "PASS: Phase3/Phase4 Storage RLS correction $order reviewed Phase4, exact policies and negative role/path tests."
