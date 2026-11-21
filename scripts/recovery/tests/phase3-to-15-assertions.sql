-- After signed PR49 five-component restore + exact 11 and proposed #12-15.
-- Synthetic-only PostgreSQL17, no live service or patient records. All fixture
-- stock, branch membership and stored-timezone changes ROLLBACK.
\set ON_ERROR_STOP on
do $pre$
begin
 if (select count(*) from public.clinic_branches)<>2 or
    (select count(*) from auth.users)<>5 or
    (select count(*) from auth.identities)<>5 or
    (select count(*) from public.pets)<>2 or
    (select count(*) from public.appointments)<>1 or
    (select count(*) from storage.objects)<>2 or
    (select count(*) from public.staff_branch_memberships)<>0 or
    (select count(*) from public.medicine_catalog)<>0 then
    raise exception 'RECOVERY15_FAIL: restored or unseeded branch baseline changed';
 end if;
 if not exists(select 1 from public.pets where
     id='33333333-3333-4333-8333-333333333333'
     and species='Dog' and breed='Chow Chow'
     and species_id='dog' and breed_id='dog-chow-chow')
 or not exists(select 1 from public.appointments where
     id='55555555-5555-4555-8555-555555555555'
     and branch_id is null and status='requested'
     and service_id is null and request_nonce is null)
 or exists(select 1 from public.clinic_branches where booking_enabled)
 or exists(select 1 from public.branch_booking_policies where is_approved) then
    raise exception 'RECOVERY15_FAIL: historic Chow Chow, requested visit or disabled booking altered';
 end if;
 if (select count(*) from storage.buckets where id='clinical-attachments' and public=false)<>1
 or has_column_privilege('authenticated','public.branch_stock_batches','unit_cost_minor','SELECT')
 or has_column_privilege('authenticated','public.branch_stock_batches','currency_code','SELECT')
 or has_table_privilege('authenticated','public.branch_stock_batches','INSERT')
 or has_table_privilege('authenticated','public.branch_stock_batches','UPDATE')
 or has_table_privilege('authenticated','public.branch_stock_batches','DELETE')
 or has_table_privilege('anon','public.branch_stock_batches','SELECT') then
    raise exception 'RECOVERY15_FAIL: private Storage, inventory cost or write-only denials altered';
 end if;
end $pre$;
begin;
-- Two *restored* identity states drive the post-migration branch test.
insert into public.staff_branch_memberships(user_id,branch_id,role,is_active)
values
('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-0000-4000-8000-000000000077','receptionist',true),
('dddddddd-dddd-4ddd-8ddd-dddddddddddd','22222222-0000-4000-8000-000000000077','veterinarian',true);
update public.clinic_branches set timezone='Pacific/Kiritimati'
 where id='22222222-0000-4000-8000-000000000077';
insert into public.medicine_catalog
 (id,product_code,generic_name,formulation,strength,stock_unit,minimum_shelf_life_days)
values
('a0000078-0000-4000-8000-000000000001','REC-A','Recovery synthetic A','synthetic vial','1 mg','vial',0),
('a0000078-0000-4000-8000-000000000002','REC-B','Recovery synthetic B','synthetic vial','2 mg','vial',0),
('a0000078-0000-4000-8000-000000000003','REC-C','Recovery synthetic C','synthetic vial','3 mg','vial',0);
-- Catalog defaults to INACTIVE. Enable ONLY disposable test products, inside ROLLBACK.
update public.medicine_catalog set is_active=true where product_code in ('REC-A','REC-B','REC-C');
insert into public.branch_medicine_rules(branch_id,medicine_id,reorder_point_units,expiry_warning_days)
values
('11111111-0000-4000-8000-000000000077','a0000078-0000-4000-8000-000000000001',2,30),
('11111111-0000-4000-8000-000000000077','a0000078-0000-4000-8000-000000000002',2,60),
('11111111-0000-4000-8000-000000000077','a0000078-0000-4000-8000-000000000003',2,90),
('22222222-0000-4000-8000-000000000077','a0000078-0000-4000-8000-000000000001',2,30);
do $seed$
declare n date; c date;
begin
 select (transaction_timestamp() at time zone timezone)::date into n
 from public.clinic_branches where slug='naga';
 select (transaction_timestamp() at time zone timezone)::date into c
 from public.clinic_branches where slug='cavite';
 if n is null or c is null then raise exception 'RECOVERY15_FAIL: branch zone missing';end if;
 insert into public.branch_stock_batches
 (branch_id,medicine_id,lot_number,received_on,expiry_date,disposition,on_hand_units)
 values
 ('11111111-0000-4000-8000-000000000077','a0000078-0000-4000-8000-000000000001','N-EXPIRED',n-40,n-1,'released',1),
 ('11111111-0000-4000-8000-000000000077','a0000078-0000-4000-8000-000000000001','N-TODAY',n-40,n,'released',1),
 ('11111111-0000-4000-8000-000000000077','a0000078-0000-4000-8000-000000000001','N-TOMORROW',n-40,n+1,'released',1),
 ('11111111-0000-4000-8000-000000000077','a0000078-0000-4000-8000-000000000001','N-30',n-40,n+30,'released',1),
 ('11111111-0000-4000-8000-000000000077','a0000078-0000-4000-8000-000000000001','N-31',n-40,n+31,'released',1),
 ('11111111-0000-4000-8000-000000000077','a0000078-0000-4000-8000-000000000002','N-60',n-40,n+60,'released',1),
 ('11111111-0000-4000-8000-000000000077','a0000078-0000-4000-8000-000000000002','N-61',n-40,n+61,'released',1),
 ('11111111-0000-4000-8000-000000000077','a0000078-0000-4000-8000-000000000003','N-90',n-40,n+90,'released',1),
 ('11111111-0000-4000-8000-000000000077','a0000078-0000-4000-8000-000000000003','N-91',n-40,n+91,'released',1),
 ('22222222-0000-4000-8000-000000000077','a0000078-0000-4000-8000-000000000001','C-TODAY',c-40,c,'released',1),
 ('22222222-0000-4000-8000-000000000077','a0000078-0000-4000-8000-000000000001','C-TOMORROW',c-40,c+1,'released',1);
end $seed$;
set local role authenticated;
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true);
select set_config('request.jwt.claims','{"role":"authenticated","is_anonymous":false}',true);
do $naga$
declare z text; fefo jsonb; a jsonb; baseline_fefo jsonb; baseline_alerts jsonb; rec record; bad boolean;
begin
 foreach z in array array['UTC','Asia/Manila','Pacific/Kiritimati',
  'Pacific/Honolulu','America/Los_Angeles','Europe/London','Asia/Tokyo'] loop
  perform set_config('TimeZone',z,true);
  if public.assert_staff_branch('11111111-0000-4000-8000-000000000077') is null then
    raise exception 'RECOVERY15_FAIL: valid Naga role denied';
  end if;
  select coalesce(jsonb_agg(f.lot_number order by f.expiry_date,f.lot_number),'[]'::jsonb)
  into fefo from public.list_branch_medicine_fefo(
   '11111111-0000-4000-8000-000000000077',
   'a0000078-0000-4000-8000-000000000001') f;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.product_code),'[]'::jsonb)
   into a from public.list_branch_medicine_alerts('11111111-0000-4000-8000-000000000077') x;
  if fefo<> '["N-TOMORROW","N-30","N-31"]'::jsonb then
   raise exception 'RECOVERY15_FAIL: Naga FEFO expiry/sort wrong under %: %',z,fefo;
  end if;
  if baseline_fefo is null then baseline_fefo:=fefo;baseline_alerts:=a;
  elsif fefo is distinct from baseline_fefo or a is distinct from baseline_alerts then
   raise exception 'RECOVERY15_FAIL: client session zone changed Naga FEFO/alerts %',z;
  end if;
  select * into rec from public.list_branch_medicine_alerts('11111111-0000-4000-8000-000000000077')
    where product_code='REC-A';
  if rec.near_expiry_batches<>2 or rec.expired_batches<>2 or rec.available_units<>3
    or rec.expiry_warning_days<>30 then
     raise exception 'RECOVERY15_FAIL: Naga 30 inclusive bounds: %',to_jsonb(rec);
  end if;
  select * into rec from public.list_branch_medicine_alerts('11111111-0000-4000-8000-000000000077')
    where product_code='REC-B';
  if rec.near_expiry_batches<>1 or rec.available_units<>2 or rec.expiry_warning_days<>60 then
     raise exception 'RECOVERY15_FAIL: Naga 60 inclusive bounds';
  end if;
  select * into rec from public.list_branch_medicine_alerts('11111111-0000-4000-8000-000000000077')
    where product_code='REC-C';
  if rec.near_expiry_batches<>1 or rec.available_units<>2 or rec.expiry_warning_days<>90 then
     raise exception 'RECOVERY15_FAIL: Naga 90 inclusive bounds';
  end if;
  if (select count(*) from public.branch_stock_batches
      where branch_id='22222222-0000-4000-8000-000000000077')<>0 then
    raise exception 'RECOVERY15_FAIL: Naga staff saw Cavite inventory rows';
  end if;
  bad:=false;
  begin
   perform 1 from public.list_branch_medicine_fefo(
    '22222222-0000-4000-8000-000000000077',
    'a0000078-0000-4000-8000-000000000001');
  exception when insufficient_privilege then bad:=true; end;
  if not bad then raise exception 'RECOVERY15_FAIL: Naga staff entered Cavite RPC';end if;
 end loop;
end $naga$;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
do $owner$
declare rejected boolean:=false;
begin
 if (select count(*) from public.branch_stock_batches)<>0
 or (select count(*) from public.appointments where branch_id is not null)<>0 then
 raise exception 'RECOVERY15_FAIL: owner accessed branch inventory or invented visit attribution';
 end if;
 begin
  perform 1 from public.list_branch_medicine_alerts('11111111-0000-4000-8000-000000000077');
 exception when insufficient_privilege then rejected:=true;end;
 if not rejected then raise exception 'RECOVERY15_FAIL: owner accessed staff inventory RPC';end if;
end $owner$;
select set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',true);
do $revoked$
declare rejected boolean:=false;
begin
 begin
  perform 1 from public.list_branch_medicine_alerts('22222222-0000-4000-8000-000000000077');
 exception when insufficient_privilege then rejected:=true; end;
 if not rejected then raise exception 'RECOVERY15_FAIL: globally revoked staff entered Cavite RPC';end if;
end $revoked$;
select set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',true);
select set_config('request.jwt.claims','{"role":"authenticated","is_anonymous":true}',true);
do $anonymous$
declare rejected boolean:=false;
begin
 begin
  perform 1 from public.list_branch_medicine_alerts('11111111-0000-4000-8000-000000000077');
 exception when insufficient_privilege then rejected:=true;end;
 if not rejected then raise exception 'RECOVERY15_FAIL: anonymous Auth entered staff inventory RPC';end if;
end $anonymous$;
reset role;
-- Activate only the formerly revoked synthetic staff *within rollback* to
-- prove Cavite positive access is tied to matching fresh GLOBAL+BRANCH state.
update public.staff_memberships set is_active=true
 where user_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
set local role authenticated;
select set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',true);
select set_config('request.jwt.claims','{"role":"authenticated","is_anonymous":false}',true);
do $cavite$
declare z text; fefo jsonb; a jsonb; basefefo jsonb; basealerts jsonb; rec record; rejected boolean;
begin
 foreach z in array array['UTC','Asia/Manila','Pacific/Honolulu','Pacific/Kiritimati','Asia/Tokyo'] loop
  perform set_config('TimeZone',z,true);
  select coalesce(jsonb_agg(f.lot_number order by f.expiry_date,f.lot_number),'[]'::jsonb)
    into fefo from public.list_branch_medicine_fefo(
    '22222222-0000-4000-8000-000000000077',
    'a0000078-0000-4000-8000-000000000001') f;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.product_code),'[]'::jsonb)
    into a from public.list_branch_medicine_alerts('22222222-0000-4000-8000-000000000077') x;
  if fefo<>'["C-TOMORROW"]'::jsonb then
   raise exception 'RECOVERY15_FAIL: Cavite FEFO expiry under %: %',z,fefo;
  end if;
  if basefefo is null then basefefo:=fefo;basealerts:=a;
  elsif basefefo is distinct from fefo or basealerts is distinct from a then
   raise exception 'RECOVERY15_FAIL: session zone changed Cavite expiry result';
  end if;
  select * into rec from public.list_branch_medicine_alerts('22222222-0000-4000-8000-000000000077')
    where product_code='REC-A';
  if rec.expired_batches<>1 or rec.near_expiry_batches<>1 or rec.available_units<>1 then
   raise exception 'RECOVERY15_FAIL: Cavite local date rules wrong under %',z;
  end if;
  if (select count(*) from public.branch_stock_batches where
    branch_id='11111111-0000-4000-8000-000000000077')<>0 then
   raise exception 'RECOVERY15_FAIL: Cavite staff saw Naga inventory rows';
  end if;
  rejected:=false;
  begin
   perform 1 from public.list_branch_medicine_fefo(
    '11111111-0000-4000-8000-000000000077',
    'a0000078-0000-4000-8000-000000000001');
  exception when insufficient_privilege then rejected:=true;end;
  if not rejected then raise exception 'RECOVERY15_FAIL: Cavite staff entered Naga RPC';end if;
 end loop;
end $cavite$;
rollback;
do $post$
begin
 if (select count(*) from public.staff_branch_memberships)<>0
 or (select count(*) from public.medicine_catalog)<>0
 or (select count(*) from public.stock_movements)<>0
 or (select timezone from public.clinic_branches where slug='cavite')<>'Asia/Manila'
 or (select is_active from public.staff_memberships
    where user_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd')
 or (select count(*) from public.appointments
    where id='55555555-5555-4555-8555-555555555555'
     and branch_id is null and status='requested')<>1
 or (select count(*) from storage.objects)<>2 then
   raise exception 'RECOVERY15_FAIL: temporary stock/roles/timezone or historic objects leaked';
 end if;
end $post$;
\echo 'PASS: RECOVERY15 actual restored identity RLS, Naga/Cavite isolation, 30/60/90, seven+five session TimeZones, FEFO expiry and rollback; original Chow Chow and private Storage unchanged'
