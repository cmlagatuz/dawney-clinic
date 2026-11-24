#!/usr/bin/env bash
set -Eeuo pipefail
bash scripts/ci/rc1_integrated_source_guard.sh
tmp=$(mktemp -d)
root=$(git rev-parse --show-toplevel)
trap 'git -C "$root" worktree remove --force "$tmp/tree" >/dev/null 2>&1 || true; rm -rf "$tmp"' EXIT
git worktree add --detach "$tmp/tree" HEAD
cd "$tmp/tree"
deny(){ if EXPECTED_HEAD_SHA="$(git rev-parse HEAD)" bash scripts/ci/rc1_integrated_source_guard.sh > "$tmp/log" 2>&1; then echo 'FAIL: unexpected source accepted'; exit 1; fi; grep -q 'RC1_INTEGRATED_BLOCKED: unexpected delta' "$tmp/log"; }
echo synthetic > rc1-unapproved-test.txt
git add rc1-unapproved-test.txt
git -c user.name=CI -c user.email=ci@example.invalid commit -m 'synthetic unexpected path' >/dev/null
deny
git reset --hard HEAD^ >/dev/null
printf '\nsynthetic drift\n' >> web/src/appointments/lifecycle.mjs
git add web/src/appointments/lifecycle.mjs
git -c user.name=CI -c user.email=ci@example.invalid commit -m 'synthetic changed blob' >/dev/null
deny
echo 'PASS: unauthorized addition and source modification rejected'
