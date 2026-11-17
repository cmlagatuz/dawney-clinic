-- FULL FOUR-MIGRATION integration rehearsal; execute ONLY against the
-- disposable PostgreSQL 17 GitHub Actions service after the ordered migrations.
-- Synthetic booking hours and patients below are never clinic-approved data.

do $history$
begin
 if (select count(*) from public.pets)<>(select count(*) from clinic_ci.legacy_pets)
    or exists(select 1 from clinic_ci.legacy_pets s left join public.pets p using(id)
      where p.id is null
         or to_jsonb(p)-'species_id'-'breed_id'-'taxonomy_review_needed'
            is distinct from s.archival_fields) then
   raise exception 'Four migrations changed/deleted historical patient fields';
 end if;
 if (select count(*) from public.appointments)<>
    (select count(*) from clinic_ci.legacy_appointments)
    or exists(select 1 from clinic_ci.legacy_appointments s
      left join public.appointments a using(id)
      where a.id is null
        or to_jsonb(a)-'service_id'-'request_nonce'
           is distinct from s.archival_fields) then
   raise exception 'Four migrations changed/deleted historical appointments';
 end if;
 if not exists(select 1 from public.pets where
    id='66666666-6666-4666-8666-666666666666'
    and species='Dog' and breed='Chow Chow'
    and species_id='dog' and breed_id='dog-chow-chow'
    and taxonomy_review_needed=false)
    or not exists(select 1 from public.pets where
    id='77777777-7777-4777-8777-777777777777'
    and species=' dog  ' and breed=' chOW cHoW  '
    and species_id='dog' and breed_id='dog-chow-chow'
    and taxonomy_review_needed=false) then
  raise exception 'Existing Chow Chow ID mapping changed legacy text or failed';
 end if;
 if (select count(*) from pg_trigger
     where tgrelid='public.pets'::regclass
     and tgfoid='clinic_private.resolve_pet_taxonomy()'::regprocedure
     and tgenabled in ('O','A') and not tgisinternal)<>1 then
  raise exception 'Taxonomy trigger installed more/less than once';
 end if;
 if exists(select 1 from public.clinic_services)
    or (select count(*) from public.clinic_booking_policy
      where policy_id=1 and not is_approved
        and timezone='Asia/Manila' and weekly_hours->'mon'='[]'::jsonb)<>1
    or exists(select 1 from public.species_catalog where clinic_supported) then
  raise exception 'A migration approved/published invented clinic services or hours';
 end if;
 if has_function_privilege('anon',
   'public.request_service_appointment(uuid,uuid,uuid,timestamptz,uuid,text,text)',
   'EXECUTE') then
  raise exception 'Anonymous RPC execution was granted'; end if;
end $history$;

-- Synthetic staff-controlled service exists only after asserting zero defaults.
insert into public.clinic_services(
 id,slug,display_name,duration_minutes,is_active,
 owner_approved_at,owner_approved_by,published_at)
 values('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'ci-only-chow-service','CI TEST ONLY — Never Publish',30,true,
  now(),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',now());
update public.species_catalog set clinic_supported=true where id='dog';
insert into public.clinic_service_species(service_id,species_id)
 values('cccccccc-cccc-4ccc-8ccc-cccccccccccc','dog');
insert into public.clinic_service_resources(service_id,resource_id,capacity)
 values('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  '55555555-5555-4555-8555-555555555555',1);

set role anon;
do $anonymous$
begin
 if (select count(*) from public.clinic_services)<>1
  or (select count(*) from public.clinic_booking_policy)<>0
  or (select count(*) from public.clinic_service_resources)<>0 then
   raise exception 'Anonymous service/schedule publication violates approval gate';
 end if;
 if has_column_privilege('anon','public.clinic_services','owner_approved_by','SELECT')
    or has_column_privilege('anon','public.clinic_services','owner_approved_at','SELECT')
    or has_column_privilege('anon','public.clinic_booking_policy','approved_by','SELECT')
    or has_column_privilege('anon','public.clinic_booking_policy','approved_at','SELECT') then
   raise exception 'Anonymous visitor can SELECT private approval metadata'; end if;
 begin
  perform owner_approved_by from public.clinic_services;
  raise exception 'Anonymous visitor read a private approval actor';
 exception when insufficient_privilege then null;end;
 begin
  perform count(*) from public.appointments;
  raise exception 'Anonymous visitor read patient appointments';
 exception when insufficient_privilege then null;end;
end $anonymous$;
reset role;

-- The unchanged owner appointment form must work while the clinic policy is
-- unapproved; rollback prevents synthetic test-row count changes.
begin;
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
do $legacy_while_draft$
declare local_slot timestamptz; new_id uuid;
begin
 local_slot:=(date_trunc('week',now() at time zone 'Asia/Manila')
  +interval '7 days 13 hours') at time zone 'Asia/Manila';
 insert into public.appointments(owner_id,pet_id,resource_id,
  starts_at,ends_at,concern)
 values('11111111-1111-4111-8111-111111111111',
  '66666666-6666-4666-8666-666666666666',
  '55555555-5555-4555-8555-555555555555',
  local_slot,local_slot+interval '30 minutes','CI legacy owner form')
 returning id into new_id;
 if not exists(select 1 from public.appointments
    where id=new_id and status='requested' and service_id is null
      and request_nonce is null) then
  raise exception 'Unapproved-policy service-less owner request did not persist';
 end if;
end $legacy_while_draft$;
rollback;

-- Owner A cannot read owner B data or approval actor fields, and a verified
-- owner cannot run service booking before trusted operator policy approval.
set role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
do $owner_a_preapproval$
declare slot timestamptz;
begin
 if (select count(*) from public.pets where owner_id=
     '22222222-2222-4222-8222-222222222222')<>0
    or has_column_privilege('authenticated','public.clinic_services',
     'owner_approved_by','SELECT')
    or has_column_privilege('authenticated','public.clinic_services',
     'owner_approved_at','SELECT')
    or has_column_privilege('authenticated','public.clinic_booking_policy',
     'approved_by','SELECT')
    or has_column_privilege('authenticated','public.clinic_booking_policy',
     'approved_at','SELECT') then
  raise exception 'Owner A read another patient or approval actor';end if;
 begin
  perform approved_by from public.clinic_booking_policy;
  raise exception 'Owner A could SELECT staff approval actor';
 exception when insufficient_privilege then null;end;
 slot:=(date_trunc('week',now() at time zone 'Asia/Manila')
  +interval '7 days 9 hours') at time zone 'Asia/Manila';
 begin
  perform public.request_service_appointment(
   '66666666-6666-4666-8666-666666666666',
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   '55555555-5555-4555-8555-555555555555',
   slot,'aaaaaaaa-aaaa-4aaa-8aaa-000000000002',
   'CI preapproval denied',null);
  raise exception 'Draft-policy RPC booking incorrectly succeeded';
 exception when check_violation then null;end;
end $owner_a_preapproval$;
reset role;

-- Operator-only synthetic approval exists inside this disposable test DB.
update public.clinic_booking_policy set
 weekly_hours='{"sun":[],"mon":[{"open":"09:00","close":"17:00"}],
 "tue":[],"wed":[],"thu":[],"fri":[],"sat":[]}'::jsonb,
 lead_minutes=0,max_advance_days=30,slot_step_minutes=30,
 is_approved=true,approved_at=now(),
 approved_by='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 revision=revision+1 where policy_id=1;

set role anon;
do $anonymous_after_approval$
begin
 if (select count(*) from public.clinic_booking_policy)<>1
    or (select count(*) from public.clinic_service_resources)<>1 then
   raise exception 'Approved public service scheduling became invisible';end if;
 if has_column_privilege('anon','public.clinic_booking_policy',
  'approved_by','SELECT') then
   raise exception 'Policy approval actor readable after approval';end if;
 begin
  perform approved_by from public.clinic_booking_policy;
  raise exception 'Anonymous read approved-by UUID';
 exception when insufficient_privilege then null;end;
end $anonymous_after_approval$;
reset role;

set role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
do $owner_a_rpc$
declare slot timestamptz; first_id uuid; replay_id uuid; count_before bigint;
begin
 slot:=(date_trunc('week',now() at time zone 'Asia/Manila')
  +interval '7 days 9 hours') at time zone 'Asia/Manila';
 select count(*) into count_before from public.appointments;
 select public.request_service_appointment(
  '66666666-6666-4666-8666-666666666666',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  '55555555-5555-4555-8555-555555555555',
  slot,'aaaaaaaa-aaaa-4aaa-8aaa-000000000001','CI approved request',null)
 into first_id;
 select public.request_service_appointment(
  '66666666-6666-4666-8666-666666666666',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  '55555555-5555-4555-8555-555555555555',
  slot,'aaaaaaaa-aaaa-4aaa-8aaa-000000000001','CI approved request',null)
 into replay_id;
 if first_id is distinct from replay_id
    or (select count(*) from public.appointments)<>count_before+1
    or not exists(select 1 from public.appointments where id=first_id
     and owner_id='11111111-1111-4111-8111-111111111111'
     and pet_id='66666666-6666-4666-8666-666666666666'
     and status='requested'
     and ends_at=starts_at+interval '30 minutes') then
  raise exception 'RPC retry was not idempotent requested-status persistence';
 end if;
 begin
  perform public.request_service_appointment(
   '66666666-6666-4666-8666-666666666666',
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   '55555555-5555-4555-8555-555555555555',
   slot,'aaaaaaaa-aaaa-4aaa-8aaa-000000000001',
   'CHANGED concern',null);
  raise exception 'Same nonce accepted altered payload';
 exception when unique_violation then null;end;
 begin
  insert into public.appointments(owner_id,pet_id,resource_id,
   starts_at,ends_at,concern)
  values('11111111-1111-4111-8111-111111111111',
   '66666666-6666-4666-8666-666666666666',
   '55555555-5555-4555-8555-555555555555',
   slot+interval '1 hour',slot+interval '1 hour 30 minutes',
   'CI postapproval legacy bypass');
  raise exception 'Approved policy allowed service-less owner insert';
 exception when check_violation then null;end;
 begin
  update public.appointments set status='confirmed'
  where id=first_id;
  raise exception 'Owner confirmed their own appointment';
 exception when insufficient_privilege then null;end;
end $owner_a_rpc$;
reset role;

set role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
do $owner_b_denials$
declare slot timestamptz;
begin
 if (select count(*) from public.appointments where
   owner_id='11111111-1111-4111-8111-111111111111')<>0
    or (select count(*) from public.pets where
   owner_id='11111111-1111-4111-8111-111111111111')<>0
    or has_column_privilege('authenticated','public.clinic_services',
     'owner_approved_by','SELECT')
    or has_column_privilege('authenticated','public.clinic_booking_policy',
     'approved_at','SELECT') then
  raise exception 'Owner B can see private patient/approval data';end if;
 begin
  perform owner_approved_by from public.clinic_services;
  raise exception 'Owner B read service approval actor';
 exception when insufficient_privilege then null;end;
 slot:=(date_trunc('week',now() at time zone 'Asia/Manila')
  +interval '7 days 9 hours') at time zone 'Asia/Manila';
 begin
  perform public.request_service_appointment(
   '66666666-6666-4666-8666-666666666666',
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   '55555555-5555-4555-8555-555555555555',
   slot,'bbbbbbbb-bbbb-4bbb-8bbb-000000000001',
   'CI foreign patient',null);
  raise exception 'Owner B booked owner A patient';
 exception when insufficient_privilege then null;end;
 begin
  perform public.request_service_appointment(
   '77777777-7777-4777-8777-777777777777',
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   '55555555-5555-4555-8555-555555555555',
   slot,'bbbbbbbb-bbbb-4bbb-8bbb-000000000002',
   'CI same resource different owner',null);
  raise exception 'Two owners double-booked shared resource';
 exception when exclusion_violation then null;end;
end $owner_b_denials$;
reset role;

-- Only clinic-authorized staff can confirm; owner A cannot self-confirm.
insert into public.staff_memberships(user_id,role)
values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','receptionist');
set role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
update public.appointments set status='confirmed'
 where request_nonce='aaaaaaaa-aaaa-4aaa-8aaa-000000000001';
reset role;

do $final$
begin
 if (select count(*) from public.appointments)<>
    (select count(*) from clinic_ci.legacy_appointments)+1 then
  raise exception 'One or more unexpected appointment rows were inserted';
 end if;
 if exists(select 1 from clinic_ci.legacy_pets s
   left join public.pets p using(id)
    where p.id is null or
     to_jsonb(p)-'species_id'-'breed_id'-'taxonomy_review_needed'
      is distinct from s.archival_fields)
    or exists(select 1 from clinic_ci.legacy_appointments s
     left join public.appointments a using(id)
     where a.id is null
      or to_jsonb(a)-'service_id'-'request_nonce'
       is distinct from s.archival_fields) then
   raise exception 'Booking tests changed old patients or appointments';
 end if;
 if (select status from public.appointments where
   request_nonce='aaaaaaaa-aaaa-4aaa-8aaa-000000000001')<>'confirmed' then
   raise exception 'Staff confirmation workflow failed';end if;
end $final$;
select 'PASS four Phase4 migrations: history/Chow Chow/roles/privacy/RPC/replay/conflicts/policy' as verdict;
