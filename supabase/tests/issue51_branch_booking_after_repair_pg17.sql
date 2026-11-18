-- ISSUE #51 AFTER REPAIR: disposable PostgreSQL 17 ONLY.
-- Original 11 + historical snapshots + immutable proposed #12 + additive #13
-- already applied by workflow. All synthetic booking policy changes ROLLBACK.
\set ON_ERROR_STOP on
begin;
set search_path=public,extensions,pg_catalog;
do $preflight$
declare first_trigger text; second_trigger text;
begin
 if (select count(*) from public.clinic_branches where booking_enabled)<>0
 or (select count(*) from public.branch_booking_policies where is_approved)<>0
 or (select count(*) from public.clinic_services)<>0
 or (select count(*) from public.appointments
   where id='55555555-5555-4555-8555-555555555555'
   and branch_id is null and status='requested'
   and service_id is null and request_nonce is null)<>1 then
   raise exception 'ISSUE51_FIX_FAIL: original history or default OFF changed';
 end if;
 select tgname into first_trigger from pg_trigger
 where tgrelid='public.appointments'::regclass and tgname='appointment_branch_guard'
 and (tgtype & 1)=1 and (tgtype & 2)=2 and (tgtype & 4)=4;
 select tgname into second_trigger from pg_trigger
 where tgrelid='public.appointments'::regclass and tgname='appointment_service_booking_guard'
 and (tgtype & 1)=1 and (tgtype & 2)=2 and (tgtype & 4)=4;
 if first_trigger is null or second_trigger is null
 or first_trigger >= second_trigger
 or (select prosecdef from pg_proc where oid=
   'clinic_private.validate_service_appointment()'::regprocedure)
 then raise exception 'ISSUE51_FIX_FAIL: branch trigger order or invoker changed';end if;
 if not exists (select 1 from pg_proc where oid=
    'public.request_service_appointment(uuid,uuid,uuid,timestamptz,uuid,text,text)'::regprocedure
    and not prosecdef) then
  raise exception 'ISSUE51_FIX_FAIL: 7-argument SECURITY INVOKER RPC signature lost';
 end if;
end $preflight$;
insert into public.appointment_resources(id,name,branch_id) values
 ('bbbb0000-7777-4777-8777-000000000051',
  'ISSUE51 repaired disposable Naga room',
  '11111111-0000-4000-8000-000000000077'),
 ('bbbb0000-7777-4777-8777-000000000052',
  'ISSUE51 repaired disposable Cavite room',
  '22222222-0000-4000-8000-000000000077');
-- Baseline: without an approved branch/published service all paths denied.
set role authenticated;
set request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false}';
do $off$
begin
 begin
  insert into public.appointments(owner_id,pet_id,resource_id,
   starts_at,ends_at,concern)
   values ('11111111-1111-4111-8111-111111111111',
   '33333333-3333-4333-8333-333333333333',
   'bbbb0000-7777-4777-8777-000000000051',
   now()+interval '18 days',now()+interval '18 days 30 minutes','ISSUE51 OFF direct');
  raise exception 'ISSUE51_FIX_FAIL: OFF direct INSERT accepted';
 exception when check_violation then null;end;
 begin
  perform public.request_service_appointment(
  '33333333-3333-4333-8333-333333333333',
  'cccc0000-7777-4777-8777-000000000051',
  'bbbb0000-7777-4777-8777-000000000051',
  now()+interval '18 days','eeee0000-7777-4777-8777-000000000001',
  'ISSUE51 OFF RPC',null);
  raise exception 'ISSUE51_FIX_FAIL: OFF RPC accepted';
 exception when check_violation then null;end;
end $off$;
reset role;
-- CI-ONLY invents test windows and approvals; no official clinic hours.
update public.clinic_branches
 set booking_enabled=true,owner_approved_at=now(),
     owner_approved_by='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
 where id='11111111-0000-4000-8000-000000000077';
update public.branch_booking_policies
 set is_approved=true,approved_at=now(),
     approved_by='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
     lead_minutes=0,max_advance_days=90,slot_step_minutes=30,
     timezone='Asia/Manila',
     weekly_hours='{"sun":[],"mon":[{"open":"09:00","close":"17:00"}],
     "tue":[],"wed":[],"thu":[],"fri":[],"sat":[]}'::jsonb
 where branch_id='11111111-0000-4000-8000-000000000077';
update public.species_catalog set clinic_supported=true where id='dog';
insert into public.clinic_services(id,slug,display_name,duration_minutes,is_active,
 owner_approved_at,owner_approved_by,published_at,branch_id)
values('cccc0000-7777-4777-8777-000000000051',
 'issue51-test-naga-only','ISSUE51 synthetic Naga dog visit',30,true,now(),
 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',now(),
 '11111111-0000-4000-8000-000000000077');
insert into public.clinic_service_species(service_id,species_id)
 values('cccc0000-7777-4777-8777-000000000051','dog');
insert into public.clinic_service_resources(service_id,resource_id,capacity)
 values('cccc0000-7777-4777-8777-000000000051',
        'bbbb0000-7777-4777-8777-000000000051',1);
-- A real historical owner B's cat remains unchanged, so add a different
-- synthetic owner-B DOG for valid second-owner exclusion-conflict testing.
insert into public.pets(id,owner_id,name,species,breed)
 values('99990000-7777-4777-8777-000000000051',
 '22222222-2222-4222-8222-222222222222','ISSUE51 CI second owner dog','Dog','Chow Chow');
-- Authenticated, verified owner A can view only approved Naga branch policy.
set role authenticated;
set request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false}';
do $owner_a$
declare t timestamptz; id1 uuid; id2 uuid; direct_id uuid;
 n integer;
begin
 if exists(select 1 from public.clinic_booking_policy where policy_id=1)
 or (select count(*) from public.branch_booking_policies where is_approved)<>1
 or (select count(*) from public.clinic_services
   where id='cccc0000-7777-4777-8777-000000000051')<>1 then
  raise exception 'ISSUE51_FIX_FAIL: hidden singleton or published Naga authorization inconsistent';
 end if;
 t:=(date_trunc('week',now() at time zone 'Asia/Manila')+
    interval '14 days 10 hours') at time zone 'Asia/Manila';
 id1:=public.request_service_appointment(
   '33333333-3333-4333-8333-333333333333',
   'cccc0000-7777-4777-8777-000000000051',
   'bbbb0000-7777-4777-8777-000000000051',
   t,'eeee0000-7777-4777-8777-000000000011',
   'ISSUE51 approved synthetic owner booking',null);
 id2:=public.request_service_appointment(
   '33333333-3333-4333-8333-333333333333',
   'cccc0000-7777-4777-8777-000000000051',
   'bbbb0000-7777-4777-8777-000000000051',
   t,'eeee0000-7777-4777-8777-000000000011',
   'ISSUE51 approved synthetic owner booking',null);
 if id1 is null or id1 is distinct from id2
  or (select count(*) from public.appointments where id=id1
   and owner_id='11111111-1111-4111-8111-111111111111'
   and pet_id='33333333-3333-4333-8333-333333333333'
   and branch_id='11111111-0000-4000-8000-000000000077'
   and service_id='cccc0000-7777-4777-8777-000000000051'
   and request_nonce='eeee0000-7777-4777-8777-000000000011'
   and status='requested' and starts_at=t
   and ends_at=t+interval '30 minutes')<>1 then
  raise exception 'ISSUE51_FIX_FAIL: approved Naga RPC or idempotency incorrect';end if;
 begin
  perform public.request_service_appointment(
   '33333333-3333-4333-8333-333333333333',
   'cccc0000-7777-4777-8777-000000000051',
   'bbbb0000-7777-4777-8777-000000000051',
   t,'eeee0000-7777-4777-8777-000000000011',
   'ISSUE51 altered nonce concern',null);
  raise exception 'ISSUE51_FIX_FAIL: changed payload replay accepted';
 exception when unique_violation then null;end;
 -- BOTH service-less and service-without-nonce paths are denied, with zero writes.
 begin
  insert into public.appointments(owner_id,pet_id,resource_id,
   starts_at,ends_at,concern)
  values('11111111-1111-4111-8111-111111111111',
   '33333333-3333-4333-8333-333333333333',
   'bbbb0000-7777-4777-8777-000000000051',
   t+interval '2 hours',t+interval '2 hours 30 minutes',
   'ISSUE51 post-fix legacy forbidden');
  raise exception 'ISSUE51_FIX_FAIL: legacy service-less bypass persists';
 exception when check_violation then null;end;
 begin
  insert into public.appointments(owner_id,pet_id,resource_id,service_id,
   starts_at,ends_at,concern)
  values('11111111-1111-4111-8111-111111111111',
   '33333333-3333-4333-8333-333333333333',
   'bbbb0000-7777-4777-8777-000000000051',
   'cccc0000-7777-4777-8777-000000000051',
   t+interval '2 hours',t+interval '2 hours 30 minutes',
   'ISSUE51 nonce missing forbidden');
  raise exception 'ISSUE51_FIX_FAIL: service without nonce accepted';
 exception when check_violation then null;end;
 -- A legitimate direct INSERT with service and nonce is also secure (no RPC bypass).
 insert into public.appointments(owner_id,pet_id,resource_id,service_id,
    request_nonce,starts_at,ends_at,concern)
 values('11111111-1111-4111-8111-111111111111',
    '33333333-3333-4333-8333-333333333333',
    'bbbb0000-7777-4777-8777-000000000051',
    'cccc0000-7777-4777-8777-000000000051',
    'eeee0000-7777-4777-8777-000000000012',
    t+interval '1 hour',t+interval '1 hour 30 minutes',
    'ISSUE51 valid direct insert')
 returning id into direct_id;
 if direct_id is null or not exists(select 1 from public.appointments
    where id=direct_id and status='requested' and
    branch_id='11111111-0000-4000-8000-000000000077') then
   raise exception 'ISSUE51_FIX_FAIL: valid direct service booking denied';end if;
 -- Different nonce, same resource+overlapping time cannot be booked again.
 begin
  perform public.request_service_appointment(
   '33333333-3333-4333-8333-333333333333',
   'cccc0000-7777-4777-8777-000000000051',
   'bbbb0000-7777-4777-8777-000000000051',
   t,'eeee0000-7777-4777-8777-000000000013',
   'ISSUE51 overlapping owner request',null);
  raise exception 'ISSUE51_FIX_FAIL: overlapping resource accepted';
 exception when unique_violation or exclusion_violation then null;end;
 -- Same-branch service paired to Cavite resource always fails while Cavite OFF.
 begin
  perform public.request_service_appointment(
   '33333333-3333-4333-8333-333333333333',
   'cccc0000-7777-4777-8777-000000000051',
   'bbbb0000-7777-4777-8777-000000000052',
   t,'eeee0000-7777-4777-8777-000000000014',
   'ISSUE51 Cavite unauthorized',null);
  raise exception 'ISSUE51_FIX_FAIL: Cavite inactive branch accepted';
 exception when check_violation then null;end;
 -- Reject unapproved scheduling variants and unsupported time windows.
 begin
  perform public.request_service_appointment(
   '33333333-3333-4333-8333-333333333333',
   'cccc0000-7777-4777-8777-000000000051',
   'bbbb0000-7777-4777-8777-000000000051',
   t+interval '5 minutes','eeee0000-7777-4777-8777-000000000015',
   'ISSUE51 invalid 5-min slot',null);
  raise exception 'ISSUE51_FIX_FAIL: invalid slot step accepted';
 exception when check_violation then null;end;
end $owner_a$;
reset role;

-- Owner B cannot forge owner A's pet or book an unsupported Cat.
set role authenticated;
set request.jwt.claim.sub='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false}';
do $owner_b$
declare t timestamptz;
begin
 t:=(date_trunc('week',now() at time zone 'Asia/Manila')+
    interval '14 days 10 hours') at time zone 'Asia/Manila';
 begin
  perform public.request_service_appointment(
   '33333333-3333-4333-8333-333333333333',
   'cccc0000-7777-4777-8777-000000000051',
   'bbbb0000-7777-4777-8777-000000000051',
   t+interval '2 hours','eeee0000-7777-4777-8777-000000000021',
   'ISSUE51 cross-owner forgery',null);
  raise exception 'ISSUE51_FIX_FAIL: unowned pet booking accepted';
 exception when insufficient_privilege then null;end;
 begin
  perform public.request_service_appointment(
   '44444444-4444-4444-8444-444444444444',
   'cccc0000-7777-4777-8777-000000000051',
   'bbbb0000-7777-4777-8777-000000000051',
   t+interval '2 hours','eeee0000-7777-4777-8777-000000000022',
   'ISSUE51 unsupported cat',null);
  raise exception 'ISSUE51_FIX_FAIL: unsupported species accepted';
 exception when check_violation then null;end;
 -- Separate genuine owner and Dog: GiST exclusion MUST reject overlap.
 begin
  perform public.request_service_appointment(
   '99990000-7777-4777-8777-000000000051',
   'cccc0000-7777-4777-8777-000000000051',
   'bbbb0000-7777-4777-8777-000000000051',
   t,'eeee0000-7777-4777-8777-000000000023',
   'ISSUE51 second owner same-resource collision',null);
  raise exception 'ISSUE51_FIX_FAIL: two-owner resource overlap accepted';
 exception when exclusion_violation then null;end;
end $owner_b$;
reset role;

-- Real unconfirmed, anonymous and revoked Auth conditions: not just an
-- arbitrary user_id or JWT role claim. The function checks Auth server rows.
set role authenticated;
set request.jwt.claim.sub='22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false}';
do $unconfirmed$
begin
 begin
  perform public.request_service_appointment(
   '33333333-3333-4333-8333-333333333333',
   'cccc0000-7777-4777-8777-000000000051',
   'bbbb0000-7777-4777-8777-000000000051',
   now()+interval '22 days','eeee0000-7777-4777-8777-000000000031',
   'ISSUE51 unconfirmed denied',null);
  raise exception 'ISSUE51_FIX_FAIL: unconfirmed owner accepted';
 exception when insufficient_privilege then null;end;
end $unconfirmed$;
reset role;
set role authenticated;
set request.jwt.claim.sub='11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set request.jwt.claims='{"role":"authenticated","is_anonymous":true}';
do $anonymous$
begin
 begin
  perform public.request_service_appointment(
   '33333333-3333-4333-8333-333333333333',
   'cccc0000-7777-4777-8777-000000000051',
   'bbbb0000-7777-4777-8777-000000000051',
   now()+interval '22 days','eeee0000-7777-4777-8777-000000000032',
   'ISSUE51 anonymous denied',null);
  raise exception 'ISSUE51_FIX_FAIL: anonymous Auth accepted';
 exception when insufficient_privilege then null;end;
end $anonymous$;
reset role;

-- Check malformed and contradictory policies, holiday and unknown timezone.
-- Use NEW non-conflicting nonce/time each try and read after as true owner.
update public.branch_booking_policies
 set weekly_hours='{"sun":[],"mon":{},"tue":[],"wed":[],"thu":[],"fri":[],"sat":[]}'::jsonb
 where branch_id='11111111-0000-4000-8000-000000000077';
set role authenticated;
set request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false}';
do $bad_schedule$
declare t timestamptz;
begin
 t:=(date_trunc('week',now() at time zone 'Asia/Manila')+
    interval '21 days 10 hours') at time zone 'Asia/Manila';
 begin
  perform public.request_service_appointment(
   '33333333-3333-4333-8333-333333333333',
   'cccc0000-7777-4777-8777-000000000051',
   'bbbb0000-7777-4777-8777-000000000051',
   t,'eeee0000-7777-4777-8777-000000000041',
   'ISSUE51 malformed schedule blocked',null);
  raise exception 'ISSUE51_FIX_FAIL: malformed weekly schedule accepted';
 exception when check_violation then null;end;
end $bad_schedule$;
reset role;
update public.branch_booking_policies
 set weekly_hours='{"sun":[],"mon":[{"open":"09:00","close":"17:00"}],
  "tue":[],"wed":[],"thu":[],"fri":[],"sat":[]}'::jsonb,
  holidays=array[((date_trunc('week',now() at time zone 'Asia/Manila')+
    interval '21 days 10 hours')::date)]
 where branch_id='11111111-0000-4000-8000-000000000077';
set role authenticated;
set request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false}';
do $holiday$
declare t timestamptz;
begin
 t:=(date_trunc('week',now() at time zone 'Asia/Manila')+
    interval '21 days 10 hours') at time zone 'Asia/Manila';
 begin
  perform public.request_service_appointment(
   '33333333-3333-4333-8333-333333333333',
   'cccc0000-7777-4777-8777-000000000051',
   'bbbb0000-7777-4777-8777-000000000051',
   t,'eeee0000-7777-4777-8777-000000000042',
   'ISSUE51 holiday closed',null);
  raise exception 'ISSUE51_FIX_FAIL: closed holiday accepted';
 exception when check_violation then null;end;
end $holiday$;
reset role;
update public.branch_booking_policies
 set holidays='{}',timezone='Not/A_Real_Zone'
 where branch_id='11111111-0000-4000-8000-000000000077';
set role authenticated;
set request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false}';
do $zone$
declare t timestamptz;
begin
 t:=(date_trunc('week',now() at time zone 'Asia/Manila')+
    interval '21 days 10 hours') at time zone 'Asia/Manila';
 begin
  perform public.request_service_appointment(
   '33333333-3333-4333-8333-333333333333',
   'cccc0000-7777-4777-8777-000000000051',
   'bbbb0000-7777-4777-8777-000000000051',
   t,'eeee0000-7777-4777-8777-000000000043',
   'ISSUE51 invalid timezone',null);
  raise exception 'ISSUE51_FIX_FAIL: invented time zone accepted';
 exception when check_violation then null;end;
end $zone$;
reset role;
update public.branch_booking_policies
 set timezone='Asia/Manila'
 where branch_id='11111111-0000-4000-8000-000000000077';

-- Only Naga-scoped receptionist can confirm; Cavite admin cannot see or
-- UPDATE RETURNING the Naga booking despite global old staff grant.
insert into public.staff_branch_memberships(user_id,branch_id,role,is_active)
 values('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  '11111111-0000-4000-8000-000000000077','receptionist',true),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  '22222222-0000-4000-8000-000000000077','administrator',true);
set role authenticated;
set request.jwt.claim.sub='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false}';
do $cavite_staff$
declare n integer; state text;
begin
 update public.appointments set status='confirmed'
 where request_nonce='eeee0000-7777-4777-8777-000000000011'
 returning status into state;
 get diagnostics n=row_count;
 if n<>0 or state is not null then
  raise exception 'ISSUE51_FIX_FAIL: foreign-branch administrator changed Naga status';end if;
end $cavite_staff$;
reset role;
set role authenticated;
set request.jwt.claim.sub='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false}';
do $naga_staff$
declare id1 uuid; n integer;
begin
 select id into id1 from public.appointments
  where request_nonce='eeee0000-7777-4777-8777-000000000011';
 update public.appointments set status='confirmed'
  where id=id1 and status='requested';
 get diagnostics n=row_count;
 if n<>1 or (select status from public.appointments where id=id1)<>'confirmed'
 or (select count(*) from public.appointment_events
    where appointment_id=id1 and new_status='confirmed')<>1 then
  raise exception 'ISSUE51_FIX_FAIL: Naga authorized confirmed/status audit lost';end if;
end $naga_staff$;
reset role;

-- Owner exact-replay after confirmation returns ID (NOT a new confirmed
-- booking); application must read persisted status, not manufacture it.
set role authenticated;
set request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false}';
do $confirmed_replay$
declare t timestamptz; id1 uuid;
begin
 t:=(date_trunc('week',now() at time zone 'Asia/Manila')+
    interval '14 days 10 hours') at time zone 'Asia/Manila';
 id1:=public.request_service_appointment(
   '33333333-3333-4333-8333-333333333333',
   'cccc0000-7777-4777-8777-000000000051',
   'bbbb0000-7777-4777-8777-000000000051',
   t,'eeee0000-7777-4777-8777-000000000011',
   'ISSUE51 approved synthetic owner booking',null);
 if id1 is null or
 (select count(*) from public.appointments
    where id=id1 and status='confirmed'
      and request_nonce='eeee0000-7777-4777-8777-000000000011')<>1 then
  raise exception 'ISSUE51_FIX_FAIL: confirmed retry rebooked or changed status';end if;
end $confirmed_replay$;
reset role;

-- Privileged final: only TWO approved Naga rows from owner A exist (RPC+direct),
-- historical snapshots and Cavite OFF unchanged, zero forbidden writes.
do $final$
begin
 if (select count(*) from public.appointments
    where request_nonce in (
     'eeee0000-7777-4777-8777-000000000011',
     'eeee0000-7777-4777-8777-000000000012'))<>2
 or exists(select 1 from public.appointments
    where concern like 'ISSUE51%' and (service_id is null or request_nonce is null
       or branch_id<>'11111111-0000-4000-8000-000000000077'))
 or exists(select 1 from public.appointments
    where request_nonce in (
    'eeee0000-7777-4777-8777-000000000014',
    'eeee0000-7777-4777-8777-000000000021',
    'eeee0000-7777-4777-8777-000000000022',
    'eeee0000-7777-4777-8777-000000000023'))
 or (select count(*) from public.clinic_branches where booking_enabled)<>1
 or (select count(*) from public.clinic_branches where slug='cavite' and not booking_enabled)<>1
 or (select count(*) from public.branch_booking_policies where is_approved)<>1
 or exists(select 1 from clinic_ci.issue77_original_pets old
   left join public.pets p using(id) where p.id is null or
   to_jsonb(p) is distinct from old.old_row)
 or exists(select 1 from clinic_ci.issue77_original_appointments old
    left join public.appointments a using(id) where a.id is null or
    (to_jsonb(a)-'branch_id') is distinct from old.old_row)
 or (select count(*) from public.pets
    where id='33333333-3333-4333-8333-333333333333'
      and species='Dog' and breed='Chow Chow' and breed_id='dog-chow-chow')<>1
 or (select count(*) from public.appointments
    where id='55555555-5555-4555-8555-555555555555'
    and branch_id is null and service_id is null and request_nonce is null
    and status='requested')<>1
 then raise exception 'ISSUE51_FIX_FAIL: denied bookings persisted, Cavite leaked or historic Chow Chow changed';end if;
end $final$;
rollback;
\echo 'PASS: ISSUE51 repaired PG17: branch OFF; verified Naga service+schedule; direct bypass denied; Cavite/owner/species/anonymous/unconfirmed/invalid hours denied; exact nonce replay; GiST overlapping owner conflict; scoped staff confirm; historical Chow Chow UNKNOWN'
