#!/usr/bin/env bash
# CI-only, real local PG17, full PR67 integrated frontend/backend source.
set -Eeuo pipefail
fail(){ echo "FULL_TREE_GATE_BLOCKED: $*" >&2; exit 1; }
[[ "$GITHUB_ACTIONS" == true && "$GITHUB_EVENT_NAME" == pull_request &&
   "$GITHUB_REPOSITORY" == cmlagatuz/dawney-clinic &&
   "$PGHOST" == 127.0.0.1 && "$PGPORT" == 5432 &&
   "$PGDATABASE" == full_tree_ci &&
   "$EXPECTED_BASE_SHA" == 5b8f7a03292123ed0314b5b7c6304d410b2fc94e &&
   "$EXPECTED_HEAD_SHA" =~ ^[0-9a-f]{40}$ &&
   "$EXPECTED_PR_NUMBER" =~ ^[0-9]+$ ]] || fail 'not exact PR67/CI/disposable PG17 environment'
for bin in git psql; do command -v "$bin" >/dev/null || fail "missing $bin";done
git fetch --no-tags --depth=2 origin \
 "refs/pull/$EXPECTED_PR_NUMBER/head:refs/remotes/origin/full-tree-self"
[[ "$(git rev-parse refs/remotes/origin/full-tree-self)" == "$EXPECTED_HEAD_SHA" ]] ||
 fail 'integration gate head changed during run'
git fetch --no-tags --depth=1 origin 'refs/pull/67/head:refs/remotes/origin/full-tree-base'
[[ "$(git rev-parse refs/remotes/origin/full-tree-base)" == "$EXPECTED_BASE_SHA" ]] ||
 fail 'PR67 source moved; do not test stale tree'
git merge-base --is-ancestor "$EXPECTED_BASE_SHA" "$EXPECTED_HEAD_SHA" ||
 fail 'tested commit not based on PR67'
while IFS= read -r path; do
 case "$path" in
 .github/workflows/full-tree-pg17-security.yml|scripts/ci/full_tree_pg17.sh|supabase/tests/full_tree_approved_booking_gate.sql) ;;
 *) fail "unexpected non-CI change against PR67: $path";;
 esac
done < <(git diff --name-only "$EXPECTED_BASE_SHA" "$EXPECTED_HEAD_SHA")
while read -r path sha; do
 [[ -s "$path" && "$(git hash-object "$path")" == "$sha" ]] ||
  fail "source drift: $path"
done <<'BLOBS'
supabase/migrations/20261113070302_phase2_core_data_security.sql cf329269e3f38a5ac320d0b60fe82b6165e218d6
supabase/migrations/20261113070834_phase2_index_and_policy_tuning.sql d7f8922de9251bb777430ce4163d2ca501b290f5
supabase/migrations/20261113074938_phase2_verified_auth_and_staff_bootstrap.sql 218b612c15944c811708f4908825d0a969064692
supabase/migrations/20261113095318_phase3_appointment_lifecycle.sql f12c39c4b75462aa9597d38065c70216e872c478
supabase/migrations/20261113100958_phase3_clinical_storage_policies.sql b47363bfdc3af3081a2af2f422be44a40c967e54
supabase/migrations/20261113101626_phase3_staff_membership_audit.sql 0fc85dd437eac7d8d89fe69025df917ab79d3e0e
supabase/migrations/20261113211600_phase4_taxonomy_attachments.sql 4296a5dcf84324cd83eea226e6054b0cd4f56658
supabase/migrations/20261113211700_phase4_animal_catalog_seed.sql cc03606d3d47b0d573f431a1a1161ba243a314d3
supabase/migrations/20261114072200_phase4_taxonomy_trigger_chow_chow_guard.sql 028cbdcfb96e15d297a9458322e1108c46a8b035
supabase/migrations/20261114090000_phase4_public_booking_contract.sql 929f327141d9e5bb2be220d5685c6ce3f28c253c
supabase/migrations/20261116002500_phase3_storage_outer_object_path_rls_fix.sql 4d78cb2aef1104379d6fd29797705a6188c4c6dc
supabase/tests/phase5a_staff_booking_rpc_queue.sql 9fd4a627f471391b192968af57f81384a5121a5a
supabase/tests/phase5a_staff_pg17_regression.sql a1b9781325724885188099075d8c36e9ed223b1b
supabase/tests/phase3_storage_outer_path_after_fix.sql 293abc90a168f6157aa0b0055d2e78fea8f59a8f
BLOBS
echo 'PASS: exact PR67 ancestry/head; six Phase2/3 + four Phase4 + additive Storage correction verified at original Git blob SHAs.'
pg(){ psql -X -v ON_ERROR_STOP=1 -q -f "$1"; }
provider(){
 if [[ "$PGDATABASE" == full_tree_history_ci ]]; then
  # PostgreSQL roles are CLUSTER-scoped; the original provider bootstrap
  # creates both roles in DB A. Keep its SQL unchanged, exclude just those
  # two CREATE ROLE statements when initializing disposable DB B.
  [[ "$(psql -XAt -v ON_ERROR_STOP=1 -c "select count(*) from pg_roles where rolname in ('anon','authenticated')")" == 2 ]] ||
   fail 'original Auth roles missing before second database'
  sed -e '/^create role anon nologin;$/d' \
      -e '/^create role authenticated nologin;$/d' \
      supabase/tests/phase5a_staff_pg17_bootstrap.sql |
      psql -X -v ON_ERROR_STOP=1 -q
 else
  pg supabase/tests/phase5a_staff_pg17_bootstrap.sql
 fi
 pg supabase/tests/phase4_combined_provider_upgrade.sql
}
six(){
 for n in \
 20261113070302_phase2_core_data_security.sql \
 20261113070834_phase2_index_and_policy_tuning.sql \
 20261113074938_phase2_verified_auth_and_staff_bootstrap.sql \
 20261113095318_phase3_appointment_lifecycle.sql \
 20261113100958_phase3_clinical_storage_policies.sql \
 20261113101626_phase3_staff_membership_audit.sql; do pg "supabase/migrations/$n"; done
}
four(){
 for n in \
 20261113211600_phase4_taxonomy_attachments.sql \
 20261113211700_phase4_animal_catalog_seed.sql \
 20261114072200_phase4_taxonomy_trigger_chow_chow_guard.sql \
 20261114090000_phase4_public_booking_contract.sql; do pg "supabase/migrations/$n";done
}
# Database A: combined auth, booking, scheduling negative, queue, Storage.
provider
six
four
pg supabase/tests/phase5a_staff_booking_rpc_queue.sql
psql -X -v ON_ERROR_STOP=1 -q -c 'BEGIN' \
 -f supabase/tests/phase5a_staff_pg17_regression.sql -c 'ROLLBACK'
[[ "$(psql -XAt -v ON_ERROR_STOP=1 -c 'select count(*) from auth.users')" == 0 &&
   "$(psql -XAt -v ON_ERROR_STOP=1 -c 'select count(*) from public.appointments')" == 0 ]] ||
 fail 'reused booking/staff fixtures not rolled back'
pg supabase/tests/full_tree_approved_booking_gate.sql
[[ "$(psql -XAt -v ON_ERROR_STOP=1 -c 'select count(*) from public.clinic_services')" == 0 ]] ||
 fail 'approved synthetic policy leaked outside transaction'
pg supabase/tests/phase3_storage_outer_path_synthetic_records.sql
pg supabase/tests/phase3_storage_outer_path_phase4_preservation.sql
pg supabase/tests/phase3_storage_outer_path_before_fix.sql
pg supabase/migrations/20261116002500_phase3_storage_outer_object_path_rls_fix.sql
pg supabase/tests/phase3_storage_outer_path_after_fix.sql
pg supabase/tests/phase4_combined_source_assertions.sql
echo 'PASS: FULL_TREE PG17 real SQL: service-less negative, RPC replay/conflict, owner/anon/revoked/staff RLS, queue 0/249/250/251/300, Storage before/after fix.'

# Database B: original Dog/Chow Chow and requested appointment are present
# BEFORE the four Phase4 migrations, not just seeded afterward.
PGDATABASE=postgres psql -X -v ON_ERROR_STOP=1 -q -c 'CREATE DATABASE full_tree_history_ci'
export PGDATABASE=full_tree_history_ci
provider
six
pg supabase/tests/phase3_storage_outer_path_synthetic_records.sql
psql -X -v ON_ERROR_STOP=1 -q <<'BEFORE'
create table clinic_ci.full_tree_pre_pets as select id,to_jsonb(p) as original from public.pets p;
create table clinic_ci.full_tree_pre_appointments as select id,to_jsonb(a) as original from public.appointments a;
do $$
begin
 if (select count(*) from clinic_ci.full_tree_pre_pets)<>2
  or (select count(*) from clinic_ci.full_tree_pre_appointments)<>1
  or (select count(*) from public.pets where species='Dog' and breed='Chow Chow')<>1
 then raise exception 'FULL_TREE_FAIL: expected pre-Phase4 Chow Chow and appointment missing';end if;
end $$;
BEFORE
four
psql -X -v ON_ERROR_STOP=1 -q <<'AFTER'
do $$
begin
 if exists(select 1 from clinic_ci.full_tree_pre_pets old left join public.pets p using(id)
   where p.id is null or to_jsonb(p)-'species_id'-'breed_id'-'taxonomy_review_needed' is distinct from old.original)
 or exists(select 1 from clinic_ci.full_tree_pre_appointments old left join public.appointments a using(id)
   where a.id is null or to_jsonb(a)-'service_id'-'request_nonce' is distinct from old.original)
 then raise exception 'FULL_TREE_FAIL: historical patient/appointment data mutated';end if;
 if (select count(*) from public.pets where id='33333333-3333-4333-8333-333333333333'
    and species='Dog' and breed='Chow Chow'
    and species_id='dog' and breed_id='dog-chow-chow'
    and taxonomy_review_needed=false)<>1
 or (select count(*) from public.appointments where id='55555555-5555-4555-8555-555555555555'
    and status='requested' and service_id is null and request_nonce is null)<>1
 then raise exception 'FULL_TREE_FAIL: Chow Chow mapping or historical appointment lost';end if;
 if (select count(*) from pg_trigger
   where tgrelid='public.pets'::regclass and
   tgfoid='clinic_private.resolve_pet_taxonomy()'::regprocedure
   and not tgisinternal and tgenabled in ('O','A'))<>1
 then raise exception 'FULL_TREE_FAIL: taxonomy trigger is not exact one';end if;
 if exists(select 1 from public.clinic_services)
    or exists(select 1 from public.clinic_booking_policy where is_approved)
 then raise exception 'FULL_TREE_FAIL: migration auto-approved services or policy';end if;
end $$;
AFTER
pg supabase/migrations/20261116002500_phase3_storage_outer_object_path_rls_fix.sql
pg supabase/tests/phase3_storage_outer_path_phase4_preservation.sql
echo 'PASS: FULL_TREE pre-Phase4 Dog/Chow Chow and requested booking archival fields survive exact six+four+fix.'
echo 'NOT VERIFIED: hosted Supabase JWTs/Storage API, provider restore, real patient data or approved clinical hours.'
