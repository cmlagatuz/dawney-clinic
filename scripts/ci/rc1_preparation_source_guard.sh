#!/usr/bin/env bash
# RC1 preparation-only exact-source gate. NOT the final combined RC1 acceptance.
set -Eeuo pipefail
die(){ echo "RC1_PREPARATION_BLOCKED: $*" >&2; exit 1; }
FROZEN=b6ee64b38ca4ce2965f2b02f09a4e5584aa56608
RC0=078053120774e856c9ddaa8c8027b3c891e9e8f6
CLOUD=00e7f072e58a684970f00ea15d2b9b614ce8aebe
[[ "${GITHUB_ACTIONS:-}" == true && "${GITHUB_EVENT_NAME:-}" == pull_request &&
   "${GITHUB_REPOSITORY:-}" == cmlagatuz/dawney-clinic &&
   "${EXPECTED_HEAD_SHA:-}" =~ ^[0-9a-f]{40}$ &&
   "$(git rev-parse HEAD)" == "$EXPECTED_HEAD_SHA" ]] || die 'requires official PR exact-head context'
git cat-file -e "$FROZEN^{commit}" && git cat-file -e "$RC0^{commit}" || die 'frozen sources missing'
git merge-base --is-ancestor "$FROZEN" HEAD || die 'incorrect parent lineage'
git fetch --no-tags origin 'refs/pull/130/head:refs/remotes/origin/rc1-frozen-backend130' 'refs/pull/129/head:refs/remotes/origin/rc1-frozen-rc0129' 'refs/pull/131/head:refs/remotes/origin/rc1-pending-cloud131'
[[ "$(git rev-parse refs/remotes/origin/rc1-frozen-backend130)" == "$FROZEN" &&
   "$(git rev-parse refs/remotes/origin/rc1-frozen-rc0129)" == "$RC0" &&
   "$(git rev-parse refs/remotes/origin/rc1-pending-cloud131)" == "$CLOUD" ]] || die 'upstream frozen source drift'
diff -u <(cat <<'RC1_PREPARED_FILES'
.github/workflows/rc1-preparation.yml
docs/AI_HANDOFF.md
docs/RC1_CUMULATIVE_CLOUD_BLOBS.tsv
docs/RC1_INTEGRATION_HANDOFF.md
docs/RC1_MIGRATION_BLOBS.tsv
docs/RC1_PENDING_CLOUD_BLOBS.tsv
docs/RC1_STAGING_ACCEPTANCE_ROLLBACK.md
readme.md
scripts/ci/rc1_preparation_source_guard.sh
scripts/release/rc1_staging_preflight.sh
scripts/release/rc1_staging_preflight_test.sh
RC1_PREPARED_FILES
) <(git diff --name-only "$FROZEN" HEAD) || die 'unexpected modified path (including SQL/UI/CI history)'
diff -u <(git ls-tree -r --name-only "$FROZEN" -- supabase/migrations) <(git ls-tree -r --name-only HEAD -- supabase/migrations) || die 'migration filename/order drift'
mapfile -t SQL < <(grep -E '^[0-9]{2}[[:space:]]' docs/RC1_MIGRATION_BLOBS.tsv)
[[ ${#SQL[@]} == 21 ]] || die 'expected 21 pinned SQL files'
for ((i=0;i<21;i++)); do
  IFS=$'\t' read -r order blob path <<< "${SQL[$i]}"
  [[ "$order" == "$(printf '%02d' "$((i+1))")" && "$path" == supabase/migrations/*.sql && "$blob" =~ ^[0-9a-f]{40}$ ]] || die 'invalid SQL manifest row'
  [[ "$(git rev-parse "HEAD:$path")" == "$blob" && "$(git hash-object "$path")" == "$blob" && "$(git rev-parse "$FROZEN:$path")" == "$blob" ]] || die "SQL blob drift: $path"
done
[[ "$(git rev-parse 'HEAD:supabase/migrations/20261123210000_staff_appointment_lifecycle.sql')" == 969db983facf7082e243d9ebae6e3fe7cdf65a39 ]] || die '#21 accepted blob changed'
mapfile -t FRONT < <(grep -E '^[0-9a-f]{40}[[:space:]]' docs/RC1_PENDING_CLOUD_BLOBS.tsv)
[[ ${#FRONT[@]} == 12 ]] || die 'not exactly 12 provisional frontend paths'
for line in "${FRONT[@]}"; do
  IFS=$'\t' read -r blob path <<< "$line"
  [[ "$blob" =~ ^[0-9a-f]{40}$ && "$path" != *'..'* && "$(git rev-parse "$CLOUD:$path")" == "$blob" ]] || die "PR131 source manifest mismatch: $path"
done
[[ ! -e web/src/appointments/port.ts && ! -e web/src/pages/staff/AppointmentLifecyclePanel.tsx ]] || die 'frontend imported before PM/SOL hardening acceptance'
bash -n scripts/release/rc1_staging_preflight.sh || die 'offline acceptance packet shell syntax invalid'
echo 'PASS: exact official PREPARATION head; frozen PR129/130/131, 21 immutable migrations, 12 pending unimported frontend source pins, eleven explicit preparation paths; no hosted staging executed.'
