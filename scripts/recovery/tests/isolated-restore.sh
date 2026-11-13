#!/usr/bin/env bash
# Disposable synthetic PostgreSQL 17 and REAL GnuPG backup/restore rehearsal.
# GitHub Actions only; never contacts the actual Supabase project.
set -Eeuo pipefail
umask 077
[[ "\${GITHUB_ACTIONS:-}" == "true" ]] || {
  echo "Refusing to run outside the disposable GitHub Actions environment" >&2
  exit 1
}
for executable in docker gpg sha256sum mktemp stat bash; do
  command -v "$executable" >/dev/null 2>&1 || { echo "Missing $executable"; exit 1; }
done

work=$(mktemp -d "\${RUNNER_TEMP:-/tmp}/dawney-restore-drill.XXXXXXXX")
trap 'rm -rf -- "$work"' EXIT
export DAWNEY_CI_WORK="$work" TMPDIR="$work"
export GNUPGHOME="$work/gnupg"
mkdir -m 700 "$GNUPGHOME" "$work/bin" "$work/backups"

# Disposable local password: not a real Supabase credential.
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres PGDATABASE=clinic_source
export PGPASSFILE="$work/.pgpass"
printf '%s\n' '127.0.0.1:5432:*:postgres:dawney-ci-only' > "$PGPASSFILE"
chmod 600 "$PGPASSFILE"

pgclient() {
  docker run --rm --network host -v "$work:$work" \
    -e PGHOST -e PGPORT -e PGUSER -e PGDATABASE -e PGPASSFILE \
    -e PGSSLMODE=disable postgres:17 "$@"
}
pgclient psql -v ON_ERROR_STOP=1 -d clinic_source -c \
  "create schema clinic_private;
   create table public.synthetic_pets(id integer primary key, name text not null);
   create table clinic_private.synthetic_links(legacy_id integer primary key);
   insert into public.synthetic_pets values (1,'Fixture A'),(2,'Fixture B');
   insert into clinic_private.synthetic_links values (99);" >/dev/null

# Wrappers run the same client major as local PostgreSQL 17 in Docker.
# Override TLS only for disposable localhost service; real backup enforces TLS.
for tool in pg_dump pg_restore; do
  cat > "$work/bin/$tool" <<'WRAPPER'
#!/usr/bin/env bash
set -Eeuo pipefail
tool=$(basename "$0")
docker run --rm --network host -v "$DAWNEY_CI_WORK:$DAWNEY_CI_WORK" \
  -e PGHOST -e PGPORT -e PGUSER -e PGDATABASE -e PGPASSFILE \
  -e PGSSLMODE=disable postgres:17 "$tool" "$@"
WRAPPER
  chmod 700 "$work/bin/$tool"
done
export PATH="$work/bin:$PATH"

gpg --batch --pinentry-mode loopback --passphrase '' --quick-generate-key \
  'Dawney synthetic CI <restore-test@example.invalid>' rsa2048 encr 0 >/dev/null 2>&1
export DAWNEY_BACKUP_RECIPIENT_FPR
DAWNEY_BACKUP_RECIPIENT_FPR=$(gpg --list-keys --with-colons |
  awk -F: '$1=="fpr"{print $10;exit}')
[[ "$DAWNEY_BACKUP_RECIPIENT_FPR" =~ ^[A-Fa-f0-9]{40}$ ]] || {
  echo "Failed to create ephemeral GPG encryption key" >&2; exit 1;
}
export DAWNEY_BACKUP_DIR="$work/backups"

bash scripts/recovery/backup-clinic.sh >/dev/null
shopt -s nullglob
archives=("$work"/backups/*.pgdump.gpg)
[[ "\${#archives[@]}" -eq 1 ]] || {
  echo "Expected exactly one encrypted synthetic archive" >&2; exit 1;
}
archive="\${archives[0]}"
bash scripts/recovery/verify-archive.sh "$archive" >/dev/null

# Tampered ciphertext must fail checksum before decryption.
mkdir "$work/tampered"
cp "$archive" "$work/tampered/$(basename "$archive")"
cp "$archive.sha256" "$work/tampered/$(basename "$archive").sha256"
printf 'tamper' >> "$work/tampered/$(basename "$archive")"
if bash scripts/recovery/verify-archive.sh "$work/tampered/$(basename "$archive")" >/dev/null 2>&1; then
  echo "Tampered encrypted archive incorrectly verified" >&2
  exit 1
fi

gpg --batch --quiet --decrypt --output "$work/restore.pgdump" "$archive"
pgclient psql -v ON_ERROR_STOP=1 -d postgres -c 'create database clinic_restored' >/dev/null
pgclient psql -v ON_ERROR_STOP=1 -d clinic_restored -c 'drop schema public cascade' >/dev/null
pgclient pg_restore --exit-on-error --no-owner --no-acl \
  -d clinic_restored "$work/restore.pgdump" >/dev/null

source_count=$(pgclient psql -At -d clinic_source -c 'select count(*) from public.synthetic_pets')
restored_count=$(pgclient psql -At -d clinic_restored -c 'select count(*) from public.synthetic_pets')
private_count=$(pgclient psql -At -d clinic_restored -c 'select count(*) from clinic_private.synthetic_links')
[[ "$source_count" == 2 && "$restored_count" == 2 && "$private_count" == 1 ]] || {
  echo "Synthetic schema restore counts did not match" >&2; exit 1;
}
echo 'PASS: PostgreSQL 17 dump, real GnuPG encryption, SHA256 tamper rejection, isolated restore and row reconciliation.'
echo 'LIMIT: no real Supabase, Auth identities, Storage object bytes or managed settings restored.'
