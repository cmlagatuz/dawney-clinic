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
# Capture EFFECTIVE ACL and object-policy matrix from the source before dump.
# Roles are shared cluster metadata, not owned by a PostgreSQL database dump:
# verify the target cluster has both browser roles before pg_restore.
required_roles(){
 local role
 for role in "$@";do
  test "$(psql -XqAt -d clinical16_ci -c \
   "select count(*) from pg_roles where rolname='$role'")" = 1 || return 1
 done
}
required_roles anon authenticated || { echo 'FAIL: missing original browser roles';exit 1; }
if required_roles anon synthetic_missing_role_abcdef;then
 echo 'FAIL: missing role preflight returned success';exit 1
fi
echo 'PASS: required-role preflight refuses missing role'
fingerprint(){ psql -XqAt -v ON_ERROR_STOP=1 -d "$1" \
 -f scripts/recovery/tests/clinical17-security-fingerprint.sql; }
authz(){ psql -XqAt -v ON_ERROR_STOP=1 -d "$1" \
 -f scripts/recovery/tests/clinical17-restored-authz.sql; }
draft_actors(){ psql -XqAt -v ON_ERROR_STOP=1 -d "$1" \
 -f scripts/recovery/tests/clinical17-restored-draft-actors.sql; }
# Logical row-fidelity digest over every synthetic clinical and historical
# source row. Every JSON field matters, including creator/editor, actor,
# idempotency request/response, timestamps, attributes and anonymous history.
data_fingerprint(){
 psql -XqAt -v ON_ERROR_STOP=1 -d "$1" <<'DATA'
WITH data AS (
 SELECT 'draft' k,to_jsonb(t)::text row_json FROM public.clinical_encounter_drafts t
 UNION ALL SELECT 'audit',to_jsonb(t)::text FROM clinic_private.clinical_draft_audit t
 UNION ALL SELECT 'receipt',to_jsonb(t)::text FROM clinic_private.clinical_draft_requests t
 UNION ALL SELECT 'provenance',to_jsonb(t)::text FROM clinic_private.clinical_record_provenance t
 UNION ALL SELECT 'clinical_record',to_jsonb(t)::text FROM public.clinical_records t
 UNION ALL SELECT 'patient',to_jsonb(t)::text FROM public.pets t
 UNION ALL SELECT 'appointment',to_jsonb(t)::text FROM public.appointments t
)
SELECT md5(coalesce(string_agg(k||':'||row_json,E'\n' ORDER BY k,row_json),''))
FROM data;
DATA
}
data_fingerprint clinical16_ci > "$tmp/source.data"
test -s "$tmp/source.data"
fingerprint clinical16_ci > "$tmp/source.authority"
test -s "$tmp/source.authority"
# Coverage preflight: a fingerprint without these clinical definer/helper
# definitions must never be accepted as meaningful recovery evidence.
for routine in public.save_staff_clinical_encounter_draft public.read_staff_patient_chart \
 public.create_staff_appointment_clinical_record clinic_private.has_branch_role \
 clinic_private.has_verified_clinical_record clinic_private.clinical_audit_append_only;do
 grep -Fq "$(printf 'routine\t%s(' "$routine")" "$tmp/source.authority" || {
  echo "FAIL: essential clinical routine absent from signed-source definition manifest: $routine";exit 1;
 }
done
echo 'PASS: essential privileged clinical RPC and authorization helper definitions present in SHA256 authority manifest'
authz clinical16_ci > "$tmp/source.authz"
draft_actors clinical16_ci > "$tmp/source.draft-authz"
test -s "$tmp/source.draft-authz"
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
# CRITICAL: restore ACL statements; --no-acl falsely widens default
# function EXECUTE and may erase required positive privileges.
# Owner is intentionally the same postgres CI role on both databases.
docker exec "$container" createdb -U postgres clinical16_restored
docker exec -i "$container" pg_restore -U postgres --no-owner \
 --exit-on-error --single-transaction -d clinical16_restored < "$tmp/restored.dump"
data_fingerprint clinical16_restored > "$tmp/restored.data"
cmp "$tmp/source.data" "$tmp/restored.data"
echo 'PASS: full clinical/draft/creator/editor/audit/receipt/provenance/patient/appointment row digest identical'
fingerprint clinical16_restored > "$tmp/restored.authority"
if ! cmp -s "$tmp/source.authority" "$tmp/restored.authority";then
 diff -u "$tmp/source.authority" "$tmp/restored.authority" | head -100 || true
 echo 'FAIL: source/restored schema/table/column/routine ACL, RLS or trigger drift';exit 1
fi
authz clinical16_restored > "$tmp/restored.authz"
cmp "$tmp/source.authz" "$tmp/restored.authz"
draft_actors clinical16_restored > "$tmp/restored.draft-authz"
cmp "$tmp/source.draft-authz" "$tmp/restored.draft-authz"
echo 'PASS: source/restored real draft create/replay, second vet editor, unconfirmed vet and denied actor security matrix identical'
echo 'PASS: full source/restored PostgreSQL authorization fingerprint and active actor tests IDENTICAL'

# Deliberately reproduce SOL's old --no-acl defect, and require a mismatch.
docker exec "$container" createdb -U postgres clinical16_noacl
docker exec -i "$container" pg_restore -U postgres --no-owner --no-acl \
 --exit-on-error --single-transaction -d clinical16_noacl < "$tmp/restored.dump"
fingerprint clinical16_noacl > "$tmp/broken.authority"
if cmp -s "$tmp/source.authority" "$tmp/broken.authority";then
 echo 'FAIL: --no-acl restore incorrectly accepted as authorization-equivalent';exit 1
fi
echo 'PASS: adversarial --no-acl restore DETECTED as missing original grants'

# Negative perturbation checks run in a rollback-only transaction: both
# an incorrectly granted PUBLIC clinical RPC and missing private object must
# change the original/restored fingerprint and fail the comparison.
{
 printf 'BEGIN;\nGRANT EXECUTE ON FUNCTION public.create_staff_appointment_clinical_record(uuid,uuid,text,numeric,numeric,text) TO PUBLIC;\n'
 cat scripts/recovery/tests/clinical17-security-fingerprint.sql
 printf 'ROLLBACK;\n'
} | psql -XqAt -v ON_ERROR_STOP=1 -d clinical16_restored > "$tmp/widened.authority"
if cmp -s "$tmp/source.authority" "$tmp/widened.authority";then
 echo 'FAIL: malicious PUBLIC EXECUTE grant was not detected';exit 1
fi
{
 printf 'BEGIN;\nDROP TABLE clinic_private.clinical_draft_requests CASCADE;\n'
 cat scripts/recovery/tests/clinical17-security-fingerprint.sql
 printf 'ROLLBACK;\n'
} | psql -XqAt -v ON_ERROR_STOP=1 -d clinical16_restored > "$tmp/missing-object.authority"
if cmp -s "$tmp/source.authority" "$tmp/missing-object.authority";then
 echo 'FAIL: missing clinical idempotency table was not detected';exit 1
fi
# Intentionally replace ONLY a privileged draft writer body; PostgreSQL keeps
# original owner/grants/SECURITY DEFINER/search_path. Metadata-only checks must
# not make this malicious restore appear equivalent.
{
 cat <<'BROKEN_FN'
BEGIN;
CREATE TEMP TABLE clinical_before_metadata AS
 SELECT proowner,proacl,prosecdef,proconfig,provolatile,proisstrict
 FROM pg_proc WHERE oid=
  'public.save_staff_clinical_encounter_draft(uuid,uuid,uuid,uuid,integer,text,text,text,text)'::regprocedure;
CREATE OR REPLACE FUNCTION public.save_staff_clinical_encounter_draft(
 p_branch uuid,p_pet uuid,p_appointment uuid,p_request_id uuid,
 p_expected_revision integer,p_complaint text,p_examination text,
 p_assessment text,p_plan text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $broken$ BEGIN RAISE EXCEPTION 'DELIBERATELY BROKEN RECOVERED DRAFT WRITER'
 USING ERRCODE='42501'; END $broken$;
DO $metadata$
BEGIN
 IF EXISTS(
 SELECT 1 FROM clinical_before_metadata b FULL JOIN
 (SELECT proowner,proacl,prosecdef,proconfig,provolatile,proisstrict
 FROM pg_proc WHERE oid=
 'public.save_staff_clinical_encounter_draft(uuid,uuid,uuid,uuid,integer,text,text,text,text)'::regprocedure) a
 ON b.proowner=a.proowner AND b.prosecdef=a.prosecdef
 AND b.proacl IS NOT DISTINCT FROM a.proacl
 AND b.proconfig IS NOT DISTINCT FROM a.proconfig
 AND b.provolatile=a.provolatile AND b.proisstrict=a.proisstrict
 WHERE b.proowner IS NULL OR a.proowner IS NULL)
 THEN RAISE EXCEPTION 'BROKEN_FUNCTION_TEST_INVALID: changed original privileges'; END IF;
END $metadata$;
BROKEN_FN
 cat scripts/recovery/tests/clinical17-security-fingerprint.sql
 printf 'ROLLBACK;\n'
} | psql -XqAt -v ON_ERROR_STOP=1 -d clinical16_restored > "$tmp/broken-function.authority"
if cmp -s "$tmp/source.authority" "$tmp/broken-function.authority";then
 echo 'FAIL: modified SECURITY DEFINER draft body passed same grants and owner';exit 1
fi
fingerprint clinical16_restored > "$tmp/restored-after-function.authority"
cmp "$tmp/source.authority" "$tmp/restored-after-function.authority"
echo 'PASS: tampered SECURITY DEFINER draft body detected although ownership/ACL/config unchanged; transaction rolled back'

# Original restored state must still match after the intentionally rolled-back
# corruption probes; never leave a corrupted candidate in the CI fixture.
fingerprint clinical16_restored > "$tmp/final.authority"
cmp "$tmp/source.authority" "$tmp/final.authority"
echo 'PASS: bad ACL, missing clinical object and missing browser role are detected and never accepted'

# Reapply the already SIGNED and byte-verified archive to an independent
# SECOND disposable DB, then recheck full immutable metadata, history and actual
# clinical writer behavior. This protects a recovery that works only once.
docker exec "$container" createdb -U postgres clinical16_second_restore
docker exec -i "$container" pg_restore -U postgres --no-owner \
 --exit-on-error --single-transaction -d clinical16_second_restore < "$tmp/restored.dump"
data_fingerprint clinical16_second_restore > "$tmp/second.data"
cmp "$tmp/source.data" "$tmp/second.data"
fingerprint clinical16_second_restore > "$tmp/second.authority"
cmp "$tmp/source.authority" "$tmp/second.authority"
authz clinical16_second_restore > "$tmp/second.authz"
cmp "$tmp/source.authz" "$tmp/second.authz"
draft_actors clinical16_second_restore > "$tmp/second.draft-authz"
cmp "$tmp/source.draft-authz" "$tmp/second.draft-authz"
echo 'PASS: second independently restored DB reads original persisted draft, audit, receipts and provenance; real actor security and SHA256 function body fingerprints identical'

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
echo 'PASS: CLINICAL17 signed+AES256 PG17 restore, tamper/missing signature rejected, draft/audit/nonce/provenance, historical Dog/Chow Chow and full source/restored ACL/RLS/trigger/actor privileges equivalent'
