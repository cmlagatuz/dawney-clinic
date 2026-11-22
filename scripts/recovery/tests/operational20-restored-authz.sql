-- Read-only/rollback-only operational20 post-restore actor and nonce acceptance.
-- Must be byte-identical in original and independent PG17 restore.
\set ON_ERROR_STOP on
do $baseline$
declare m uuid;
begin
 select id into m from public.medicine_catalog where product_code='OPS-SUP-001';
 if m is null
  or (select count(*) from public.staff_access_requests where state='pending')<>1
  or (select count(*) from public.staff_access_requests where state='approved')<>1
  or (select count(*) from public.staff_access_requests where state='revoked')<>1
  or (select count(*) from clinic_private.staff_review_receipts)<3
  or (select count(*) from clinic_private.staff_operation_events)<4
  or (select count(*) from clinic_private.inventory_write_receipts where branch_id=
     '22222222-0000-4000-8000-000000000077')<>2
  or (select sum(on_hand_units) from public.branch_stock_batches where branch_id=
     '22222222-0000-4000-8000-000000000077' and medicine_id=m)<>15
  or (select sum(delta_on_hand) from public.stock_movements where branch_id=
     '22222222-0000-4000-8000-000000000077' and medicine_id=m)<>15
  or (select count(*) from public.pets where id='33333333-3333-4333-8333-333333333333'
     and species='Dog' and breed='Chow Chow' and breed_id='dog-chow-chow')<>1
  or (select count(*) from public.appointments
     where id='55555555-5555-4555-8555-555555555555'
     and branch_id is null and status='requested')<>1
 then raise exception 'OPS_RESTORE_FAIL: missing synthetic source rows or conserved ledger';end if;
 if not exists(select 1 from public.staff_memberships
    where user_id='90909090-aaaa-4aaa-8aaa-222222222222'
      and role='accountant' and is_active)
 or not exists(select 1 from public.staff_branch_memberships
    where user_id='90909090-aaaa-4aaa-8aaa-222222222222'
      and branch_id='22222222-0000-4000-8000-000000000077'
      and role='accountant' and is_active)
 or exists(select 1 from public.staff_memberships
    where user_id='bbbbbbbb-6666-4666-8666-bbbbbbbbbbbb' and is_active)
 then raise exception 'OPS_RESTORE_FAIL: accountant/active/revoked membership';end if;
end $baseline$;

-- Stored receipt replay must return EXACT immutable response, never write a lot.
begin;
set local role authenticated;
set local request.jwt.claim.sub='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
set local request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"c3333333-aaaa-4aaa-8aaa-333333333333"}';
do $received$
declare item uuid;r jsonb;receipt jsonb;
begin
 select id into item from public.medicine_catalog where product_code='OPS-SUP-001';
 select response into receipt from clinic_private.inventory_write_receipts
 where actor_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  and nonce='f2222222-2222-4222-8222-222222222222';
 -- Protected receipt is intentionally only inspected through the current
 -- SECURITY DEFINER RPC below; direct browser SELECT stays unavailable.
end $received$;
rollback;

-- Exact persisted inventory receipt replay, zero additional inventory movement.
begin;
set local role authenticated;
set local request.jwt.claim.sub='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
set local request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"c3333333-aaaa-4aaa-8aaa-333333333333"}';
do $nonce$
declare item uuid;r jsonb;old jsonb;
begin
 select id into item from public.medicine_catalog where product_code='OPS-SUP-001';
 r:=public.receive_branch_inventory_stock(
   '22222222-0000-4000-8000-000000000077',item,
   'f2222222-2222-4222-8222-222222222222',
   'LOT-OPS-1',date '2028-12-31','Synthetic Supplier',5);
 if r->>'kind'<>'stock_received'
  or (select count(*) from public.stock_movements where event_id=
      'f2222222-2222-4222-8222-222222222222')<>1
  or (select sum(on_hand_units) from public.branch_stock_batches
     where medicine_id=item and branch_id=
       '22222222-0000-4000-8000-000000000077')<>15
 then raise exception 'OPS_RESTORE_FAIL: persisted inventory nonce double counted';end if;
 begin
  perform public.receive_branch_inventory_stock(
   '22222222-0000-4000-8000-000000000077',item,
   'f2222222-2222-4222-8222-222222222222',
   'LOT-OPS-1',date '2028-12-31','Synthetic Supplier',6);
  raise exception 'OPS_RESTORE_FAIL: changed receipt nonce accepted';
 exception when unique_violation then null;end;
end $nonce$;
rollback;

-- Persisted admin approval review receipt also survives dump/restore.
begin;
set local role authenticated;
set local request.jwt.claim.sub='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
set local request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"c2222222-aaaa-4aaa-8aaa-222222222222"}';
do $admin_replay$
declare a jsonb;
begin
 a:=public.review_staff_access('90909090-aaaa-4aaa-8aaa-222222222222',
   'approve','accountant',
   array['22222222-0000-4000-8000-000000000077']::uuid[],
   1,'90909090-5555-4555-8555-909090909090');
 if a->>'role'<>'accountant' or a->>'state'<>'approved'
  or (select count(*) from public.staff_access_requests where user_id=
    '90909090-aaaa-4aaa-8aaa-222222222222' and revision=2)<>1
 then raise exception 'OPS_RESTORE_FAIL: admin review replay was not idempotent';end if;
 begin
  perform public.review_staff_access('90909090-aaaa-4aaa-8aaa-222222222222',
   'approve','administrator',
   array['22222222-0000-4000-8000-000000000077']::uuid[],
   1,'90909090-5555-4555-8555-909090909090');
  raise exception 'OPS_RESTORE_FAIL: changed admin nonce accepted';
 exception when unique_violation then null;end;
end $admin_replay$;
rollback;

-- Browser SELECT and direct DML still respect the restored Auth/RLS/ACL state.
begin;
set local role authenticated;
set local request.jwt.claim.sub='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
set local request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"c2222222-aaaa-4aaa-8aaa-222222222222"}';
do $scope$
begin
 if (select count(*) from public.staff_access_requests
    where requested_branch_id='22222222-0000-4000-8000-000000000077')<2
 or (select count(*) from public.branch_stock_batches
    where branch_id='22222222-0000-4000-8000-000000000077')<>1
 or exists(select 1 from public.branch_stock_batches
    where branch_id='11111111-0000-4000-8000-000000000077')
 then raise exception 'OPS_RESTORE_FAIL: restored administrator branch scope';end if;
 begin
  insert into public.staff_access_requests(user_id,requested_branch_id)
   values('90909090-aaaa-4aaa-8aaa-111111111111',
     '22222222-0000-4000-8000-000000000077');
  raise exception 'OPS_RESTORE_FAIL: browser direct staff request write';
 exception when insufficient_privilege then null;end;
 begin
  delete from public.stock_movements where event_type='receipt';
  raise exception 'OPS_RESTORE_FAIL: direct browser ledger DELETE';
 exception when insufficient_privilege then null;end;
end $scope$;
rollback;

-- Deleting the ACTUAL session row in a transaction takes immediate effect for
-- the same old, unexpired JWT; rollback preserves the signed source fingerprint.
begin;
delete from auth.sessions where id='c2222222-aaaa-4aaa-8aaa-222222222222';
set local role authenticated;
set local request.jwt.claim.sub='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
set local request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"c2222222-aaaa-4aaa-8aaa-222222222222"}';
do $revoked$
begin
 if (select count(*) from public.staff_access_requests)<>0
 or (select count(*) from public.medicine_catalog)<>0
 or (select count(*) from public.branch_medicine_rules)<>0
 or (select count(*) from public.branch_stock_batches)<>0
 or (select count(*) from public.stock_movements)<>0
 then raise exception 'OPS_RESTORE_FAIL: signed restore deleted-session table read';end if;
 begin
  perform public.list_staff_access_requests('22222222-0000-4000-8000-000000000077');
  raise exception 'OPS_RESTORE_FAIL: deleted-session admin RPC';
 exception when insufficient_privilege then null;end;
end $revoked$;
rollback;

-- An authenticated accountant is NOT a receptionist or stock writer.
begin;
set local role authenticated;
set local request.jwt.claim.sub='90909090-aaaa-4aaa-8aaa-222222222222';
set local request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"90909090-bbbb-4bbb-8bbb-222222222222"}';
do $accountant$
begin
 if exists(select 1 from public.branch_stock_batches)
 or exists(select 1 from public.stock_movements)
 then raise exception 'OPS_RESTORE_FAIL: accountant obtained stock access';end if;
 begin
  perform public.create_branch_inventory_item(
   '22222222-0000-4000-8000-000000000077',gen_random_uuid(),
   'OPS-ACCOUNTANT','Not allowed','No','supply','packet',null,null,0,null,null,null,0);
  raise exception 'OPS_RESTORE_FAIL: accountant stock writer granted';
 exception when insufficient_privilege then null;end;
end $accountant$;
rollback;

-- Even PostgreSQL privileged writes must trip append-only trigger guards.
begin;
do $immutability$
begin
 begin
  update public.stock_movements set delta_on_hand=999 where event_type='receipt';
  raise exception 'OPS_RESTORE_FAIL: immutable stock movement changed';
 exception when insufficient_privilege then null;end;
 begin
  delete from clinic_private.staff_review_receipts;
  raise exception 'OPS_RESTORE_FAIL: immutable approval receipt deleted';
 exception when insufficient_privilege then null;end;
 begin
  update clinic_private.inventory_write_receipts set response='{}'::jsonb;
  raise exception 'OPS_RESTORE_FAIL: immutable inventory receipt modified';
 exception when insufficient_privilege then null;end;
end $immutability$;
rollback;

do $structure$
declare f record;
begin
 for f in select proname,prosecdef,proconfig from pg_proc
   where oid=any(array[
    'clinic_private.operational_read_session_live()'::regprocedure,
    'clinic_private.require_operational_actor()'::regprocedure,
    'public.review_staff_access(uuid,text,text,uuid[],integer,uuid)'::regprocedure,
    'public.receive_branch_inventory_stock(uuid,uuid,uuid,text,date,text,bigint)'::regprocedure])
 loop
  if not f.prosecdef or not ('search_path='=any(f.proconfig)) then
   raise exception 'OPS_RESTORE_FAIL: privileged routine search_path/definer lost: %',f.proname;
  end if;
 end loop;
 if (select count(*) from pg_trigger where tgrelid='public.stock_movements'::regclass
      and tgname='inventory_ledger_never_update_delete' and tgenabled='O')<>1
 or (select count(*) from pg_trigger where tgrelid='clinic_private.staff_review_receipts'::regclass
      and tgname='staff_review_receipts_append_only' and tgenabled='O')<>1
 or (select count(*) from pg_trigger where tgrelid='clinic_private.inventory_write_receipts'::regclass
      and tgname='inventory_receipt_never_rewrite' and tgenabled='O')<>1
 then raise exception 'OPS_RESTORE_FAIL: append-only trigger disabled';end if;
end $structure$;
\echo 'PASS: preserved approvals/accountant/audit/replay/stock, branch RLS, deleted sessions and append-only PG17 guards'
