-- ISSUE78 P2-01: disposable PostgreSQL17 branch-local inventory date security regression.
-- Run AFTER existing 11+12+13+14+15 migration, synthetic fixture, original RLS
-- and concurrent denied-write suite. Never applied as a migration.
\set ON_ERROR_STOP on
begin;
-- This creates synthetic date-edge lots only within a rollback-only transaction.
-- The authoritative instant is TRANSACTION_TIMESTAMP(), not CURRENT_DATE.
do $seed$
declare
 naga_date date;
 cavite_date date;
begin
 select (pg_catalog.transaction_timestamp() at time zone b.timezone)::date
  into naga_date from public.clinic_branches b
  where b.id='11111111-0000-4000-8000-000000000077';
 if naga_date is null then raise exception 'P2_01_FAIL: missing Naga zone';end if;
 -- Change *synthetic Cavite* zone within this test transaction only.
 -- A branch's own timezone, not Naga nor session, must control its read RPC.
 update public.clinic_branches set timezone='Pacific/Kiritimati'
  where id='22222222-0000-4000-8000-000000000077';
 select (pg_catalog.transaction_timestamp() at time zone b.timezone)::date
  into cavite_date from public.clinic_branches b
  where b.id='22222222-0000-4000-8000-000000000077';
 if cavite_date is null then raise exception 'P2_01_FAIL: missing Cavite zone';end if;
 -- Explicit reproducible UTC instants straddling Manila midnight.
 -- PostgreSQL SET TIME ZONE must never influence these dates.
 perform pg_catalog.set_config('TimeZone','Pacific/Honolulu',true);
 if (timestamptz '2026-11-18 15:59:59+00' at time zone
    (select b.timezone from public.clinic_branches b
      where b.id='11111111-0000-4000-8000-000000000077'))::date
       <> date '2026-11-18'
  or (timestamptz '2026-11-18 16:00:00+00' at time zone
    (select b.timezone from public.clinic_branches b
      where b.id='11111111-0000-4000-8000-000000000077'))::date
       <> date '2026-11-19'
  or (timestamptz '2026-11-18 15:59:59+00' at time zone
    (select b.timezone from public.clinic_branches b
      where b.id='22222222-0000-4000-8000-000000000077'))::date
       <> date '2026-11-19' then
   raise exception 'P2_01_FAIL: fixed UTC instant does not honor stored Naga/Cavite timezone';
 end if;
 -- Each pair tests the exact expiry date (+0, excluded), next day (+1),
 -- and the inclusive warning ceiling (+30/+60/+90), plus ceiling+1.
 insert into public.branch_stock_batches
 (branch_id,medicine_id,lot_number,received_on,expiry_date,
  disposition,on_hand_units,reserved_units,quarantined_units)
 values
 ('11111111-0000-4000-8000-000000000077','a0000078-0000-4000-8000-000000000001','TZ-A-YESTERDAY',naga_date-30,naga_date-1,'released',1,0,0),
 ('11111111-0000-4000-8000-000000000077','a0000078-0000-4000-8000-000000000001','TZ-A-EXPIRES-TODAY',naga_date-30,naga_date,'released',1,0,0),
 ('11111111-0000-4000-8000-000000000077','a0000078-0000-4000-8000-000000000001','TZ-A-TOMORROW',naga_date-30,naga_date+1,'released',1,0,0),
 ('11111111-0000-4000-8000-000000000077','a0000078-0000-4000-8000-000000000001','TZ-A-30',naga_date-30,naga_date+30,'released',1,0,0),
 ('11111111-0000-4000-8000-000000000077','a0000078-0000-4000-8000-000000000001','TZ-A-31',naga_date-30,naga_date+31,'released',1,0,0),
 ('11111111-0000-4000-8000-000000000077','a0000078-0000-4000-8000-000000000002','TZ-B-60',naga_date-30,naga_date+60,'released',1,0,0),
 ('11111111-0000-4000-8000-000000000077','a0000078-0000-4000-8000-000000000002','TZ-B-61',naga_date-30,naga_date+61,'released',1,0,0),
 ('11111111-0000-4000-8000-000000000077','a0000078-0000-4000-8000-000000000003','TZ-C-90',naga_date-30,naga_date+90,'released',1,0,0),
 ('11111111-0000-4000-8000-000000000077','a0000078-0000-4000-8000-000000000003','TZ-C-91',naga_date-30,naga_date+91,'released',1,0,0),
 ('22222222-0000-4000-8000-000000000077','a0000078-0000-4000-8000-000000000001','TZ-CAVITE-TODAY',cavite_date-30,cavite_date,'released',1,0,0),
 ('22222222-0000-4000-8000-000000000077','a0000078-0000-4000-8000-000000000001','TZ-CAVITE-TOMORROW',cavite_date-30,cavite_date+1,'released',1,0,0);
end $seed$;
set role authenticated;
set request.jwt.claim.sub='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
do $naga$
declare
 session_zone text;
 baseline_fefo jsonb;
 result_fefo jsonb;
 baseline_alerts jsonb;
 result_alerts jsonb;
 a record;
 b record;
 c record;
 local_date date;
begin
 select (pg_catalog.transaction_timestamp() at time zone cb.timezone)::date
 into local_date from public.clinic_branches cb
 where cb.id='11111111-0000-4000-8000-000000000077';
 foreach session_zone in array
   array['UTC','Asia/Manila','Pacific/Honolulu','Pacific/Kiritimati',
         'America/Los_Angeles','Europe/London','Asia/Tokyo']
 loop
  perform pg_catalog.set_config('TimeZone',session_zone,true);
  -- Directly test the actual SECURITY INVOKER RPC, not a mock calculation.
  select coalesce(jsonb_agg(jsonb_build_object(
   'lot',f.lot_number,'expires',f.expiry_date,'available',f.available_units)
   order by f.expiry_date,f.received_on,f.lot_number,f.batch_id),'[]'::jsonb)
  into result_fefo from public.list_branch_medicine_fefo(
   '11111111-0000-4000-8000-000000000077',
   'a0000078-0000-4000-8000-000000000001') f;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.product_code),'[]'::jsonb)
   into result_alerts from public.list_branch_medicine_alerts(
   '11111111-0000-4000-8000-000000000077') x;
  if baseline_fefo is null then
   baseline_fefo:=result_fefo; baseline_alerts:=result_alerts;
  elsif result_fefo is distinct from baseline_fefo
   or result_alerts is distinct from baseline_alerts then
    raise exception 'P2_01_FAIL: session % changed FEFO/alert outputs',session_zone;
  end if;
  if exists(select 1 from public.list_branch_medicine_fefo(
    '11111111-0000-4000-8000-000000000077',
    'a0000078-0000-4000-8000-000000000001') f
    where f.lot_number in ('TZ-A-YESTERDAY','TZ-A-EXPIRES-TODAY')) then
   raise exception 'P2_01_FAIL: expiry-date or prior-date lot was returned in %',session_zone;
  end if;
  if (select array_agg(f.lot_number order by f.expiry_date,f.received_on,f.lot_number,f.batch_id)
      from public.list_branch_medicine_fefo(
       '11111111-0000-4000-8000-000000000077',
       'a0000078-0000-4000-8000-000000000001') f
      where f.lot_number like 'TZ-%')
    is distinct from array['TZ-A-TOMORROW','TZ-A-30','TZ-A-31'] then
   raise exception 'P2_01_FAIL: FEFO local-date boundary or ordering changed in %',session_zone;
  end if;
  select * into a from public.list_branch_medicine_alerts(
    '11111111-0000-4000-8000-000000000077') where product_code='QA78-A';
  select * into b from public.list_branch_medicine_alerts(
    '11111111-0000-4000-8000-000000000077') where product_code='QA78-B';
  select * into c from public.list_branch_medicine_alerts(
    '11111111-0000-4000-8000-000000000077') where product_code='QA78-C';
  if a.available_units<>27 or a.near_expiry_batches<>4 or a.expired_batches<>3
   or a.expiry_warning_days<>30 or a.low_stock or a.out_of_stock
   or b.available_units<>6 or b.near_expiry_batches<>2
   or b.expiry_warning_days<>60 or b.low_stock or b.out_of_stock
   or c.available_units<>3 or c.near_expiry_batches<>2
   or c.expiry_warning_days<>90 or c.low_stock or c.out_of_stock then
   raise exception 'P2_01_FAIL: exact 30/60/90 inclusive expiry bounds wrong under %: %/%/%',
    session_zone,to_jsonb(a),to_jsonb(b),to_jsonb(c);
  end if;
 end loop;
end $naga$;
reset role;
set role authenticated;
set request.jwt.claim.sub='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
do $cavite$
declare
 z text;
 baseline jsonb;
 snapshot jsonb;
 alert_row record;
begin
 foreach z in array array['UTC','Asia/Manila','Pacific/Honolulu',
                           'Pacific/Kiritimati','America/Los_Angeles'] loop
  perform pg_catalog.set_config('TimeZone',z,true);
  if exists(select 1 from public.list_branch_medicine_fefo(
   '22222222-0000-4000-8000-000000000077',
   'a0000078-0000-4000-8000-000000000001') f
   where f.lot_number='TZ-CAVITE-TODAY') then
   raise exception 'P2_01_FAIL: Cavite expiry-day batch allowed in %',z;
  end if;
  if not exists(select 1 from public.list_branch_medicine_fefo(
   '22222222-0000-4000-8000-000000000077',
   'a0000078-0000-4000-8000-000000000001') f
   where f.lot_number='TZ-CAVITE-TOMORROW') then
   raise exception 'P2_01_FAIL: Cavite next-day batch missing in %',z;
  end if;
  select to_jsonb(a) into snapshot from public.list_branch_medicine_alerts(
    '22222222-0000-4000-8000-000000000077') a where product_code='QA78-A';
  select * into alert_row from public.list_branch_medicine_alerts(
    '22222222-0000-4000-8000-000000000077') where product_code='QA78-A';
  if baseline is null then baseline:=snapshot;
  elsif snapshot is distinct from baseline then
   raise exception 'P2_01_FAIL: Cavite session-timezone dependent alert %',z;
  end if;
  if alert_row.expired_batches<>1 or alert_row.near_expiry_batches<>2
   or alert_row.available_units<>4 then
    raise exception 'P2_01_FAIL: Cavite branch-local date incorrect under %: %',z,snapshot;
  end if;
  if exists(select 1 from public.branch_stock_batches
    where branch_id='11111111-0000-4000-8000-000000000077') then
   raise exception 'P2_01_FAIL: Cavite staff read Naga batches';
  end if;
 end loop;
end $cavite$;
reset role;
rollback;
-- All test-only clock and stock changes must disappear, real fixture remains.
do $post$
begin
 if (select count(*) from public.branch_stock_batches)<>9
  or (select count(*) from public.stock_movements)<>2
  or (select timezone from public.clinic_branches
      where id='22222222-0000-4000-8000-000000000077')<>'Asia/Manila'
  or (select count(*) from public.appointments
      where id='55555555-5555-4555-8555-555555555555'
       and branch_id is null and status='requested')<>1 then
  raise exception 'P2_01_FAIL: rollback leaked fixture/date or historic appointment';
 end if;
end $post$;
\echo 'PASS: ISSUE78 P2-01 real PG17 absolute UTC→branch-local expiry day, 30/60/90 inclusive thresholds, seven Naga and five Cavite session zones, FEFO/alerts invariant, branch RLS and rollback'
