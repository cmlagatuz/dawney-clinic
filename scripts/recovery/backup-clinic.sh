#!/usr/bin/env bash
# Dawney Clinic: authenticated, encrypted export of application schemas only.
# Never run in public CI; use owner-controlled, encrypted local storage.
set -Eeuo pipefail
umask 077

fail() { printf 'Backup stopped: %s\n' "$1" >&2; exit 1; }
for tool in pg_dump pg_restore gpg sha256sum stat mktemp; do
  command -v "$tool" >/dev/null 2>&1 || fail "Missing prerequisite: $tool"
done
for var in PGHOST PGUSER PGDATABASE PGPASSFILE DAWNEY_BACKUP_RECIPIENT_FPR; do
  [[ -n "${!var:-}" ]] || fail "Set $var privately before running"
done
[[ -f "$PGPASSFILE" ]] || fail 'PGPASSFILE does not exist'
# POSIX permission check. On Windows/WSL copy the password file to a private Linux volume first.
perms=$(stat -c '%a' "$PGPASSFILE")
[[ "$perms" == '600' || "$perms" == '400' ]] || fail 'PGPASSFILE must be mode 600 or 400'
[[ "${DAWNEY_BACKUP_RECIPIENT_FPR}" =~ ^[A-Fa-f0-9]{40}$ ]] || fail 'Use full 40-character GPG public key fingerprint'
export PGSSLMODE=require
OUTPUT_DIR="${DAWNEY_BACKUP_DIR:-$HOME/dawney-private-backups}"
mkdir -p "$OUTPUT_DIR"
chmod 700 "$OUTPUT_DIR"
workdir=$(mktemp -d "${TMPDIR:-/tmp}/dawney-backup.XXXXXXXX")
target=""
complete=0
cleanup() {
  rm -rf -- "$workdir"
  if [[ "$complete" != 1 && -n "$target" ]]; then rm -f -- "$target" "$target.sha256"; fi
}
trap cleanup EXIT

archive="$workdir/application.pgdump"
pg_dump --format=custom --no-owner --no-acl --schema=public --schema=clinic_private --file="$archive"
pg_restore --list "$archive" > "$workdir/archive.list"
[[ -s "$workdir/archive.list" ]] || fail 'Archive manifest is empty'

name="dawney_$(date -u +%Y%m%dT%H%M%SZ)_$$_application.pgdump.gpg"
target="$OUTPUT_DIR/$name"
gpg --batch --yes --encrypt --recipient "$DAWNEY_BACKUP_RECIPIENT_FPR" --output "$target" "$archive"
[[ -s "$target" ]] || fail 'Encrypted archive missing'
(
  cd "$OUTPUT_DIR"
  sha256sum "$name" > "$name.sha256"
)
complete=1
printf 'Encrypted application-schemas export saved: %s\n' "$target"
printf 'Checksum file: %s.sha256\n' "$target"
printf 'WARNING: Auth users, project settings and Storage object bytes are NOT included.\n'