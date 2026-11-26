#!/usr/bin/env bash
# Final RC2 exact import and release-engineering delta. Prior guards run at frozen sources.
set -Eeuo pipefail
fail(){ echo "RC2_BACKEND_BLOCKED: $*" >&2; exit 1; }
base=8a3b35f94b63ac318b9f977d33d4f7153fbd2cc5
import=a811b6e4a3f692839ff574678f885a4622e44b75
clinical=052b7223ad3208e5644e39bc2e72ae11f2cc74bf
cloud=c0a2d7c9011ee6e1d7337bd8c05eff6af2877586
initial_readme=07d26dc6ea28fe9514cb0b35a30366db65fe50a2
readme=06223697d84878a15d48e64c5ac49133735d75e9
rc1=2e029697fc2c446171a951167b30bcf7679c286e
[[ "${GITHUB_ACTIONS:-}" == true && "${GITHUB_EVENT_NAME:-}" == pull_request && "${GITHUB_REPOSITORY:-}" == cmlagatuz/dawney-clinic && "${EXPECTED_HEAD_SHA:-}" == "$(git rev-parse HEAD)" ]] || fail 'requires official exact head'
git merge-base --is-ancestor "$base" HEAD || fail 'CI checkpoint ancestry'
git merge-base --is-ancestor "$import" HEAD || fail 'final import ancestry'
test "$(git rev-parse "$import^")" = "$base" || fail 'final import parent'
git fetch --no-tags origin refs/pull/132/head:refs/remotes/origin/rc2-rc1 refs/pull/136/head:refs/remotes/origin/rc2-recovery refs/pull/137/head:refs/remotes/origin/rc2-cloud refs/pull/138/head:refs/remotes/origin/rc2-readme refs/pull/139/head:refs/remotes/origin/rc2-receipt
[[ "$(git rev-parse refs/remotes/origin/rc2-rc1)" == "$rc1" && "$(git rev-parse refs/remotes/origin/rc2-recovery)" == e8537d5535ac7b5277cd790968ac26d7494c8bad && "$(git rev-parse refs/remotes/origin/rc2-receipt)" == 2a79d535ec7b473581381a0122a20afbcefc3256 ]] || fail 'accepted backend ref drift'
git merge-base --is-ancestor "$cloud" refs/remotes/origin/rc2-cloud || fail 'accepted CLOUD lineage drift'
git merge-base --is-ancestor "$initial_readme" "$readme" || fail 'approved README ancestry drift'
git merge-base --is-ancestor "$readme" refs/remotes/origin/rc2-readme || fail 'accepted README lineage drift'
git merge-base --is-ancestor "$rc1" "$clinical" || fail 'clinical ancestry'
git merge-base --is-ancestor "$clinical" "$cloud" || fail 'professional ancestry'
test "$(git rev-parse "$base:web")" = "$(git rev-parse "$clinical:web")" || fail 'clinical baseline drift'
diff -u <(printf '%s\n' 'web/src/billing/billing.css' 'web/src/clinical/workspace.css' 'web/src/components/Layout.tsx' 'web/src/inventory/pharmacy.css' 'web/src/ops/useOpsData.ts' 'web/src/pages/public/HomePage.tsx' 'web/src/pages/public/ServicesPage.tsx' 'web/src/pages/staff/appointment-lifecycle.css' 'web/src/pages/staff/operator-workspaces.css' 'web/src/release/clinic-release.css' 'web/src/styles.css' 'web/tests/clinic-release-train.browser.test.mjs' 'web/tests/fixtures/release-clinic-http.mjs' 'web/tests/fixtures/staff-lifecycle-http.mjs' 'web/tests/professional-ui.browser.test.mjs' 'web/tests/release-clinic.browser.test.mjs' 'web/tests/staff-appointment-lifecycle.browser.test.mjs') <(git diff --name-only "$clinical" "$cloud") || fail 'approved professional path set'
diff -u <(printf '%s\n' 'readme.md' 'web/src/billing/billing.css' 'web/src/clinical/workspace.css' 'web/src/components/Layout.tsx' 'web/src/inventory/pharmacy.css' 'web/src/ops/useOpsData.ts' 'web/src/pages/public/HomePage.tsx' 'web/src/pages/public/ServicesPage.tsx' 'web/src/pages/staff/appointment-lifecycle.css' 'web/src/pages/staff/operator-workspaces.css' 'web/src/release/clinic-release.css' 'web/src/styles.css' 'web/tests/clinic-release-train.browser.test.mjs' 'web/tests/fixtures/release-clinic-http.mjs' 'web/tests/fixtures/staff-lifecycle-http.mjs' 'web/tests/professional-ui.browser.test.mjs' 'web/tests/release-clinic.browser.test.mjs' 'web/tests/staff-appointment-lifecycle.browser.test.mjs') <(git diff --name-only "$base" "$import") || fail 'exact import path set'
test "$(git rev-parse "$cloud:web")" = f5dc0a98bf82fc75db7a5bf144f23236523505b8 || fail 'approved web tree pin'
for ref in "$import" HEAD; do
 test "$(git rev-parse "$ref:web")" = f5dc0a98bf82fc75db7a5bf144f23236523505b8 || fail 'current professional frontend drift'
done
test "$(git ls-tree "$import" -- readme.md)" = "$(git ls-tree "$initial_readme" -- readme.md)" || fail 'initial README import drift'
test "$(git rev-parse "$initial_readme:readme.md")" = c4e6929a5d64b31124d999c6cf5970e1fafccf47 || fail 'initial approved README blob'
test "$(git ls-tree HEAD -- readme.md)" = "$(git ls-tree "$readme" -- readme.md)" || fail 'latest approved README drift'
test "$(git rev-parse "$readme:readme.md")" = ea890c3f9e8243f62410f1591cbe39f26c86f0d5 || fail 'latest approved README blob'
diff -u <(printf '%s\n' 'readme.md' 'web/src/billing/billing.css' 'web/src/clinical/workspace.css' 'web/src/components/Layout.tsx' 'web/src/inventory/pharmacy.css' 'web/src/ops/useOpsData.ts' 'web/src/pages/public/HomePage.tsx' 'web/src/pages/public/ServicesPage.tsx' 'web/src/pages/staff/appointment-lifecycle.css' 'web/src/pages/staff/operator-workspaces.css' 'web/src/release/clinic-release.css' 'web/src/styles.css' 'web/tests/clinic-release-train.browser.test.mjs' 'web/tests/fixtures/release-clinic-http.mjs' 'web/tests/fixtures/staff-lifecycle-http.mjs' 'web/tests/professional-ui.browser.test.mjs' 'web/tests/release-clinic.browser.test.mjs' 'web/tests/staff-appointment-lifecycle.browser.test.mjs') <(cut -f3 docs/RC2_FINAL_IMPORT_BLOBS.tsv | tail -n +2) || fail 'import ledger paths'
diff -u <(printf '%s\n' '.github/workflows/full-tree-pg17-security.yml' '.github/workflows/phase3-release.yml' '.github/workflows/rc1-preparation.yml' '.github/workflows/staff-appointment-lifecycle-pg17.yml' 'docs/AI_HANDOFF.md' 'docs/RC2_CI_INTEGRITY.md' 'docs/RC2_FINAL_IMPORT_BLOBS.tsv' 'docs/RC2_FINAL_SOURCE_BLOBS.tsv' 'docs/RC2_OPERATIONAL_REGISTER.md' 'docs/RC2_OPERATOR_RELEASE_PACKET.md' 'docs/RC2_RECOVERY_OPERATOR_GUIDE.md' 'readme.md' 'scripts/ci/rc2_backend_source_guard.sh' 'scripts/ci/rc2_backend_source_guard_test.sh' 'scripts/ci/rc2_frozen_checks.sh' 'scripts/release/mandatory-test-gate.mjs' 'scripts/release/rc2_operator_preflight.py' 'scripts/release/rc2_operator_preflight_test.py') <(git diff --name-only "$import" HEAD) || fail 'unexpected final integration delta'
diff -u <(printf '%s\n' '.github/workflows/full-tree-pg17-security.yml' '.github/workflows/phase3-release.yml' '.github/workflows/rc1-preparation.yml' '.github/workflows/staff-appointment-lifecycle-pg17.yml' 'docs/AI_HANDOFF.md' 'docs/RC2_CI_INTEGRITY.md' 'docs/RC2_FINAL_IMPORT_BLOBS.tsv' 'docs/RC2_OPERATIONAL_REGISTER.md' 'docs/RC2_OPERATOR_RELEASE_PACKET.md' 'docs/RC2_RECOVERY_OPERATOR_GUIDE.md' 'readme.md' 'scripts/ci/rc2_backend_source_guard.sh' 'scripts/ci/rc2_backend_source_guard_test.sh' 'scripts/ci/rc2_frozen_checks.sh' 'scripts/release/mandatory-test-gate.mjs' 'scripts/release/rc2_operator_preflight.py' 'scripts/release/rc2_operator_preflight_test.py') <(cut -f3 docs/RC2_FINAL_SOURCE_BLOBS.tsv | tail -n +2) || fail 'final ledger paths'
for ledger in docs/RC2_FINAL_IMPORT_BLOBS.tsv docs/RC2_FINAL_SOURCE_BLOBS.tsv; do
 [[ "$(head -n 1 "$ledger")" == $'# mode\tblob\tpath' ]] || fail 'ledger header'
 while IFS=$'\t' read -r mode blob path; do
  [[ "$mode" =~ ^100(644|755)$ && "$blob" =~ ^[0-9a-f]{40}$ && -n "$path" ]] || fail 'malformed delta row'
  if [[ "$ledger" == docs/RC2_FINAL_IMPORT_BLOBS.tsv ]]; then
   [[ "$(git ls-tree "$import" -- "$path")" == "$mode blob $blob"$'\t'"$path" ]] || fail "import checkpoint ledger drift $path"
   # The original import README is historical; latest README is pinned above and in final ledger.
   [[ "$path" != readme.md ]] || continue
  fi
  [[ "$(git ls-tree HEAD -- "$path")" == "$mode blob $blob"$'\t'"$path" && "$(git hash-object "$path")" == "$blob" ]] || fail "ledger blob/mode $path"
 done < <(tail -n +2 "$ledger")
done
diff -u <(git ls-tree -r "$base" -- supabase scripts/recovery) <(git ls-tree -r HEAD -- supabase scripts/recovery) || fail 'backend/recovery drift'
diff -u <(git ls-tree -r "$base" -- supabase/migrations) <(awk -F '\t' 'NR>1{print $2" blob "$3"\t"$4}' docs/RC2_MIGRATION_BLOBS.tsv) || fail 'migration ledger drift'
test "$(tail -n +2 docs/RC2_MIGRATION_BLOBS.tsv | wc -l)" = 23 || fail 'migration count'
while IFS=$'\t' read -r seq mode blob path; do
 [[ "$mode" == 100644 && "$(git hash-object "$path")" == "$blob" ]] || fail "migration bytes $path"
done < <(tail -n +2 docs/RC2_MIGRATION_BLOBS.tsv)
git diff --quiet && git diff --cached --quiet || fail 'dirty tracked source'
echo 'PASS: exact final professional import, PM README, final CI delta and 23 immutable migrations/recovery'
