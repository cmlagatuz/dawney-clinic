#!/usr/bin/env bash
# Run unchanged historical assertions in their actual frozen source context.
set -Eeuo pipefail
[[ "${GITHUB_ACTIONS:-}" == true && "${GITHUB_EVENT_NAME:-}" == pull_request && "${GITHUB_REPOSITORY:-}" == cmlagatuz/dawney-clinic ]] || exit 1
[[ $# == 1 ]] || exit 1
sha=2e029697fc2c446171a951167b30bcf7679c286e
case "$1" in
 rc2-preparation) sha=939bc5f1237d90df431d06408e8812682fd58421; script=scripts/ci/rc2_backend_source_guard.sh ;;
 rc2-preparation-negative) sha=939bc5f1237d90df431d06408e8812682fd58421; script=scripts/ci/rc2_backend_source_guard_test.sh ;;
 rc1-provenance) script=scripts/ci/rc1_integrated_source_guard_test.sh ;;
 rc1-preflight) script=scripts/release/rc1_staging_preflight_test.sh ;;
 appointment) script=scripts/ci/staff_appointment_source_guard.sh ;;
 appointment-restore) script=scripts/recovery/tests/appointment21-signed-restore.sh ;;
 full-tree) script=scripts/ci/full_tree_pg17.sh ;;
 rc0) sha=078053120774e856c9ddaa8c8027b3c891e9e8f6; script=scripts/ci/rc0_source_guard.sh ;;
 *) exit 1 ;;
esac
root=$(git rev-parse --show-toplevel)
tmp=$(mktemp -d)
trap 'git -C "$root" worktree remove --force "$tmp/tree" >/dev/null 2>&1 || true; rm -rf "$tmp"' EXIT
git worktree add --detach "$tmp/tree" "$sha"
cd "$tmp/tree"
test "$(git rev-parse HEAD)" = "$sha"
EXPECTED_HEAD_SHA="$sha" EXPECTED_PR_NUMBER=132 bash "$script"
echo "PASS: unchanged historical check $1 on $sha"
