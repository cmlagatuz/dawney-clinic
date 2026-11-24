#!/usr/bin/env bash
set -Eeuo pipefail
root=$(git rev-parse --show-toplevel)
tmp=$(mktemp -d)
trap 'git -C "$root" worktree remove --force "$tmp/tree" >/dev/null 2>&1 || true; rm -rf "$tmp"' EXIT
git worktree add --detach "$tmp/tree" HEAD
cd "$tmp/tree"
awk -F '\t' '/^[0-9][0-9]\t/{v=$3; sub(/^.*\//,"",v); sub(/_.*/,"",v); print v}' docs/RC1_MIGRATION_BLOBS.tsv > "$tmp/all"
head -n 11 "$tmp/all" > "$tmp/valid"
run(){ bash scripts/release/rc1_staging_preflight.sh --staging-versions "$1"; }
deny(){ if run "$1" > "$tmp/log" 2>&1; then echo "FAIL: $2 accepted"; exit 1; fi; grep -q RC1_PREFLIGHT_BLOCKED "$tmp/log"; echo "PASS: $2 rejected"; }
run "$tmp/valid" > "$tmp/positive"
test "$(grep -Ec '^(1[2-9]|2[01]) [0-9a-f]{40} supabase/migrations/' "$tmp/positive")" = 10
echo 'PASS: exact 11-version prefix, ten missing versions'
head -n 10 "$tmp/all" > "$tmp/short"; deny "$tmp/short" short
head -n 12 "$tmp/all" > "$tmp/extra"; deny "$tmp/extra" extra
{ sed -n '2p' "$tmp/valid"; sed -n '1p' "$tmp/valid"; tail -n +3 "$tmp/valid"; } > "$tmp/order"; deny "$tmp/order" reordered
{ head -n 10 "$tmp/valid"; head -n 1 "$tmp/valid"; } > "$tmp/duplicate"; deny "$tmp/duplicate" duplicate
{ head -n 10 "$tmp/valid"; echo 99999999999999; } > "$tmp/unknown"; deny "$tmp/unknown" unknown
file=$(awk -F '\t' '/^21\t/{print $3}' docs/RC1_MIGRATION_BLOBS.tsv)
old=$(git rev-parse "HEAD:$file")
printf '\n-- synthetic drift only\n' >> "$file"
deny "$tmp/valid" dirty-source
new=$(git hash-object "$file")
sed -i "s/$old/$new/" docs/RC1_MIGRATION_BLOBS.tsv
git -c user.name=CI -c user.email=ci@example.invalid add "$file" docs/RC1_MIGRATION_BLOBS.tsv
git -c user.name=CI -c user.email=ci@example.invalid commit -m 'synthetic local drift test' >/dev/null
deny "$tmp/valid" committed-source-and-manifest-drift
echo 'PASS: offline synthetic preflight rehearsal; no hosted operations'
