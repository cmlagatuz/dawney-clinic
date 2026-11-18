-- ISSUE #78 isolated PostgreSQL17 acceptance for READ-ONLY future inventory.
-- Original 11 + immutable 12/13/14 + new proposed 15. Fixtures are synthetic.
\set ON_ERROR_STOP on
begin;
-- All original patient history and no fake clinical approvals remain unchanged.
do $privileged$
declare n integer;
begin
 if (select count(*) from public.medicine_catalog)<>4
 or (select count(*) from public.branch_stock_batches)<>9
 or (select count(*) from public.stock_movements)<>2
 or (select count(*) from public.branch_medicine_rules)<>5 then
  raise exception 'ISSUE78_FAIL: missing synthetic catalog/batches/ledger';
 end if;
 if exists(select 1 from public.clinic_branches where booking_enabled)
 or exists(select 1 from public.branch_booking_policies where is_approved) then
  raise exception 'ISSUE78_FAIL: clinical flag/approval was activated';
 end if;
 if (select count(*) from public.appointments where id=
   '55555555-5555-4555-8555-555555555555'
    and branch_id is null and status='requested')<>1
 or (select count(*) from public.pets where id='33333333-3333-4333-8333-333333333333'
    and species='Dog' and breed='Chow Chow' and breed_id='dog-chow-chow')<>1
 or exists(select 1 from clinic_ci.issue77_original_pets o join public.pets p using(id)
   where to_jsonb(p) is distinct from o.old_row)
 or exists(select 1 from clinic_ci.issue77_original_appointments o join public.appointments a using(id)
   where to_jsonb(a)-'branch_id' is distinct from o.old_row) then
  raise exception 'ISSUE78_FAIL: historic patient, appointment or attribution changed';
 end if;
 if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in
      ('medicine_catalog','branch_medicine_rules','branch_stock_batches','stock_movements')
      and c.relrowsecurity)<>4 then
  raise exception 'ISSUE78_FAIL: one inventory table lacks RLS';
 end if;
 if has_table_privilege('anon','public.branch_stock_batches','SELECT')
 or has_table_privilege('authenticated','public.branch_stock_batches','INSERT')
 or has_table_privilege('authenticated','public.branch_stock_batches','UPDATE')
 or has_table_privilege('authenticated','public.branch_stock_batches','DELETE')
 or has_table_privilege('authenticated','public.stock_movements','INSERT')
 or has_table_privilege('authenticated','public.stock_movements','UPDATE')
 or has_table_privilege('authenticated','public.stock_movements','DELETE')
 or has_table_privilege('authenticated','public.medicine_catalog','INSERT')
 or has_table_privilege('authenticated','public.branch_medicine_rules','UPDATE')
 or has_column_privilege('authenticated','public.branch_stock_batches','unit_cost_minor','SELECT')
 or has_column_privilege('authenticated','public.branch_stock_batches','currency_code','SELECT')
 or has_function_privilege('anon','public.list_branch_medicine_fefo(uuid,uuid)','EXECUTE')
 or has_function_privilege('anon','public.list_branch_medicine_alerts(uuid)','EXECUTE')
 or not has_function_privilege('authenticated','public.list_branch_medicine_fefo(uuid,uuid)','EXECUTE')
 or not has_function_privilege('authenticated','public.list_branch_medicine_alerts(uuid)','EXECUTE')
 or (select count(*) from pg_proc where oid in
   ('public.list_branch_medicine_fefo(uuid,uuid)'::regprocedure,
    'public.list_branch_medicine_alerts(uuid)'::regprocedure)
   and prosecdef)<>0 then
   raise exception 'ISSUE78_FAIL: unexpected stock write/anonymous/cost/function privilege';
 end if;
 -- All three stock quantity bounds enforced regardless of database role.
 begin
  insert into public.branch_stock_batches(branch_id,medicine_id,lot_number,
    received_on,expiry_date,on_hand_units,reserved_units)
   values('11111111-0000-4000-8000-000000000077',
    'a0000078-0000-4000-8000-000000000001','INVALID-NEGATIVE',
    current_date,current_date+10,1,2);
  raise exception 'ISSUE78_FAIL: oversized reservations persisted';
 exception when check_violation then null;end;
 begin
  insert into public.branch_stock_batches(branch_id,medicine_id,lot_number,
    received_on,expiry_date,on_hand_units)
   values('11111111-0000-4000-8000-000000000077',
    'a0000078-0000-4000-8000-000000000001','INVALID-MINUS',
    current_date,current_date+10,-1);
  raise exception 'ISSUE78_FAIL: negative on_hand persisted';
 exception when check_violation then null;end;
 begin
  insert into public.branch_stock_batches(branch_id,medicine_id,lot_number,
    received_on,expiry_date)
   values('11111111-0000-4000-8000-000000000077',
    'a0000078-0000-4000-8000-000000000001','INVALID-DATE',
    current_date,current_date-1);
  raise exception 'ISSUE78_FAIL: expiry precedes receipt';
 exception when check_violation then null;end;
 -- Ledger cannot point a Cavite movement to a Naga-only batch.
 begin
  insert into public.stock_movements(branch_id,medicine_id,batch_id,event_id,
   event_type,delta_on_hand,after_on_hand,after_reserved,after_quarantined,
   reason_code,recorded_by)
  values('22222222-0000-4000-8000-000000000077',
   'a0000078-0000-4000-8000-000000000001',
   'b0000078-0000-4000-8000-000000000001',
   gen_random_uuid(),'receipt',1,1,0,0,'synthetic',
   'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
  raise exception 'ISSUE78_FAIL: foreign branch batch ledger accepted';
 exception when foreign_key_violation then null;end;
 -- Even a privileged SQL actor cannot rewrite, delete or truncate a row:
 -- append-only auditor is NOT just an API permission convention.
 begin
  update public.stock_movements set delta_on_hand=50
   where id='d0000078-0000-4000-8000-000000000001';
  raise exception 'ISSUE78_FAIL: ledger UPDATE accepted';
 exception when insufficient_privilege then null;end;
 begin
  delete from public.stock_movements where id='d0000078-0000-4000-8000-000000000001';
  raise exception 'ISSUE78_FAIL: ledger DELETE accepted';
 exception when insufficient_privilege then null;end;
 begin
  execute 'truncate public.stock_movements';
  raise exception 'ISSUE78_FAIL: ledger TRUNCATE accepted';
 exception when insufficient_privilege then null;end;
end $privileged$;

set role authenticated;
set request.jwt.claim.sub='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
set request.jwt.claims='{"is_anonymous":false}';
set request.jwt.claim.active_branch_id='22222222-0000-4000-8000-000000000077';
do $naga_vet$
declare a record;b record;f text[];g bigint[];
begin
 if public.assert_staff_branch('11111111-0000-4000-8000-000000000077')
    <> '11111111-0000-4000-8000-000000000077'::uuid then
  raise exception 'ISSUE78_FAIL: Naga vet not active';
 end if;
 if (select count(*) from public.medicine_catalog)<>4
 or (select count(*) from public.branch_medicine_rules)<>4
 or (select count(*) from public.branch_stock_batches)<>8
 or (select count(*) from public.stock_movements)<>1 then
  raise exception 'ISSUE78_FAIL: Naga staff cannot read own or sees Cavite inventory';
 end if;
 if exists(select 1 from public.branch_stock_batches where branch_id=
   '22222222-0000-4000-8000-000000000077')
 or exists(select 1 from public.stock_movements where branch_id=
   '22222222-0000-4000-8000-000000000077') then
  raise exception 'ISSUE78_FAIL: forged active_branch_id granted Cavite stock';
 end if;
 begin
  perform * from public.list_branch_medicine_alerts(
   '22222222-0000-4000-8000-000000000077');
  raise exception 'ISSUE78_FAIL: Cavite alerts visible to Naga vet';
 exception when insufficient_privilege then null;end;
 begin
  perform * from public.list_branch_medicine_fefo(
   '22222222-0000-4000-8000-000000000077',
   'a0000078-0000-4000-8000-000000000001');
  raise exception 'ISSUE78_FAIL: Cavite FEFO visible to Naga vet';
 exception when insufficient_privilege then null;end;
 select array_agg(x.lot_number order by x.expiry_date,x.received_on,x.lot_number),
  array_agg(x.available_units order by x.expiry_date,x.received_on,x.lot_number)
   into f,g
 from public.list_branch_medicine_fefo(
 '11111111-0000-4000-8000-000000000077',
 'a0000078-0000-4000-8000-000000000001') x;
 if f is distinct from array['N-A-20','N-A-40'] or
 g is distinct from array[4::bigint,20::bigint] then
  raise exception 'ISSUE78_FAIL: FEFO selected expired/quarantined/recalled/reserved lot %/%',f,g;
 end if;
 select * into a from public.list_branch_medicine_alerts(
 '11111111-0000-4000-8000-000000000077') where product_code='QA78-A';
 if a.available_units<>24 or a.reorder_point_units<>25
 or not a.low_stock or a.out_of_stock or a.expiry_warning_days<>30
 or a.near_expiry_batches<>2 or a.expired_batches<>1
 or a.quarantined_batches<>4 then
  raise exception 'ISSUE78_FAIL: 30-day/FEFO/low-stock alert invalid: %',row_to_json(a);
 end if;
 select * into b from public.list_branch_medicine_alerts(
 '11111111-0000-4000-8000-000000000077') where product_code='QA78-B';
 if b.available_units<>4 or b.expiry_warning_days<>60
 or b.near_expiry_batches<>1 or not b.low_stock or b.out_of_stock then
  raise exception 'ISSUE78_FAIL: 60-day near expiry threshold invalid';
 end if;
 select * into b from public.list_branch_medicine_alerts(
 '11111111-0000-4000-8000-000000000077') where product_code='QA78-C';
 if b.available_units<>1 or b.expiry_warning_days<>90
 or b.near_expiry_batches<>1 or not b.low_stock or b.out_of_stock then
  raise exception 'ISSUE78_FAIL: 90-day near expiry threshold invalid';
 end if;
 select * into b from public.list_branch_medicine_alerts(
 '11111111-0000-4000-8000-000000000077') where product_code='QA78-D';
 if b.available_units<>0 or not b.out_of_stock or not b.low_stock
 or b.expired_batches<>0 then
  raise exception 'ISSUE78_FAIL: zero stock not correctly classified';
 end if;
 if (select count(*) from public.list_branch_medicine_alerts(
  '11111111-0000-4000-8000-000000000077'))<>4 then
  raise exception 'ISSUE78_FAIL: alert rows lost or duplicated';
 end if;
 -- Forbidden direct app mutations, INCLUDING changing to another branch.
 begin
  update public.branch_stock_batches set branch_id=
    '22222222-0000-4000-8000-000000000077',on_hand_units=999
  where id='b0000078-0000-4000-8000-000000000001';
  raise exception 'ISSUE78_FAIL: Naga vet shifted branch and quantity';
 exception when insufficient_privilege then null;end;
 begin
  update public.branch_stock_batches set on_hand_units=-1
   where id='b0000078-0000-4000-8000-000000000001';
  raise exception 'ISSUE78_FAIL: Naga vet negative stock accepted';
 exception when insufficient_privilege then null;end;
 begin
  insert into public.stock_movements(branch_id,medicine_id,batch_id,event_id,event_type,
    delta_on_hand,after_on_hand,after_reserved,after_quarantined,reason_code,recorded_by)
  values('11111111-0000-4000-8000-000000000077',
   'a0000078-0000-4000-8000-000000000001',
   'b0000078-0000-4000-8000-000000000001',
   gen_random_uuid(),'dispense',-1,6,2,1,'unauthorized',
   'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
  raise exception 'ISSUE78_FAIL: direct dispense/receipt ledger INSERT accepted';
 exception when insufficient_privilege then null;end;
 begin
  update public.stock_movements set reason_code='tamper'
   where id='d0000078-0000-4000-8000-000000000001';
  raise exception 'ISSUE78_FAIL: direct ledger tamper accepted';
 exception when insufficient_privilege then null;end;
 begin
  execute 'select unit_cost_minor from public.branch_stock_batches limit 1';
  raise exception 'ISSUE78_FAIL: confidential unit cost exposed';
 exception when insufficient_privilege then null;end;
end $naga_vet$;
reset role;

-- Explicit Cavite admin remains authorized only for Cavite.
set role authenticated;
set request.jwt.claim.sub='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
set request.jwt.claims='{"is_anonymous":false}';
do $cavite$
declare x record;
begin
 if (select count(*) from public.branch_stock_batches)<>1
 or (select count(*) from public.stock_movements)<>1
 or (select count(*) from public.branch_medicine_rules)<>1 then
  raise exception 'ISSUE78_FAIL: Cavite admin sees Naga batches';
 end if;
 select * into x from public.list_branch_medicine_alerts(
 '22222222-0000-4000-8000-000000000077') where product_code='QA78-A';
 if x.available_units<>3 or x.reorder_point_units<>2 or x.low_stock
 or x.out_of_stock or x.near_expiry_batches<>1 then
  raise exception 'ISSUE78_FAIL: Cavite independent stock/expiry wrong';
 end if;
 if (select count(*) from public.list_branch_medicine_fefo(
  '22222222-0000-4000-8000-000000000077',
  'a0000078-0000-4000-8000-000000000001'))<>1 then
  raise exception 'ISSUE78_FAIL: Cavite FEFO unavailable';
 end if;
 begin
  perform * from public.list_branch_medicine_alerts(
   '11111111-0000-4000-8000-000000000077');
  raise exception 'ISSUE78_FAIL: Cavite admin bypassed Naga scope';
 exception when insufficient_privilege then null;end;
end $cavite$;
reset role;

-- Role revocation & forged mismatched branch membership must fail immediately.
update public.staff_branch_memberships set role='receptionist'
 where user_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
 and branch_id='11111111-0000-4000-8000-000000000077';
set role authenticated;
set request.jwt.claim.sub='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
do $mismatch$
begin
 if exists(select 1 from public.branch_stock_batches) then
  raise exception 'ISSUE78_FAIL: mismatched staff role can read stock';end if;
 begin
  perform * from public.list_branch_medicine_alerts('11111111-0000-4000-8000-000000000077');
  raise exception 'ISSUE78_FAIL: mismatched role can read alert';exception when insufficient_privilege then null;end;
end $mismatch$;
reset role;
update public.staff_branch_memberships set role='veterinarian',is_active=false
 where user_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
 and branch_id='11111111-0000-4000-8000-000000000077';
set role authenticated;
set request.jwt.claim.sub='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
do $revoked_branch$
begin
 if exists(select 1 from public.medicine_catalog)
 or exists(select 1 from public.branch_stock_batches)
 or exists(select 1 from public.stock_movements) then
  raise exception 'ISSUE78_FAIL: inactive branch read allowed';end if;
 begin
  perform * from public.list_branch_medicine_fefo('11111111-0000-4000-8000-000000000077',
   'a0000078-0000-4000-8000-000000000001');
  raise exception 'ISSUE78_FAIL: revoked branch can run FEFO';
 exception when insufficient_privilege then null;end;
end $revoked_branch$;
reset role;
update public.staff_branch_memberships set is_active=true
 where user_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
 and branch_id='11111111-0000-4000-8000-000000000077';
update public.staff_memberships set is_active=false
 where user_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
set role authenticated;
set request.jwt.claim.sub='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
do $revoked_global$
begin
 if exists(select 1 from public.branch_stock_batches) or exists(select 1 from public.medicine_catalog)
 then raise exception 'ISSUE78_FAIL: inactive global role sees inventory';end if;
 begin
  perform * from public.list_branch_medicine_alerts('11111111-0000-4000-8000-000000000077');
  raise exception 'ISSUE78_FAIL: revoked global staff ran alert';exception when insufficient_privilege then null;end;
end $revoked_global$;
reset role;
-- Cross-account change to owner A or unconfirmed/anonymous session denied.
set role authenticated;
set request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
do $owner$
begin
 if exists(select 1 from public.medicine_catalog) or exists(select 1 from public.branch_stock_batches)
 then raise exception 'ISSUE78_FAIL: real owner read stock';end if;
 begin
  perform * from public.list_branch_medicine_alerts('11111111-0000-4000-8000-000000000077');
  raise exception 'ISSUE78_FAIL: owner self-elevated inventory';exception when insufficient_privilege then null;end;
end $owner$;
set request.jwt.claim.sub='22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
do $unconfirmed$
begin
 if exists(select 1 from public.medicine_catalog) then
  raise exception 'ISSUE78_FAIL: unconfirmed user catalog access';end if;
 begin
  perform * from public.list_branch_medicine_alerts('22222222-0000-4000-8000-000000000077');
  raise exception 'ISSUE78_FAIL: unconfirmed branch scope';exception when insufficient_privilege then null;end;
end $unconfirmed$;
set request.jwt.claim.sub='11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set request.jwt.claims='{"is_anonymous":true}';
do $anonymous$
begin
 if exists(select 1 from public.medicine_catalog) then
  raise exception 'ISSUE78_FAIL: anonymous Auth account read catalog';end if;
 begin
  perform * from public.list_branch_medicine_fefo('11111111-0000-4000-8000-000000000077',
   'a0000078-0000-4000-8000-000000000001');
  raise exception 'ISSUE78_FAIL: anonymous could query FEFO';exception when insufficient_privilege then null;end;
end $anonymous$;
reset role;
rollback;
-- Rollback-only role edits: no unauthorized stock or medical mutation persisted.
do $post$
begin
 if (select on_hand_units from public.branch_stock_batches
  where id='b0000078-0000-4000-8000-000000000001')<>7
 or (select count(*) from public.stock_movements)<>2
 or (select count(*) from public.branch_stock_batches)<>9
 or (select count(*) from public.appointments where id='55555555-5555-4555-8555-555555555555'
  and branch_id is null and status='requested')<>1 then
  raise exception 'ISSUE78_FAIL: denied mutation leaked persistence';
 end if;
end $post$;
\echo 'PASS: ISSUE78 real PG17 RLS Naga/Cavite isolation, active/invalid roles, FEFO, 30/60/90 expiry, out/low, nonnegative constraints, cross-branch ledger FK, immutable audit, denied writes and Chow Chow unchanged'
