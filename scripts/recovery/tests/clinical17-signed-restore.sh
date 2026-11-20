#!/usr/bin/env bash
# UNAPPLIED #16/#17 synthetic PG17 signed+encrypted recovery. No provider calls.
set -euo pipefail
[[ "$PGDATABASE" == clinical16_ci ]] || { echo 'FAIL: disposable DB required'; exit 1; }
container="$(docker ps --filter ancestor=postgres:17 --format '{{.ID}}' | head -n 1)"
[[ -n "$container" ]] || { echo 'FAIL: disposable PostgreSQL17 service unavailable';exit 1; }
tmp="$(mktemp -d)"
chmod 700 "$tmp"
trap 'rm -rf "$tmp"' EXIT
psql -X -v ON_ERROR_STOP=1 -q <<'PROVENANCE'
set role authenticated;
set request.jwt.claim.sub='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false}';
select public.create_staff_appointment_clinical_record(
 'aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa',
 'a1919191-2222-4222-8222-333333333333',
 'RESTORE17 VERIFIED synthetic examination',37.1,10.5,'synthetic');
PROVENANCE
for table in public.clinical_encounter_drafts clinic_private.clinical_draft_audit clinic_private.clinical_draft_requests clinic_private.clinical_record_provenance;do
 test "$(psql -XAt -c "select count(*) from $table")" = 1
done
docker exec "$container" pg_dump -U postgres -Fc -d clinical16_ci > "$tmp/source.dump"
test -s "$tmp/source.dump"
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$tmp/ephemeral.key" >/dev/null 2>&1
openssl pkey -in "$tmp/ephemeral.key" -pubout -out "$tmp/ephemeral.pub" >/dev/null 2>&1
gpg --batch --yes --pinentry-mode loopback --passphrase 'ci-only-clinical17-no-provider' \
 --symmetric --cipher-algo AES256 --output "$tmp/signed.encrypted" "$tmp/source.dump"
openssl dgst -sha256 -sign "$tmp/ephemeral.key" -out "$tmp/signed.sig" "$tmp/signed.encrypted"
openssl dgst -sha256 -verify "$tmp/ephemeral.pub" -signature "$tmp/signed.sig" "$tmp/signed.encrypted"
cp "$tmp/signed.encrypted" "$tmp/altered.encrypted"
printf 'TAMPER' >> "$tmp/altered.encrypted"
if openssl dgst -sha256 -verify "$tmp/ephemeral.pub" \
 -signature "$tmp/signed.sig" "$tmp/altered.encrypted" >/dev/null 2>&1;then
 echo 'FAIL: ciphertext tamper accepted';exit 1
fi
if openssl dgst -sha256 -verify "$tmp/ephemeral.pub" \
 -signature "$tmp/missing.sig" "$tmp/signed.encrypted" >/dev/null 2>&1;then
 echo 'FAIL: missing signature accepted';exit 1
fi
gpg --batch --yes --pinentry-mode loopback --passphrase 'ci-only-clinical17-no-provider' \
 --decrypt --output "$tmp/restored.dump" "$tmp/signed.encrypted" >/dev/null 2>&1
cmp "$tmp/source.dump" "$tmp/restored.dump"
docker exec "$container" createdb -U postgres clinical16_restored
docker exec -i "$container" pg_restore -U postgres --no-owner --no-acl \
 -d clinical16_restored < "$tmp/restored.dump"
query(){ docker exec "$container" psql -XAt -v ON_ERROR_STOP=1 -U postgres -d clinical16_restored -c "$1"; }
for table in clinic_private.clinical_record_provenance clinic_private.clinical_draft_audit clinic_private.clinical_draft_requests;do
 test "$(query "select count(*) from $table")" = 1
done
test "$(query "select count(*) from public.clinical_encounter_drafts where status='draft' and revision=1")" = 1
test "$(query "select count(*) from public.clinical_records c join clinic_private.clinical_record_provenance p on p.record_id=c.id and p.pet_id=c.pet_id and p.branch_id=c.branch_id where c.procedure='RESTORE17 VERIFIED synthetic examination'")" = 1
test "$(query "select count(*) from public.pets where id='33333333-3333-4333-8333-333333333333' and species='Dog' and breed='Chow Chow' and breed_id='dog-chow-chow'")" = 1
test "$(query "select count(*) from public.appointments where id='55555555-5555-4555-8555-555555555555' and status='requested' and branch_id is null")" = 1
test "$(query "select has_table_privilege('authenticated','clinic_private.clinical_draft_audit','SELECT')")" = f
test "$(query "select has_column_privilege('authenticated','public.clinical_records','branch_id','INSERT')")" = f
test "$(query "select count(*) from pg_trigger where tgrelid='clinic_private.clinical_draft_audit'::regclass and tgname='clinical_draft_audit_no_update_delete' and tgenabled='O'")" = 1
echo 'PASS: CLINICAL17 signed+AES256 PG17 restore, tamper/missing signature rejected, draft/audit/nonce/provenance, historical Dog/Chow Chow and grants recovered'
