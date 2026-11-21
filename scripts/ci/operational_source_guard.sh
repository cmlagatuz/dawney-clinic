#!/usr/bin/env bash
# Frozen PR124 child-only fail-closed review guard; no provider calls.
set -euo pipefail
fail(){ echo "OPS_SOURCE_BLOCKED: $*" >&2;exit 1; }
parent=ebe6caf8a1f9f17fb00739986b1ebdb83e2d9d0d
[[ "$GITHUB_ACTIONS" == true && "$GITHUB_EVENT_NAME" == pull_request &&
   "$GITHUB_REPOSITORY" == cmlagatuz/dawney-clinic ]] ||
 fail 'not an official GitHub pull_request checkout'
git fetch --no-tags origin 'refs/pull/124/head:refs/remotes/origin/frozen-pr124'
[[ "$(git rev-parse refs/remotes/origin/frozen-pr124)" == "$parent" ]] ||
 fail 'PR124 is not frozen at the reviewed parent'
git merge-base --is-ancestor "$parent" HEAD || fail 'missing exact PR124 ancestry'
diff -u <(cat <<'ALLOWED'
.github/workflows/operational-staff-inventory-pg17.yml
docs/STAFF_INVENTORY_OPERATIONAL_CONTRACT.md
scripts/ci/full_tree_pg17.sh
scripts/ci/operational_source_guard.sh
supabase/migrations/20261121201000_staff_self_service_approval_accountant.sql
supabase/migrations/20261121202000_inventory_transactional_branch_ops.sql
supabase/tests/operational_staff_inventory_pg17.sql
web/src/lib/operational-rpcs.ts
ALLOWED
) <(git diff --name-only "$parent" HEAD) ||
 fail 'unexpected child path or unauthorized source modification'
# Preserve EVERY inherited migration through exact PR124 object equivalence.
while IFS= read -r path;do
 [[ "$(git rev-parse "HEAD:$path")" == "$(git rev-parse "$parent:$path")" ]] ||
  fail "historical migration changed: $path"
done < <(git ls-tree -r --name-only "$parent" supabase/migrations |
 grep -E '^supabase/migrations/[0-9]+.*\.sql$')
[[ "$(git diff --name-only "$parent" HEAD -- supabase/migrations)" == \
$'supabase/migrations/20261121201000_staff_self_service_approval_accountant.sql\nsupabase/migrations/20261121202000_inventory_transactional_branch_ops.sql' ]] ||
 fail 'new migrations changed outside reviewed #18/#19'
while read -r path sha;do
 [[ "$(git rev-parse "HEAD:$path")" == "$sha" &&
    "$(git hash-object "$path")" == "$sha" ]] ||
  fail "operational source drift: $path"
done <<'EXACT'
.github/workflows/operational-staff-inventory-pg17.yml 65b17f1f089e60290880059eeb2ac949fc3ef23e
docs/STAFF_INVENTORY_OPERATIONAL_CONTRACT.md 1dcb3132b2f42f1a82b4bdb7f08964bd91912219
supabase/migrations/20261121201000_staff_self_service_approval_accountant.sql a91803aab9017618f48026d78c94b2c94bc02298
supabase/migrations/20261121202000_inventory_transactional_branch_ops.sql e3a2a5112a48d90f2d99a62de53dc980c673464e
supabase/tests/operational_staff_inventory_pg17.sql 62fe92e6a101ab7d25e47a37e3d4ce7220ef03bd
web/src/lib/operational-rpcs.ts 010c4662aefe5cfafd5327878311a48bba1cfeca
EXACT
echo 'PASS: exact PR124 frozen base, inherited 17 migrations identical and child source blobs pinned'
