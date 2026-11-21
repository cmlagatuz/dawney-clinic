#!/usr/bin/env bash
# Non-destructive inspection. Does not restore data or connect to the live clinic database.
set -Eeuo pipefail
umask 077
fail() { printf 'Archive check failed: %s\n' "$1" >&2; exit 1; }
[[ $# -eq 1 ]] || fail 'Usage: verify-archive.sh /secure/path/application.pgdump.gpg'
archive="$1"
[[ -s "$archive" && -s "$archive.sha256" ]] || fail 'Encrypted archive or checksum not found'
for tool in pg_restore gpg sha256sum mktemp; do
  command -v "$tool" >/dev/null 2>&1 || fail "Missing prerequisite: $tool"
done
(
  cd "$(dirname "$archive")"
  sha256sum --status -c "$(basename "$archive").sha256"
) || fail 'Encrypted archive checksum mismatch'
workdir=$(mktemp -d "${TMPDIR:-/tmp}/dawney-check.XXXXXXXX")
trap 'rm -rf -- "$workdir"' EXIT
# Decryption requires an authorized owner key; never accept a password argument or log it.
gpg --quiet --decrypt --output "$workdir/clinic.pgdump" "$archive" || fail 'Decryption failed'
pg_restore --list "$workdir/clinic.pgdump" > "$workdir/contents.txt" || fail 'Invalid PostgreSQL archive'
[[ -s "$workdir/contents.txt" ]] || fail 'PostgreSQL archive manifest empty'
printf 'Encrypted checksum and PostgreSQL archive structure verified.\n'
printf 'This is NOT a full restore test; test isolated recovery before clinical use.\n'