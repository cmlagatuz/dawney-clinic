-- ISSUE #51: original 11 + proposed 12th migration, BEFORE the fix.
-- CI DISPOSABLE PostgreSQL17 ONLY; fake JWT claims are not hosted Auth proof.
-- This reproducer must COMMIT synthetic data and verify it remains readable
-- as a privileged SQL caller. It is expected to PASS only if the bypass exists.
\set ON_ERROR_STOP on
begin;
do $pre$
begin
 if (select count(*) from public.clinic_branches where booking_enabled)<>0
 or (select count(*) from public.branch_booking_policies where is_approved)<>0
 or (select count(*) from public.clinic_services)<>0
 or (select count(*) from public.appointments
   where id='55555555-5555-4555-8555-555555555555'
     and branch_id is null and status='requested')<>1 then
  raise exception 'ISSUE51_REPRO_FAIL: baseline source not branch OFF with historic requested appointment';
 end if;
end $pre$;
-- Unique invented CI resource + CI owner approvals, NEVER public booking hours.
insert into public.appointment_resources(id,name,branch_id) values
 ('bbbb0000-7777-4777-8777-000000000051','ISSUE51 disposable Naga test resource',
  '11111111-0000-4000-8000-000000000077');
set role authenticated;
set request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false}';
do $off$
begin
 begin
  insert into public.appointments
   (owner_id,pet_id,resource_id,starts_at,ends_at,concern)
  values('11111111-1111-4111-8111-111111111111',
   '33333333-3333-4333-8333-333333333333',
   'bbbb0000-7777-4777-8777-000000000051',
   now()+interval '18 days',now()+interval '18 days 30 minutes',
   'ISSUE51 CI branch OFF denied');
  raise exception 'ISSUE51_REPRO_FAIL: branch OFF permitted booking';
 exception when check_violation then null;
 end;
end $off$;
reset role;
-- Only the CI local Naga branch is artificially published. Cavite remains OFF.
update public.clinic_branches
 set booking_enabled=true,owner_approved_at=now(),
     owner_approved_by='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
 where id='11111111-0000-4000-8000-000000000077';
update public.branch_booking_policies
 set is_approved=true,approved_at=now(),
     approved_by='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
     lead_minutes=0,max_advance_days=90,slot_step_minutes=30,
     weekly_hours='{"sun":[],"mon":[{"open":"01:00","close":"23:00"}],
     "tue":[{"open":"01:00","close":"23:00"}],
     "wed":[{"open":"01:00","close":"23:00"}],
     "thu":[{"open":"01:00","close":"23:00"}],
     "fri":[{"open":"01:00","close":"23:00"}],
     "sat":[{"open":"01:00","close":"23:00"}]}'::jsonb
 where branch_id='11111111-0000-4000-8000-000000000077';
-- Even with a valid Naga-only approved service, the old INSERT omits both.
update public.species_catalog set clinic_supported=true where id='dog';
insert into public.clinic_services
(id,slug,display_name,duration_minutes,is_active,owner_approved_at,
 owner_approved_by,published_at,branch_id)
values ('cccc0000-7777-4777-8777-000000000051','issue51-repro-svc',
 'ISSUE51 synthetic service',30,true,now(),
 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',now(),
 '11111111-0000-4000-8000-000000000077');
insert into public.clinic_service_species(service_id,species_id)
 values('cccc0000-7777-4777-8777-000000000051','dog');
insert into public.clinic_service_resources(service_id,resource_id,capacity)
 values('cccc0000-7777-4777-8777-000000000051',
        'bbbb0000-7777-4777-8777-000000000051',1);
set role authenticated;
set request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false}';
do $bypass$
declare created uuid;
begin
 if exists(select 1 from public.clinic_booking_policy where policy_id=1)
 or (select count(*) from public.branch_booking_policies where is_approved)<>1 then
  raise exception 'ISSUE51_REPRO_FAIL: singleton RLS or approved branch visibility invalid';
 end if;
 insert into public.appointments
  (owner_id,pet_id,resource_id,starts_at,ends_at,concern,details)
 values('11111111-1111-4111-8111-111111111111',
  '33333333-3333-4333-8333-333333333333',
  'bbbb0000-7777-4777-8777-000000000051',
  now()+interval '21 days',now()+interval '21 days 30 minutes',
  'ISSUE51 PRE_FIX_BYPASS_PERSISTED',null)
 returning id into created;
 if created is null or not exists(
  select 1 from public.appointments a where a.id=created
    and a.service_id is null and a.request_nonce is null
    and a.branch_id='11111111-0000-4000-8000-000000000077'
    and a.status='requested'
    and a.created_by='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') then
  raise exception 'ISSUE51_REPRO_DISPROVED: service-less insert did not persist while authorized branch enabled';
 end if;
end $bypass$;
reset role;
commit;
-- A privileged new SQL statement confirms durable committed insertion.
do $persisted$
begin
 if (select count(*) from public.appointments a
   where a.concern='ISSUE51 PRE_FIX_BYPASS_PERSISTED'
    and a.service_id is null and a.request_nonce is null
    and a.branch_id='11111111-0000-4000-8000-000000000077'
    and a.status='requested')<>1 then
  raise exception 'ISSUE51_REPRO_DISPROVED: committed bypass row missing';
 end if;
 if (select count(*) from public.appointments
   where id='55555555-5555-4555-8555-555555555555'
   and branch_id is null and status='requested')<>1
 or exists(select 1 from public.clinic_branches where slug='cavite'
   and booking_enabled) then
  raise exception 'ISSUE51_REPRO_FAIL: historical branch or Cavite changed';
 end if;
end $persisted$;
\echo 'ISSUE51 CONFIRMED: real disposable PG17 commits Naga service-less authenticated INSERT with NULL service_id + NULL request_nonce after Naga-only synthetic approval; historic branch UNKNOWN and Cavite OFF'
