-- FULL-TREE SYNTHETIC SECURITY GATE: disposable PostgreSQL 17 only.
-- Six real Phase2/3 + four Phase4 migrations must already be installed.
-- No production/staging writes; this entire approved-policy fixture is ROLLED BACK.
begin;

do $preflight$
begin
 if (select count(*) from public.clinic_services)<>0 or
    (select count(*) from public.clinic_booking_policy where is_approved)<>0 or
    (select count(*) from public.appointments)<>0 or
    not exists (select 1 from public.clinic_booking_policy where policy_id=1
      and is_approved=false and timezone='Asia/Manila')
 then raise exception 'FULL_TREE_FAIL: clinical services/hours must start UNAPPROVED and empty';end if;
 if to_regprocedure('public.request_service_appointment(uuid,uuid,uuid,timestamptz,uuid,text,text)') is null
    or not (select relrowsecurity from pg_class where oid='public.appointments'::regclass)
    or has_function_privilege('anon','public.request_service_appointment(uuid,uuid,uuid,timestamptz,uuid,text,text)','EXECUTE')
 then raise exception 'FULL_TREE_FAIL: unsafe booking function/RLS/anon permissions';end if;
end $preflight$;

insert into auth.users(id,email_confirmed_at,is_anonymous) values
 ('11111111-1111-4111-8111-111111111111',now(),false),
 ('22222222-2222-4222-8222-222222222222',now(),false),
 ('33333333-3333-4333-8333-333333333333',now(),false),
 ('44444444-4444-4444-8444-444444444444',now(),false);
insert into public.owners(id,user_id,first_name,last_name) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Synthetic','A'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','Synthetic','B');
insert into public.pets(id,owner_id,name,species) values
 ('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Full Gate A','Dog'),
 ('bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Full Gate B','Dog');
insert into public.staff_memberships(user_id,role,is_active) values
 ('33333333-3333-4333-8333-333333333333','veterinarian',true),
 ('44444444-4444-4444-8444-444444444444','veterinarian',false);
insert into public.appointment_resources(id,name) values
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','Full Tree disposable resource');

update public.species_catalog set clinic_supported=true where id='dog';
insert into public.clinic_services(id,slug,display_name,duration_minutes,is_active,
 owner_approved_at,owner_approved_by,published_at)
values('dddddddd-dddd-4ddd-8ddd-dddddddddddd','ci-only-fully-approved-service',
 'SYNTHETIC FULL-TREE ONLY',30,true,now(),
 '33333333-3333-4333-8333-333333333333',now());
insert into public.clinic_service_species(service_id,species_id)
values('dddddddd-dddd-4ddd-8ddd-dddddddddddd','dog');
insert into public.clinic_service_resources(service_id,resource_id,capacity)
values('dddddddd-dddd-4ddd-8ddd-dddddddddddd',
 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',1);

update public.clinic_booking_policy set
 weekly_hours='{"sun":[],"mon":[{"open":"09:00","close":"17:00"}],
 "tue":[],"wed":[],"thu":[],"fri":[],"sat":[]}'::jsonb,
 lead_minutes=0,max_advance_days=30,slot_step_minutes=30,
 approved_at=now(),approved_by='33333333-3333-4333-8333-333333333333',
 is_approved=true,revision=revision+1 where policy_id=1;

-- A signed-in owner must NOT insert a legacy service-less booking once policy
-- is approved, even in a valid published time and even with a forged nonce.
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","is_anonymous":false}',true);
do $mandatory_no_bypass$
declare slot timestamptz; inserted uuid; replay uuid; n integer;
begin
 slot:=(date_trunc('week',now() at time zone 'Asia/Manila')
       +interval '7 days 9 hours') at time zone 'Asia/Manila';
 if (select count(*) from public.clinic_booking_policy where is_approved)<>1
 then raise exception 'FULL_TREE_FAIL: approved policy not visible to authenticated owner';end if;
 -- This is the non-negotiable postapproval negative assertion.
 begin
  insert into public.appointments(owner_id,pet_id,resource_id,starts_at,ends_at,concern)
   values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    slot+interval '1 hour',slot+interval '90 minutes',
    'MUST NEVER persist service-less after approval');
  raise exception 'FULL_TREE_FAIL: APPROVED POLICY ALLOWED SERVICE-LESS INSERT';
 exception when check_violation then null;
 end;
 if exists(select 1 from public.appointments) then
   raise exception 'FULL_TREE_FAIL: denied service-less request left persisted row';end if;

 begin
  insert into public.appointments(owner_id,pet_id,resource_id,starts_at,ends_at,
    concern,request_nonce)
  values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   slot+interval '1 hour',slot+interval '90 minutes',
   'MUST NEVER persist nonce without service','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
  raise exception 'FULL_TREE_FAIL: forged nonce bypassed mandatory service';
 exception when check_violation then null;
 end;
 if exists(select 1 from public.appointments) then
  raise exception 'FULL_TREE_FAIL: forged nonce left persisted row';end if;

 select public.request_service_appointment(
  'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  slot,'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','Synthetic approved booking',null)
 into inserted;
 select public.request_service_appointment(
  'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  slot,'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','Synthetic approved booking',null)
 into replay;
 select count(*) into n from public.appointments;
 if inserted is null or replay is distinct from inserted or n<>1
   or not exists(select 1 from public.appointments
     where id=inserted and owner_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
       and pet_id='aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
       and service_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
       and request_nonce='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
       and status='requested'
       and ends_at=slot+interval '30 minutes')
 then raise exception 'FULL_TREE_FAIL: approved service-aware RPC did not persist exactly once';end if;
 begin
  perform public.request_service_appointment(
   'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
   'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   slot,'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','Tampered payload',null);
  raise exception 'FULL_TREE_FAIL: altered replay accepted';
 exception when unique_violation then null;end;
end $mandatory_no_bypass$;

select pg_catalog.set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $owner_separation$
declare slot timestamptz;
begin
 slot:=(date_trunc('week',now() at time zone 'Asia/Manila')
       +interval '7 days 9 hours') at time zone 'Asia/Manila';
 if (select count(*) from public.appointments)<>0
    or exists(select 1 from public.pets where id='aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa')
 then raise exception 'FULL_TREE_FAIL: owner B saw owner A patient or booking';end if;
 begin
  perform public.request_service_appointment(
    'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    slot+interval '1 hour','ffffffff-ffff-4fff-8fff-ffffffffffff',
    'Forged patient ownership',null);
  raise exception 'FULL_TREE_FAIL: B booked A pet';
 exception when insufficient_privilege then null;end;
 begin
  perform public.request_service_appointment(
    'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    slot,'ffffffff-ffff-4fff-8fff-ffffffffffff',
    'Resource overlap',null);
  raise exception 'FULL_TREE_FAIL: duplicate active resource booking';
 exception when exclusion_violation then null;end;
end $owner_separation$;

select pg_catalog.set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
do $revoked$
begin
 if clinic_private.has_staff_role(array['veterinarian','administrator'])
    or exists(select 1 from public.appointments)
 then raise exception 'FULL_TREE_FAIL: revoked staff saw clinic queue';end if;
end $revoked$;

select pg_catalog.set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
do $staff_queue$
begin
 if not clinic_private.has_staff_role(array['veterinarian'])
   or (select count(*) from public.appointments)<>1
 then raise exception 'FULL_TREE_FAIL: verified active veterinarian cannot read approved queue';end if;
end $staff_queue$;
reset role;

set local role anon;
do $anon_denials$
begin
 if has_function_privilege('anon',
  'public.request_service_appointment(uuid,uuid,uuid,timestamptz,uuid,text,text)','EXECUTE')
   or has_table_privilege('anon','public.appointments','SELECT')
   or has_table_privilege('anon','public.appointments','INSERT')
 then raise exception 'FULL_TREE_FAIL: anonymous granted patient appointment/RPC';end if;
end $anon_denials$;
reset role;
rollback;
\echo 'PASS: approved policy blocks BOTH service-less INSERT variants; owner-only service-aware RPC persists exactly once, rejects replay tamper, owner B conflicts and revoked/anon denied.'
