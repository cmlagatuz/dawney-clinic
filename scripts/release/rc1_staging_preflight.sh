#!/usr/bin/env bash
# RC1 release packet: OFFLINE ONLY, no database, network or provider commands.
# Never interpret passing this check as authorization to apply migrations.
set -Eeuo pipefail
fail(){ printf 'RC1_PREFLIGHT_BLOCKED: %s\n' "$*" >&2; exit 1; }
[[ $# == 2 && "$1" == '--staging-versions' && -f "$2" ]] ||
 fail 'usage: bash scripts/release/rc1_staging_preflight.sh --staging-versions <approved-scrubbed-versions-file>; no hosted access performed'
VERSIONS_FILE="$(realpath "$2")"
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || fail 'repository checkout required'
cd "$ROOT"
[[ -z "$(git status --porcelain -- supabase/migrations docs/RC1_MIGRATION_BLOBS.tsv)" ]] || fail 'uncommitted SQL or manifest modifications'
git merge-base --is-ancestor b6ee64b38ca4ce2965f2b02f09a4e5584aa56608 HEAD || fail 'not descended from frozen PR130'
mapfile -t expected < <(grep -E '^[0-9][0-9][[:space:]]' docs/RC1_MIGRATION_BLOBS.tsv)
[[ ${#expected[@]} == 21 ]] || fail 'expected exactly 21 pinned migrations'
mapfile -t actual_paths < <(git ls-tree -r --name-only HEAD -- supabase/migrations | grep -E '^supabase/migrations/[0-9]{14}_[^/]+\.sql$')
[[ ${#actual_paths[@]} == 21 ]] || fail 'unexpected migration count'
for ((i=0;i<21;i++)); do
  IFS=$'\t' read -r num sha path <<< "${expected[$i]}"
  [[ "$num" == "$(printf '%02d' "$((i+1))")" && "$sha" =~ ^[0-9a-f]{40}$ && "$path" == "${actual_paths[$i]}" ]] || fail "migration order or manifest row $i differs"
  [[ "$(git rev-parse "HEAD:$path")" == "$sha" && "$(git hash-object "$path")" == "$sha" && "$(git rev-parse "b6ee64b38ca4ce2965f2b02f09a4e5584aa56608:$path")" == "$sha" ]] || fail "migration source blob drift: $path"
done
mapfile -t applied < <(sed -e 's/\r$//' -e '/^[[:space:]]*$/d' "$VERSIONS_FILE")
[[ ${#applied[@]} == 11 ]] || fail 'staging must have exactly the PM-reported 11-version prefix; stop and investigate otherwise'
for ((i=0;i<11;i++)); do
  IFS=$'\t' read -r _ _ path <<< "${expected[$i]}"
  version="${path##*/}"; version="${version%%_*}"
  [[ "${applied[$i]}" == "$version" ]] || fail "staging migration history mismatch at index $((i+1)); STOP"
done
printf '%s\n' 'RC1 OFFLINE PREFLIGHT PASS: immutable 21 SQL blobs and EXACT staging 11-prefix in supplied file.'
printf '%s\n' 'NOT APPLIED / NOT AUTHORIZED. Missing migration sequence #12–#21:'
for ((i=11;i<21;i++)); do IFS=$'\t' read -r n sha path <<< "${expected[$i]}"; printf '%s %s %s\n' "$n" "$sha" "$path"; done
printf '%s\n' 'NEXT: owner-authorized signed full DB+Auth+Storage snapshot, separate verified restore, isolated staged CLI dry-run. This script never connects or applies SQL.'
