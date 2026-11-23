-- #21 SOURCE ONLY. Real disposable PG17, after unchanged 20 migrations.
-- All identities, visits, policy approvals and session tokens below are synthetic.
\set ON_ERROR_STOP on
do $source$
begin
 if (select count(*) from public.appointments
   where id='55555555-5555-4555-8555-555555555555' and branch_id is null
     and status='requested' and lifecycle_revision=1)<>1
  or (select count(*) from public.pets where id='33333333-3333-4333-8333-333333333333'
     and species='Dog' and breed='Chow Chow' and breed_id='dog-chow-chow')<>1
 then raise exception 'LIFECYCLE_FAIL: historical patient or unassigned request modified';end if;
 if has_function_privilege('anon',
   'public.transition_staff_appointment(uuid,uuid,text,integer,uuid)','EXECUTE') or
   not has_function_privilege('authenticated',
   'public.transition_staff_appointment(uuid,uuid,text,integer,uuid)','EXECUTE') or
   has_table_privilege('authenticated','clinic_private.appointment_transition_events','INSERT')
 then raise exception 'LIFECYCLE_FAIL: browser ACL';end if;
end $source$;

-- Approved policy and service exist ONLY inside this CI database, never hosted.
-- No animal types were approved by migration seeds; CI explicitly approves this synthetic cat.
update public.species_catalog set clinic_supported=true where id='cat';
update public.clinic_branches set booking_enabled=true,
 owner_approved_at=clock_timestamp(),owner_approved_by='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
 where id='22222222-0000-4000-8000-000000000077';
update public.branch_booking_policies
 set timezone='Asia/Manila',
 weekly_hours='{"sun":[{"open":"00:00","close":"23:59"}],"mon":[{"open":"00:00","close":"23:59"}],"tue":[{"open":"00:00","close":"23:59"}],"wed":[{"open":"00:00","close":"23:59"}],"thu":[{"open":"00:00","close":"23:59"}],"fri":[{"open":"00:00","close":"23:59"}],"sat":[{"open":"00:00","close":"23:59"}]}'::jsonb,
 lead_minutes=0,max_advance_days=365,slot_step_minutes=5,
 is_approved=true,approved_at=clock_timestamp(),
 approved_by='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
 where branch_id='22222222-0000-4000-8000-000000000077';
insert into public.clinic_services
 (id,slug,display_name,duration_minutes,is_active,owner_approved_at,owner_approved_by,published_at,branch_id)
 values('a1200000-0000-4000-8000-000000000001','synthetic-lifecycle-visit',
 'CI synthetic appointment lifecycle',30,true,clock_timestamp(),
 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',clock_timestamp(),
 '22222222-0000-4000-8000-000000000077');
insert into public.clinic_service_species(service_id,species_id)
 select 'a1200000-0000-4000-8000-000000000001',species_id
 from public.pets where id='44444444-4444-4444-8444-444444444444';
insert into public.appointment_resources(id,name,is_active,branch_id)
select ('a1200000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 'CI lifecycle resource '||i,true,'22222222-0000-4000-8000-000000000077'
from generate_series(1,6) i;
insert into public.clinic_service_resources(service_id,resource_id,capacity)
select 'a1200000-0000-4000-8000-000000000001',id,1
from public.appointment_resources where name like 'CI lifecycle resource %';
-- Synthetic owner B, structurally valid and booked against distinct resources.
insert into auth.sessions(id,user_id) values
 ('b1111111-aaaa-4aaa-8aaa-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
 ('b2222222-aaaa-4aaa-8aaa-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select pg_catalog.set_config('request.jwt.claim.sub',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
select pg_catalog.set_config('request.jwt.claims',
 '{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"b1111111-aaaa-4aaa-8aaa-111111111111"}',false);
with slots as (
 select ('a1210000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid id,
 ('a1200000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid resource_id,
 ('a1220000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid request_nonce,
 case when i=3 then
 ((date_trunc('hour',clock_timestamp() at time zone 'Asia/Manila')+
    interval '1 hour') at time zone 'Asia/Manila')
 else ((date_trunc('day',(clock_timestamp()+interval '200 days') at time zone 'Asia/Manila')+
    interval '10 hours') at time zone 'Asia/Manila') end slot_start
 from generate_series(1,6) i
)
insert into public.appointments
 (id,owner_id,pet_id,resource_id,service_id,request_nonce,
 starts_at,ends_at,concern,created_by)
select s.id,'22222222-2222-4222-8222-222222222222',
 '44444444-4444-4444-8444-444444444444',s.resource_id,
 'a1200000-0000-4000-8000-000000000001',s.request_nonce,
 s.slot_start,s.slot_start+interval '30 minutes',
 'CI lifecycle test case '||right(s.id::text,1),
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' from slots s;
select pg_catalog.set_config('request.jwt.claim.sub','',false);
select pg_catalog.set_config('request.jwt.claims','{}',false);

-- Superuser can construct fixtures; browser roles cannot directly confirm.
set role authenticated;
set request.jwt.claim.sub='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"c2222222-aaaa-4aaa-8aaa-222222222222"}';
do $positive$
declare v jsonb;again jsonb; v_app uuid:='a1210000-0000-4000-8000-000000000001';
begin
 begin
  update public.appointments set status='confirmed' where id=v_app;
  raise exception 'LIFECYCLE_FAIL: staff bypassed transactional RPC';
 exception when insufficient_privilege then null;end;
 v:=public.transition_staff_appointment(v_app,
  '22222222-0000-4000-8000-000000000077','confirm',1,
  'a1300000-0000-4000-8000-000000000001');
 again:=public.transition_staff_appointment(v_app,
  '22222222-0000-4000-8000-000000000077','confirm',1,
  'a1300000-0000-4000-8000-000000000001');
 if v is distinct from again or v->>'status'<>'confirmed'
    or (v->>'revision')::int<>2 then
  raise exception 'LIFECYCLE_FAIL: nonce replay/new status';end if;
 begin
  perform public.transition_staff_appointment(v_app,
   '22222222-0000-4000-8000-000000000077','cancel',1,
   'a1300000-0000-4000-8000-000000000001');
  raise exception 'LIFECYCLE_FAIL: changed payload reused nonce';
 exception when unique_violation then null;end;
 begin
  perform public.transition_staff_appointment(v_app,
   '22222222-0000-4000-8000-000000000077','check_in',1,gen_random_uuid());
  raise exception 'LIFECYCLE_FAIL: stale expected revision accepted';
 exception when serialization_failure then null;end;
end $positive$;
reset role;
do $audit$
begin
 if (select count(*) from clinic_private.appointment_transition_events
    where appointment_id='a1210000-0000-4000-8000-000000000001'
    and actor_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
    and old_revision=1 and new_revision=2 and old_status='requested'
    and new_status='confirmed')<>1
 or (select count(*) from clinic_private.appointment_transition_receipts
    where appointment_id='a1210000-0000-4000-8000-000000000001')<>1 then
  raise exception 'LIFECYCLE_FAIL: immutable staff audit/nonce cardinality';end if;
end $audit$;

-- Branch receptionist may decline requested but cannot use Naga branch.
set role authenticated;
set request.jwt.claim.sub='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"c3333333-aaaa-4aaa-8aaa-333333333333"}';
do $receptionist$
declare r jsonb;
begin
 begin
  perform public.transition_staff_appointment(
  'a1210000-0000-4000-8000-000000000002',
  '11111111-0000-4000-8000-000000000077','decline',1,gen_random_uuid());
  raise exception 'LIFECYCLE_FAIL: wrong branch accepted';
 exception when insufficient_privilege then null;end;
 r:=public.transition_staff_appointment(
  'a1210000-0000-4000-8000-000000000002',
  '22222222-0000-4000-8000-000000000077','decline',1,
  'a1300000-0000-4000-8000-000000000002');
 if r->>'status'<>'cancelled' or r->>'action'<>'decline' then
  raise exception 'LIFECYCLE_FAIL: requested decline not persisted';end if;
end $receptionist$;
reset role;

-- Owner B direct cancellation still works through the original frontend
-- .update({status:'cancelled'}) path, but now increments the CAS version.
set role authenticated;
set request.jwt.claim.sub='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"b1111111-aaaa-4aaa-8aaa-111111111111"}';
do $owner$
begin
 begin
  update public.appointments set status='confirmed'
   where id='a1210000-0000-4000-8000-000000000005';
  raise exception 'LIFECYCLE_FAIL: owner directly confirmed request';
 exception when insufficient_privilege then null;end;
 update public.appointments set status='cancelled'
   where id='a1210000-0000-4000-8000-000000000005';
 if (select lifecycle_revision from public.appointments
    where id='a1210000-0000-4000-8000-000000000005')<>2
 then raise exception 'LIFECYCLE_FAIL: owner cancellation omitted CAS';end if;
 begin
  perform public.transition_staff_appointment(
  'a1210000-0000-4000-8000-000000000006',
  '22222222-0000-4000-8000-000000000077','confirm',1,gen_random_uuid());
  raise exception 'LIFECYCLE_FAIL: owner gained staff power';
 exception when insufficient_privilege then null;end;
end $owner$;
reset role;

-- Positive visit transition: check-in only inside visit window;
-- completion requires a real branch_encounter linked to same patient.
set role authenticated;
set request.jwt.claim.sub='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"c2222222-aaaa-4aaa-8aaa-222222222222"}';
do $checkin$
declare v jsonb;
begin
 perform public.transition_staff_appointment(
  'a1210000-0000-4000-8000-000000000003',
  '22222222-0000-4000-8000-000000000077','confirm',1,
  'a1300000-0000-4000-8000-000000000003');
 v:=public.transition_staff_appointment(
  'a1210000-0000-4000-8000-000000000003',
  '22222222-0000-4000-8000-000000000077','check_in',2,
  'a1300000-0000-4000-8000-000000000004');
 if v->>'status'<>'checked_in' then raise exception 'LIFECYCLE_FAIL: check-in';end if;
 begin
  perform public.transition_staff_appointment(
   'a1210000-0000-4000-8000-000000000003',
   '22222222-0000-4000-8000-000000000077','complete',3,
   'a1300000-0000-4000-8000-000000000005');
  raise exception 'LIFECYCLE_FAIL: completed without visit record';
 exception when check_violation then null;end;
end $checkin$;
reset role;
insert into public.branch_encounters(appointment_id,branch_id,pet_id,opened_by)
 values('a1210000-0000-4000-8000-000000000003',
 '22222222-0000-4000-8000-000000000077',
 '44444444-4444-4444-8444-444444444444',
 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
set role authenticated;
set request.jwt.claim.sub='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"c2222222-aaaa-4aaa-8aaa-222222222222"}';
do $complete$
declare v jsonb;
begin
 v:=public.transition_staff_appointment(
 'a1210000-0000-4000-8000-000000000003',
 '22222222-0000-4000-8000-000000000077','complete',3,
 'a1300000-0000-4000-8000-000000000006');
 if v->>'status'<>'completed' or (v->>'revision')::integer<>4 then
  raise exception 'LIFECYCLE_FAIL: complete status/revision';end if;
 begin
  perform public.transition_staff_appointment(
  'a1210000-0000-4000-8000-000000000001',
  '22222222-0000-4000-8000-000000000077','no_show',2,gen_random_uuid());
  raise exception 'LIFECYCLE_FAIL: future no-show accepted';
 exception when check_violation then null;end;
end $complete$;
reset role;

-- Negative browser/Auth cases: anonymous, missing JWT, stale claims,
-- other owner, accountant, revoked global membership and deleted session.
set role anon;
do $anonymous$
begin
 begin
  perform public.transition_staff_appointment(
  'a1210000-0000-4000-8000-000000000006',
  '22222222-0000-4000-8000-000000000077','confirm',1,gen_random_uuid());
  raise exception 'LIFECYCLE_FAIL: anon invoked staff RPC';
 exception when insufficient_privilege then null;end;
end $anonymous$;
reset role;
set role authenticated;
set request.jwt.claim.sub='bbbbbbbb-6666-4666-8666-bbbbbbbbbbbb';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"c1111111-aaaa-4aaa-8aaa-111111111111"}';
do $accountant$
begin
 begin
  perform public.transition_staff_appointment(
  'a1210000-0000-4000-8000-000000000006',
  '22222222-0000-4000-8000-000000000077','confirm',1,gen_random_uuid());
  raise exception 'LIFECYCLE_FAIL: accountant gained staff clinical transition';
 exception when insufficient_privilege then null;end;
end $accountant$;
reset role;
set role authenticated;
set request.jwt.claim.sub='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"b1111111-aaaa-4aaa-8aaa-111111111111"}';
do $other_owner$
begin
 begin
  perform public.transition_staff_appointment(
   'a1210000-0000-4000-8000-000000000001',
   '22222222-0000-4000-8000-000000000077','cancel',2,gen_random_uuid());
  raise exception 'LIFECYCLE_FAIL: owner without staff grant transitioned status';
 exception when insufficient_privilege then null;end;
end $other_owner$;
reset role;
set role authenticated;
set request.jwt.claim.sub='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":1,"session_id":"c2222222-aaaa-4aaa-8aaa-222222222222"}';
do $expired$
begin
 begin
  perform public.transition_staff_appointment(
   'a1210000-0000-4000-8000-000000000006',
   '22222222-0000-4000-8000-000000000077','confirm',1,gen_random_uuid());
  raise exception 'LIFECYCLE_FAIL: expired JWT passed';
 exception when insufficient_privilege then null;end;
end $expired$;
reset role;
begin;
delete from auth.sessions where id='c2222222-aaaa-4aaa-8aaa-222222222222';
set local role authenticated;
set local request.jwt.claim.sub='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
set local request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"c2222222-aaaa-4aaa-8aaa-222222222222"}';
do $deleted_session$
begin
 begin
  perform public.transition_staff_appointment(
   'a1210000-0000-4000-8000-000000000006',
   '22222222-0000-4000-8000-000000000077','confirm',1,gen_random_uuid());
  raise exception 'LIFECYCLE_FAIL: deleted Auth session still transitioned';
 exception when insufficient_privilege then null;end;
end $deleted_session$;
rollback;
begin;
update public.staff_memberships set is_active=false
 where user_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
set local role authenticated;
set local request.jwt.claim.sub='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
set local request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"c3333333-aaaa-4aaa-8aaa-333333333333"}';
do $revoked$
begin
 begin
  perform public.transition_staff_appointment(
   'a1210000-0000-4000-8000-000000000006',
   '22222222-0000-4000-8000-000000000077','confirm',1,gen_random_uuid());
  raise exception 'LIFECYCLE_FAIL: revoked staff still transitioned';
 exception when insufficient_privilege then null;end;
end $revoked$;
rollback;

-- Reconfirm historical identity, exact-one audit event, owner cancellation.
do $final$
begin
 if (select status from public.appointments
   where id='55555555-5555-4555-8555-555555555555')<>'requested'
 or (select branch_id from public.appointments
   where id='55555555-5555-4555-8555-555555555555') is not null
 or (select count(*) from clinic_private.appointment_transition_events
   where appointment_id='a1210000-0000-4000-8000-000000000001')<>1
 or (select status from public.appointments
   where id='a1210000-0000-4000-8000-000000000005')<>'cancelled'
 then raise exception 'LIFECYCLE_FAIL: final audit/history reconciliation';end if;
end $final$;
\echo 'PASS: staff appointment confirmed/declined/check-in/completed, immutable nonce replay, CAS stale denial, owner cancellation retained, cross-branch/accountant/anon/expired/revoked/deleted session denied, historical Chow Chow preserved'
