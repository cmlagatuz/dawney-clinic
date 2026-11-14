-- Isolated synthetic PG17 regression. NEVER run on the real Supabase project.
-- "09:00-17:00" and fake services below are TEST FIXTURES, not real Dawney hours.
do $empty$
begin
 if exists(select 1 from public.clinic_services) then raise exception 'Migration published default service'; end if;
 if exists(select 1 from public.clinic_booking_policy where is_approved) then
  raise exception 'Schedule incorrectly approved'; end if;
 if not exists(select 1 from public.clinic_booking_policy where timezone='Asia/Manila'
     and weekly_hours->'mon'='[]'::jsonb and not is_approved) then
  raise exception 'Proposed timezone must start unapproved with no hours'; end if;
 if (select count(*) from public.appointments)<>1
    or not exists(select 1 from public.appointments
     where id='77777777-7777-4777-8777-777777777777'
       and service_id is null and request_nonce is null and status='requested') then
  raise exception 'Legacy appointment damaged by additive migration'; end if;
 if not (select relrowsecurity from pg_class where oid='public.clinic_services'::regclass)
   or not (select relrowsecurity from pg_class where oid='public.clinic_booking_policy'::regclass)
   or has_table_privilege('anon','public.appointments','SELECT')
   or has_table_privilege('anon','public.appointments','INSERT')
   or has_table_privilege('authenticated','public.clinic_services','INSERT')
   or has_table_privilege('authenticated','public.clinic_booking_policy','UPDATE') then
  raise exception 'Booking table or service RLS/grants unsafe'; end if;
 if has_function_privilege('anon',
  'public.request_service_appointment(uuid,uuid,uuid,timestamptz,uuid,text,text)','EXECUTE')
  then raise exception 'Anonymous booking RPC exposed'; end if;
end $empty$;
-- Synthetic owner approval is performed ONLY by privileged local PG fixture.
insert into public.clinic_services(id,slug,display_name,duration_minutes,is_active,owner_approved_at,owner_approved_by,published_at)
values('88888888-8888-4888-8888-888888888888','synthetic-ci-service',
 'SYNTHETIC TEST SERVICE (never publish)',30,true,now(),
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',now());
insert into public.clinic_services(id,slug,display_name,duration_minutes,is_active)
values('99999999-9999-4999-8999-999999999999','unapproved-test','Unapproved draft',30,false);
insert into public.clinic_service_species(service_id,species_id)
values('88888888-8888-4888-8888-888888888888','dog');
insert into public.clinic_service_resources(service_id,resource_id,capacity)
values('88888888-8888-4888-8888-888888888888',
 '55555555-5555-4555-8555-555555555555',1);
update public.species_catalog set clinic_supported=true where id='dog';

set role anon;
do $anon$
begin
 if (select count(*) from public.clinic_services)<>1 then
  raise exception 'Unapproved public service leaked or approved one hidden'; end if;
 if has_table_privilege('anon','public.clinic_service_species','SELECT') then
  raise exception 'Anonymous taxonomy grants unexpectedly broadened'; end if;
 if (select count(*) from public.clinic_service_resources)<>0
    or (select count(*) from public.clinic_booking_policy)<>0 then
  raise exception 'Unapproved hours/resource listing leaked'; end if;
 begin
  perform count(*) from public.appointments;
  raise exception 'Anonymous appointment read incorrectly granted';
 exception when insufficient_privilege then null;end;
end $anon$;
reset role;
set role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
do $unapproved$
declare t timestamptz;
begin
 t:=(date_trunc('week',now() at time zone 'Asia/Manila')+interval '7 days 9 hours')
      at time zone 'Asia/Manila';
 begin
  perform public.request_service_appointment(
   '33333333-3333-4333-8333-333333333333',
   '88888888-8888-4888-8888-888888888888',
   '55555555-5555-4555-8555-555555555555',
   t,'11111111-1111-4111-8111-111111111111','CI consultation',null);
  raise exception 'Request before clinic schedule approval was accepted';
 exception when check_violation then null; end;
end $unapproved$;
reset role;

update public.clinic_booking_policy
set weekly_hours='{"sun":[],"mon":[{"open":"09:00","close":"17:00"}],
 "tue":[],"wed":[],"thu":[],"fri":[],"sat":[]}'::jsonb,
 lead_minutes=0,max_advance_days=30,slot_step_minutes=30,
 approved_at=now(),approved_by='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 is_approved=true,revision=2
where policy_id=1;
set role anon;
do $public_ready$
begin
 if (select count(*) from public.clinic_booking_policy)<>1 then
  raise exception 'Approved hours not visible for public discovery'; end if;
 if (select count(*) from public.clinic_service_resources)<>1 then
  raise exception 'Approved service-resource link not visible'; end if;
end $public_ready$;
reset role;

set role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
do $positive$
declare
 slot timestamptz;
 first_id uuid;
 retry_id uuid;
 begin_count integer;
begin
 slot:=(date_trunc('week',now() at time zone 'Asia/Manila')+interval '7 days 9 hours')
       at time zone 'Asia/Manila';
 select count(*) into begin_count from public.appointments;
 select public.request_service_appointment(
   '33333333-3333-4333-8333-333333333333',
   '88888888-8888-4888-8888-888888888888',
   '55555555-5555-4555-8555-555555555555',
   slot,'11111111-1111-4111-8111-111111111111','CI consultation',null)
 into first_id;
 select public.request_service_appointment(
   '33333333-3333-4333-8333-333333333333',
   '88888888-8888-4888-8888-888888888888',
   '55555555-5555-4555-8555-555555555555',
   slot,'11111111-1111-4111-8111-111111111111','CI consultation',null)
 into retry_id;
 if retry_id<>first_id or (select count(*) from public.appointments)<>begin_count+1
   or not exists(select 1 from public.appointments where id=first_id
      and service_id='88888888-8888-4888-8888-888888888888'
      and owner_id='11111111-1111-4111-8111-111111111111'
      and status='requested' and ends_at=starts_at+interval '30 minutes') then
  raise exception 'Idempotent request did not persist as requested exactly once'; end if;

 begin
  perform public.request_service_appointment(
    '33333333-3333-4333-8333-333333333333',
    '88888888-8888-4888-8888-888888888888',
    '55555555-5555-4555-8555-555555555555',
    slot,'11111111-1111-4111-8111-111111111111','Changed concern',null);
  raise exception 'Reused token with altered payload incorrectly accepted';
 exception when unique_violation then null;end;
 begin
  perform public.request_service_appointment(
    '33333333-3333-4333-8333-333333333333',
    '88888888-8888-4888-8888-888888888888',
    '55555555-5555-4555-8555-555555555555',
    slot,'22222222-2222-4222-8222-222222222222','CI consultation',null);
  raise exception 'Second token double booked same patient/slot';
 exception when unique_violation or exclusion_violation then null;end;
 begin
  perform public.request_service_appointment(
    '44444444-4444-4444-8444-444444444444',
    '88888888-8888-4888-8888-888888888888',
    '55555555-5555-4555-8555-555555555555',
    slot,'33333333-3333-4333-8333-333333333333','CI other patient',null);
  raise exception 'Foreign patient booking accepted';
 exception when insufficient_privilege then null;end;
 begin
  perform public.request_service_appointment(
    '33333333-3333-4333-8333-333333333333',
    '99999999-9999-4999-8999-999999999999',
    '55555555-5555-4555-8555-555555555555',
    slot,'44444444-4444-4444-8444-444444444444','Unapproved service',null);
  raise exception 'Unapproved service booking accepted';
 exception when check_violation then null;end;
 begin
  perform public.request_service_appointment(
    '33333333-3333-4333-8333-333333333333',
    '88888888-8888-4888-8888-888888888888',
    '66666666-6666-4666-8666-666666666666',
    slot,'55555555-5555-4555-8555-555555555555','Unapproved resource',null);
  raise exception 'Unmapped resource booking accepted';
 exception when check_violation then null;end;
 begin
  perform public.request_service_appointment(
    '33333333-3333-4333-8333-333333333333',
    '88888888-8888-4888-8888-888888888888',
    '55555555-5555-4555-8555-555555555555',
    slot+interval '15 minutes',
    '66666666-6666-4666-8666-666666666666','Bad step',null);
  raise exception 'Off-step booking accepted';
 exception when check_violation then null;end;
 begin
  perform public.request_service_appointment(
    '33333333-3333-4333-8333-333333333333',
    '88888888-8888-4888-8888-888888888888',
    '55555555-5555-4555-8555-555555555555',
    slot+interval '10 hours',
    '77777777-7777-4777-8777-777777777777','After hours',null);
  raise exception 'Outside-hours booking accepted';
 exception when check_violation then null;end;
 begin
  insert into public.appointments
    (owner_id,pet_id,resource_id,service_id,request_nonce,starts_at,ends_at,concern)
  values('11111111-1111-4111-8111-111111111111',
    '33333333-3333-4333-8333-333333333333',
    '55555555-5555-4555-8555-555555555555',
    '88888888-8888-4888-8888-888888888888',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    slot+interval '1 hour',slot+interval '1 hour 45 minutes','Bad duration');
  raise exception 'Direct API bypassed approved 30-minute duration';
 exception when check_violation then null;end;
 begin
  insert into public.appointments(owner_id,pet_id,resource_id,starts_at,ends_at,concern)
  values('11111111-1111-4111-8111-111111111111',
    '33333333-3333-4333-8333-333333333333',
    '55555555-5555-4555-8555-555555555555',
    slot+interval '1 hour',slot+interval '1 hour 30 minutes','Legacy bypass');
  raise exception 'Legacy service-free booking bypassed active policy';
 exception when check_violation then null;end;
end $positive$;

-- Add a second eligible owner/species under privileged isolated test operator.
reset role;
update public.species_catalog set clinic_supported=true where id='cat';
insert into public.clinic_service_species(service_id,species_id)
values('88888888-8888-4888-8888-888888888888','cat');
set role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
do $conflict$
declare slot timestamptz;
begin
 slot:=(date_trunc('week',now() at time zone 'Asia/Manila')+interval '7 days 9 hours')
       at time zone 'Asia/Manila';
 begin
  perform public.request_service_appointment(
    '44444444-4444-4444-8444-444444444444',
    '88888888-8888-4888-8888-888888888888',
    '55555555-5555-4555-8555-555555555555',
    slot,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Resource conflict',null);
  raise exception 'Two owners double-booked resource';
 exception when exclusion_violation then null;end;
 if (select count(*) from public.appointments where
  owner_id='22222222-2222-4222-8222-222222222222')<>1 then
  raise exception 'Conflict created foreign owner request'; end if;
end $conflict$;
reset role;
-- Holiday rejection in the clinic local date, not host/visitor timezone.
update public.clinic_booking_policy set
 holidays=array[(date_trunc('week',now() at time zone 'Asia/Manila')
    +interval '7 days')::date] where policy_id=1;
set role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
do $holiday$
declare slot timestamptz;
begin
 slot:=(date_trunc('week',now() at time zone 'Asia/Manila')+interval '7 days 11 hours')
       at time zone 'Asia/Manila';
 begin
 perform public.request_service_appointment(
   '33333333-3333-4333-8333-333333333333',
   '88888888-8888-4888-8888-888888888888',
   '55555555-5555-4555-8555-555555555555',
   slot,'cccccccc-cccc-4ccc-8ccc-cccccccccccc','Holiday blocked',null);
 raise exception 'Holiday booked despite approved closure';
 exception when check_violation then null;end;
end $holiday$;
reset role;
-- Only privileged actor sets up verified test staff; the owner cannot confirm.
insert into public.staff_memberships(user_id,role)
 values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','receptionist');
set role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
do $customer_cannot_confirm$
begin
 begin
  update public.appointments set status='confirmed'
  where owner_id='11111111-1111-4111-8111-111111111111'
    and request_nonce='11111111-1111-4111-8111-111111111111';
  raise exception 'Customer confirmed own appointment';
 exception when insufficient_privilege then null;end;
end $customer_cannot_confirm$;
set role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
update public.appointments set status='confirmed'
where request_nonce='11111111-1111-4111-8111-111111111111';
reset role;
do $last$
begin
 if (select status from public.appointments
   where request_nonce='11111111-1111-4111-8111-111111111111')<>'confirmed'
   then raise exception 'Verified receptionist could not confirm';end if;
 if (select count(*) from public.appointments)<>2 then
  raise exception 'Booking tests unexpectedly changed legacy or duplicated records';end if;
 if (select status from public.appointments
   where id='77777777-7777-4777-8777-777777777777')<>'requested'
   then raise exception 'Historical appointment changed';end if;
end $last$;
-- Service retirement cannot turn an exact retry into a new request.
update public.clinic_services set is_active=false
where id='88888888-8888-4888-8888-888888888888';
set role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
do $retired$
declare slot timestamptz; saved uuid;
begin
 slot:=(date_trunc('week',now() at time zone 'Asia/Manila')+interval '7 days 9 hours')
       at time zone 'Asia/Manila';
 select public.request_service_appointment(
  '33333333-3333-4333-8333-333333333333',
  '88888888-8888-4888-8888-888888888888',
  '55555555-5555-4555-8555-555555555555',
  slot,'11111111-1111-4111-8111-111111111111','CI consultation',null)
 into saved;
 if saved is distinct from (select id from public.appointments
       where request_nonce='11111111-1111-4111-8111-111111111111') then
   raise exception 'Retired-service retry lost its existing booking'; end if;
 begin
  perform public.request_service_appointment(
    '33333333-3333-4333-8333-333333333333',
    '88888888-8888-4888-8888-888888888888',
    '55555555-5555-4555-8555-555555555555',
    slot+interval '2 hours',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd','New retired service request',null);
  raise exception 'Retired service admitted new booking';
 exception when check_violation then null;end;
end $retired$;
reset role;
select 'PASS: public service catalog, owner booking, idempotency, conflict, holiday, Manila, status RLS' as verdict;
