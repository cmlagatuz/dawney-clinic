#!/usr/bin/env bash
# RC2 combined clinical checkpoint; all accepted historical checks run unchanged
# at their own frozen sources. No broad allowlist or mutable HEAD-derived pins.
set -Eeuo pipefail
fail(){ echo "RC2_BACKEND_BLOCKED: $*" >&2; exit 1; }
prep=939bc5f1237d90df431d06408e8812682fd58421
import=32606649a3e4359df998d26d9ace50aab91cef64
checkpoint=8b7416672accff2ef95e07ff16340dcb0e65d6d9
cloud=052b7223ad3208e5644e39bc2e72ae11f2cc74bf
readme=d0233b8962e8f7eea54cc14f0a55d6280c0933a2
rc1=2e029697fc2c446171a951167b30bcf7679c286e
[[ "${GITHUB_ACTIONS:-}" == true && "${GITHUB_EVENT_NAME:-}" == pull_request && "${GITHUB_REPOSITORY:-}" == cmlagatuz/dawney-clinic && "${EXPECTED_HEAD_SHA:-}" == "$(git rev-parse HEAD)" ]] || fail 'requires official exact head'
git merge-base --is-ancestor "$prep" HEAD || fail 'preparation ancestry'
git merge-base --is-ancestor "$import" HEAD || fail 'import ancestry'
git merge-base --is-ancestor "$checkpoint" HEAD || fail 'review checkpoint ancestry'
test "$(git rev-parse "$import^")" = "$prep" || fail 'import parent'
git fetch --no-tags origin refs/pull/132/head:refs/remotes/origin/rc2-rc1 refs/pull/136/head:refs/remotes/origin/rc2-recovery refs/pull/137/head:refs/remotes/origin/rc2-cloud refs/pull/138/head:refs/remotes/origin/rc2-readme refs/pull/139/head:refs/remotes/origin/rc2-receipt
[[ "$(git rev-parse refs/remotes/origin/rc2-rc1)" == "$rc1" && "$(git rev-parse refs/remotes/origin/rc2-recovery)" == e8537d5535ac7b5277cd790968ac26d7494c8bad && "$(git rev-parse refs/remotes/origin/rc2-receipt)" == 2a79d535ec7b473581381a0122a20afbcefc3256 ]] || fail 'accepted backend ref drift'
# Source branches may advance; only the independently accepted ancestor is imported.
git merge-base --is-ancestor "$cloud" refs/remotes/origin/rc2-cloud || fail 'accepted CLOUD lineage drift'
git merge-base --is-ancestor "$readme" refs/remotes/origin/rc2-readme || fail 'accepted PM README lineage drift'
git merge-base --is-ancestor "$rc1" "$cloud" || fail 'CLOUD base ancestry'
diff -u <(printf '%s\n' web/src/clinical/ChartIntegration.tsx web/src/clinical/PatientChart.tsx web/src/clinical/chart-port.ts web/src/components/Layout.tsx web/src/lib/clinical-chart.ts web/src/pages/staff/ClinicalWorkspacePage.tsx web/tests/clinical-workspace.browser.test.mjs) <(git diff --name-only "$rc1" "$cloud") || fail 'accepted CLOUD path set'
diff -u <(printf '%s\n' readme.md web/src/clinical/ChartIntegration.tsx web/src/clinical/PatientChart.tsx web/src/clinical/chart-port.ts web/src/components/Layout.tsx web/src/lib/clinical-chart.ts web/src/pages/staff/ClinicalWorkspacePage.tsx web/tests/clinical-workspace.browser.test.mjs) <(git diff --name-only "$prep" "$import") || fail 'import path drift'
for p in readme.md web/src/clinical/ChartIntegration.tsx web/src/clinical/PatientChart.tsx web/src/clinical/chart-port.ts web/src/components/Layout.tsx web/src/lib/clinical-chart.ts web/src/pages/staff/ClinicalWorkspacePage.tsx web/tests/clinical-workspace.browser.test.mjs; do
 source="$cloud"; [[ "$p" != readme.md ]] || source="$readme"
 test "$(git ls-tree "$import" -- "$p")" = "$(git ls-tree "$source" -- "$p")" || fail "import blob/mode $p"
 test "$(git ls-tree HEAD -- "$p")" = "$(git ls-tree "$source" -- "$p")" || fail "accepted blob/mode $p"
done
test "$(git rev-parse "$cloud:web")" = 8152e80d44df78c0486aa46f066a8204300b9d66 || fail 'approved frontend tree pin'
test "$(git rev-parse HEAD:web)" = 8152e80d44df78c0486aa46f066a8204300b9d66 || fail 'current frontend tree drift'
diff -u <(git ls-tree -r "$prep" -- supabase/migrations) <(git ls-tree -r HEAD -- supabase/migrations) || fail 'migration tree drift'
diff -u <(git ls-tree -r "$prep" -- supabase/migrations) <(awk -F '\t' 'NR>1{print $2" blob "$3"\t"$4}' docs/RC2_MIGRATION_BLOBS.tsv) || fail 'migration ledger drift'
test "$(tail -n +2 docs/RC2_MIGRATION_BLOBS.tsv | wc -l)" = 23 || fail 'migration count'
while IFS=$'\t' read -r seq mode blob path; do
 [[ "$mode" == 100644 && "$(git hash-object "$path")" == "$blob" ]] || fail "migration bytes $path"
done < <(tail -n +2 docs/RC2_MIGRATION_BLOBS.tsv)
# Independent frozen combined gate and negative tests run in the provenance workflow.
combined=55e86d4f431878d9e4c142b657d7640c81272c6a
ci_checkpoint=0e57090b8046aeab19b0f57cfaf394e5790eb842
git merge-base --is-ancestor "$combined" HEAD || fail 'accepted combined ancestry'
git merge-base --is-ancestor "$ci_checkpoint" HEAD || fail 'CI correction ancestry'
diff -u <(printf '%s\n' docs/RC2_CI_INTEGRITY_BLOBS.tsv scripts/ci/rc2_backend_source_guard.sh) <(git diff --name-only "$ci_checkpoint" HEAD) || fail 'unexpected post-checkpoint delta'
diff -u <(printf '%s\n' .github/workflows/full-tree-pg17-security.yml .github/workflows/phase3-release.yml .github/workflows/phase5a-staff-postgres.yml .github/workflows/rc1-preparation.yml .github/workflows/staff-appointment-lifecycle-pg17.yml docs/AI_HANDOFF.md docs/RC2_CI_INTEGRITY.md docs/RC2_CI_INTEGRITY_BLOBS.tsv scripts/ci/rc2_backend_source_guard.sh scripts/ci/rc2_backend_source_guard_test.sh scripts/ci/rc2_frozen_checks.sh scripts/ci/tests/phase5a-target-guard.test.mjs scripts/release/mandatory-test-gate.mjs scripts/release/mandatory-test-gate.test.mjs) <(git diff --name-only "$combined" HEAD) || fail 'unexpected CI integrity delta'
diff -u <(printf '%s\n' .github/workflows/full-tree-pg17-security.yml .github/workflows/phase3-release.yml .github/workflows/phase5a-staff-postgres.yml .github/workflows/rc1-preparation.yml .github/workflows/staff-appointment-lifecycle-pg17.yml docs/AI_HANDOFF.md docs/RC2_CI_INTEGRITY.md scripts/ci/rc2_backend_source_guard.sh scripts/ci/rc2_backend_source_guard_test.sh scripts/ci/rc2_frozen_checks.sh scripts/ci/tests/phase5a-target-guard.test.mjs scripts/release/mandatory-test-gate.mjs scripts/release/mandatory-test-gate.test.mjs) <(cut -f3 docs/RC2_CI_INTEGRITY_BLOBS.tsv | tail -n +2) || fail 'CI integrity ledger paths'
while IFS=$'\t' read -r mode blob path; do
 [[ "$mode" == 100644 && "$blob" =~ ^[0-9a-f]{40}$ && -n "$path" ]] || fail 'malformed delta row'
 [[ "$(git ls-tree HEAD -- "$path")" == "$mode blob $blob"$'\t'"$path" && "$(git hash-object "$path")" == "$blob" ]] || fail "CI integrity blob/mode $path"
done < <(tail -n +2 docs/RC2_CI_INTEGRITY_BLOBS.tsv)
git diff --quiet && git diff --cached --quiet || fail 'dirty tracked source'
echo 'PASS: exact RC2 CI integrity delta, frozen combined web, README, 23 immutable migrations and recovery'
