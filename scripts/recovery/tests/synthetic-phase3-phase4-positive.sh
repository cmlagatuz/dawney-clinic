#!/usr/bin/env bash
# Positive versioned synthetic Phase3-equivalent recovery -> reviewed Phase4.
# CI-only, localhost PostgreSQL 17. No live Supabase/Auth/Storage or patient data.
set -Eeuo pipefail
umask 077
[[ "${GITHUB_ACTIONS:-}" == true && "${PGHOST:-}" == '127.0.0.1' &&
   "${PGPORT:-}" == 5432 && $# == 1 && -d "$1" ]] ||
 { echo 'Refusing non-CI/non-local restoration or missing pinned SQL' >&2; exit 1; }
for tool in docker git gpg tar sha256sum stat node cmp mktemp; do
 command -v "$tool" >/dev/null || { echo "Missing tool: $tool" >&2; exit 1; }
done
reviewed=$1
work=$(mktemp -d "$RUNNER_TEMP/phase3-full-restore.XXXXXXXX")
export GNUPGHOME="$work/gnupg" DAWNEY_CI_RECOVERY_WORK="$work"
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres PGPASSFILE="$work/.pgpass"
mkdir -m 700 "$GNUPGHOME" "$work/plain" "$work/encrypted" "$work/decrypted" \
 "$work/object-source" "$work/object-restored"
printf '%s\n' '127.0.0.1:5432:*:postgres:dawney-phase3-ci-only' >"$PGPASSFILE"
chmod 600 "$PGPASSFILE"
pgclient() {
 docker run --rm -i --network host -v "$work:$work" \
  -e PGHOST -e PGPORT -e PGUSER -e PGPASSFILE -e PGSSLMODE=disable \
  postgres:17 "$@"
}
fail(){ echo "POSITIVE RECOVERY FAILURE: $*" >&2; exit 1; }
cleanup(){
 pgclient psql -X -v ON_ERROR_STOP=1 -d postgres \
  -c 'drop database if exists phase3_restored_ci with (force)' >/dev/null 2>&1 || true
 rm -rf -- "$work"
}
trap cleanup EXIT
# Exact source blobs checked before any DB operations.
while read -r file blob; do
 [[ -s "$file" && "$(git hash-object "$file")" == "$blob" ]] ||
  fail "Unreviewed/missing Phase2/3 source: $file"
done <<'PHASE3'
supabase/migrations/20261113070302_phase2_core_data_security.sql cf329269e3f38a5ac320d0b60fe82b6165e218d6
supabase/migrations/20261113070834_phase2_index_and_policy_tuning.sql d7f8922de9251bb777430ce4163d2ca501b290f5
supabase/migrations/20261113074938_phase2_verified_auth_and_staff_bootstrap.sql 218b612c15944c811708f4908825d0a969064692
supabase/migrations/20261113095318_phase3_appointment_lifecycle.sql f12c39c4b75462aa9597d38065c70216e872c478
supabase/migrations/20261113100958_phase3_clinical_storage_policies.sql b47363bfdc3af3081a2af2f422be44a40c967e54
supabase/migrations/20261113101626_phase3_staff_membership_audit.sql 0fc85dd437eac7d8d89fe69025df917ab79d3e0e
PHASE3
while read -r file blob; do
 [[ -s "$reviewed/$file" && "$(git hash-object "$reviewed/$file")" == "$blob" ]] ||
  fail "Unreviewed/missing Phase4 source: $file"
done <<'PHASE4'
20261113211600_phase4_taxonomy_attachments.sql 4296a5dcf84324cd83eea226e6054b0cd4f56658
20261113211700_phase4_animal_catalog_seed.sql cc03606d3d47b0d573f431a1a1161ba243a314d3
20261114072200_phase4_taxonomy_trigger_chow_chow_guard.sql 028cbdcfb96e15d297a9458322e1108c46a8b035
20261114090000_phase4_public_booking_contract.sql 929f327141d9e5bb2be220d5685c6ce3f28c253c
PHASE4
[[ -s "$reviewed/20261116002500_phase3_storage_outer_object_path_rls_fix.sql" &&
   "$(git hash-object "$reviewed/20261116002500_phase3_storage_outer_object_path_rls_fix.sql")" == "4d78cb2aef1104379d6fd29797705a6188c4c6dc" ]] ||
 fail 'Unreviewed/missing PR62 additive Phase3 Storage correction'
echo 'PASS: six original Phase2/3, exact PR62 additive Storage policy and four reviewed Phase4 SQL blobs verified.'

pgclient psql -X -v ON_ERROR_STOP=1 -d phase3_source_ci \
 < scripts/recovery/tests/phase3-provider-bootstrap.sql >/dev/null
for migration in \
 20261113070302_phase2_core_data_security.sql \
 20261113070834_phase2_index_and_policy_tuning.sql \
 20261113074938_phase2_verified_auth_and_staff_bootstrap.sql \
 20261113095318_phase3_appointment_lifecycle.sql \
 20261113100958_phase3_clinical_storage_policies.sql \
 20261113101626_phase3_staff_membership_audit.sql; do
 pgclient psql -X -v ON_ERROR_STOP=1 -d phase3_source_ci \
 < "supabase/migrations/$migration" >/dev/null
done
echo 'PASS: actual six Phase2/3 migrations applied, no invented clinical schema.'

printf '\x89\x50\x4e\x47\x00\xfe\x80\x01SYNTHETIC-PHOTO' >"$work/object-source/photo.bin"
printf '\x25\x50\x44\x46\x00\xff\x03SYNTHETIC-CARD' >"$work/object-source/card.bin"
photo_sha=$(sha256sum "$work/object-source/photo.bin" | cut -d' ' -f1)
card_sha=$(sha256sum "$work/object-source/card.bin" | cut -d' ' -f1)
photo_size=$(stat -c %s "$work/object-source/photo.bin")
card_size=$(stat -c %s "$work/object-source/card.bin")
pgclient psql -X -v ON_ERROR_STOP=1 -d phase3_source_ci \
 -v photo_sha="$photo_sha" -v card_sha="$card_sha" \
 -v photo_size="$photo_size" -v card_size="$card_size" \
 < scripts/recovery/tests/phase3-synthetic-records.sql >/dev/null
snapshot(){
 pgclient psql -X -v ON_ERROR_STOP=1 -At -d "$1" \
 < scripts/recovery/tests/phase3-preserved-snapshot.sql |
 sha256sum | cut -d' ' -f1
}
original=$(snapshot phase3_source_ci)
[[ "$original" =~ ^[0-9a-f]{64}$ ]] || fail 'Initial dataset hash missing'
[[ "$(pgclient psql -X -v ON_ERROR_STOP=1 -At -d phase3_source_ci \
 -c 'select count(*) from public.appointment_events')" == 1 ]] ||
 fail 'Phase3 real appointment event trigger did not execute'

# Application archive includes all full DDL, policies, grants and clinical data.
# Auth/Storage table ROWS are *excluded* and separately backed up/restored.
pgclient pg_dump --format=custom --no-owner -d phase3_source_ci \
 --exclude-table-data=auth.users --exclude-table-data=auth.identities \
 --exclude-table-data=storage.buckets --exclude-table-data=storage.objects \
 --file="$work/plain/application.pgdump"
pgclient pg_dump --format=custom --data-only --no-owner -d phase3_source_ci \
 --table=auth.users --table=auth.identities \
 --file="$work/plain/auth-identities.pgdump"
pgclient pg_dump --format=custom --data-only --no-owner -d phase3_source_ci \
 --table=storage.buckets --table=storage.objects \
 --file="$work/plain/storage-metadata.pgdump"
tar -C "$work/object-source" -cf "$work/plain/storage-objects.tar" photo.bin card.bin
cat >"$work/plain/configuration.json" <<'JSON'
{"synthetic":true,"fixture_schema_version":"phase3-real-six-migrations-v1","auth":{"providers":["email"],"redirect_allowlist":["https://example.invalid/auth/callback"]},"storage":{"bucket":"clinical-attachments","public":false},"hosted_supabase_verified":false}
JSON

gpg --batch --pinentry-mode loopback --passphrase '' --quick-generate-key \
 'Dawney synthetic Phase3 <ci-only@example.invalid>' rsa2048 default 0 >/dev/null 2>&1
fpr=$(gpg --list-keys --with-colons 2>/dev/null | awk -F: '$1=="fpr"{print $10;exit}')
[[ "$fpr" =~ ^[A-Fa-f0-9]{40}$ ]] || fail 'Ephemeral signing key missing'
gpg --batch --pinentry-mode loopback --passphrase '' \
 --quick-add-key "$fpr" rsa2048 encr 0 >/dev/null 2>&1
for part in application.pgdump auth-identities.pgdump storage-metadata.pgdump \
 storage-objects.tar configuration.json; do
 gpg --batch --yes --trust-model always --encrypt --recipient "$fpr" \
  --output "$work/encrypted/$part.gpg" "$work/plain/$part"
done
node --input-type=module <<'JS'
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {requiredComponents} from './scripts/recovery/verify-recovery-set.mjs';
const work=process.env.DAWNEY_CI_RECOVERY_WORK;
const names=['application.pgdump.gpg','auth-identities.pgdump.gpg',
 'storage-metadata.pgdump.gpg','storage-objects.tar.gpg','configuration.json.gpg'];
const components={};
for(let i=0;i<requiredComponents.length;i++){
 const buffer=readFileSync(join(work,'encrypted',names[i]));
 components[requiredComponents[i]]={file:names[i],bytes:buffer.length,
  sha256:createHash('sha256').update(buffer).digest('hex')};
}
writeFileSync(join(work,'encrypted','recovery-set.json'),JSON.stringify({
 format:'dawney-recovery-set',version:1,
 created_utc:new Date().toISOString().replace(/\.\d{3}Z$/,'Z'),components
}),{mode:0o600});
JS
manifest="$work/encrypted/recovery-set.json"
gpg --batch --detach-sign --output "$manifest.sig" "$manifest"
verify(){
 gpg --batch --verify "$manifest.sig" "$manifest" >/dev/null 2>&1 &&
 node scripts/recovery/verify-recovery-set.mjs "$manifest" >/dev/null 2>&1
}
verify || fail 'Initial five-component signature or ciphertext mismatch'
mv "$work/encrypted/storage-objects.tar.gpg" "$work/omitted.gpg"
if verify;then fail 'Missing Storage archive unexpectedly verified';fi
mv "$work/omitted.gpg" "$work/encrypted/storage-objects.tar.gpg"
cp "$work/encrypted/auth-identities.pgdump.gpg" "$work/auth-original.gpg"
node --input-type=module - "$work/encrypted/auth-identities.pgdump.gpg" <<'JS'
import {readFileSync,writeFileSync} from 'node:fs';
const path=process.argv[2],data=readFileSync(path);
data[Math.floor(data.length/2)]^=1;writeFileSync(path,data);
JS
if verify;then fail 'Corrupted Auth ciphertext unexpectedly verified';fi
mv "$work/auth-original.gpg" "$work/encrypted/auth-identities.pgdump.gpg"
cp "$manifest" "$work/saved-manifest.json"
printf '\n' >> "$manifest"
if verify;then fail 'Unsigned manifest alteration unexpectedly verified';fi
mv "$work/saved-manifest.json" "$manifest"
verify || fail 'Original signature/hash no longer validates'
[[ "$(pgclient psql -X -At -d postgres -c \
 "select count(*) from pg_database where datname='phase3_restored_ci'")" == 0 ]] ||
 fail 'Restore target exists before integrity gate'
echo 'PASS NEGATIVE: missing Storage bytes, altered Auth ciphertext and changed signed manifest fail before restore.'

for part in application.pgdump auth-identities.pgdump storage-metadata.pgdump \
 storage-objects.tar configuration.json; do
 gpg --batch --quiet --decrypt --output "$work/decrypted/$part" \
  "$work/encrypted/$part.gpg"
done
cmp -s "$work/plain/configuration.json" "$work/decrypted/configuration.json" ||
 fail 'Provider config file not identical'
[[ "$(tar -tf "$work/decrypted/storage-objects.tar")" == $'photo.bin\ncard.bin' ]] ||
 fail 'Unexpected object archive members'

# Global role identities are retained by the same disposable PostgreSQL service.
# Restore each component in FK-safe order, including post-data RLS/ACL/triggers.
pgclient psql -X -v ON_ERROR_STOP=1 -d postgres \
 -c 'create database phase3_restored_ci' >/dev/null
pgclient pg_restore --exit-on-error --single-transaction --no-owner \
 --section=pre-data -d phase3_restored_ci \
 "$work/decrypted/application.pgdump" >/dev/null
pgclient pg_restore --exit-on-error --single-transaction --no-owner \
 -d phase3_restored_ci "$work/decrypted/auth-identities.pgdump" >/dev/null
pgclient pg_restore --exit-on-error --single-transaction --no-owner \
 -d phase3_restored_ci "$work/decrypted/storage-metadata.pgdump" >/dev/null
pgclient pg_restore --exit-on-error --single-transaction --no-owner \
 --section=data -d phase3_restored_ci \
 "$work/decrypted/application.pgdump" >/dev/null
pgclient pg_restore --exit-on-error --single-transaction --no-owner \
 --section=post-data -d phase3_restored_ci \
 "$work/decrypted/application.pgdump" >/dev/null
[[ "$(snapshot phase3_restored_ci)" == "$original" ]] ||
 fail 'Restored baseline no longer matches original Auth, patients or appointments'
[[ "$(pgclient psql -X -At -v ON_ERROR_STOP=1 -d phase3_restored_ci \
 -c 'select count(*) from auth.identities i join auth.users u on u.id=i.user_id')" == 5 ]] ||
 fail 'Auth identities lost through five-component restoration'
[[ "$(pgclient psql -X -At -v ON_ERROR_STOP=1 -d phase3_restored_ci \
 -c "select count(*) from pg_policies where schemaname='public'
 and tablename in ('owners','pets','appointments','staff_memberships')")" -ge 4 ]] ||
 fail 'Phase3 policy catalog not restored'
echo 'PASS POSITIVE: five-component signed encrypted restore has identical real Phase3-shaped baseline, FK identities and RLS policies.'

tar -C "$work/object-restored" --extract --no-same-owner --no-same-permissions \
 --file="$work/decrypted/storage-objects.tar"
for file in photo card; do
 cmp -s "$work/object-source/$file.bin" "$work/object-restored/$file.bin" ||
 fail "Object $file bytes changed"
done
[[ "$(sha256sum "$work/object-restored/photo.bin" | cut -d' ' -f1)" == "$photo_sha" ]] ||
 fail 'Photo SHA256 mismatch'
[[ "$(sha256sum "$work/object-restored/card.bin" | cut -d' ' -f1)" == "$card_sha" ]] ||
 fail 'Card SHA256 mismatch'
for sha in "$photo_sha" "$card_sha"; do
 [[ "$(pgclient psql -X -At -v ON_ERROR_STOP=1 -d phase3_restored_ci \
 -c "select count(*) from storage.objects where metadata->>'sha256'='$sha'")" == 1 ]] ||
 fail 'Private Storage metadata digest does not match physical object'
done
echo 'PASS: both private Storage binary objects exactly match physical bytes and their persisted checksums.'

# Actual 11-source order: six Phase2/3, four Phase4, then Storage fix.
# The signed recovery/source assertions below remain unchanged.
# Exact reviewed four migration order: taxonomy, seed, PR40 guard, PR43 RPC.
for migration in \
 20261113211600_phase4_taxonomy_attachments.sql \
 20261113211700_phase4_animal_catalog_seed.sql \
 20261114072200_phase4_taxonomy_trigger_chow_chow_guard.sql \
 20261114090000_phase4_public_booking_contract.sql; do
 pgclient psql -X -v ON_ERROR_STOP=1 -d phase3_restored_ci \
  < "$reviewed/$migration" >/dev/null
done
[[ "$(snapshot phase3_restored_ci)" == "$original" ]] ||
 fail 'Four Phase4 migrations modified historical Auth/patient/appointment/Storage fields'
# Correct restored Storage policy after FOUR original Phase4 migrations (#11).
pgclient psql -X -v ON_ERROR_STOP=1 -d phase3_restored_ci \
 < "$reviewed/20261116002500_phase3_storage_outer_object_path_rls_fix.sql" >/dev/null
[[ "$(snapshot phase3_restored_ci)" == "$original" ]] ||
 fail 'Additive Storage correction changed preserved Auth/patients/appointments/metadata'
echo 'PASS: ordered original six + four + Storage correction; signed recovery fingerprint preserved.'
pgclient psql -X -v ON_ERROR_STOP=1 -d phase3_restored_ci \
 < scripts/recovery/tests/phase3-phase4-positive-assertions.sql
[[ "$(snapshot phase3_restored_ci)" == "$original" ]] ||
 fail 'Authorization tests altered preserved records'
echo 'PASS POSITIVE: five signed/encrypted components, fixed Storage RLS, four exact Phase4 migrations, owner/staff allow and denial matrix, historical fingerprint unchanged.'
echo 'NOT VERIFIED: hosted Supabase Auth/JWT/sessions, Storage API, managed provider restore, production rollback or real patient backups.'

# PR96-only extension starts AFTER the original complete signed five-component
# PR49 restoration, ciphertext negatives, byte comparison and Storage RLS matrix.
# Never weaken or replace the original positive/negative checks.
while read -r migration blob; do
 [[ "$(git rev-parse "HEAD:supabase/migrations/$migration")" == "$blob" &&
    "$(git hash-object "supabase/migrations/$migration")" == "$blob" ]] ||
 fail "RECOVERY15 drift: $migration"
done <<'RECOVERY_FOUR_ADDITIVE_BLOBS'
20261117233500_issue77_four_branch_foundation.sql 4732b815cff45850d2f01cdeb93c527dac0e22a0
20261118203500_issue51_branch_booking_security.sql f58ca0e0bcb36d3a320060db7bf9bbeffe7f35f3
20261118215500_issue58_staff_branch_read_contract.sql c889477348d9505d54f54b1d08532c2f648992a9
20261118225000_issue78_inventory_read_only_foundation.sql 908f881bfc541ab4265912e0a9e55525ea8275a5
RECOVERY_FOUR_ADDITIVE_BLOBS
[[ "$(git hash-object scripts/recovery/tests/phase3-to-15-history-snapshot.sql)" == b13a10eb386e2743904c379a4d89aef33afe24c8 &&
   "$(git hash-object scripts/recovery/tests/phase3-to-15-assertions.sql)" == f51aed74ab5bac5a984708388117fa468d9bdbe1 ]] ||
 fail 'RECOVERY15 new history/assertion source drift'
history_snapshot(){
 pgclient psql -X -v ON_ERROR_STOP=1 -At -d phase3_restored_ci \
 < scripts/recovery/tests/phase3-to-15-history-snapshot.sql |
 sha256sum | cut -d' ' -f1
}
pre12=$(history_snapshot)
[[ "$pre12" =~ ^[0-9a-f]{64}$ ]] || fail 'RECOVERY15 historical pre-12 fingerprint invalid'
for migration in \
 20261117233500_issue77_four_branch_foundation.sql \
 20261118203500_issue51_branch_booking_security.sql \
 20261118215500_issue58_staff_branch_read_contract.sql \
 20261118225000_issue78_inventory_read_only_foundation.sql; do
 pgclient psql -X -v ON_ERROR_STOP=1 -d phase3_restored_ci \
 < "supabase/migrations/$migration" >/dev/null
done
[[ "$(history_snapshot)" == "$pre12" ]] ||
 fail 'RECOVERY15 migrations #12-15 altered preserved Auth/owners/Chow Chow/appointments or Storage metadata'
echo 'PASS: RECOVERY15 signed restored PG17 database applied exact 11+12-15, preserving historical snapshot'
pgclient psql -X -v ON_ERROR_STOP=1 -d phase3_restored_ci \
 < scripts/recovery/tests/phase3-to-15-assertions.sql
[[ "$(history_snapshot)" == "$pre12" ]] ||
 fail 'RECOVERY15 RLS/expiry rollback changed historical fingerprint'
echo 'PASS: RECOVERY15 signed restore, PostgreSQL Auth/Storage/historical integrity + branch-local inventory negative and positive matrix'
echo 'NOT VERIFIED: real Supabase hosted Auth/JWT, Storage API, physical provider restore or clinical inventory.'
