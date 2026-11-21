-- #18/#19 disposable PostgreSQL17 operational acceptance.
-- Source DB only. Requires synthetic auth.sessions shim and actual migrations.
\set ON_ERROR_STOP on
insert into auth.users(id,email_confirmed_at,is_anonymous)
 values ('bbbbbbbb-6666-4666-8666-bbbbbbbbbbbb',clock_timestamp(),false);
insert into auth.sessions(id,user_id) values
 ('c1111111-aaaa-4aaa-8aaa-111111111111','bbbbbbbb-6666-4666-8666-bbbbbbbbbbbb'),
 ('c2222222-aaaa-4aaa-8aaa-222222222222','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),
 ('c3333333-aaaa-4aaa-8aaa-333333333333','cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
 ('c4444444-aaaa-4aaa-8aaa-444444444444','dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
 ('c5555555-aaaa-4aaa-8aaa-555555555555','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
-- Existing F is globally revoked. No real users, invited emails or hosted calls.
set role authenticated;
set request.jwt.claim.sub='bbbbbbbb-6666-4666-8666-bbbbbbbbbbbb';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"c1111111-aaaa-4aaa-8aaa-111111111111"}';
do $request$
declare x jsonb;y jsonb;
begin
 x:=public.request_staff_access('22222222-0000-4000-8000-000000000077','CI synthetic staff access');
 y:=public.request_staff_access('22222222-0000-4000-8000-000000000077','CI synthetic staff access');
 if x is distinct from y or x->>'state'<>'pending' or (x->>'revision')::int<>1
 then raise exception 'OPS_FAIL: verified request or duplicate pending changed';end if;
 begin
  perform public.review_staff_access('bbbbbbbb-6666-4666-8666-bbbbbbbbbbbb','approve','administrator',
    array['22222222-0000-4000-8000-000000000077']::uuid[],1,gen_random_uuid());
  raise exception 'OPS_FAIL: pending user self-approved';
 exception when insufficient_privilege then null;end;
end $request$;
reset role;

do $pending$
begin
 if (select count(*) from public.staff_access_requests where user_id='bbbbbbbb-6666-4666-8666-bbbbbbbbbbbb'
    and state='pending' and revision=1)<>1
 or (select count(*) from clinic_private.staff_operation_events where target_id='bbbbbbbb-6666-4666-8666-bbbbbbbbbbbb'
    and action='request')<>1
 or exists(select 1 from public.staff_memberships where user_id='bbbbbbbb-6666-4666-8666-bbbbbbbbbbbb')
 then raise exception 'OPS_FAIL: pending user gained privilege or audit wrong';end if;
end $pending$;

set role authenticated;
set request.jwt.claim.sub='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"c2222222-aaaa-4aaa-8aaa-222222222222"}';
do $admin$
declare a jsonb;b jsonb;
begin
 a:=public.list_staff_access_requests('22222222-0000-4000-8000-000000000077');
 if jsonb_array_length(a->'items')<1 then raise exception 'OPS_FAIL: admin cannot view pending branch';end if;
 begin
  perform public.review_staff_access('bbbbbbbb-6666-4666-8666-bbbbbbbbbbbb','approve','receptionist',
    array['11111111-0000-4000-8000-000000000077']::uuid[],1,
    'a5555555-3333-4333-8333-555555555555');
  raise exception 'OPS_FAIL: Cavite admin granted Naga';
 exception when insufficient_privilege then null;end;
 begin
  perform public.review_staff_access('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','approve','administrator',
    array['22222222-0000-4000-8000-000000000077']::uuid[],1,
    'b5555555-3333-4333-8333-555555555555');
  raise exception 'OPS_FAIL: admin self-approval';
 exception when insufficient_privilege then null;end;
 a:=public.review_staff_access('bbbbbbbb-6666-4666-8666-bbbbbbbbbbbb','approve','receptionist',
   array['22222222-0000-4000-8000-000000000077']::uuid[],1,
   'c5555555-3333-4333-8333-555555555555');
 b:=public.review_staff_access('bbbbbbbb-6666-4666-8666-bbbbbbbbbbbb','approve','receptionist',
   array['22222222-0000-4000-8000-000000000077']::uuid[],1,
   'c5555555-3333-4333-8333-555555555555');
 if a is distinct from b or a->>'state'<>'approved' or (a->>'revision')::integer<>2
 then raise exception 'OPS_FAIL: staff approval/replay';end if;
 begin
  perform public.review_staff_access('bbbbbbbb-6666-4666-8666-bbbbbbbbbbbb','approve','administrator',
   array['22222222-0000-4000-8000-000000000077']::uuid[],1,
   'c5555555-3333-4333-8333-555555555555');
  raise exception 'OPS_FAIL: changed review nonce accepted';
 exception when unique_violation then null;end;
 begin
  perform public.review_staff_access('bbbbbbbb-6666-4666-8666-bbbbbbbbbbbb','role_change','accountant',
   array['22222222-0000-4000-8000-000000000077']::uuid[],1,
   'd5555555-3333-4333-8333-555555555555');
  raise exception 'OPS_FAIL: stale admin revision accepted';
 exception when serialization_failure then null;end;
end $admin$;
reset role;

do $approved$
begin
 if (select count(*) from public.staff_memberships m
   join public.staff_branch_memberships b on b.user_id=m.user_id
   where m.user_id='bbbbbbbb-6666-4666-8666-bbbbbbbbbbbb'
    and m.role='receptionist' and m.is_active
    and b.role='receptionist' and b.is_active
    and b.branch_id='22222222-0000-4000-8000-000000000077')<>1
 or (select count(*) from clinic_private.staff_review_receipts
   where nonce='c5555555-3333-4333-8333-555555555555')<>1
 then raise exception 'OPS_FAIL: durable staff grant/review receipt';end if;
end $approved$;

set role authenticated;
set request.jwt.claim.sub='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"c2222222-aaaa-4aaa-8aaa-222222222222"}';
do $accountant$
declare a jsonb;
begin
 a:=public.review_staff_access('bbbbbbbb-6666-4666-8666-bbbbbbbbbbbb','role_change','accountant',
   array['22222222-0000-4000-8000-000000000077']::uuid[],2,
   'e5555555-3333-4333-8333-555555555555');
 if a->>'role'<>'accountant' or a->>'state'<>'approved'
 then raise exception 'OPS_FAIL: accountant role change';end if;
end $accountant$;
reset role;
set role authenticated;
set request.jwt.claim.sub='bbbbbbbb-6666-4666-8666-bbbbbbbbbbbb';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"c1111111-aaaa-4aaa-8aaa-111111111111"}';
do $accountant_denial$
begin
 if clinic_private.has_branch_role('22222222-0000-4000-8000-000000000077',
   array['administrator','receptionist','veterinarian']) then
  raise exception 'OPS_FAIL: accountant inherited clinical role';end if;
 begin
  perform public.assert_staff_branch('22222222-0000-4000-8000-000000000077');
  raise exception 'OPS_FAIL: accountant passed standard staff selector';
 exception when insufficient_privilege then null;end;
 begin
  perform public.create_branch_inventory_item(
   '22222222-0000-4000-8000-000000000077',gen_random_uuid(),
   'TEST-ACC','Forbidden','No','supply','packet',null,null,0,null,null,null,0);
  raise exception 'OPS_FAIL: accountant wrote inventory';
 exception when insufficient_privilege then null;end;
end $accountant_denial$;
reset role;

-- Synthetic receptionist C has exact Cavite + global active role.
set role authenticated;
set request.jwt.claim.sub='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"c3333333-aaaa-4aaa-8aaa-333333333333"}';
do $item$
declare a jsonb;b jsonb;
begin
 a:=public.create_branch_inventory_item(
 '22222222-0000-4000-8000-000000000077',
 'f1111111-2222-4222-8222-111111111111',
 'OPS-SUP-001','Sterile Gauze','Synthetic non-controlled supply','supply',
 'packet',null,null,5,'LOT-OPS-1',date '2028-12-31','Synthetic Supplier',10);
 b:=public.create_branch_inventory_item(
 '22222222-0000-4000-8000-000000000077',
 'f1111111-2222-4222-8222-111111111111',
 'OPS-SUP-001','Sterile Gauze','Synthetic non-controlled supply','supply',
 'packet',null,null,5,'LOT-OPS-1',date '2028-12-31','Synthetic Supplier',10);
 if a is distinct from b or a->>'kind'<>'inventory_item'
  or (a->>'onHandUnits')::bigint<>10 then raise exception 'OPS_FAIL: opening stock + replay';end if;
 begin
  perform public.create_branch_inventory_item(
   '22222222-0000-4000-8000-000000000077',
   'f1111111-2222-4222-8222-111111111111',
   'OPS-SUP-002','Different product','Changed nonce','supply',
   'packet',null,null,5,'LOT-OPS-1',date '2028-12-31','Synthetic Supplier',10);
  raise exception 'OPS_FAIL: product create changed nonce accepted';
 exception when unique_violation then null;end;
 begin
  perform public.create_branch_inventory_item(
   '22222222-0000-4000-8000-000000000077',gen_random_uuid(),
   'OPS-SUP-001','Duplicate','No','supply','packet',null,null,0,null,null,null,0);
  raise exception 'OPS_FAIL: duplicate global product code accepted';
 exception when unique_violation then null;end;
 begin
  perform public.create_branch_inventory_item(
   '11111111-0000-4000-8000-000000000077',gen_random_uuid(),
   'OPS-WRONG','Cross branch','No','supply','packet',null,null,0,null,null,null,0);
  raise exception 'OPS_FAIL: wrong branch item created';
 exception when insufficient_privilege then null;end;
 begin
  perform public.create_branch_inventory_item(
   '22222222-0000-4000-8000-000000000077',gen_random_uuid(),
   'OPS-BAD-UNIT','Bad unit','No','supply','BAD UNIT',null,null,0,null,null,null,0);
  raise exception 'OPS_FAIL: malformed unit accepted';
 exception when invalid_parameter_value then null;end;
 begin
  perform public.create_branch_inventory_item(
   '22222222-0000-4000-8000-000000000077',gen_random_uuid(),
   'OPS-EXPIRED','Expired','No','supply','packet',null,null,0,'OLD',date '2020-01-01',null,10);
  raise exception 'OPS_FAIL: expired opening accepted';
 exception when check_violation then null;end;
end $item$;
reset role;

do $ledger$
begin
 if (select count(*) from public.medicine_catalog where product_code='OPS-SUP-001' and category='supply')<>1
 or (select count(*) from public.branch_medicine_rules r join public.medicine_catalog m on m.id=r.medicine_id
    where m.product_code='OPS-SUP-001' and r.branch_id='22222222-0000-4000-8000-000000000077')<>1
 or (select count(*) from public.branch_stock_batches b join public.medicine_catalog m on m.id=b.medicine_id
    where m.product_code='OPS-SUP-001' and b.on_hand_units=10)<>1
 or (select count(*) from public.stock_movements where event_id='f1111111-2222-4222-8222-111111111111'
    and event_type='opening' and delta_on_hand=10 and recorded_by='cccccccc-cccc-4ccc-8ccc-cccccccccccc')<>1
 then raise exception 'OPS_FAIL: opening item/ledger cardinality';end if;
 if has_table_privilege('authenticated','public.stock_movements','INSERT')
 or has_table_privilege('authenticated','public.branch_stock_batches','UPDATE')
 or has_table_privilege('authenticated','public.staff_memberships','UPDATE')
 then raise exception 'OPS_FAIL: browser direct data mutations granted';end if;
end $ledger$;
-- Move item ID to a reusable psql variable without trusting browser rows.
select id as ops_item_id from public.medicine_catalog where product_code='OPS-SUP-001' \gset

set role authenticated;
set request.jwt.claim.sub='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"c3333333-aaaa-4aaa-8aaa-333333333333"}';
do $receive$
declare v_item uuid; a jsonb;b jsonb;c jsonb;
begin
 select id into v_item from public.medicine_catalog where product_code='OPS-SUP-001';
 a:=public.receive_branch_inventory_stock(
  '22222222-0000-4000-8000-000000000077',v_item,
  'f2222222-2222-4222-8222-222222222222',
  'LOT-OPS-1',date '2028-12-31','Synthetic Supplier',5);
 b:=public.receive_branch_inventory_stock(
  '22222222-0000-4000-8000-000000000077',v_item,
  'f2222222-2222-4222-8222-222222222222',
  'LOT-OPS-1',date '2028-12-31','Synthetic Supplier',5);
 c:=public.get_branch_inventory_balance('22222222-0000-4000-8000-000000000077',v_item);
 if a is distinct from b or (a->>'lotOnHandUnits')::bigint<>15
  or (c->>'onHandUnits')::bigint<>15
 then raise exception 'OPS_FAIL: receipt idempotency/stock balance';end if;
 begin
  perform public.receive_branch_inventory_stock(
   '22222222-0000-4000-8000-000000000077',v_item,
   'f2222222-2222-4222-8222-222222222222',
   'LOT-OPS-1',date '2028-12-31','Synthetic Supplier',6);
  raise exception 'OPS_FAIL: changed receipt nonce accepted';
 exception when unique_violation then null;end;
 begin
  perform public.receive_branch_inventory_stock(
   '22222222-0000-4000-8000-000000000077',v_item,gen_random_uuid(),
   'LOT-OPS-1',date '2028-12-31',null,-1);
  raise exception 'OPS_FAIL: negative stock receipt accepted';
 exception when invalid_parameter_value then null;end;
 begin
  perform public.receive_branch_inventory_stock(
   '22222222-0000-4000-8000-000000000077',v_item,gen_random_uuid(),
   'LOT-OPS-1',date '2020-01-01',null,1);
  raise exception 'OPS_FAIL: expired stock receipt accepted';
 exception when check_violation then null;end;
 begin
  perform public.receive_branch_inventory_stock(
   '11111111-0000-4000-8000-000000000077',v_item,gen_random_uuid(),
   'LOT-OPS-1',date '2028-12-31',null,1);
  raise exception 'OPS_FAIL: wrong branch receipt accepted';
 exception when insufficient_privilege then null;end;
 a:=public.edit_branch_inventory_item(
   '22222222-0000-4000-8000-000000000077',v_item,1,
   'Sterile Gauze Updated','Branch-only changed description',8,60);
 if (a->>'revision')::integer<>2 then raise exception 'OPS_FAIL: safe edit revision';end if;
 begin
  perform public.edit_branch_inventory_item(
   '22222222-0000-4000-8000-000000000077',v_item,1,
   'Sterile Gauze Stale','Would overwrite current',7,30);
  raise exception 'OPS_FAIL: stale item update accepted';
 exception when serialization_failure then null;end;
end $receive$;
reset role;

-- Explicit failed write inside a transaction must disappear completely.
begin;
set local role authenticated;
set local request.jwt.claim.sub='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
set local request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"c3333333-aaaa-4aaa-8aaa-333333333333"}';
select public.receive_branch_inventory_stock(
 '22222222-0000-4000-8000-000000000077',:'ops_item_id',
 'f3333333-2222-4222-8222-333333333333',
 'LOT-OPS-1',date '2028-12-31','Synthetic Supplier',2);
rollback;
do $rollback_proof$
begin
 if (select on_hand_units from public.branch_stock_batches
  where medicine_id=(select id from public.medicine_catalog where product_code='OPS-SUP-001'))<>15
 or exists(select 1 from public.stock_movements
  where event_id='f3333333-2222-4222-8222-333333333333')
 or exists(select 1 from clinic_private.inventory_write_receipts
  where nonce='f3333333-2222-4222-8222-333333333333')
 then raise exception 'OPS_FAIL: rolled back stock became durable';end if;
end $rollback_proof$;


-- Adversarial transactional denies for a once-authorized branch receptionist.
begin;
update public.staff_memberships set is_active=false
 where user_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
set local role authenticated;
set local request.jwt.claim.sub='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
set local request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"c3333333-aaaa-4aaa-8aaa-333333333333"}';
do $revoked_staff$
begin
 begin
  perform public.receive_branch_inventory_stock(
   '22222222-0000-4000-8000-000000000077',
   (select id from public.medicine_catalog where product_code='OPS-SUP-001'),
   gen_random_uuid(),'LOT-OPS-1',date '2028-12-31','Synthetic Supplier',1);
  raise exception 'OPS_FAIL: revoked receptionist still received stock';
 exception when insufficient_privilege then null;end;
end $revoked_staff$;
rollback;

begin;
update public.medicine_catalog set is_controlled=true where product_code='OPS-SUP-001';
set local role authenticated;
set local request.jwt.claim.sub='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
set local request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"c3333333-aaaa-4aaa-8aaa-333333333333"}';
do $controlled$
begin
 begin
  perform public.receive_branch_inventory_stock(
   '22222222-0000-4000-8000-000000000077',
   (select id from public.medicine_catalog where product_code='OPS-SUP-001'),
   gen_random_uuid(),'LOT-OPS-1',date '2028-12-31','Synthetic Supplier',1);
  raise exception 'OPS_FAIL: controlled product was received without policy';
 exception when insufficient_privilege then null;end;
end $controlled$;
rollback;

begin;
set local role authenticated;
set local request.jwt.claim.sub='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
set local request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"c3333333-aaaa-4aaa-8aaa-333333333333"}';
do $direct_dml$
begin
 begin
  insert into public.branch_stock_batches
   (branch_id,medicine_id,lot_number,received_on,expiry_date)
  values('22222222-0000-4000-8000-000000000077',
   (select id from public.medicine_catalog where product_code='OPS-SUP-001'),
   'FORBIDDEN-DIRECT',current_date,date '2028-12-31');
  raise exception 'OPS_FAIL: direct authenticated batch insert succeeded';
 exception when insufficient_privilege then null;end;
end $direct_dml$;
rollback;

set role authenticated;
set request.jwt.claim.sub='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"c2222222-aaaa-4aaa-8aaa-222222222222"}';
do $revoked$
declare a jsonb;
begin
 a:=public.review_staff_access('bbbbbbbb-6666-4666-8666-bbbbbbbbbbbb','revoke',
   null,null,3,'f4444444-2222-4222-8222-444444444444');
 if a->>'state'<>'revoked' then raise exception 'OPS_FAIL: staff revocation';end if;
end $revoked$;
reset role;
do $final$
begin
 if (select count(*) from public.staff_memberships
    where user_id='bbbbbbbb-6666-4666-8666-bbbbbbbbbbbb' and is_active)<>0
 or (select count(*) from public.staff_branch_memberships
    where user_id='bbbbbbbb-6666-4666-8666-bbbbbbbbbbbb' and is_active)<>0
 or (select count(*) from clinic_private.inventory_write_receipts
    where branch_id='22222222-0000-4000-8000-000000000077')<>2
 or (select count(*) from public.stock_movements s
    join public.medicine_catalog m on m.id=s.medicine_id
    where m.product_code='OPS-SUP-001')<>2
 or (select sum(delta_on_hand) from public.stock_movements s
    join public.medicine_catalog m on m.id=s.medicine_id
    where m.product_code='OPS-SUP-001')<>15
 or (select on_hand_units from public.branch_stock_batches
    where medicine_id=(select id from public.medicine_catalog where product_code='OPS-SUP-001'))<>15
 or (select count(*) from public.pets where species='Dog' and breed='Chow Chow')<>1
 or (select count(*) from public.appointments where id='55555555-5555-4555-8555-555555555555'
    and branch_id is null and status='requested')<>1
 then raise exception 'OPS_FAIL: final audit/stock/history reconciliation';end if;
end $final$;
\echo 'PASS: verified self-request, branch scoped admin approval, accountant isolation, role change/revoke, immutable audit, item opening, receive replay, stale and wrong branch denials, stock conservation, direct writes denied and transaction rollback'
