#!/usr/bin/env bash
# Integrated RC1 provenance; independent of historical preparation-only gate.
set -Eeuo pipefail
die(){ echo "RC1_INTEGRATED_BLOCKED: $*" >&2; exit 1; }
BASE=b6ee64b38ca4ce2965f2b02f09a4e5584aa56608
IMPORT=15c3778796b8e2e2468f3066e12d8a3d66270483
CLOUD=052a97da1e7ff4e95d46331f6b657f199592bd84
[[ "${GITHUB_ACTIONS:-}" == true && "${GITHUB_EVENT_NAME:-}" == pull_request && "${GITHUB_REPOSITORY:-}" == cmlagatuz/dawney-clinic && "${EXPECTED_HEAD_SHA:-}" == "$(git rev-parse HEAD)" ]] || die 'requires official exact-head checkout'
git merge-base --is-ancestor "$BASE" "$IMPORT" || die 'backend ancestry'
git merge-base --is-ancestor "$IMPORT" HEAD || die 'import ancestry'
git fetch --no-tags origin refs/pull/130/head:refs/remotes/origin/rc1-backend130 refs/pull/133/head:refs/remotes/origin/rc1-cloud133
[[ "$(git rev-parse refs/remotes/origin/rc1-backend130)" == "$BASE" && "$(git rev-parse refs/remotes/origin/rc1-cloud133)" == "$CLOUD" ]] || die 'frozen source drift'
diff -u <(printf '%s\n' .github/workflows/rc1-preparation.yml scripts/ci/rc1_integrated_source_guard.sh scripts/ci/rc1_integrated_source_guard_test.sh) <(git diff --name-only "$IMPORT" HEAD) || die 'unexpected delta from accepted import'
[[ -z "$(git status --porcelain)" ]] || die 'dirty checkout'
diff -u <(git ls-tree -r "$BASE" -- supabase/migrations) <(git ls-tree -r HEAD -- supabase/migrations) || die 'migration tree drift'
[[ "$(git ls-tree -r --name-only HEAD -- supabase/migrations | grep -c '\.sql$')" == 21 ]] || die 'migration count'
while IFS=$'\t' read -r blob path; do
 [[ "$(git rev-parse "$CLOUD:$path")" == "$blob" && "$(git rev-parse "HEAD:$path")" == "$blob" && "$(git hash-object "$path")" == "$blob" ]] || die "approved frontend drift: $path"
done <<'APPROVED'
00f3f176e8f6fdcbf72abf7ed4453ba80280484a	docs/CLOUD_STAFF_APPOINTMENT_LIFECYCLE_2026.md
6436b1aa5fd6d18c7ac92aa8b17546131282bcd0	web/src/appointments/lifecycle.d.mts
0101256c03e89c80f09cd39eddfac19a745dbf43	web/src/appointments/lifecycle.mjs
378deefec10fbc193296e54be5aa2417af974ac5	web/src/appointments/port.ts
ee6785e327daa59558ec60932a2c6f93b6a35ab1	web/src/components/ops/OpsParts.tsx
73b18a2242237e7b7fc92d4cd84338e361902684	web/src/pages/staff/AppointmentLifecyclePanel.tsx
9969e62bb161dadf6e6fba56c6a5471e624e39b2	web/src/pages/staff/InventoryOperatorForms.tsx
a8a82e7f6c3ed5e345d25b8071c4e240d3efd0d0	web/src/pages/staff/InventoryOperatorPage.tsx
e1b2d4d72154396aeb3e1923c00e64b409f056a0	web/src/pages/staff/OpsPage.tsx
f03285ff49bd9bbfb27930df687b1eea625583a5	web/src/pages/staff/StaffAccessPages.tsx
716cf1053defc641554e95c380ccaa94a8fc4a80	web/src/pages/staff/appointment-lifecycle.css
57e996c4fc5e9a13e833f80ed551484015617174	web/tests/appointment-lifecycle.test.mjs
d686e7c24de6822f67d3746a5e28c7424411f0fe	web/tests/fixtures/operational-http.mjs
a7368c204e8789613816e6ea8f1b3a2ce1771486	web/tests/fixtures/staff-lifecycle-http.mjs
31a252b56fb8a4aa04033380fad0971d13e3b93b	web/tests/staff-appointment-lifecycle.browser.test.mjs
359840ff22862a04a90d095e15698ce070a91e9e	web/tests/staff-inventory-operational.browser.test.mjs
f7fe41fe4b74fb9a3c01e27fff9bb9dc105e51c0	web/tests/staff-inventory-operator.browser.test.mjs
10b976d983ea31539b46a166b7ba08f13fee74c4	web/tests/staff-inventory-operator.test.mjs
95c5bdb31387a622a58b19e82ff10ee4c9abb9dc	web/tests/staff-ops-connected.browser.test.mjs
APPROVED
echo 'PASS: RC1 integrated provenance; exact approved import, 19 frontend blobs, 21 immutable migrations; no hosted actions'
