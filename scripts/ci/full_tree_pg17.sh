#!/usr/bin/env bash
# CI-only, real local PG17: reviewed PR69+PR70+PR71 staff+PR68 security source.
set -Eeuo pipefail
fail(){ echo "FULL_TREE_GATE_BLOCKED: $*" >&2; exit 1; }
[[ "$GITHUB_ACTIONS" == true && "$GITHUB_EVENT_NAME" == pull_request &&
   "$GITHUB_REPOSITORY" == cmlagatuz/dawney-clinic &&
   "$PGHOST" == 127.0.0.1 && "$PGPORT" == 5432 &&
   "$PGDATABASE" == full_tree_ci &&
   "$EXPECTED_BASE_SHA" == 63a2b68ee93463f426cafc6bdf468376343001cf &&
   "$EXPECTED_FRONTEND_SHA" == 2a42489a4b85c46979f9c971474fc74579f673de &&
   "$EXPECTED_SECURITY_SHA" == 9bc84ef3cde86d6c052c4d40012ffbee9c2391f0 &&
   "$EXPECTED_STAFF_SHA" == 1dfd25f2ffcf5470ed7e0b4a33fcf5013a53a373 &&
   "$EXPECTED_HEAD_SHA" =~ ^[0-9a-f]{40}$ &&
   "$EXPECTED_PR_NUMBER" =~ ^[0-9]+$ ]] || fail 'not pinned release-candidate/CI/disposable PG17 environment'
for bin in git psql; do command -v "$bin" >/dev/null || fail "missing $bin";done
[[ "$(git rev-parse HEAD)" == "$EXPECTED_HEAD_SHA" ]] || fail "checkout does not match exact PR head"
git fetch --no-tags origin \
 "refs/pull/$EXPECTED_PR_NUMBER/head:refs/remotes/origin/full-tree-self"
[[ "$(git rev-parse refs/remotes/origin/full-tree-self)" == "$EXPECTED_HEAD_SHA" ]] ||
 fail 'integration gate head changed during run'
git fetch --no-tags origin \
 'refs/pull/69/head:refs/remotes/origin/release-base' \
 'refs/pull/70/head:refs/remotes/origin/reviewed-frontend' \
 'refs/pull/68/head:refs/remotes/origin/reviewed-security' \
 'refs/pull/71/head:refs/remotes/origin/reviewed-staff'
[[ "$(git rev-parse refs/remotes/origin/release-base)" == "$EXPECTED_BASE_SHA" ]] ||
 fail 'PR69 source moved; do not test stale tree'
[[ "$(git rev-parse refs/remotes/origin/reviewed-frontend)" == "$EXPECTED_FRONTEND_SHA" ]] ||
 fail 'PR70 source moved; do not test stale tree'
[[ "$(git rev-parse refs/remotes/origin/reviewed-security)" == "$EXPECTED_SECURITY_SHA" ]] ||
 fail 'PR68 source moved; do not test stale tree'
[[ "$(git rev-parse refs/remotes/origin/reviewed-staff)" == "$EXPECTED_STAFF_SHA" ]] ||
 fail 'PR71 source moved; do not test stale tree'
git merge-base --is-ancestor "$EXPECTED_BASE_SHA" "$EXPECTED_HEAD_SHA" ||
 fail 'tested commit is missing PR69 ancestry'
git merge-base --is-ancestor "$EXPECTED_FRONTEND_SHA" "$EXPECTED_HEAD_SHA" ||
 fail 'tested commit is missing reviewed PR70 ancestry'
git merge-base --is-ancestor "$EXPECTED_SECURITY_SHA" "$EXPECTED_HEAD_SHA" ||
 fail 'tested commit is missing Grok-accepted PR68 ancestry'
git merge-base --is-ancestor "$EXPECTED_STAFF_SHA" "$EXPECTED_HEAD_SHA" ||
 fail 'tested commit is missing PR71 staff UI ancestry'
# The seven PR70 files must be byte-for-byte identical to Claude's reviewed head.
while IFS= read -r path; do
 [[ "$(git rev-parse "HEAD:$path")" == "$(git rev-parse "$EXPECTED_FRONTEND_SHA:$path")" ]] ||
 fail "reviewed frontend source drift: $path"
done <<'CLAUDE'
docs/AI_HANDOFF.md
web/src/pages/AppointmentsPage.tsx
web/src/public-site/booking-mode.d.mts
web/src/public-site/booking-mode.mjs
web/src/public-site/usePatientEligibility.ts
web/src/public-site/useServiceSpecies.ts
web/tests/owner-booking-view.test.mjs
CLAUDE
# PR68 original runner and tests remain anchored at the frozen PR100 commit.
# The single guard exception below is explicitly anchored to PR98's frozen
# previously reviewed blob, then separately pinned to this child's correction.
while IFS= read -r path; do
 [[ "$(git rev-parse "HEAD:$path")" == "$(git rev-parse "$EXPECTED_SECURITY_SHA:$path")" ]] ||
 fail "Grok-accepted hosted harness drift: $path"
done <<'GROK'
.github/workflows/hosted-security-acceptance-source.yml
docs/HOSTED_SECURITY_ACCEPTANCE.md
GROK
[[ "$(git rev-parse "0a8ac3ca914676189272ee5e736bf40e22f36a17:scripts/hosted-acceptance/acceptance.mjs")" == ab77c3cb5cad7e3d52f39e418e4c01fb595c9afe &&
   "$(git rev-parse "0a8ac3ca914676189272ee5e736bf40e22f36a17:scripts/hosted-acceptance/tests/acceptance.test.mjs")" == c5d2dd61e4fecd0f65b8f57fd30cfc240f0131ea ]] ||
 fail 'reviewed original PR68 runner/tests drifted in frozen PR100'
[[ "$(git rev-parse "51ae2c4cfaa92f9126925ab9b9632f8fe77ad1a7:scripts/hosted-acceptance/guards.mjs")" == c6361ee848c1c78370fc5e771d8765090c367708 ]] ||
 fail 'PR98 signed-owner guard ancestor changed'
# Reviewed #71 staff UI files must match the immutable source commit and
# the checked-out bytes; allowlist below remains restrictive for other files.
while read -r path sha; do
 [[ "$(git rev-parse "$EXPECTED_STAFF_SHA:$path")" == "$sha" &&
    "$(git rev-parse "HEAD:$path")" == "$sha" &&
    "$(git hash-object "$path")" == "$sha" ]] ||
  fail "reviewed PR71 staff UI source drift: $path"
done <<'STAFF_BLOBS'
docs/phase5a-ui/INTEGRATION.md 849736b92d23cfeae9f1c41d9354c98559063df6
web/src/ops/port-adapter.d.mts be658d899e66551062b88fbf7062ff8444092efd
web/src/ops/port-adapter.mjs cc219d05c37408ea2833ee71bdd1b1dc6c486b59
web/src/ops/port.ts 49c86914c496b37c73ccf2193bcbaf65757088fb
web/src/ops/useOpsData.ts 65ba82cee4aca9fbb26d9539d04942fd1ace93b7
web/src/pages/staff/OpsPage.tsx 441f4e201fc0dd45568d8de9a75eb2e6be7b3ccf
web/tests/ops-model.test.mjs b142ba5b8aca13cf95231d39d01396f12ced2b81
web/tests/ops-port.test.mjs af738c1fef40a537c1ae6dc77e467c4adabd5339
STAFF_BLOBS
while IFS= read -r path; do
 case "$path" in
 docs/AI_HANDOFF.md|docs/UNIFIED_RELEASE_CANDIDATE.md|\
 .github/workflows/full-tree-pg17-security.yml|scripts/ci/full_tree_pg17.sh|\
 .github/workflows/hosted-security-acceptance-source.yml|docs/HOSTED_SECURITY_ACCEPTANCE.md|\
 scripts/hosted-acceptance/guards.mjs|scripts/hosted-acceptance/acceptance.mjs|\
 scripts/hosted-acceptance/tests/acceptance.test.mjs|\
 web/src/pages/AppointmentsPage.tsx|web/src/public-site/booking-mode.d.mts|\
 web/src/public-site/booking-mode.mjs|web/src/public-site/usePatientEligibility.ts|\
 web/src/public-site/useServiceSpecies.ts|web/tests/owner-booking-view.test.mjs|\
 docs/phase5a-ui/INTEGRATION.md|web/src/ops/port-adapter.d.mts|\
 web/src/ops/port-adapter.mjs|web/src/ops/port.ts|web/src/ops/useOpsData.ts|\
 web/src/pages/staff/OpsPage.tsx|web/tests/ops-model.test.mjs|\
 web/tests/ops-port.test.mjs|\
  docs/STAGING_ACCEPTANCE_TRANSPORT_PREPARATION.md|\
  .github/workflows/staging-acceptance-plan-offline.yml|\
  .github/workflows/phase4-repository-security.yml|\
  .github/workflows/phase3-recovery.yml|\
  scripts/hosted-acceptance/staging-request-plan.mjs|\
  scripts/hosted-acceptance/tests/staging-request-plan.test.mjs) ;;
 *) fail "unexpected source change against PR69: $path";;
 esac
done < <(git diff --name-only "$EXPECTED_BASE_SHA" "$EXPECTED_HEAD_SHA")
# Frozen SOL-reviewed parent PR75 must be unchanged. Explicitly allow only
# its original five remediation paths plus this one signed-owner guard exception.
git fetch --no-tags origin 'refs/pull/75/head:refs/remotes/origin/frozen-pr75'
[[ "$(git rev-parse refs/remotes/origin/frozen-pr75)" == c9995b0e44469408eaa5f46261f2702d3590fc12 &&
   "$(git rev-parse "c9995b0e44469408eaa5f46261f2702d3590fc12:scripts/hosted-acceptance/staging-request-plan.mjs")" == 2654049c6221efea7a1b9c138c7c88442d99961e &&
   "$(git rev-parse "c9995b0e44469408eaa5f46261f2702d3590fc12:scripts/hosted-acceptance/tests/staging-request-plan.test.mjs")" == 6287fd01a8b51b254083058a33643280d47496db ]] ||
 fail 'PR75 reviewed transport planner parent/source moved'
git merge-base --is-ancestor c9995b0e44469408eaa5f46261f2702d3590fc12 "$EXPECTED_HEAD_SHA" ||
 fail 'offline remediation is not descended from reviewed PR75'
diff -u <(cat <<'P2_REMEDIATION_ONLY'
.github/workflows/staging-acceptance-plan-offline.yml
docs/STAGING_ACCEPTANCE_TRANSPORT_PREPARATION.md
scripts/ci/full_tree_pg17.sh
scripts/hosted-acceptance/guards.mjs
scripts/hosted-acceptance/staging-request-plan.mjs
scripts/hosted-acceptance/tests/staging-request-plan.test.mjs
P2_REMEDIATION_ONLY
) <(git diff --name-only c9995b0e44469408eaa5f46261f2702d3590fc12 0a8ac3ca914676189272ee5e736bf40e22f36a17) ||
 fail 'frozen PR100 six-path remediation invariant violated'
# The PR100 ancestor's exact reviewed six-path change remains frozen.
git fetch --no-tags origin 'refs/pull/100/head:refs/remotes/origin/frozen-pr100'
[[ "$(git rev-parse refs/remotes/origin/frozen-pr100)" == 0a8ac3ca914676189272ee5e736bf40e22f36a17 ]] ||
 fail 'frozen SOL-reviewed PR100 head moved'
git merge-base --is-ancestor 0a8ac3ca914676189272ee5e736bf40e22f36a17 "$EXPECTED_HEAD_SHA" ||
 fail 'runner child missing frozen PR100 ancestry'
diff -u <(cat <<'RUNNER_CHILD_ONLY'
.github/workflows/full-tree-pg17-security.yml
.github/workflows/phase3-recovery.yml
scripts/ci/full_tree_pg17.sh
scripts/hosted-acceptance/acceptance.mjs
scripts/hosted-acceptance/guards.mjs
scripts/hosted-acceptance/staging-request-plan.mjs
scripts/hosted-acceptance/tests/acceptance.test.mjs
scripts/hosted-acceptance/tests/staging-request-plan.test.mjs
RUNNER_CHILD_ONLY
) <(git diff --name-only 0a8ac3ca914676189272ee5e736bf40e22f36a17 c8bddb28fca73856a7917a8ffc70de56f38f8e2e) ||
 fail 'frozen PR103 original eight-path security remediation changed'
# Freeze the SOL-reviewed PR103 source independent from the new child.
git fetch --no-tags origin 'refs/pull/103/head:refs/remotes/origin/frozen-pr103'
[[ "$(git rev-parse refs/remotes/origin/frozen-pr103)" == c8bddb28fca73856a7917a8ffc70de56f38f8e2e &&
   "$(git rev-parse "c8bddb28fca73856a7917a8ffc70de56f38f8e2e:scripts/ci/full_tree_pg17.sh")" == 074d451cb90e65ce5d90b56b4c3b41d191d76803 ]] ||
 fail 'PR103 exact reviewed parent moved'
git merge-base --is-ancestor c8bddb28fca73856a7917a8ffc70de56f38f8e2e "$EXPECTED_HEAD_SHA" ||
 fail 'actor-security child missing frozen PR103 ancestor'
diff -u <(cat <<'ACTOR_BOUNDARY_CHILD'
.github/workflows/staging-acceptance-plan-offline.yml
scripts/ci/full_tree_pg17.sh
scripts/hosted-acceptance/acceptance.mjs
scripts/hosted-acceptance/tests/acceptance.test.mjs
ACTOR_BOUNDARY_CHILD
) <(git diff --name-only c8bddb28fca73856a7917a8ffc70de56f38f8e2e 8dd43037ba830a3b2a63d4c55c8cf710b9ab5d2b) ||
 fail 'frozen PR107 four-path actor correction moved'
git fetch --no-tags origin 'refs/pull/107/head:refs/remotes/origin/frozen-pr107'
[[ "$(git rev-parse refs/remotes/origin/frozen-pr107)" == 8dd43037ba830a3b2a63d4c55c8cf710b9ab5d2b &&
   "$(git rev-parse "8dd43037ba830a3b2a63d4c55c8cf710b9ab5d2b:scripts/ci/full_tree_pg17.sh")" == 1c987c3f39746756878738cf208c005625d990be ]] ||
 fail 'frozen SOL-reviewed PR107 head or CI source moved'
git merge-base --is-ancestor 8dd43037ba830a3b2a63d4c55c8cf710b9ab5d2b "$EXPECTED_HEAD_SHA" ||
 fail 'fixture-security child is not descended from frozen PR107'
diff -u <(cat <<'FIXTURE_BOUNDARY_CHILD'
.github/workflows/phase4-repository-security.yml
scripts/ci/full_tree_pg17.sh
scripts/hosted-acceptance/acceptance.mjs
scripts/hosted-acceptance/tests/acceptance.test.mjs
FIXTURE_BOUNDARY_CHILD
) <(git diff --name-only 8dd43037ba830a3b2a63d4c55c8cf710b9ab5d2b 980b7ab94a8f06cb810549a43bee0e6a0f63f789) ||
 fail 'frozen PR111 four-path immutable fixture child changed'
git fetch --no-tags origin 'refs/pull/111/head:refs/remotes/origin/frozen-pr111'
[[ "$(git rev-parse refs/remotes/origin/frozen-pr111)" == 980b7ab94a8f06cb810549a43bee0e6a0f63f789 &&
   "$(git rev-parse "980b7ab94a8f06cb810549a43bee0e6a0f63f789:scripts/ci/full_tree_pg17.sh")" == 4611b3a71535f173455f3f62dc757eeed150c33d ]] ||
 fail 'frozen SOL-reviewed PR111 exact head/CI changed'
git merge-base --is-ancestor 980b7ab94a8f06cb810549a43bee0e6a0f63f789 "$EXPECTED_HEAD_SHA" ||
 fail 'revoked-veterinarian role child missing exact PR111 ancestry'
diff -u <(cat <<'REVOKED_CLINICIAN_CHILD_ONLY'
scripts/ci/full_tree_pg17.sh
scripts/hosted-acceptance/acceptance.mjs
scripts/hosted-acceptance/tests/acceptance.test.mjs
REVOKED_CLINICIAN_CHILD_ONLY
) <(git diff --name-only 980b7ab94a8f06cb810549a43bee0e6a0f63f789 "$EXPECTED_HEAD_SHA") ||
 fail 'revoked veterinarian exact identity/role child path scope widened'
while read -r path sha;do
 [[ "$(git rev-parse "HEAD:$path")" == "$sha" &&
    "$(git hash-object "$path")" == "$sha" ]] ||
 fail "revoked-veterinarian exact blob drift: $path"
done <<'REVOKED_CLINICIAN_CHILD_BLOBS'
scripts/hosted-acceptance/acceptance.mjs 242803fcff634c6d542981c00d7cb1b971d8bf93
scripts/hosted-acceptance/tests/acceptance.test.mjs 5048314c9de7d2fc7fd6d32761acb8b080f0b29f
REVOKED_CLINICIAN_CHILD_BLOBS
while read -r path sha;do
 [[ "$(git rev-parse "980b7ab94a8f06cb810549a43bee0e6a0f63f789:$path")" == "$sha" ]] ||
 fail "frozen PR111 fixture snapshot exact blob drift: $path"
done <<'FIXTURE_SNAPSHOT_BLOBS'
.github/workflows/phase4-repository-security.yml 20d50851b4b0842bb880591aeadcb78842f6c8e0
scripts/hosted-acceptance/acceptance.mjs 21846505972dc3f6d68df16113f379fd1762817b
scripts/hosted-acceptance/tests/acceptance.test.mjs 12e373d7ecf10c8d36b806a870a628715942b07c
FIXTURE_SNAPSHOT_BLOBS
while read -r path sha; do
 [[ "$(git rev-parse "8dd43037ba830a3b2a63d4c55c8cf710b9ab5d2b:$path")" == "$sha" ]] ||
 fail "frozen PR107 actor security source moved: $path"
done <<'ACTOR_BOUNDARY_BLOBS'
.github/workflows/staging-acceptance-plan-offline.yml f00971f2ff8f2eaf8b19f55e1765a33880d312db
scripts/hosted-acceptance/acceptance.mjs e28531d440f9c9f6ca736565d03f167403ec21c5
scripts/hosted-acceptance/tests/acceptance.test.mjs 73bb6968711470a040566769d48da4e71ac68335
ACTOR_BOUNDARY_BLOBS
[[ "$(git rev-parse "0a8ac3ca914676189272ee5e736bf40e22f36a17:.github/workflows/phase3-recovery.yml")" == 5c81e8bbc82497157c71842560f3400f7e581ab5 &&
   "$(git rev-parse "HEAD:.github/workflows/phase3-recovery.yml")" == c8cd61ac2b896a56251f4068d7b1d07fcc5fd488 &&
   "$(git hash-object .github/workflows/phase3-recovery.yml)" == c8cd61ac2b896a56251f4068d7b1d07fcc5fd488 ]] ||
 fail 'unchanged signed recovery workflow expanded beyond reviewed PR trigger'
while read -r path parent current; do
 [[ "$(git rev-parse "0a8ac3ca914676189272ee5e736bf40e22f36a17:$path")" == "$parent" &&
    "$(git rev-parse "8dd43037ba830a3b2a63d4c55c8cf710b9ab5d2b:$path")" == "$current" ]] ||
 fail "frozen PR107 runner remediation ancestor changed: $path"
done <<'RUNNER_SECURITY_BLOBS'
scripts/hosted-acceptance/acceptance.mjs ab77c3cb5cad7e3d52f39e418e4c01fb595c9afe e28531d440f9c9f6ca736565d03f167403ec21c5
scripts/hosted-acceptance/guards.mjs dd17dd88beba2f17db771632591577b14e84fee0 58d5fd6e2444ecd018c21f76b770269ac6ac04a9
scripts/hosted-acceptance/staging-request-plan.mjs f45250d8bf49b4efef9093d7b4fbd358421b8020 d96da92c8e7db950df891b13a1ac4b856aabade3
scripts/hosted-acceptance/tests/acceptance.test.mjs c5d2dd61e4fecd0f65b8f57fd30cfc240f0131ea 73bb6968711470a040566769d48da4e71ac68335
scripts/hosted-acceptance/tests/staging-request-plan.test.mjs 6687c5e2da23acc5c05426339265073d98001ba8 75ee84cbfa8f830b0429d509a4cef4646bf96614
RUNNER_SECURITY_BLOBS
# Preserve the exact PR100 workflow and pin ONLY the added networkless
# Chromium/Playwright localhost smoke step in this CI-only child.
[[ "$(git rev-parse "0a8ac3ca914676189272ee5e736bf40e22f36a17:.github/workflows/full-tree-pg17-security.yml")" == 7d73f726bb7ce7079bba3506f35fba9bc5ce24d0 &&
   "$(git rev-parse "HEAD:.github/workflows/full-tree-pg17-security.yml")" == e822c6af58cf45754c26064a2acf99ecb23d9318 &&
   "$(git hash-object .github/workflows/full-tree-pg17-security.yml)" == e822c6af58cf45754c26064a2acf99ecb23d9318 ]] ||
 fail 'unreviewed full-tree Playwright CI workflow drift'
# Offline-only PR75 staging transport plan and mock coverage: strict blob pins.
# Only the hardened guard differs from the original PR68 guard source; the
# PR68 journal-first acceptance runner and inherited source tests stay pinned.
while read -r path sha; do
 [[ "$(git rev-parse "HEAD:$path")" == "$sha" &&
    "$(git hash-object "$path")" == "$sha" ]] ||
  fail "unreviewed staging transport-preparation source drift: $path"
done <<'STAGING_PREP_BLOBS'
scripts/hosted-acceptance/guards.mjs 58d5fd6e2444ecd018c21f76b770269ac6ac04a9
scripts/hosted-acceptance/staging-request-plan.mjs d96da92c8e7db950df891b13a1ac4b856aabade3
scripts/hosted-acceptance/tests/staging-request-plan.test.mjs 75ee84cbfa8f830b0429d509a4cef4646bf96614
docs/STAGING_ACCEPTANCE_TRANSPORT_PREPARATION.md 487cfe380f4d5eb6353f7a54bed109640be7f6e2
.github/workflows/staging-acceptance-plan-offline.yml f00971f2ff8f2eaf8b19f55e1765a33880d312db
STAGING_PREP_BLOBS
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
echo 'PASS: exact PR69+PR70+PR71+Grok-accepted PR68 ancestry/head; reviewed booking/staff/security blobs; original six Phase2/3 + four Phase4 + additive Storage correction pinned.'
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
