#!/usr/bin/env bash
# RC2 intermediate: exact accepted source and complete delta, no broad exclusions.
set -Eeuo pipefail
fail(){ echo "RC2_BACKEND_BLOCKED: $*" >&2; exit 1; }
phase=be49e7b25ff7ab3a5eee3ef42b6e62cc50c84267
base=2e029697fc2c446171a951167b30bcf7679c286e
import=faba29cdfa0f0f67b4a6baba2fae84b25a2a411a
checkpoint=56224eea6929c65e9fb9edd5a92407747615fda8
recovery=e8537d5535ac7b5277cd790968ac26d7494c8bad
readme=eeaa425509380499b4b228fd4fe9f73d969b1aac
[[ "${GITHUB_ACTIONS:-}" == true && "${GITHUB_EVENT_NAME:-}" == pull_request && "${GITHUB_REPOSITORY:-}" == cmlagatuz/dawney-clinic && "${EXPECTED_HEAD_SHA:-}" == "$(git rev-parse HEAD)" ]] || fail 'requires official exact head'
git merge-base --is-ancestor "$phase" HEAD || fail 'phase ancestry'
git merge-base --is-ancestor "$import" HEAD || fail 'exact import ancestry'
git merge-base --is-ancestor "$checkpoint" HEAD || fail 'review checkpoint ancestry'
test "$(git rev-parse "$import^")" = "$phase" || fail 'import parent'
git fetch --no-tags origin refs/pull/132/head:refs/remotes/origin/rc2-rc1 refs/pull/136/head:refs/remotes/origin/rc2-recovery refs/pull/138/head:refs/remotes/origin/rc2-readme refs/pull/139/head:refs/remotes/origin/rc2-receipt
[[ "$(git rev-parse refs/remotes/origin/rc2-rc1)" == "$base" && "$(git rev-parse refs/remotes/origin/rc2-recovery)" == "$recovery" && "$(git rev-parse refs/remotes/origin/rc2-readme)" == "$readme" && "$(git rev-parse refs/remotes/origin/rc2-receipt)" == 2a79d535ec7b473581381a0122a20afbcefc3256 ]] || fail 'accepted ref drift'
diff -u <(git ls-tree -r "$phase" -- supabase/migrations) <(git ls-tree -r HEAD -- supabase/migrations) || fail 'migration tree drift'
test "$(git rev-parse "$phase:web")" = "$(git rev-parse HEAD:web)" || fail 'frontend drift'
test "$(git rev-parse "$base:web")" = "$(git rev-parse HEAD:web)" || fail 'RC1 web drift'
diff -u <(printf '%s\n' .github/workflows/manual-supabase-recovery.yml docs/MANUAL_SUPABASE_RECOVERY.md readme.md scripts/recovery/manual-supabase-recovery.py scripts/recovery/tests/manual-supabase-recovery-test.py) <(git diff --name-only "$phase" "$import") || fail 'import path drift'
for p in .github/workflows/manual-supabase-recovery.yml docs/MANUAL_SUPABASE_RECOVERY.md readme.md scripts/recovery/manual-supabase-recovery.py scripts/recovery/tests/manual-supabase-recovery-test.py; do
 source="$recovery"; [[ "$p" != readme.md ]] || source="$readme"
 test "$(git ls-tree "$import" -- "$p")" = "$(git ls-tree "$source" -- "$p")" || fail "import blob/mode $p"
 if [[ "$p" != .github/workflows/manual-supabase-recovery.yml ]]; then
  test "$(git ls-tree HEAD -- "$p")" = "$(git ls-tree "$source" -- "$p")" || fail "accepted blob/mode $p"
 fi
done
diff -u <(printf '%s\n' docs/RC2_BACKEND_BLOBS.tsv scripts/ci/rc2_backend_source_guard.sh) <(git diff --name-only "$checkpoint" HEAD) || fail 'unexpected post-checkpoint delta'
diff -u <(printf '%s\n' .github/workflows/clinical-draft-receipt-pg17.yml .github/workflows/clinical23-live-session-pg17.yml .github/workflows/full-tree-pg17-security.yml .github/workflows/manual-supabase-recovery.yml .github/workflows/operational-p2-recovery-pg17.yml .github/workflows/operational-staff-inventory-pg17.yml .github/workflows/rc1-preparation.yml .github/workflows/staff-appointment-lifecycle-pg17.yml docs/AI_HANDOFF.md docs/MANUAL_SUPABASE_RECOVERY.md docs/RC2_BACKEND_BLOBS.tsv docs/RC2_BACKEND_INTEGRATION.md docs/RC2_MIGRATION_BLOBS.tsv readme.md scripts/ci/clinical23_session_order_pg17.sh scripts/ci/rc2_backend_source_guard.sh scripts/ci/rc2_backend_source_guard_test.sh scripts/ci/rc2_frozen_checks.sh scripts/recovery/manual-supabase-recovery.py scripts/recovery/tests/manual-supabase-recovery-test.py supabase/tests/clinical23_attachment_scope_pg17.sql) <(git diff --name-only "$phase" HEAD) || fail 'unexpected delta'
diff -u <(printf '%s\n' .github/workflows/clinical-draft-receipt-pg17.yml .github/workflows/clinical23-live-session-pg17.yml .github/workflows/full-tree-pg17-security.yml .github/workflows/manual-supabase-recovery.yml .github/workflows/operational-p2-recovery-pg17.yml .github/workflows/operational-staff-inventory-pg17.yml .github/workflows/rc1-preparation.yml .github/workflows/staff-appointment-lifecycle-pg17.yml docs/AI_HANDOFF.md docs/MANUAL_SUPABASE_RECOVERY.md docs/RC2_BACKEND_INTEGRATION.md docs/RC2_MIGRATION_BLOBS.tsv readme.md scripts/ci/clinical23_session_order_pg17.sh scripts/ci/rc2_backend_source_guard.sh scripts/ci/rc2_backend_source_guard_test.sh scripts/ci/rc2_frozen_checks.sh scripts/recovery/manual-supabase-recovery.py scripts/recovery/tests/manual-supabase-recovery-test.py supabase/tests/clinical23_attachment_scope_pg17.sql) <(cut -f3 docs/RC2_BACKEND_BLOBS.tsv | tail -n +2) || fail 'delta ledger paths'
while IFS=$'\t' read -r mode blob path; do
 [[ "$mode" == 100644 && "$blob" =~ ^[0-9a-f]{40}$ && -n "$path" ]] || fail 'malformed delta row'
 [[ "$(git ls-tree HEAD -- "$path")" == "$mode blob $blob"$'\t'"$path" && "$(git hash-object "$path")" == "$blob" ]] || fail "delta blob/mode $path"
done < <(tail -n +2 docs/RC2_BACKEND_BLOBS.tsv)
diff -u <(git ls-tree -r "$phase" -- supabase/migrations) <(awk -F '\t' 'NR>1{print $2" blob "$3"\t"$4}' docs/RC2_MIGRATION_BLOBS.tsv) || fail 'migration ledger drift'
test "$(tail -n +2 docs/RC2_MIGRATION_BLOBS.tsv | wc -l)" = 23 || fail 'migration count'
while IFS=$'\t' read -r seq mode blob path; do
 [[ "$mode" == 100644 && "$(git hash-object "$path")" == "$blob" ]] || fail "migration bytes $path"
done < <(tail -n +2 docs/RC2_MIGRATION_BLOBS.tsv)
git diff --quiet && git diff --cached --quiet || fail 'dirty tracked source'
echo 'PASS: exact RC2 backend delta, approved recovery/README, 23 immutable migrations and frozen frontend'
