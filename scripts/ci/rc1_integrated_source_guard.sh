#!/usr/bin/env bash
# Integrated RC1 provenance; independent of historical preparation-only gate.
set -Eeuo pipefail
die(){ echo "RC1_INTEGRATED_BLOCKED: $*" >&2; exit 1; }
BASE=b6ee64b38ca4ce2965f2b02f09a4e5584aa56608
IMPORT=15c3778796b8e2e2468f3066e12d8a3d66270483
CLOUD=052a97da1e7ff4e95d46331f6b657f199592bd84
FIX=73067fcdbce7846522e55c33cd0e0ca2051335f4
[[ "${GITHUB_ACTIONS:-}" == true && "${GITHUB_EVENT_NAME:-}" == pull_request && "${GITHUB_REPOSITORY:-}" == cmlagatuz/dawney-clinic && "${EXPECTED_HEAD_SHA:-}" == "$(git rev-parse HEAD)" ]] || die 'requires official exact-head checkout'
git merge-base --is-ancestor "$BASE" "$IMPORT" || die 'backend ancestry'
git merge-base --is-ancestor "$IMPORT" HEAD || die 'import ancestry'
git fetch --no-tags origin refs/pull/130/head:refs/remotes/origin/rc1-backend130 refs/pull/133/head:refs/remotes/origin/rc1-cloud133 refs/pull/134/head:refs/remotes/origin/rc1-cloud134
[[ "$(git rev-parse refs/remotes/origin/rc1-backend130)" == "$BASE" && "$(git rev-parse refs/remotes/origin/rc1-cloud133)" == "$CLOUD" && "$(git rev-parse refs/remotes/origin/rc1-cloud134)" == "$FIX" ]] || die 'frozen source drift'
diff -u <(printf '%s\n' .github/workflows/rc1-preparation.yml docs/AI_HANDOFF.md docs/RC1_CUMULATIVE_CLOUD_BLOBS.tsv docs/RC1_INTEGRATION_HANDOFF.md docs/RC1_STAGING_ACCEPTANCE_ROLLBACK.md readme.md scripts/ci/rc1_integrated_source_guard.sh scripts/ci/rc1_integrated_source_guard_test.sh web/src/hooks/useUnresolvedOperationWarning.ts web/src/pages/staff/AppointmentLifecyclePanel.tsx web/src/pages/staff/InventoryOperatorForms.tsx web/src/pages/staff/InventoryOperatorPage.tsx web/src/pages/staff/OpsPage.tsx web/tests/fixtures/operational-http.mjs web/tests/staff-appointment-lifecycle.browser.test.mjs web/tests/staff-inventory-operational.browser.test.mjs) <(git diff --name-only "$IMPORT" HEAD) || die 'unexpected delta from accepted import'
[[ -z "$(git status --porcelain)" ]] || die 'dirty checkout'
diff -u <(git ls-tree -r "$BASE" -- supabase/migrations) <(git ls-tree -r HEAD -- supabase/migrations) || die 'migration tree drift'
[[ "$(git ls-tree -r --name-only HEAD -- supabase/migrations | grep -c '\.sql$')" == 21 ]] || die 'migration count'
declare -A seen=()
count=0
while IFS= read -r row; do
  IFS=$'\t' read -r blob path source extra <<< "$row"
  [[ "$blob" =~ ^[0-9a-f]{40}$ && -n "$path" && -z "$extra" && "$row" == "$blob"$'\t'"$path"$'\t'"$source" ]] || die 'malformed approved row'
  [[ "$source" == "$CLOUD" || "$source" == "$FIX" ]] || die 'unknown approved source'
  [[ -z "${seen[$path]+present}" ]] || die "duplicate approved path: $path"
  seen[$path]=1
  count=$((count+1))
  [[ "$(git rev-parse "$source:$path")" == "$blob" && "$(git rev-parse "HEAD:$path")" == "$blob" && "$(git hash-object "$path")" == "$blob" ]] || die "approved frontend drift: $path"
done <<'APPROVED'
00f3f176e8f6fdcbf72abf7ed4453ba80280484a	docs/CLOUD_STAFF_APPOINTMENT_LIFECYCLE_2026.md	052a97da1e7ff4e95d46331f6b657f199592bd84
6436b1aa5fd6d18c7ac92aa8b17546131282bcd0	web/src/appointments/lifecycle.d.mts	052a97da1e7ff4e95d46331f6b657f199592bd84
0101256c03e89c80f09cd39eddfac19a745dbf43	web/src/appointments/lifecycle.mjs	052a97da1e7ff4e95d46331f6b657f199592bd84
378deefec10fbc193296e54be5aa2417af974ac5	web/src/appointments/port.ts	052a97da1e7ff4e95d46331f6b657f199592bd84
ee6785e327daa59558ec60932a2c6f93b6a35ab1	web/src/components/ops/OpsParts.tsx	052a97da1e7ff4e95d46331f6b657f199592bd84
6bfe61847b8f6db69a03f43bfee8238043c10016	web/src/hooks/useUnresolvedOperationWarning.ts	73067fcdbce7846522e55c33cd0e0ca2051335f4
716cf1053defc641554e95c380ccaa94a8fc4a80	web/src/pages/staff/appointment-lifecycle.css	052a97da1e7ff4e95d46331f6b657f199592bd84
a7e0b5d6a7a35888a27c33a61eb9bd5126529e35	web/src/pages/staff/AppointmentLifecyclePanel.tsx	73067fcdbce7846522e55c33cd0e0ca2051335f4
a3f8d1a57afff042075e06a7d1f22b59836ee638	web/src/pages/staff/InventoryOperatorForms.tsx	73067fcdbce7846522e55c33cd0e0ca2051335f4
0058085e8ad59e46646ab37b2e08f81a84ebfef8	web/src/pages/staff/InventoryOperatorPage.tsx	73067fcdbce7846522e55c33cd0e0ca2051335f4
337e0eb7347de5872e95cdb6ac2df79ff8ba60dc	web/src/pages/staff/OpsPage.tsx	73067fcdbce7846522e55c33cd0e0ca2051335f4
f03285ff49bd9bbfb27930df687b1eea625583a5	web/src/pages/staff/StaffAccessPages.tsx	052a97da1e7ff4e95d46331f6b657f199592bd84
57e996c4fc5e9a13e833f80ed551484015617174	web/tests/appointment-lifecycle.test.mjs	052a97da1e7ff4e95d46331f6b657f199592bd84
a6c892a9f37dc28fef0ec8550d1132181dc499bb	web/tests/fixtures/operational-http.mjs	73067fcdbce7846522e55c33cd0e0ca2051335f4
a7368c204e8789613816e6ea8f1b3a2ce1771486	web/tests/fixtures/staff-lifecycle-http.mjs	052a97da1e7ff4e95d46331f6b657f199592bd84
40d635336863e2dae26b6ea7f210e920e28681e4	web/tests/staff-appointment-lifecycle.browser.test.mjs	73067fcdbce7846522e55c33cd0e0ca2051335f4
79e17a15a19940f5367f7c8c0d5c86a29d68b842	web/tests/staff-inventory-operational.browser.test.mjs	73067fcdbce7846522e55c33cd0e0ca2051335f4
f7fe41fe4b74fb9a3c01e27fff9bb9dc105e51c0	web/tests/staff-inventory-operator.browser.test.mjs	052a97da1e7ff4e95d46331f6b657f199592bd84
10b976d983ea31539b46a166b7ba08f13fee74c4	web/tests/staff-inventory-operator.test.mjs	052a97da1e7ff4e95d46331f6b657f199592bd84
95c5bdb31387a622a58b19e82ff10ee4c9abb9dc	web/tests/staff-ops-connected.browser.test.mjs	052a97da1e7ff4e95d46331f6b657f199592bd84
APPROVED
[[ "$count" == 20 ]] || die 'approved row count'
echo 'PASS: RC1 integrated provenance; 20 approved source blobs and 21 immutable migrations'
