#!/usr/bin/env bash
# CI-only two independent PG17 sessions; production and single-connection simulations prohibited.
set -Eeuo pipefail
[[ "${GITHUB_ACTIONS:-}" == "true" && "${PGDATABASE:-}" == "clinic_race" ]] || {
  echo 'Refusing non-disposable race test target' >&2; exit 1;
}
work=$(mktemp -d "${RUNNER_TEMP:?}/phase4-nonce-race.XXXXXXXX")
trap 'rm -rf -- "$work"' EXIT
export PHASE4_RACE_SIGNAL="$work/inserted"
slot="(date_trunc('week', now() at time zone 'Asia/Manila') + interval '7 days 9 hours') at time zone 'Asia/Manila'"
cat > "$work/first.sql" <<SQL
\\set VERBOSITY verbose
begin;
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
select public.request_service_appointment(
'33333333-3333-4333-8333-333333333333',
'88888888-8888-4888-8888-888888888888',
'55555555-5555-4555-8555-555555555555',
$slot,'dededede-dede-4ede-8ede-dededededede','CI simultaneous retry',null);
\\! touch "$work/inserted"
select pg_sleep(5);
commit;
SQL
cat > "$work/second.sql" <<SQL
\\set VERBOSITY verbose
begin;
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
select public.request_service_appointment(
'33333333-3333-4333-8333-333333333333',
'88888888-8888-4888-8888-888888888888',
'55555555-5555-4555-8555-555555555555',
$slot,'dededede-dede-4ede-8ede-dededededede','CI simultaneous retry',null);
commit;
SQL
psql -X -qAt -v ON_ERROR_STOP=1 -f "$work/first.sql" >"$work/first.log" 2>&1 &
first_pid=$!
for i in {1..80}; do
  [[ -f "$work/inserted" ]] && break
  kill -0 "$first_pid" 2>/dev/null || { echo 'First session failed before insert' >&2; exit 1; }
  sleep 0.05
done
[[ -f "$work/inserted" ]] || { echo 'First session did not reach transaction hold' >&2; exit 1; }
set +e
psql -X -qAt -v ON_ERROR_STOP=1 -f "$work/second.sql" >"$work/second.log" 2>&1
second_status=$?
wait "$first_pid"
first_status=$?
set -e
[[ $first_status -eq 0 ]] || { echo 'First transaction failed' >&2; exit 1; }
existing=$(psql -X -qAt -v ON_ERROR_STOP=1 -c "
  select id from public.appointments where request_nonce='dededede-dede-4ede-8ede-dededededede'")
[[ "$existing" =~ ^[0-9a-f-]{36}$ ]] || { echo 'First booking missing' >&2; exit 1; }
count=$(psql -X -qAt -v ON_ERROR_STOP=1 -c "
  select count(*) from public.appointments where request_nonce='dededede-dede-4ede-8ede-dededededede'")
[[ "$count" == "1" ]] || { echo 'Concurrent retry duplicated booking' >&2; exit 1; }
grep -Fq "$existing" "$work/first.log" || { echo 'First RPC did not return stored booking' >&2; exit 1; }
if [[ "${PHASE4_EXPECT_EXCLUSION_REPRO:-}" == "YES" ]]; then
  [[ "$second_status" -ne 0 ]] && grep -q '23P01' "$work/second.log" || {
    echo 'Expected baseline exclusion_violation did not reproduce' >&2; exit 1;
  }
  echo 'REPRODUCED: concurrent exact nonce retry raises 23P01 exclusion_violation on unpatched source'
else
  [[ "$second_status" -eq 0 ]] && grep -Fq "$existing" "$work/second.log" || {
    echo 'Exact concurrent nonce retry did not return original appointment' >&2; exit 1;
  }
  echo 'PASS: two-session PG17 same-nonce retry returns same booking and creates exactly one row'
fi
