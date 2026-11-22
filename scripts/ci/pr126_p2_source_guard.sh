#!/usr/bin/env bash
# Strict SOL PR126 two-P2 child. All frozen PR126 files remain byte-identical
# except the one reviewed full-tree CI script (required to invoke this guard).
set -Eeuo pipefail
fail(){ echo "OPS_P2_SOURCE_BLOCKED: $*" >&2;exit 1; }
parent=fd91f7b0e60408764a507df4e1c7efbbd707e5b2
[[ "${GITHUB_ACTIONS:-}" == true && "${GITHUB_EVENT_NAME:-}" == pull_request &&
   "${GITHUB_REPOSITORY:-}" == cmlagatuz/dawney-clinic ]] ||
 fail 'not official GitHub pull_request checkout'
git fetch --no-tags origin 'refs/pull/126/head:refs/remotes/origin/frozen-pr126'
[[ "$(git rev-parse refs/remotes/origin/frozen-pr126)" == "$parent" ]] ||
 fail 'PR126 exact SOL-reviewed head moved'
git merge-base --is-ancestor "$parent" HEAD || fail 'missing exact PR126 ancestry'
[[ "$(git rev-parse HEAD)" != "$parent" ]] || fail 'not a corrective child'
# Source lineage and narrow path list; neither CLOUD PR127 nor frozen parent touched.
diff -u <(cat <<'REVIEWED_P2_PATHS'
.github/workflows/operational-p2-recovery-pg17.yml
docs/OPERATIONAL_P2_RECOVERY_AND_RLS.md
scripts/ci/full_tree_pg17.sh
scripts/ci/pr126_p2_source_guard.sh
scripts/recovery/tests/operational20-restored-authz.sql
scripts/recovery/tests/operational20-signed-restore.sh
supabase/migrations/20261122120000_operational_live_session_read_guard.sql
supabase/tests/operational20_before_fix_repro.sql
supabase/tests/operational20_session_rls_pg17.sql
REVIEWED_P2_PATHS
) <(git diff --name-only "$parent" HEAD) ||
 fail 'unexpected source path, historical file modified, or incomplete two-P2 package'
# For EACH original frozen PR126 path, verify exact byte-identical Git blob.
while IFS= read -r path;do
 [[ "$path" == scripts/ci/full_tree_pg17.sh ]] && continue
 [[ "$(git rev-parse "HEAD:$path")" == "$(git rev-parse "$parent:$path")" ]] ||
  fail "frozen PR126 source modified: $path"
done < <(git ls-tree -r --name-only "$parent")
[[ "$(git rev-parse "HEAD:scripts/ci/full_tree_pg17.sh")" != \
   "$(git rev-parse "$parent:scripts/ci/full_tree_pg17.sh")" ]] ||
 fail 'full-tree source script did not add new strict child guard'
[[ "$(git rev-parse "HEAD:scripts/ci/operational_source_guard.sh")" == b43652ee31c9f8b4f11260e1c82907907e17cfea ]] ||
 fail 'original operational PR126 guard changed'
# 19 historic source migration objects frozen; the ONLY new migration is #20.
test "$(git ls-tree -r --name-only HEAD supabase/migrations | grep -Ec '^supabase/migrations/[0-9]+.*\.sql$')" = 20 ||
 fail 'migration count is not exact 20'
[[ "$(git diff --name-only "$parent" HEAD -- supabase/migrations)" == \
 'supabase/migrations/20261122120000_operational_live_session_read_guard.sql' ]] ||
 fail 'unexpected migration edits'
# New reviewable leaf blobs exact-pinned; no wildcard/default parent allowance.
while read -r path sha;do
 [[ "$(git rev-parse "HEAD:$path")" == "$sha" &&
    "$(git hash-object "$path")" == "$sha" ]] ||
 fail "P2 source/blob drift: $path"
done <<'P2_SOURCE_BLOBS'
.github/workflows/operational-p2-recovery-pg17.yml 8bbdc94b047ba555ce62cbc3383546428d1d9ab6
docs/OPERATIONAL_P2_RECOVERY_AND_RLS.md 055efcc67ad5ee0f72767ef5513915214ab2ea03
scripts/recovery/tests/operational20-restored-authz.sql aee36d057dde54e112aa8eddbfaeca6dd32c3cc4
scripts/recovery/tests/operational20-signed-restore.sh a396092687301d1f3b1cbf2b0ea573aae3d42cb6
supabase/migrations/20261122120000_operational_live_session_read_guard.sql 7b2c2a2e3363482bb8e54ab68947d09e81f66776
supabase/tests/operational20_before_fix_repro.sql 7a2fde3978036e863b525b2b92483e05da73cce0
supabase/tests/operational20_session_rls_pg17.sql f16eb36a94db6f870130e10064be25f79df380dd
P2_SOURCE_BLOBS
echo 'PASS: PR126 SOL-frozen original 19 migrations and all other source objects unchanged; nine exact corrective paths/pinned blobs'
