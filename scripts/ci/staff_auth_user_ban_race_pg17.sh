#!/usr/bin/env bash
# P2 Auth-user ban TOCTOU: real separate PostgreSQL17 sessions, no hosted calls.
# RED on reviewed a372776: B commits ban while A waits on the appointment row.
# GREEN after fix: B blocks on A's auth.users row lock until A ends.
set -Eeuo pipefail
fail(){ echo "APPOINTMENT21_AUTH_BAN_RACE_FAIL: $*" >&2; exit 1; }
[[ "$GITHUB_ACTIONS" == true && "$GITHUB_EVENT_NAME" == pull_request &&
   "$GITHUB_REPOSITORY" == cmlagatuz/dawney-clinic &&
   "$PGDATABASE" == appointment21_ci &&
   "$PGHOST" == 127.0.0.1 && "$PGPORT" == 5432 ]] ||
   fail 'not isolated official CI PostgreSQL environment'
sql(){ psql -XAtq -v ON_ERROR_STOP=1 -c "$1"; }
actor='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
appointment='a1210000-0000-4000-8000-000000000006'
branch='22222222-0000-4000-8000-000000000077'
nonce='a1500000-0000-4000-8000-000000000001'
holder_app='appt21-race-holder'
writer_app='appt21-race-writer'
ban_app='appt21-race-ban'
tmp="$(mktemp -d)"
chmod 700 "$tmp"
cleanup(){
  sql "select pg_terminate_backend(pid) from pg_stat_activity
    where datname=current_database()
      and application_name in ('$holder_app','$writer_app','$ban_app')
      and pid<>pg_backend_pid()" >/dev/null 2>&1 || true
  sql "update auth.users set banned_until=null where id='$actor'" >/dev/null 2>&1 || true
  rm -rf "$tmp"
}
trap cleanup EXIT
[[ "$(sql "select count(*) from auth.users where id='$actor' and banned_until is null")" == 1 ]] ||
 fail 'synthetic actor is not initially unbanned'
[[ "$(sql "select count(*) from public.appointments
  where id='$appointment' and status='requested' and lifecycle_revision=1")" == 1 ]] ||
 fail 'expected requested synthetic appointment has changed'
base_events="$(sql "select count(*) from clinic_private.appointment_transition_events where appointment_id='$appointment'")"

# H holds ONLY the target appointment row, never the Auth-user row.
( PGAPPNAME="$holder_app" psql -XAtq -v ON_ERROR_STOP=1 >"$tmp/holder" 2>&1 <<SQL
begin;
select id from public.appointments where id='$appointment' for update;
select pg_sleep(90);
rollback;
SQL
) & holder_pid=$!
wait_condition(){
  local label="$1" query="$2"
  for _ in $(seq 1 120); do
    [[ "$(sql "$query" 2>/dev/null || true)" == 1 ]] && return 0
    sleep 0.1
  done
  fail "bounded wait expired: $label"
}
wait_condition 'holder acquired appointment lock' "select count(*)
 from pg_stat_activity where datname=current_database()
 and application_name='$holder_app' and state='active' and query like '%pg_sleep(90)%'"

# A passes current Auth/session/branch checks, then blocks at appointment FOR UPDATE.
( PGAPPNAME="$writer_app" psql -XAtq -v ON_ERROR_STOP=1 >"$tmp/writer" 2>&1 <<SQL
begin;
set local role authenticated;
set local request.jwt.claim.sub='$actor';
set local request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"c2222222-aaaa-4aaa-8aaa-222222222222"}';
select public.transition_staff_appointment(
 '$appointment','$branch','confirm',1,'$nonce');
rollback;
SQL
) & writer_pid=$!
wait_condition 'writer blocked on holder after staff auth' "select count(*)
 from pg_stat_activity a join pg_stat_activity h on h.datname=a.datname
 where a.datname=current_database() and a.application_name='$writer_app'
 and h.application_name='$holder_app' and a.wait_event_type='Lock'
 and h.pid=any(pg_blocking_pids(a.pid))"

# B is an independent trusted SQL test operator. It cannot commit while A has
# a FOR SHARE lock on auth.users. A premature commit is a P2 reproduction.
( PGAPPNAME="$ban_app" psql -XAtq -v ON_ERROR_STOP=1 >"$tmp/ban" 2>&1 <<SQL
update auth.users set banned_until=clock_timestamp()+interval '2 hours' where id='$actor';
SQL
  echo committed >"$tmp/ban.committed"
) & ban_pid=$!
outcome=''
for _ in $(seq 1 120); do
  if [[ -f "$tmp/ban.committed" ]];then outcome='premature_ban';break;fi
  if [[ "$(sql "select count(*) from pg_stat_activity a
    join pg_stat_activity b on b.datname=a.datname
    where a.datname=current_database()
     and a.application_name='$ban_app' and b.application_name='$writer_app'
     and a.wait_event_type='Lock'
     and b.pid=any(pg_blocking_pids(a.pid))" 2>/dev/null || true)" == 1 ]];then
    outcome='ban_waiting_on_actor';break
  fi
  sleep 0.1
done
[[ -n "$outcome" ]] || fail 'ban made neither commit nor observable lock progress'

# Release H and verify which transaction could commit first.
sql "select pg_terminate_backend(pid) from pg_stat_activity
 where datname=current_database() and application_name='$holder_app'" >/dev/null
wait "$holder_pid" || true
if ! wait "$writer_pid";then cat "$tmp/writer" >&2;fail 'writer unexpectedly failed';fi
if ! wait "$ban_pid";then cat "$tmp/ban" >&2;fail 'synthetic ban failed';fi
if [[ "$outcome" == 'premature_ban' ]];then
  if grep -q '"status": "confirmed"' "$tmp/writer";then
    echo 'P2_REPRODUCED: ban committed BEFORE holder release, then banned staff RPC returned confirmed' >&2
  else
    echo 'P2_REPRODUCED: ban committed while the authorized staff RPC was waiting' >&2
    cat "$tmp/writer" >&2
  fi
  fail 'auth.users was not row-locked by appointment writer (RED)'
fi
[[ -f "$tmp/ban.committed" ]] ||
 fail 'ban did not commit after writer completed'
[[ "$(sql "select count(*) from auth.users
 where id='$actor' and banned_until>clock_timestamp()")" == 1 ]] ||
 fail 'committed ban was not retained'
[[ "$(sql "select count(*) from public.appointments
 where id='$appointment' and status='requested' and lifecycle_revision=1")" == 1 ]] ||
 fail 'rolled-back writer modified appointment'
[[ "$(sql "select count(*) from clinic_private.appointment_transition_events where appointment_id='$appointment'")" == "$base_events" ]] ||
 fail 'rolled-back writer left audit event'
[[ "$(sql "select count(*) from clinic_private.appointment_transition_receipts where request_id='$nonce'")" == 0 ]] ||
 fail 'rolled-back writer left receipt'
grep -q '"status": "confirmed"' "$tmp/writer" ||
 fail 'authorized writer did not complete before ban'
# After committed ban, even a live unexpired JWT/session is denied on new call.
psql -XAtq -v ON_ERROR_STOP=1 <<SQL
begin;
set local role authenticated;
set local request.jwt.claim.sub='$actor';
set local request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"c2222222-aaaa-4aaa-8aaa-222222222222"}';
do \$blocked\$
begin
 begin
  perform public.transition_staff_appointment(
    '$appointment','$branch','confirm',1,gen_random_uuid());
  raise exception 'BANNED_ACTOR_UNEXPECTEDLY_ACCEPTED';
 exception when insufficient_privilege then null;
 end;
end
\$blocked\$;
rollback;
SQL
echo 'PASS: auth.users ban waited on staff user-row FOR SHARE; rollback preserved appointment/nonce/audit; committed ban denied new RPC'
