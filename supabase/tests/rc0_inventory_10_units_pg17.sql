-- RC0 combined exact-tree disposable PG17: ADD zero-opening item then RECEIVE 10,
-- identical nonce retry, changed nonce payload denial, authoritative ledger,
-- and no durable changes outside the rollback-only synthetic transaction.
\set ON_ERROR_STOP on
begin;
set local role authenticated;
set local request.jwt.claim.sub='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
set local request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"c3333333-aaaa-4aaa-8aaa-333333333333"}';
do $rc0_ten$
declare b uuid:='22222222-0000-4000-8000-000000000077';
 n uuid:='baaaaaaa-2222-4222-8222-aaaaaaaaaaaa';
 m uuid:='baaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
 x jsonb;y jsonb;z jsonb;balance jsonb;item uuid;
begin
 x:=public.create_branch_inventory_item(
  b,m,'RC0-TEN-001','RC0 Sterile Pads','Synthetic 10-unit rollback','supply',
  'packet',null,null,0,null,null,null,0);
 item:=(x->>'itemId')::uuid;
 if x->>'kind'<>'inventory_item' or (x->>'onHandUnits')::integer<>0 or x->'batchId'<>'null'::jsonb
 then raise exception 'RC0_TEN_FAIL: no-stock item creation response';end if;
 y:=public.receive_branch_inventory_stock(
  b,item,n,'LOT-RC0-TEN',date '2028-12-31','Synthetic Supplier',10);
 z:=public.receive_branch_inventory_stock(
  b,item,n,'LOT-RC0-TEN',date '2028-12-31','Synthetic Supplier',10);
 balance:=public.get_branch_inventory_balance(b,item);
 if y is distinct from z or y->>'kind'<>'stock_received'
 or (y->>'receivedUnits')::integer<>10 or (balance->>'onHandUnits')::integer<>10
 or (select count(*) from public.stock_movements s
    where s.event_id=n and s.event_type='receipt' and s.delta_on_hand=10)<>1
 or (select count(*) from clinic_private.inventory_write_receipts where nonce=n)<>1
 or (select count(*) from public.branch_stock_batches
    where medicine_id=item and branch_id=b and on_hand_units=10
      and supplier_name='Synthetic Supplier')<>1
 then raise exception 'RC0_TEN_FAIL: receive 10 / replay / ledger / authoritative balance';end if;
 begin
  perform public.receive_branch_inventory_stock(
   b,item,n,'LOT-RC0-TEN',date '2028-12-31','Synthetic Supplier',11);
  raise exception 'RC0_TEN_FAIL: changed nonce payload accepted';
 exception when unique_violation then null;end;
 begin
  perform public.receive_branch_inventory_stock(
   '11111111-0000-4000-8000-000000000077',item,gen_random_uuid(),
   'LOT-RC0-TEN',date '2028-12-31','Synthetic Supplier',1);
  raise exception 'RC0_TEN_FAIL: cross-branch receipt allowed';
 exception when insufficient_privilege then null;end;
end;
$rc0_ten$;
rollback;
do $no_leak$
begin
 if exists(select 1 from public.medicine_catalog where product_code='RC0-TEN-001')
 or exists(select 1 from public.stock_movements
  where event_id='baaaaaaa-2222-4222-8222-aaaaaaaaaaaa')
 or exists(select 1 from clinic_private.inventory_write_receipts
  where nonce='baaaaaaa-2222-4222-8222-aaaaaaaaaaaa')
 then raise exception 'RC0_TEN_FAIL: rollback did not remove synthetic rows';end if;
end $no_leak$;
\echo 'PASS: RC0 Add Item zero opening, Receive 10 units, same nonce no double balance, changed payload and cross-branch rejected; rollback clean'
