#!/usr/bin/env bash
# Disposable PostgreSQL17-only extension of the RC0 signed recovery verification.
set -Eeuo pipefail
fail(){ echo "APPOINTMENT21_RECOVERY_FAIL: $*" >&2; exit 1; }
[[ "${GITHUB_ACTIONS:-}" == true && "${GITHUB_EVENT_NAME:-}" == pull_request &&
   "${PGDATABASE:-}" == appointment21_ci && "${PGHOST:-}" == 127.0.0.1 ]] ||
 fail 'not an isolated CI PostgreSQL environment'
container="$(docker ps --filter ancestor=postgres:17 --format '{{.ID}}' | head -n 1)"
[[ -n "$container" ]] || fail 'missing PostgreSQL17 service'
tmp="$(mktemp -d)";trap 'rm -rf "$tmp"' EXIT
fingerprint(){
 psql -XAt -q -v ON_ERROR_STOP=1 -d "$1" <<'SQL'
with records as (
 select 'appointment' type,to_jsonb(t)::text contents from public.appointments t
 union all select 'event',to_jsonb(t)::text from clinic_private.appointment_transition_events t
 union all select 'receipt',to_jsonb(t)::text from clinic_private.appointment_transition_receipts t
 union all select 'visit',to_jsonb(t)::text from public.branch_encounters t
 union all select 'auth_user',to_jsonb(t)::text from auth.users t
 union all select 'auth_session',to_jsonb(t)::text from auth.sessions t
 union all select 'staff_global',to_jsonb(t)::text from public.staff_memberships t
 union all select 'staff_branch',to_jsonb(t)::text from public.staff_branch_memberships t
)
select md5(string_agg(type||':'||contents,E'\n' order by type,contents)) from records;
select md5(pg_get_functiondef('public.transition_staff_appointment(uuid,uuid,text,integer,uuid)'::regprocedure));
select count(*) from public.appointments where id='55555555-5555-4555-8555-555555555555'
 and status='requested' and branch_id is null;
select count(*) from clinic_private.appointment_transition_events
 where appointment_id='a1210000-0000-4000-8000-000000000006' and action='confirm';
select case when
 pg_get_functiondef('public.transition_staff_appointment(uuid,uuid,text,integer,uuid)'::regprocedure)
   like '%join auth.users u%'
 and pg_get_functiondef('public.transition_staff_appointment(uuid,uuid,text,integer,uuid)'::regprocedure)
   like '%for share of sm,bm,u%'
 then 1 else 0 end;
SQL
}
fingerprint appointment21_ci > "$tmp/source"
[[ "$(sed -n '3p' "$tmp/source")" == 1 &&
   "$(sed -n '4p' "$tmp/source")" == 1 &&
   "$(sed -n '5p' "$tmp/source")" == 1 ]] ||
 fail 'missing preserved history or idempotent event'
docker exec "$container" pg_dump -Fc -U postgres -d appointment21_ci > "$tmp/archive"
test -s "$tmp/archive" || fail 'backup empty'
# Sign data and the 21-file source manifest; no secrets leave CI.
find supabase/migrations -maxdepth 1 -name '*.sql' -type f | LC_ALL=C sort |
 xargs sha256sum > "$tmp/source-manifest"
[[ "$(wc -l < "$tmp/source-manifest")" == 21 ]] || fail 'unexpected migration history'
cat "$tmp/source" >> "$tmp/source-manifest"
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$tmp/key" >/dev/null 2>&1
openssl pkey -in "$tmp/key" -pubout -out "$tmp/pub" >/dev/null 2>&1
openssl dgst -sha256 -sign "$tmp/key" -out "$tmp/signature" "$tmp/archive"
openssl dgst -sha256 -sign "$tmp/key" -out "$tmp/manifest-signature" "$tmp/source-manifest"
openssl dgst -sha256 -verify "$tmp/pub" -signature "$tmp/signature" "$tmp/archive" >/dev/null
openssl dgst -sha256 -verify "$tmp/pub" -signature "$tmp/manifest-signature" "$tmp/source-manifest" >/dev/null
cp "$tmp/archive" "$tmp/tampered";printf 'x' >> "$tmp/tampered"
if openssl dgst -sha256 -verify "$tmp/pub" -signature "$tmp/signature" "$tmp/tampered" >/dev/null 2>&1;then
 fail 'tampered snapshot accepted'
fi
if openssl dgst -sha256 -verify "$tmp/pub" -signature "$tmp/absent" "$tmp/archive" >/dev/null 2>&1;then
 fail 'absent signature accepted'
fi
docker exec "$container" createdb -U postgres appointment21_restore_ci
docker exec -i "$container" pg_restore -U postgres --exit-on-error  -d appointment21_restore_ci < "$tmp/archive"
fingerprint appointment21_restore_ci > "$tmp/restore"
cmp "$tmp/source" "$tmp/restore" || fail 'snapshot changed on independent database restore'
# On the INDEPENDENT restored DB, prove Auth-user bans remain authoritative:
# transactionally ban a synthetic admin and deny a still-live session/JWT.
psql -XAtq -v ON_ERROR_STOP=1 -d appointment21_restore_ci <<'RESTORED_AUTH_DENY'
begin;
update auth.users set banned_until=clock_timestamp()+interval '2 hours'
 where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
set local role authenticated;
set local request.jwt.claim.sub='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
set local request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"c2222222-aaaa-4aaa-8aaa-222222222222"}';
do $ban_restore$
begin
 begin
  perform public.transition_staff_appointment(
    'a1210000-0000-4000-8000-000000000006',
    '22222222-0000-4000-8000-000000000077','cancel',2,gen_random_uuid());
  raise exception 'RESTORE_FAIL: banned actor gained appointment write';
 exception when insufficient_privilege then null;
 end;
end
$ban_restore$;
rollback;
RESTORED_AUTH_DENY
echo 'PASS: signed 21-migration/actor/Auth-user/session/role/nonce/function parity, corrected Auth-row FOR SHARE, restored banned-user denial and tamper/missing signature rejection'
