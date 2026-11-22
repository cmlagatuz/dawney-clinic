-- SOL P2-A: known-existing operational rows, real PG17 RLS SELECT as browser.
-- Run AFTER full #1-#20 and original operational_staff_inventory_pg17.sql.
-- Synthetic provider Auth sessions only. No hosted data or real identities.
\set ON_ERROR_STOP on
-- A second branch's distinct real row/batch/movement provides negative controls.
insert into public.medicine_catalog
 (id,product_code,generic_name,formulation,strength,stock_unit,
  is_active,category,description)
values ('90909090-2222-4222-8222-909090909090','OPS-NAGA-002',
 'Naga synthetic gauze','Roll','N/A','packet',true,'supply','Naga-only branch');
insert into public.branch_medicine_rules(branch_id,medicine_id,branch_description)
values('11111111-0000-4000-8000-000000000077',
 '90909090-2222-4222-8222-909090909090','Naga branch secret');
insert into public.branch_stock_batches
 (id,branch_id,medicine_id,lot_number,received_on,expiry_date,disposition,
  on_hand_units,supplier_name)
values('90909090-3333-4333-8333-909090909090',
 '11111111-0000-4000-8000-000000000077',
 '90909090-2222-4222-8222-909090909090',
 'NAGA-LOT',current_date,date '2028-12-31','released',3,'Naga-only Supplier');
insert into public.stock_movements
 (branch_id,medicine_id,batch_id,event_id,event_type,delta_on_hand,
  after_on_hand,after_reserved,after_quarantined,reason_code,recorded_by)
values('11111111-0000-4000-8000-000000000077',
 '90909090-2222-4222-8222-909090909090',
 '90909090-3333-4333-8333-909090909090',
 '90909090-4444-4444-8444-909090909090',
 'opening',3,3,0,0,'opening_stock',
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd');

-- One genuinely pending request and one live accountant approved by Cavite admin.
insert into auth.users(id,email_confirmed_at,is_anonymous) values
 ('90909090-aaaa-4aaa-8aaa-111111111111',now(),false),
 ('90909090-aaaa-4aaa-8aaa-222222222222',now(),false);
insert into auth.sessions(id,user_id) values
 ('90909090-bbbb-4bbb-8bbb-111111111111','90909090-aaaa-4aaa-8aaa-111111111111'),
 ('90909090-bbbb-4bbb-8bbb-222222222222','90909090-aaaa-4aaa-8aaa-222222222222');

set role authenticated;
set request.jwt.claim.sub='90909090-aaaa-4aaa-8aaa-111111111111';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"90909090-bbbb-4bbb-8bbb-111111111111"}';
select public.request_staff_access('11111111-0000-4000-8000-000000000077','Synthetic pending Naga');
set request.jwt.claim.sub='90909090-aaaa-4aaa-8aaa-222222222222';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"90909090-bbbb-4bbb-8bbb-222222222222"}';
select public.request_staff_access('22222222-0000-4000-8000-000000000077','Synthetic accountant only');
set request.jwt.claim.sub='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"c2222222-aaaa-4aaa-8aaa-222222222222"}';
select public.review_staff_access('90909090-aaaa-4aaa-8aaa-222222222222',
 'approve','accountant',array['22222222-0000-4000-8000-000000000077']::uuid[],
 1,'90909090-5555-4555-8555-909090909090');

do $admin_positive$
declare v_item uuid;
begin
 select id into v_item from public.medicine_catalog where product_code='OPS-SUP-001';
 if (select count(*) from public.staff_access_requests
   where requested_branch_id='22222222-0000-4000-8000-000000000077')<2
 or (select count(*) from public.medicine_catalog where id=v_item)<>1
 or (select count(*) from public.branch_medicine_rules
   where branch_id='22222222-0000-4000-8000-000000000077'
   and medicine_id=v_item and branch_description='Branch-only changed description')<>1
 or (select count(*) from public.branch_stock_batches
   where branch_id='22222222-0000-4000-8000-000000000077'
    and medicine_id=v_item and supplier_name='Synthetic Supplier')<>1
 or (select count(*) from public.stock_movements
   where branch_id='22222222-0000-4000-8000-000000000077' and medicine_id=v_item)<>2
 then raise exception 'P2_A_FAIL: active admin cannot read known Cavite rows';end if;
 if exists(select 1 from public.branch_medicine_rules
   where branch_id='11111111-0000-4000-8000-000000000077')
 or exists(select 1 from public.branch_stock_batches
   where branch_id='11111111-0000-4000-8000-000000000077')
 or exists(select 1 from public.stock_movements
   where branch_id='11111111-0000-4000-8000-000000000077')
 or exists(select 1 from public.staff_access_requests
   where requested_branch_id='11111111-0000-4000-8000-000000000077')
 then raise exception 'P2_A_FAIL: Cavite admin read other branch';end if;
end;
$admin_positive$;
reset role;

-- True committed deletion (not merely a transaction rollback or expired JWT).
delete from auth.sessions where id='c2222222-aaaa-4aaa-8aaa-222222222222';
do $deleted_preflight$
begin
 if exists(select 1 from auth.sessions where id='c2222222-aaaa-4aaa-8aaa-222222222222')
 or (select count(*) from public.staff_access_requests where requested_branch_id='22222222-0000-4000-8000-000000000077')<2
 or (select count(*) from public.stock_movements where branch_id='22222222-0000-4000-8000-000000000077')<2
 then raise exception 'P2_A_FAIL: known protected rows absent or session not deleted';end if;
end $deleted_preflight$;

set role authenticated;
set request.jwt.claim.sub='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"c2222222-aaaa-4aaa-8aaa-222222222222"}';
do $deleted_session_denial$
declare v_item uuid := '90909090-2222-4222-8222-909090909090';
begin
 -- SELECT 0 must mean RLS denied, not an empty fixture: source preflight above.
 if (select count(*) from public.staff_access_requests)<>0
 or (select count(*) from public.medicine_catalog)<>0
 or (select count(*) from public.branch_medicine_rules)<>0
 or (select count(*) from public.branch_stock_batches)<>0
 or (select count(*) from public.stock_movements)<>0
 or exists(select 1 from public.medicine_catalog where category='supply' and description is not null)
 or exists(select 1 from public.branch_medicine_rules where branch_description is not null)
 or exists(select 1 from public.branch_stock_batches where supplier_name is not null)
 then raise exception 'P2_A_FAIL: deleted-session direct table SELECT leaked operational metadata';end if;
 begin
  perform public.list_staff_access_requests('22222222-0000-4000-8000-000000000077');
  raise exception 'P2_A_FAIL: deleted-session operational staff RPC succeeded';
 exception when insufficient_privilege then null;end;
 begin
  perform public.get_branch_inventory_balance(
   '22222222-0000-4000-8000-000000000077',v_item);
  raise exception 'P2_A_FAIL: deleted-session balance RPC succeeded';
 exception when insufficient_privilege then null;end;
end;
$deleted_session_denial$;
reset role;

-- Recreate ONLY the disposable CI session so restored nonce replay is testable.
insert into auth.sessions(id,user_id) values
 ('c2222222-aaaa-4aaa-8aaa-222222222222','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');

-- Independent active receptionist C still reads the Cavite stock, not Naga.
set role authenticated;
set request.jwt.claim.sub='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"c3333333-aaaa-4aaa-8aaa-333333333333"}';
do $cavite_read$
begin
 if (select count(*) from public.medicine_catalog where product_code='OPS-SUP-001')<>1
 or (select count(*) from public.branch_stock_batches
   where branch_id='22222222-0000-4000-8000-000000000077')<>1
 or exists(select 1 from public.stock_movements
   where branch_id='11111111-0000-4000-8000-000000000077')
 then raise exception 'P2_A_FAIL: independent receptionist branch scope changed';end if;
end $cavite_read$;
reset role;

-- Naga veterinarian D can see its own branch stock but no Cavite stock.
set role authenticated;
set request.jwt.claim.sub='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"c4444444-aaaa-4aaa-8aaa-444444444444"}';
do $naga_read$
begin
 if (select count(*) from public.branch_medicine_rules
   where branch_id='11111111-0000-4000-8000-000000000077')<>1
 or (select count(*) from public.branch_stock_batches
   where branch_id='11111111-0000-4000-8000-000000000077')<>1
 or (select count(*) from public.stock_movements
   where branch_id='11111111-0000-4000-8000-000000000077')<>1
 or exists(select 1 from public.stock_movements
   where branch_id='22222222-0000-4000-8000-000000000077')
 then raise exception 'P2_A_FAIL: Naga branch visibility or cross-branch isolation';end if;
end $naga_read$;
reset role;

-- Accountant cannot gain operational metadata or mutations through role alias.
set role authenticated;
set request.jwt.claim.sub='90909090-aaaa-4aaa-8aaa-222222222222';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"90909090-bbbb-4bbb-8bbb-222222222222"}';
do $accountant_negative$
begin
 if (select count(*) from public.medicine_catalog)<>0
 or (select count(*) from public.branch_stock_batches)<>0
 or (select count(*) from public.stock_movements)<>0
 then raise exception 'P2_A_FAIL: accountant has inventory branch visibility';end if;
 begin
  perform public.get_branch_inventory_balance('22222222-0000-4000-8000-000000000077',
   (select id from public.medicine_catalog where product_code='OPS-SUP-001'));
  raise exception 'P2_A_FAIL: accountant balance RPC accepted';
 exception when insufficient_privilege then null;end;
end $accountant_negative$;
reset role;

-- Structural assertions; deny cost, service metadata and unsafe direct DML.
do $rls_matrix$
declare x record;
begin
 for x in select unnest(array['staff_access_requests','medicine_catalog',
  'branch_medicine_rules','branch_stock_batches','stock_movements']) t loop
  if not exists(select 1 from pg_policies
     where schemaname='public' and tablename=x.t
       and permissive='RESTRICTIVE' and cmd='SELECT'
       and policyname='operational_live_session_'||
         case x.t when 'staff_access_requests' then 'staff_requests'
          when 'medicine_catalog' then 'catalog'
          when 'branch_medicine_rules' then 'branch_rules'
          when 'branch_stock_batches' then 'stock_batches' else 'movements' end)
  or not exists(select 1 from pg_class where oid=('public.'||x.t)::regclass and relrowsecurity)
  then raise exception 'P2_A_FAIL: required RLS guard disabled on %',x.t;end if;
 end loop;
 if has_table_privilege('authenticated','auth.sessions','SELECT')
 or has_table_privilege('authenticated','clinic_private.inventory_write_receipts','SELECT')
 or has_column_privilege('authenticated','public.branch_stock_batches','unit_cost_minor','SELECT')
 or has_column_privilege('authenticated','public.branch_stock_batches','currency_code','SELECT')
 or has_table_privilege('authenticated','public.stock_movements','INSERT')
 or has_table_privilege('authenticated','public.staff_access_requests','INSERT')
 or has_function_privilege('anon','clinic_private.operational_read_session_live()','EXECUTE')
 or not has_function_privilege('authenticated','clinic_private.operational_read_session_live()','EXECUTE')
 then raise exception 'P2_A_FAIL: Auth/ledger/cost grants widened';end if;
end $rls_matrix$;
\echo 'PASS: known-existing direct SELECT before/after deleted session, separate branches, accountant denial, RPC denial and ACL integrity'
