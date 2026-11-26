#!/usr/bin/env bash
# Disposable PG17 post-#23 transaction ordering; synthetic sessions only.
set -Eeuo pipefail
[[ "${GITHUB_ACTIONS:-}" == true && "${GITHUB_EVENT_NAME:-}" == pull_request && "${PGHOST:-}" == 127.0.0.1 && "${PGDATABASE:-}" == clinical22_ci ]] || exit 1
pg(){ psql -XAtq -v ON_ERROR_STOP=1 "$@"; }
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
pg -c "insert into auth.sessions(id,user_id) values ('a2400000-1111-4111-8111-000000000003','dddddddd-dddd-4ddd-8ddd-dddddddddddd'),('a2400000-1111-4111-8111-000000000004','dddddddd-dddd-4ddd-8ddd-dddddddddddd')"
wait_sleep(){ local app="$1"; for i in {1..80}; do
 if [[ "$(pg -c "select count(*) from pg_stat_activity where application_name='$app' and wait_event='PgSleep'")" == 1 ]]; then return; fi
 sleep 0.1
 done; echo 'CLINICAL23_ORDER missing transaction barrier'; return 1; }
PGAPPNAME=clinical23_writer pg >"$tmp/writer" 2>&1 <<'SQL' &
begin;
set local role authenticated;
set local request.jwt.claim.sub='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
set local request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"a2400000-1111-4111-8111-000000000003"}';
select public.save_staff_clinical_encounter_draft('11111111-0000-4000-8000-000000000077','33333333-3333-4333-8333-333333333333','aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa','a2400000-0000-4000-8000-000000000004',4,'synthetic session ordering','','','');
select pg_sleep(8);
commit;
SQL
writer=$!
wait_sleep clinical23_writer
pg <<'SQL'
begin;
set local lock_timeout='500ms';
do $lock$
begin
 begin
 delete from auth.sessions where id='a2400000-1111-4111-8111-000000000003';
 raise exception 'CLINICAL23_ORDER revocation did not wait';
 exception when lock_not_available then null; end;
end $lock$;
rollback;
SQL
wait "$writer" || { cat "$tmp/writer"; exit 1; }
pg -c "delete from auth.sessions where id='a2400000-1111-4111-8111-000000000003'"
test "$(pg -c "select count(*) from clinic_private.clinical_draft_audit where request_id='a2400000-0000-4000-8000-000000000004' and revision=5")" = 1
PGAPPNAME=clinical23_revoker pg >"$tmp/revoker" 2>&1 <<'SQL' &
begin;
delete from auth.sessions where id='a2400000-1111-4111-8111-000000000004';
select pg_sleep(8);
commit;
SQL
revoker=$!
wait_sleep clinical23_revoker
PGAPPNAME=clinical23_waiting_writer pg >"$tmp/denied" 2>&1 <<'SQL' &
set statement_timeout='20s';
set role authenticated;
set request.jwt.claim.sub='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"a2400000-1111-4111-8111-000000000004"}';
do $deny$
begin
 begin
 perform public.save_staff_clinical_encounter_draft('11111111-0000-4000-8000-000000000077','33333333-3333-4333-8333-333333333333','aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa','a2400000-0000-4000-8000-000000000005',5,'synthetic denied','','','');
 raise exception 'CLINICAL23_ORDER revoked writer committed';
 exception when insufficient_privilege then null; end;
end $deny$;
SQL
denied=$!
blocked=0
for i in {1..50}; do
 if [[ "$(pg -c "select count(*) from pg_stat_activity where application_name='clinical23_waiting_writer' and wait_event_type='Lock'")" == 1 ]]; then blocked=1; break; fi
 sleep 0.1
done
test "$blocked" = 1
wait "$revoker"; wait "$denied" || { cat "$tmp/denied"; exit 1; }
test "$(pg -c "select count(*) from clinic_private.clinical_draft_audit where request_id='a2400000-0000-4000-8000-000000000005'")" = 0
test "$(pg -c "select count(*) from clinic_private.clinical_draft_requests where request_id='a2400000-0000-4000-8000-000000000005'")" = 0
echo 'PASS: post-#23 writer-first commit and revoke-first denial, one revision and no denied receipt'
