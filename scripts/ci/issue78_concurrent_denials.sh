#!/usr/bin/env bash
# Issue78 DISPOSABLE PG17 ONLY: two overlapping, unauthorized stock writers.
# This is a denial concurrency test, NOT validation of future enabled dispense
# transactions / SELECT FOR UPDATE. No inventory mutation API exists yet.
set -Eeuo pipefail
[[ "${GITHUB_ACTIONS:-}" == true && "${GITHUB_EVENT_NAME:-}" == pull_request &&
   "${GITHUB_REPOSITORY:-}" == cmlagatuz/dawney-clinic &&
   "${PGDATABASE:-}" == issue78_inventory_ci && "${PGHOST:-}" == 127.0.0.1 ]] ||
 { echo 'ISSUE78_CONCURRENCY_BLOCKED: not isolated GitHub PG17'; exit 1; }
attempt(){
 local actor="$1"
 psql -X -v ON_ERROR_STOP=1 -q -v actor="$actor" <<'SQL'
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :'actor',true);
select set_config('request.jwt.claim.active_branch_id','22222222-0000-4000-8000-000000000077',true);
select pg_sleep(0.65);
do $racing$
begin
  begin
   update public.branch_stock_batches
    set on_hand_units=on_hand_units-1
    where id='b0000078-0000-4000-8000-000000000001';
   raise exception 'ISSUE78_RACE_FAIL: parallel direct stock UPDATE accepted';
  exception when insufficient_privilege then null;end;
  begin
   insert into public.stock_movements(branch_id,medicine_id,batch_id,event_id,
    event_type,delta_on_hand,after_on_hand,after_reserved,after_quarantined,
    reason_code,recorded_by)
   values ('11111111-0000-4000-8000-000000000077',
    'a0000078-0000-4000-8000-000000000001',
    'b0000078-0000-4000-8000-000000000001',
    gen_random_uuid(),'dispense',-1,6,2,1,'unauthorized',
    current_setting('request.jwt.claim.sub')::uuid);
   raise exception 'ISSUE78_RACE_FAIL: parallel dispense ledger INSERT accepted';
  exception when insufficient_privilege then null;end;
end $racing$;
commit;
SQL
}
attempt 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' > /tmp/issue78-race-a.log 2>&1 &
a=$!
attempt 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' > /tmp/issue78-race-b.log 2>&1 &
b=$!
wait "$a" || { cat /tmp/issue78-race-a.log; exit 1; }
wait "$b" || { cat /tmp/issue78-race-b.log; exit 1; }
psql -X -v ON_ERROR_STOP=1 -q <<'VERIFY'
do $post$
begin
 if (select on_hand_units from public.branch_stock_batches
   where id='b0000078-0000-4000-8000-000000000001')<>7
 or (select reserved_units from public.branch_stock_batches
   where id='b0000078-0000-4000-8000-000000000001')<>2
 or (select count(*) from public.stock_movements)<>2
 or (select count(*) from public.branch_stock_batches)<>9 then
  raise exception 'ISSUE78_RACE_FAIL: concurrent unauthorized mutation persisted';
 end if;
end $post$;
VERIFY
echo 'PASS: ISSUE78 simultaneous authenticated A/B clients cannot update shared stock or append dispense ledger; unchanged 7/2/9/2 persistence (write path intentionally OFF)'
