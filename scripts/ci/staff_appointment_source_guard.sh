#!/usr/bin/env bash
# ASTRA #21: exact isolated backend child from SOL-accepted RC0 PR129.
set -Eeuo pipefail
fail(){ echo "APPOINTMENT21_SOURCE_BLOCKED: $*" >&2; exit 1; }
FROZEN=078053120774e856c9ddaa8c8027b3c891e9e8f6
[[ "${GITHUB_ACTIONS:-}" == true && "${GITHUB_EVENT_NAME:-}" == pull_request &&
   "${GITHUB_REPOSITORY:-}" == cmlagatuz/dawney-clinic &&
   "${EXPECTED_HEAD_SHA:-}" =~ ^[0-9a-f]{40}$ &&
   "$(git rev-parse HEAD)" == "$EXPECTED_HEAD_SHA" ]] || fail 'not exact official PR head'
git cat-file -e "$FROZEN^{commit}" || fail 'frozen parent missing'
git merge-base --is-ancestor "$FROZEN" HEAD || fail 'not descendant of frozen PR129'
git fetch --no-tags origin 'refs/pull/129/head:refs/remotes/origin/frozen-rc0-pr129'
[[ "$(git rev-parse refs/remotes/origin/frozen-rc0-pr129)" == "$FROZEN" ]] ||
 fail 'frozen PR129 changed during test'
diff -u <(cat <<'EXPECTED'
.github/workflows/staff-appointment-lifecycle-pg17.yml
.github/workflows/operational-p2-recovery-pg17.yml
docs/AI_HANDOFF.md
docs/STAFF_APPOINTMENT_LIFECYCLE_CONTRACT.md
scripts/ci/full_tree_pg17.sh
scripts/ci/staff_appointment_source_guard.sh
scripts/recovery/tests/appointment21-signed-restore.sh
supabase/migrations/20261123210000_staff_appointment_lifecycle.sql
supabase/tests/staff_appointment_lifecycle_pg17.sql
EXPECTED
) <(git diff --name-only "$FROZEN" HEAD) || fail 'unreviewed changed path'
mapfile -t old < <(git ls-tree -r --name-only "$FROZEN" supabase/migrations | grep -E '\.sql$')
mapfile -t now < <(git ls-tree -r --name-only HEAD supabase/migrations | grep -E '\.sql$')
[[ ${#old[@]} == 20 && ${#now[@]} == 21 ]] || fail 'historical migration count modified'
diff -u <(printf '%s\n' "${old[@]}") <(printf '%s\n' "${now[@]:0:20}") ||
 fail 'original migration sequence changed'
[[ "${now[20]}" == 'supabase/migrations/20261123210000_staff_appointment_lifecycle.sql' ]] ||
 fail 'unexpected 21st migration'
for path in "${old[@]}";do
 [[ "$(git rev-parse "HEAD:$path")" == "$(git rev-parse "$FROZEN:$path")" &&
    "$(git hash-object "$path")" == "$(git rev-parse "$FROZEN:$path")" ]] ||
 fail "historical migration mutated: $path"
done
for path in AGENTS.md MANUS.md docs/FIVE_AGENT_ORCHESTRATION.md scripts/ci/rc0_source_guard.sh;do
 [[ "$(git rev-parse "HEAD:$path")" == "$(git rev-parse "$FROZEN:$path")" ]] ||
 fail "frozen instruction/CI guard mutated: $path"
done
echo "PASS: exact PR129 frozen SHA, all 20 original migration blobs and 9-file additive child only"
