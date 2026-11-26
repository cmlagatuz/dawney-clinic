#!/usr/bin/env bash
set -Eeuo pipefail
root=$(git rev-parse --show-toplevel)
tmp=$(mktemp -d)
trap 'git -C "$root" worktree remove --force "$tmp/tree" >/dev/null 2>&1 || true; rm -rf "$tmp"' EXIT
git worktree add --detach "$tmp/tree" HEAD
cd "$tmp/tree"
deny(){ if EXPECTED_HEAD_SHA="$(git rev-parse HEAD)" bash scripts/ci/rc2_backend_source_guard.sh >"$tmp/log" 2>&1; then echo "FAIL: $1 accepted"; exit 1; fi; grep -q 'RC2_BACKEND_BLOCKED:' "$tmp/log"; echo "PASS: $1 rejected"; }
base=$(git rev-parse HEAD)
commit(){ git add -A; git -c user.name=CI -c user.email=ci@example.invalid commit -m 'synthetic provenance fixture' >/dev/null; }
echo synthetic > rc2-unapproved-test.txt; commit; deny extra-path; git reset --hard "$base" >/dev/null
printf '\n-- synthetic drift\n' >> supabase/migrations/20261126020000_clinical_live_session_alignment.sql; commit; deny migration-drift; git reset --hard "$base" >/dev/null
printf '\n# synthetic drift\n' >> scripts/recovery/manual-supabase-recovery.py; commit; deny import-drift; git reset --hard "$base" >/dev/null
git update-index --chmod=+x scripts/ci/rc2_backend_source_guard.sh; git -c user.name=CI -c user.email=ci@example.invalid commit -m 'synthetic mode drift' >/dev/null; deny mode-drift; git reset --hard "$base" >/dev/null
sed -i '2s/[0-9a-f]\{40\}/0000000000000000000000000000000000000000/' docs/RC2_BACKEND_BLOBS.tsv; commit; deny manifest-drift

git reset --hard "$base" >/dev/null
printf '\n// synthetic drift\n' >> web/src/lib/clinical-chart.ts; commit; deny frontend-drift; git reset --hard "$base" >/dev/null
printf '\nsynthetic drift\n' >> readme.md; commit; deny readme-drift
