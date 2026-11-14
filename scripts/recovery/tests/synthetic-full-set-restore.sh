#!/usr/bin/env bash
# Disposable ONLY: representative Auth + application + private Storage metadata
# and object-byte restoration. This does not test hosted Supabase APIs.
set -Eeuo pipefail
umask 077
[[ "$GITHUB_ACTIONS" == "true" ]] || { echo 'CI-only drill refused' >&2; exit 1; }
for tool in docker gpg sha256sum stat mktemp node tar cmp; do
 command -v "$tool" >/dev/null || { echo "Missing $tool" >&2; exit 1; }
done
work=$(mktemp -d "$RUNNER_TEMP/dawney-full-set.XXXXXXXX")
trap 'rm -rf -- "$work"' EXIT
export GNUPGHOME="$work/gnupg" DAWNEY_CI_RECOVERY_WORK="$work"
mkdir -m 700 "$GNUPGHOME" "$work/plain" "$work/encrypted" \
 "$work/objects-source" "$work/objects-restored" "$work/decrypted"
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres PGPASSFILE="$work/.pgpass"
printf '%s\n' '127.0.0.1:5432:*:postgres:dawney-ci-only' > "$PGPASSFILE"
chmod 600 "$PGPASSFILE"
pgclient() {
 docker run --rm -i --network host -v "$work:$work" \
  -e PGHOST -e PGPORT -e PGUSER -e PGPASSFILE -e PGSSLMODE=disable \
  postgres:17 "$@"
}
fail() { echo "Synthetic recovery failure: $1" >&2; exit 1; }

# Binary test objects, not clinic data; include NUL and non-ASCII bytes.
printf '\x00\xff\x80\x7fCI-FAKE-PET-IMAGE\x00\x01' > "$work/objects-source/photo.bin"
printf 'CI-FAKE-HEALTH-CARD\x00\xfe\x03\xef' > "$work/objects-source/card.bin"
photo_sha=$(sha256sum "$work/objects-source/photo.bin" | cut -d' ' -f1)
card_sha=$(sha256sum "$work/objects-source/card.bin" | cut -d' ' -f1)
photo_size=$(stat -c '%s' "$work/objects-source/photo.bin")
card_size=$(stat -c '%s' "$work/objects-source/card.bin")
pgclient psql -v ON_ERROR_STOP=1 -d postgres -c 'create database recovery_source' >/dev/null
pgclient psql -v ON_ERROR_STOP=1 -d recovery_source <<'SQL' >/dev/null
create schema auth;
create schema storage;
create schema clinic_private;
create table auth.users(
 id uuid primary key, email text not null unique,
 email_confirmed_at timestamptz, is_anonymous boolean not null default false);
create table auth.identities(
 id uuid primary key, user_id uuid not null references auth.users(id),
 provider text not null, provider_id text not null);
create table public.owners(
 id uuid primary key, user_id uuid not null unique references auth.users(id));
create table public.pets(
 id uuid primary key, owner_id uuid not null references public.owners(id),
 name text not null, species text not null, breed text);
create table public.appointments(
 id uuid primary key, owner_id uuid not null references public.owners(id),
 pet_id uuid not null references public.pets(id),
 status text not null check(status in ('requested','confirmed','cancelled')),
 concern text not null);
create table clinic_private.recovery_history(
 version text primary key, applied_at timestamptz not null);
create table storage.buckets(
 id text primary key, public boolean not null default false);
create table storage.objects(
 id uuid primary key, bucket_id text not null references storage.buckets(id),
 name text not null unique, metadata jsonb not null);
insert into auth.users values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','synthetic-a@example.invalid','2026-11-14T00:00:00Z',false),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','synthetic-b@example.invalid','2026-11-14T00:00:00Z',false);
insert into auth.identities values
 ('11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','email','synthetic-a@example.invalid'),
 ('22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','email','synthetic-b@example.invalid');
insert into public.owners values
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.pets values
 ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','Synthetic Chow','Dog','Chow Chow'),
 ('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222','Synthetic Cat','Cat',null);
insert into public.appointments values
 ('55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111',
 '33333333-3333-4333-8333-333333333333','requested','CI appointment remains requested');
insert into clinic_private.recovery_history values('synthetic-phase3','2026-11-14T00:00:00Z');
insert into storage.buckets values('clinical-attachments',false);
SQL
pgclient psql -v ON_ERROR_STOP=1 -d recovery_source \
 -v photo_sha="$photo_sha" -v card_sha="$card_sha" \
 -v photo_size="$photo_size" -v card_size="$card_size" <<'SQL' >/dev/null
insert into storage.objects values
 ('66666666-6666-4666-8666-666666666666','clinical-attachments',
  'pets/33333333-3333-4333-8333-333333333333/owners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/photo.bin',
  jsonb_build_object('file','photo.bin','sha256',:'photo_sha','size',:photo_size)),
 ('77777777-7777-4777-8777-777777777777','clinical-attachments',
  'pets/44444444-4444-4444-8444-444444444444/owners/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/card.bin',
  jsonb_build_object('file','card.bin','sha256',:'card_sha','size',:card_size));
SQL

# Auth and Storage bytes are separate from application pg_dump.
pgclient pg_dump --format=custom --no-owner --no-acl -d recovery_source \
 --schema=auth --file="$work/plain/auth-identities.pgdump"
pgclient pg_dump --format=custom --no-owner --no-acl -d recovery_source \
 --schema=public --schema=clinic_private --file="$work/plain/application.pgdump"
pgclient pg_dump --format=custom --no-owner --no-acl -d recovery_source \
 --schema=storage --file="$work/plain/storage-metadata.pgdump"
tar -C "$work/objects-source" -cf "$work/plain/storage-objects.tar" photo.bin card.bin
cat > "$work/plain/configuration.json" <<'JSON'
{"synthetic":true,"auth":{"providers":["email"],"redirect_allowlist":["https://example.invalid/auth/callback"]},"storage":{"bucket":"clinical-attachments","public":false}}
JSON

# Temporary local sign+encrypt key: never a provider credential.
gpg --batch --pinentry-mode loopback --passphrase '' --quick-generate-key \
 'Dawney disposable CI <synthetic-recovery@example.invalid>' rsa2048 default 0 >/dev/null 2>&1
fpr=$(gpg --list-keys --with-colons 2>/dev/null | awk -F: '$1=="fpr"{print $10;exit}')
[[ "$fpr" =~ ^[A-Fa-f0-9]{40}$ ]] || fail 'Ephemeral signing key missing'
gpg --batch --pinentry-mode loopback --passphrase '' \
 --quick-add-key "$fpr" rsa2048 encr 0 >/dev/null 2>&1
for filename in application.pgdump auth-identities.pgdump storage-metadata.pgdump \
 storage-objects.tar configuration.json; do
 gpg --batch --yes --trust-model always --encrypt --recipient "$fpr" \
 --output "$work/encrypted/$filename.gpg" "$work/plain/$filename"
done
node --input-type=module <<'JS'
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {requiredComponents} from './scripts/recovery/verify-recovery-set.mjs';
const root=process.env.DAWNEY_CI_RECOVERY_WORK;
const files=['application.pgdump.gpg','auth-identities.pgdump.gpg',
 'storage-metadata.pgdump.gpg','storage-objects.tar.gpg','configuration.json.gpg'];
const components={};
for(let i=0;i<requiredComponents.length;i++){
 const data=readFileSync(join(root,'encrypted',files[i]));
 components[requiredComponents[i]]={
  file:files[i],bytes:data.length,
  sha256:createHash('sha256').update(data).digest('hex')
 };
}
writeFileSync(join(root,'encrypted','recovery-set.json'),JSON.stringify({
 format:'dawney-recovery-set',version:1,
 created_utc:new Date().toISOString().replace(/\.\d{3}Z$/,'Z'),
 components
}),{mode:0o600});
JS
manifest="$work/encrypted/recovery-set.json"
gpg --batch --yes --detach-sign --output "$manifest.sig" "$manifest"
gpg --batch --verify "$manifest.sig" "$manifest" >/dev/null 2>&1 ||
 fail 'Manifest signature invalid'
node scripts/recovery/verify-recovery-set.mjs "$manifest" >/dev/null ||
 fail 'Encrypted component SHA-256 verification failed'

# Missing/corrupted components and changed signature MUST fail before restore.
mv "$work/encrypted/storage-objects.tar.gpg" "$work/omitted.gpg"
if node scripts/recovery/verify-recovery-set.mjs "$manifest" >/dev/null 2>&1; then
 fail 'Missing Storage payload unexpectedly accepted'
fi
mv "$work/omitted.gpg" "$work/encrypted/storage-objects.tar.gpg"
cp "$work/encrypted/auth-identities.pgdump.gpg" "$work/saved-auth.gpg"
node --input-type=module - "$work/encrypted/auth-identities.pgdump.gpg" <<'JS'
import {readFileSync,writeFileSync} from 'node:fs';
const file=process.argv[2], data=readFileSync(file);
data[Math.floor(data.length/2)]^=0x01;
writeFileSync(file,data);
JS
if node scripts/recovery/verify-recovery-set.mjs "$manifest" >/dev/null 2>&1; then
 fail 'Same-size corrupted Auth ciphertext unexpectedly accepted'
fi
mv "$work/saved-auth.gpg" "$work/encrypted/auth-identities.pgdump.gpg"
cp "$manifest" "$work/unsigned-modified-manifest.json"
printf '\n' >> "$work/unsigned-modified-manifest.json"
if gpg --batch --verify "$manifest.sig" "$work/unsigned-modified-manifest.json" >/dev/null 2>&1; then
 fail 'Changed manifest passed detached signature'
fi
[[ "$(pgclient psql -At -d postgres -c \
 "select count(*) from pg_database where datname='recovery_restored'")" == 0 ]] ||
 fail 'Restore destination exists before integrity gate'
gpg --batch --verify "$manifest.sig" "$manifest" >/dev/null 2>&1 ||
 fail 'Authenticity gate failed before restore'
node scripts/recovery/verify-recovery-set.mjs "$manifest" >/dev/null ||
 fail 'Integrity gate failed before restore'

for filename in application.pgdump auth-identities.pgdump storage-metadata.pgdump \
 storage-objects.tar configuration.json; do
 gpg --batch --quiet --decrypt --output "$work/decrypted/$filename" \
 "$work/encrypted/$filename.gpg"
done
[[ "$(tar -tf "$work/decrypted/storage-objects.tar")" == $'photo.bin\ncard.bin' ]] ||
 fail 'Unexpected Storage tar member'
pgclient psql -v ON_ERROR_STOP=1 -d postgres -c 'create database recovery_restored' >/dev/null
for component in auth-identities application storage-metadata; do
 pgclient pg_restore --exit-on-error --single-transaction --no-owner --no-acl \
  -d recovery_restored "$work/decrypted/$component.pgdump" >/dev/null
done
tar --extract --no-same-owner --no-same-permissions \
 --file "$work/decrypted/storage-objects.tar" -C "$work/objects-restored"
for name in photo card; do
 cmp -s "$work/objects-source/$name.bin" "$work/objects-restored/$name.bin" ||
 fail 'Private Storage bytes not identical'
done
[[ "$(sha256sum "$work/objects-restored/photo.bin" | cut -d' ' -f1)" == "$photo_sha" ]] ||
 fail 'Photo digest changed'
[[ "$(sha256sum "$work/objects-restored/card.bin" | cut -d' ' -f1)" == "$card_sha" ]] ||
 fail 'Card digest changed'
cmp -s "$work/plain/configuration.json" "$work/decrypted/configuration.json" ||
 fail 'Synthetic provider configuration file changed'

snapshot() {
 pgclient psql -At -d "$1" -c "
 select jsonb_build_object(
 'users',(select jsonb_agg(to_jsonb(t) order by id) from auth.users t),
 'identities',(select jsonb_agg(to_jsonb(t) order by id) from auth.identities t),
 'owners',(select jsonb_agg(to_jsonb(t) order by id) from public.owners t),
 'pets',(select jsonb_agg(to_jsonb(t) order by id) from public.pets t),
 'appointments',(select jsonb_agg(to_jsonb(t) order by id) from public.appointments t),
 'migrations',(select jsonb_agg(to_jsonb(t) order by version) from clinic_private.recovery_history t),
 'buckets',(select jsonb_agg(to_jsonb(t) order by id) from storage.buckets t),
 'objects',(select jsonb_agg(to_jsonb(t) order by id) from storage.objects t)
 )::text"
}
[[ "$(snapshot recovery_source)" == "$(snapshot recovery_restored)" ]] ||
 fail 'Identity/appointment/object metadata restore fingerprint mismatch'
[[ "$(pgclient psql -At -d recovery_restored -c \
 "select count(*) from auth.identities i join auth.users u on u.id=i.user_id
 join public.owners o on o.user_id=u.id join public.pets p on p.owner_id=o.id")" == 2 ]] ||
 fail 'Auth identity-to-owner-to-patient link changed'
[[ "$(pgclient psql -At -d recovery_restored -c \
 "select count(*) from public.appointments where status='requested'")" == 1 ]] ||
 fail 'Historical requested appointment missing'
[[ "$(pgclient psql -At -d recovery_restored -c \
 "select count(*) from storage.buckets where id='clinical-attachments' and public=false")" == 1 ]] ||
 fail 'Private Storage bucket privacy changed'
[[ "$(pgclient psql -At -d recovery_restored -c \
 "select count(*) from storage.objects")" == 2 ]] ||
 fail 'Storage metadata count changed'
echo 'PASS: real encrypted signed synthetic five-component PostgreSQL17 Auth/app/Storage recovery, 2 owners/pets/identities, 1 requested appointment and 2 byte-identical objects.'
echo 'PASS: missing objects, same-size corrupt Auth ciphertext and changed manifest fail before restoration.'
echo 'NOT VERIFIED: managed Supabase Auth logins/sessions, Storage API, live credentials/config, provider restore or real patient backups.'
