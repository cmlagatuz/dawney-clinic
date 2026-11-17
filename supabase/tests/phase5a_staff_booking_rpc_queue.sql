-- PR #59: verified booking RPC -> persisted staff queue, using PR #43 SQL.
-- DISPOSABLE PostgreSQL 17 ONLY. Requires exact migrations selected by CI.
-- Auth claims below are unsigned local PostgreSQL session settings, NOT hosted JWTs.
-- Entire synthetic fixture is rolled back; never execute on a connected clinic.
begin;

do $preflight$
begin
 if to_regprocedure('public.request_service_appointment(uuid,uuid,uuid,timestamptz,uuid,text,text)') is null
    or not (select relrowsecurity from pg_class where oid='public.appointments'::regclass)
    or not (select relrowsecurity from pg_class where oid='public.staff_memberships'::regclass)
    or not (select relrowsecurity from pg_class where oid='public.clinic_service_species'::regclass)
    or not exists(select 1 from pg_policies where schemaname='public' and tablename='appointments'
      and policyname='appointments_read_own_or_staff') then
  raise exception 'Secure booking/staff RLS migrations are not in place; fail closed';
 end if;
 if exists(select 1 from public.clinic_services)
    or exists(select 1 from public.clinic_booking_policy where is_approved) then
  raise exception 'Booking test must start with no real/published services or hours';
 end if;
end $preflight$;

-- Fixture identities exist ONLY in this transaction in isolated PostgreSQL.
insert into auth.users(id,email_confirmed_at,is_anonymous) values
 ('11111111-1111-4111-8111-111111111111',now(),false), -- owner A
 ('22222222-2222-4222-8222-222222222222',now(),false), -- owner B
 ('33333333-3333-4333-8333-333333333333',now(),false), -- active receptionist
 ('44444444-4444-4444-8444-444444444444',now(),false), -- revoked veterinarian
 ('55555555-5555-4555-8555-555555555555',now(),true),  -- anonymous Auth identity
 ('66666666-6666-4666-8666-666666666666',null,false); -- unverified Auth identity
insert into public.owners(id,user_id,first_name,last_name) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Synthetic','Owner A'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','Synthetic','Owner B');
-- The real taxonomy trigger maps the catalog ID but never fabricates clinic support.
insert into public.pets(id,owner_id,name,species) values
 ('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Synthetic A','Dog'),
 ('bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Synthetic B','Dog');
insert into public.staff_memberships(user_id,role,is_active) values
 ('33333333-3333-4333-8333-333333333333','receptionist',true),
 ('44444444-4444-4444-8444-444444444444','veterinarian',false);
insert into public.appointment_resources(id,name) values
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','SYNTHETIC RPC queue resource');
-- Synthetic approval ONLY after zero-default assertions above.
update public.species_catalog set clinic_supported=true where id='dog';
insert into public.clinic_services(
 id,slug,display_name,duration_minutes,is_active,owner_approved_at,owner_approved_by,published_at
) values (
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd','ci-rpc-staff-queue',
 'SYNTHETIC RPC queue service',30,true,now(),
 '33333333-3333-4333-8333-333333333333',now()
);
insert into public.clinic_service_species(service_id,species_id)
values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','dog');
insert into public.clinic_service_resources(service_id,resource_id,capacity)
values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','cccccccc-cccc-4ccc-8ccc-cccccccccccc',1);
update public.clinic_booking_policy set
 weekly_hours='{"sun":[],"mon":[{"open":"09:00","close":"17:00"}],
 "tue":[],"wed":[],"thu":[],"fri":[],"sat":[]}'::jsonb,
 lead_minutes=0,max_advance_days=30,slot_step_minutes=30,
 approved_at=now(),approved_by='33333333-3333-4333-8333-333333333333',
 is_approved=true,revision=2 where policy_id=1;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","is_anonymous":false}',true);
do $owner_rpc$
declare t timestamptz; inserted uuid; replay uuid; before_count integer;
begin
 if (select count(*) from public.appointments)<>0
   or clinic_private.has_staff_role(array['administrator','veterinarian','receptionist']) then
  raise exception 'Owner A must start with an empty booking queue and no staff role';
 end if;
 t:=(date_trunc('week',now() at time zone 'Asia/Manila')
     + interval '7 days 9 hours') at time zone 'Asia/Manila';
 select count(*) into before_count from public.appointments;
 select public.request_service_appointment(
  'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  t,'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'Synthetic booking for staff queue',null) into inserted;
 select public.request_service_appointment(
  'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  t,'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'Synthetic booking for staff queue',null) into replay;
 if inserted is null or replay is distinct from inserted
    or (select count(*) from public.appointments)<>before_count+1
    or not exists (
     select 1 from public.appointments where id=inserted
       and owner_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
       and pet_id='aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
       and service_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
       and resource_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
       and request_nonce='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
       and starts_at=t and ends_at=t+interval '30 minutes'
       and status='requested' and created_by='11111111-1111-4111-8111-111111111111'
       and concern='Synthetic booking for staff queue'
    ) then
  raise exception 'Owner RPC did not persist exactly one requested appointment';
 end if;
 begin
  perform public.request_service_appointment(
   'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
   'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   t,'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
   'Tampered payload',null);
  raise exception 'Altered nonce payload bypassed idempotency';
 exception when unique_violation then null;
 end;
 -- Even a forged app-role JWT claim cannot grant membership or confirm.
 perform pg_catalog.set_config('request.jwt.claims',
  '{"role":"administrator","is_anonymous":false}',true);
 if clinic_private.has_staff_role(array['administrator','receptionist']) then
  raise exception 'Owner A forged a privileged staff role via JWT role text';
 end if;
 begin
  update public.appointments set status='confirmed' where id=inserted;
  raise exception 'Owner A was allowed to confirm without staff membership';
 exception when insufficient_privilege then null;
 end;
 if (select status from public.appointments where id=inserted)<>'requested' then
  raise exception 'Forbidden owner confirmation mutated persisted status';
 end if;
 perform pg_catalog.set_config('request.jwt.claims',
  '{"role":"authenticated","is_anonymous":false}',true);
end $owner_rpc$;

-- The unrelated owner sees no private booking rows, audit, or owner-A pets,
-- cannot confirm the hidden row and cannot book the already occupied resource.
select pg_catalog.set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $owner_b$
declare t timestamptz; touched integer;
begin
 if (select count(*) from public.appointments)<>0
   or (select count(*) from public.appointment_events)<>0
   or (select count(*) from public.pets
        where id='aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa')<>0 then
  raise exception 'Unrelated owner B can see A booking, audit or patient';
 end if;
 update public.appointments set status='confirmed'
  where request_nonce='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
 get diagnostics touched=ROW_COUNT;
 if touched<>0 then raise exception 'Owner B forged a cross-owner confirmation';end if;
 t:=(date_trunc('week',now() at time zone 'Asia/Manila')
     + interval '7 days 9 hours') at time zone 'Asia/Manila';
 begin
  perform public.request_service_appointment(
   'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb',
   'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   t,'ffffffff-ffff-4fff-8fff-ffffffffffff',
   'Synthetic competing visit',null);
  raise exception 'Shared resource double-booking bypassed exclusion';
 exception when exclusion_violation then null;
 end;
 if (select count(*) from public.appointments)<>0 then
  raise exception 'Owner B created or saw conflicting appointment';
 end if;
end $owner_b$;

-- The production staff adapter checks verified Auth + active membership first.
-- PostgreSQL SELECT below reproduces its actual fields/window/order/251 cap.
select pg_catalog.set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
do $active_staff_queue$
declare member public.staff_memberships%rowtype; v record;
declare lower_bound timestamptz; upper_bound timestamptz; matching integer;
begin
 select * into member from public.staff_memberships
   where user_id='33333333-3333-4333-8333-333333333333';
 if member.user_id is null or member.role<>'receptionist'
    or member.is_active is distinct from true
    or not clinic_private.has_staff_role(array['receptionist']) then
  raise exception 'Active receptionist membership failed verified RLS membership read';
 end if;
 select starts_at into lower_bound from public.appointments
  where request_nonce='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
 if lower_bound is null then raise exception 'RPC booking is not readable by staff';end if;
 lower_bound:=lower_bound-interval '1 hour';
 upper_bound:=lower_bound+interval '2 hours';
 select count(*) into matching from (
  select id,pet_id,owner_id,resource_id,starts_at,ends_at,status,concern
   from public.appointments
   where starts_at>=lower_bound and starts_at<upper_bound
   order by starts_at asc,id asc limit 251
 ) queue;
 if matching<>1 then raise exception 'Staff queue returned % rows, expected 1',matching;end if;
 select id,pet_id,owner_id,resource_id,starts_at,ends_at,status,concern into v
   from public.appointments
   where starts_at>=lower_bound and starts_at<upper_bound
   order by starts_at asc,id asc limit 251;
 if v.id is null or v.pet_id<>'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
    or v.owner_id<>'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    or v.resource_id<>'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    or v.status<>'requested'
    or v.concern<>'Synthetic booking for staff queue'
    or v.ends_at<>v.starts_at+interval '30 minutes' then
  raise exception 'Staff queue lost the complete requested RPC appointment';
 end if;
 if (select count(*) from public.appointment_events
      where appointment_id=v.id and new_status='requested')<>1 then
  raise exception 'RPC booking status insert missing appointment audit event';
 end if;
end $active_staff_queue$;

-- A revoked staff membership remains self-readable but has NO clinic queue.
select pg_catalog.set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
do $revoked_staff$
begin
 if clinic_private.has_staff_role(array['receptionist','veterinarian','administrator'])
    or (select count(*) from public.appointments)<>0
    or (select count(*) from public.appointment_events)<>0
    or (select count(*) from public.staff_memberships
        where user_id='44444444-4444-4444-8444-444444444444'
          and is_active=false and role='veterinarian')<>1 then
  raise exception 'Revoked veterinarian retained booking queue access';
 end if;
end $revoked_staff$;

-- Auth anonymous (under authenticated DB role) does NOT see private records.
select pg_catalog.set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',true);
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","is_anonymous":true}',true);
do $anonymous_auth$
begin
 if clinic_private.is_permanent_user()
   or clinic_private.has_staff_role(array['receptionist','veterinarian','administrator'])
   or (select count(*) from public.appointments)<>0
   or (select count(*) from public.appointment_events)<>0 then
  raise exception 'Anonymous Auth actor read protected RPC booking';
 end if;
end $anonymous_auth$;
select pg_catalog.set_config('request.jwt.claim.sub','66666666-6666-4666-8666-666666666666',true);
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","is_anonymous":false}',true);
do $unconfirmed_auth$
begin
 if clinic_private.is_permanent_user()
   or (select count(*) from public.appointments)<>0 then
  raise exception 'Unconfirmed Auth user read private booking';
 end if;
end $unconfirmed_auth$;

-- Database anonymous role lacks SELECT entirely; a forged staff subject does not help.
set local role anon;
select pg_catalog.set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
do $anon_database_role$
declare denied boolean:=false;
begin
 if has_any_column_privilege('anon','public.appointments','SELECT') then
  raise exception 'Anon has table/column-level appointment SELECT privilege';
 end if;
 begin
  perform count(*) from public.appointments;
 exception when insufficient_privilege then denied:=true;
 end;
 if not denied then raise exception 'SQL anon role selected private appointments';end if;
end $anon_database_role$;

-- Confirm that only the ACTIVE receptionist can transition the persisted row.
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","is_anonymous":false}',true);
do $staff_confirmation$
declare before_id uuid; after_id uuid;
begin
 select id into before_id from public.appointments
 where request_nonce='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
   and status='requested';
 if before_id is null then raise exception 'Staff confirmation target disappeared';end if;
 update public.appointments set status='confirmed' where id=before_id
 returning id into after_id;
 if after_id is distinct from before_id
    or (select count(*) from public.appointments
       where id=before_id and status='confirmed')<>1
    or (select count(*) from public.appointment_events
       where appointment_id=before_id and new_status='confirmed')<>1
    or (select count(*) from public.appointments)<>1 then
  raise exception 'Authorized staff confirmation lost booking identity or event';
 end if;
end $staff_confirmation$;

reset role;
rollback;
select 'PASS: real PG17 secure RPC requested appointment -> authorized staff queue; owner/anon/revoked isolation, confirmation and nonce/resource safeguards' as verdict;
