#!/usr/bin/env bash
# Synthetic CI only: no provider endpoint or external backup location.
set -Eeuo pipefail
[[ "${GITHUB_ACTIONS:-}" == true && "${GITHUB_EVENT_NAME:-}" == pull_request &&
 "${PGHOST:-}" == 127.0.0.1 && "${PGDATABASE:-}" == clinical22_ci ]] || exit 1
container="$(docker ps --filter ancestor=postgres:17 --format '{{.ID}}' | head -n1)"
test -n "$container"
tmp="$(mktemp -d)";chmod 700 "$tmp";trap 'rm -rf "$tmp"' EXIT
fingerprint(){
 psql -XAtq -v ON_ERROR_STOP=1 -d "$1" -f scripts/recovery/tests/clinical17-security-fingerprint.sql
 psql -XAtq -v ON_ERROR_STOP=1 -d "$1" <<'DATA'
 with rows as (
 select 'draft' k,to_jsonb(t)::text v from public.clinical_encounter_drafts t
 union all select 'receipt',to_jsonb(t)::text from clinic_private.clinical_draft_requests t
 union all select 'audit',to_jsonb(t)::text from clinic_private.clinical_draft_audit t
 union all select 'pet',to_jsonb(t)::text from public.pets t
 union all select 'appointment',to_jsonb(t)::text from public.appointments t
 union all select 'session',to_jsonb(t)::text from auth.sessions t
 union all select 'user',to_jsonb(t)::text from auth.users t
 union all select 'staff',to_jsonb(t)::text from public.staff_memberships t
 union all select 'branch',to_jsonb(t)::text from public.staff_branch_memberships t
 )
 select encode(sha256(convert_to(string_agg(k||':'||v,E'\n' order by k,v),'UTF8')),'hex') from rows;
DATA
}
lookup(){
 psql -XAtq -v ON_ERROR_STOP=1 -d "$1" <<'LOOKUP'
 set role authenticated;
 set request.jwt.claim.sub='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
 set request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"a2200000-1111-4111-8111-000000000001"}';
 select public.reconcile_staff_clinical_draft('11111111-0000-4000-8000-000000000077',
 '33333333-3333-4333-8333-333333333333','aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa');
LOOKUP
}
fingerprint clinical22_ci > "$tmp/source"
grep -Fq 'public.reconcile_staff_clinical_draft(' "$tmp/source"
lookup clinical22_ci > "$tmp/receipt"
grep -Fq '"kind": "committed"' "$tmp/receipt"
docker exec "$container" pg_dump -U postgres -Fc clinical22_ci > "$tmp/dump"
test -s "$tmp/dump"
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$tmp/key" >/dev/null 2>&1
openssl pkey -in "$tmp/key" -pubout -out "$tmp/pub" >/dev/null 2>&1
openssl rand -hex 32 > "$tmp/pass"
gpg --batch --yes --pinentry-mode loopback --passphrase-file "$tmp/pass" --symmetric --cipher-algo AES256 --output "$tmp/encrypted" "$tmp/dump"
openssl dgst -sha256 -sign "$tmp/key" -out "$tmp/sig" "$tmp/encrypted"
openssl dgst -sha256 -sign "$tmp/key" -out "$tmp/source.sig" "$tmp/source"
openssl dgst -sha256 -verify "$tmp/pub" -signature "$tmp/sig" "$tmp/encrypted"
openssl dgst -sha256 -verify "$tmp/pub" -signature "$tmp/source.sig" "$tmp/source"
cp "$tmp/encrypted" "$tmp/corrupt";printf x >> "$tmp/corrupt"
if openssl dgst -sha256 -verify "$tmp/pub" -signature "$tmp/sig" "$tmp/corrupt" >/dev/null 2>&1;then exit 1;fi
if openssl dgst -sha256 -verify "$tmp/pub" -signature "$tmp/missing" "$tmp/encrypted" >/dev/null 2>&1;then exit 1;fi
gpg --batch --yes --pinentry-mode loopback --passphrase-file "$tmp/pass" --decrypt --output "$tmp/restored" "$tmp/encrypted"
cmp "$tmp/dump" "$tmp/restored"
docker exec "$container" createdb -U postgres clinical22_restored
docker exec -i "$container" pg_restore -U postgres --exit-on-error --single-transaction -d clinical22_restored < "$tmp/restored"
fingerprint clinical22_restored > "$tmp/target"
cmp "$tmp/source" "$tmp/target"
lookup clinical22_restored > "$tmp/target.receipt"
cmp "$tmp/receipt" "$tmp/target.receipt"
psql -XAtq -v ON_ERROR_STOP=1 -d clinical22_restored <<'DENIAL'
begin;
delete from auth.sessions where id='a2200000-1111-4111-8111-000000000001';
set local role authenticated;
set local request.jwt.claim.sub='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
set local request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"a2200000-1111-4111-8111-000000000001"}';
do $denied$
begin
 begin
  perform public.reconcile_staff_clinical_draft('11111111-0000-4000-8000-000000000077',
   '33333333-3333-4333-8333-333333333333','aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa');
  raise exception 'RESTORE_FAIL: deleted session authorized';
 exception when insufficient_privilege then null; end;
end $denied$;
rollback;
DENIAL
psql -X -v ON_ERROR_STOP=1 -d clinical22_restored -f 'supabase/tests/clinical23_live_session_pg17.sql'
echo 'PASS: signed encrypted full PG17 restore, clinical receipt/history/authority parity and restored #23 authorization'
