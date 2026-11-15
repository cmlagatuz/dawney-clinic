-- Phase5A read-side RLS, queue ordering and 250/251+ boundaries.
-- RUN ONLY on the disposable PG17 service after the six exact repo migrations.
-- This fixture creates NO real Auth users, staff accounts or clinical writes.
-- JWT claims here are unsigned session settings, NOT real hosted token checks.

-- All data below is fabricated in this disposable CI database by postgres.
insert into auth.users(id,email_confirmed_at,is_anonymous) values
 ('11111111-1111-4111-8111-111111111111',now(),false), -- owner A
 ('22222222-2222-4222-8222-222222222222',now(),false), -- owner B
 ('33333333-3333-4333-8333-333333333333',now(),false), -- receptionist
 ('44444444-4444-4444-8444-444444444444',now(),false), -- veterinarian
 ('55555555-5555-4555-8555-555555555555',now(),false), -- administrator
 ('66666666-6666-4666-8666-666666666666',now(),false), -- staff subsequently revoked
 ('77777777-7777-4777-8777-777777777777',now(),true),  -- anonymous Auth identity
 ('88888888-8888-4888-8888-888888888888',null,false); -- unverified identity
insert into public.owners(id,user_id,first_name,last_name) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Synthetic','Owner A'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','Synthetic','Owner B');
insert into public.pets(id,owner_id,name,species) values
 ('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Synthetic A','Dog'),
 ('bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Synthetic B','Cat');
insert into public.staff_memberships(user_id,role) values
 ('33333333-3333-4333-8333-333333333333','receptionist'),
 ('44444444-4444-4444-8444-444444444444','veterinarian'),
 ('55555555-5555-4555-8555-555555555555','administrator'),
 ('66666666-6666-4666-8666-666666666666','veterinarian');
insert into public.appointment_resources(id,name) values
 ('cccccccc-cccc-4ccc-8ccc-000000000001','CI synthetic room A'),
 ('cccccccc-cccc-4ccc-8ccc-000000000002','CI synthetic room B'),
 ('cccccccc-cccc-4ccc-8ccc-000000000003','CI synthetic room C');
insert into public.appointments(
 id,owner_id,pet_id,resource_id,starts_at,ends_at,concern
) values
 ('dddddddd-dddd-4ddd-8ddd-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-000000000001',
  '2032-02-01T09:00:00Z','2032-02-01T09:30:00Z','Synthetic owner A'),
 ('dddddddd-dddd-4ddd-8ddd-000000000002','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb','cccccccc-cccc-4ccc-8ccc-000000000002',
  '2032-02-01T09:00:00Z','2032-02-01T09:30:00Z','Synthetic owner B'),
 ('dddddddd-dddd-4ddd-8ddd-000000000003','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb','cccccccc-cccc-4ccc-8ccc-000000000003',
  '2032-02-01T10:00:00Z','2032-02-01T10:30:00Z','Synthetic owner B');

-- A valid browser role can read only its own appointment; staff read all.
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select set_config('request.jwt.claims','{"role":"authenticated","is_anonymous":false}',false);
do $owner_a$
begin
 if (select count(*) from public.appointments)<>1
   or (select count(*) from public.appointments
       where owner_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')<>0
   or (select count(*) from public.staff_memberships)<>0
   or clinic_private.has_staff_role(array['receptionist','veterinarian','administrator']) then
  raise exception 'Owner A gained another owner appointment or staff queue role';
 end if;
end $owner_a$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
do $owner_b$
begin
 if (select count(*) from public.appointments)<>2
   or (select count(*) from public.appointments
        where owner_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')<>0
   or (select count(*) from public.staff_memberships)<>0 then
  raise exception 'Owner B crossed appointment or membership RLS boundary';
 end if;
end $owner_b$;

-- Active authorized roles see full queue and only their membership (admin sees all).
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
do $receptionist$
begin
 if not clinic_private.has_staff_role(array['receptionist'])
   or (select count(*) from public.appointments)<>3
   or (select count(distinct owner_id) from public.appointments)<>2
   or (select count(*) from public.staff_memberships)<>1 then
  raise exception 'Active receptionist staff appointment/membership RLS broken';
 end if;
end $receptionist$;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',false);
do $veterinarian$
begin
 if not clinic_private.has_staff_role(array['veterinarian'])
   or (select count(*) from public.appointments)<>3
   or (select count(*) from public.staff_memberships)<>1 then
  raise exception 'Active veterinarian staff appointment/membership RLS broken';
 end if;
end $veterinarian$;
select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',false);
do $admin$
begin
 if not clinic_private.has_staff_role(array['administrator'])
   or (select count(*) from public.appointments)<>3
   or (select count(*) from public.staff_memberships)<>4 then
  raise exception 'Active administrator cannot read scoped clinic queue/memberships';
 end if;
end $admin$;
select set_config('request.jwt.claim.sub','66666666-6666-4666-8666-666666666666',false);
do $staff_pre_revoke$
begin
 if not clinic_private.has_staff_role(array['veterinarian'])
   or (select count(*) from public.appointments)<>3 then
  raise exception 'Pre-revocation staff fixture invalid';
 end if;
end $staff_pre_revoke$;
reset role;
update public.staff_memberships set is_active=false
 where user_id='66666666-6666-4666-8666-666666666666';
set role authenticated;
select set_config('request.jwt.claim.sub','66666666-6666-4666-8666-666666666666',false);
do $staff_post_revoke$
begin
 -- Self membership remains readable by design; role is inactive, queue invisible.
 if clinic_private.has_staff_role(array['veterinarian'])
    or (select count(*) from public.appointments)<>0
    or (select count(*) from public.staff_memberships)<>1
    or (select is_active from public.staff_memberships
        where user_id='66666666-6666-4666-8666-666666666666') is distinct from false then
  raise exception 'Revoked staff retained full-clinic queue authorization';
 end if;
end $staff_post_revoke$;

-- Verified ID alone is insufficient for a simulated anonymous Auth actor.
select set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777777',false);
select set_config('request.jwt.claims','{"role":"authenticated","is_anonymous":true}',false);
do $anonymous_auth$
begin
 if clinic_private.is_permanent_user()
   or clinic_private.has_staff_role(array['receptionist','veterinarian','administrator'])
   or (select count(*) from public.appointments)<>0 then
  raise exception 'Anonymous Auth identity saw staff queue';
 end if;
end $anonymous_auth$;
-- An anonymous JWT flag must also revoke even a previously valid staff actor.
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
do $flagged_staff$
begin
 if clinic_private.is_permanent_user()
   or clinic_private.has_staff_role(array['receptionist'])
   or (select count(*) from public.appointments)<>0 then
  raise exception 'Anonymous claim bypassed permanent staff RLS gate';
 end if;
end $flagged_staff$;
select set_config('request.jwt.claim.sub','88888888-8888-4888-8888-888888888888',false);
select set_config('request.jwt.claims','{"role":"authenticated","is_anonymous":false}',false);
do $unconfirmed$
begin
 if clinic_private.is_permanent_user()
   or (select count(*) from public.appointments)<>0 then
  raise exception 'Unconfirmed identity accessed appointments';
 end if;
end $unconfirmed$;

set role anon;
select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',false);
do $anon_pg_role$
declare refused boolean:=false;
begin
 begin
  perform count(*) from public.appointments;
 exception when insufficient_privilege then refused:=true;
 end;
 if not refused then raise exception 'SQL anon role selected appointments using forged staff sub'; end if;
end $anon_pg_role$;
reset role;
select 'PASS: real Phase2/3 SQL RLS staff roles, revoked, anonymous, owner A/B and clinic-wide appointment visibility' as rls_verdict;

-- Test the actual SQL ORDER/LIMIT/WHERE semantics requested by the JS adapter.
-- All 300 synthetic appointments occupy the same UTC instant but distinct rooms.
-- The stable id ASC tie-break is mandatory, not a PostgREST mock ordering claim.
create function clinic_ci.seed_queue(first_index integer,last_index integer)
returns void language plpgsql security invoker set search_path='' as $seed$
declare i integer; resource_uuid uuid; booking_uuid uuid;
begin
 for i in first_index..last_index loop
  resource_uuid:=('eeeeeeee-eeee-4eee-8eee-'||lpad(i::text,12,'0'))::uuid;
  booking_uuid:=('ffffffff-ffff-4fff-8fff-'||lpad(i::text,12,'0'))::uuid;
  insert into public.appointment_resources(id,name)
  values(resource_uuid,'CI queue room '||i);
  insert into public.appointments(
    id,owner_id,pet_id,resource_id,starts_at,ends_at,concern
  ) values (
    booking_uuid,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
    resource_uuid,
    '2032-01-02T09:00:00Z','2032-01-02T09:30:00Z','Synthetic queue-only visit'
  );
 end loop;
end $seed$;
revoke all on function clinic_ci.seed_queue(integer,integer) from public,anon,authenticated;
create function clinic_ci.assert_queue(expected_total integer)
returns void language plpgsql security invoker set search_path='' as $assert$
declare ids uuid[]; n integer; actual_total integer; i integer; expected_id uuid;
begin
 select count(*) into actual_total from public.appointments
 where starts_at >= '2032-01-02T00:00:00Z'::timestamptz
   and starts_at < '2032-01-03T00:00:00Z'::timestamptz;
 if actual_total<>expected_total then
  raise exception 'PG17 RLS window expected % total visits, saw %',expected_total,actual_total;
 end if;
 select array_agg(id order by starts_at,id) into ids
 from (
  select id,starts_at from public.appointments
  where starts_at >= '2032-01-02T00:00:00Z'::timestamptz
    and starts_at < '2032-01-03T00:00:00Z'::timestamptz
  order by starts_at asc,id asc limit 251
 ) queue_rows;
 n:=coalesce(array_length(ids,1),0);
 if n<>least(expected_total,251) or (n>250)<>(expected_total>250) then
  raise exception 'PG17 queue completeness boundary wrong: total %, fetched %',expected_total,n;
 end if;
 for i in 1..n loop
  expected_id:=('ffffffff-ffff-4fff-8fff-'||lpad(i::text,12,'0'))::uuid;
  if ids[i] is distinct from expected_id then
   raise exception 'PG17 same-time deterministic id tie-break wrong at index %',i;
  end if;
 end loop;
end $assert$;
grant usage on schema clinic_ci to authenticated;
grant execute on function clinic_ci.assert_queue(integer) to authenticated;

-- No extra SQL rows at all is a valid complete queue.
set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
select clinic_ci.assert_queue(0);
reset role;
select clinic_ci.seed_queue(1,249);
set role authenticated;
select clinic_ci.assert_queue(249);
reset role;
select clinic_ci.seed_queue(250,250);
set role authenticated;
select clinic_ci.assert_queue(250);
reset role;
select clinic_ci.seed_queue(251,251);
set role authenticated;
select clinic_ci.assert_queue(251);
reset role;
select clinic_ci.seed_queue(252,300);
set role authenticated;
select clinic_ci.assert_queue(300);

-- A full-clinic staff queue must not leak to another non-staff owner or revoked user.
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
do $owner_b_queue$
begin
 if (select count(*) from public.appointments
  where starts_at >= '2032-01-02T00:00:00Z'
    and starts_at < '2032-01-03T00:00:00Z')<>0 then
  raise exception 'Owner B saw another owners 300 queue rows';
 end if;
end $owner_b_queue$;
select set_config('request.jwt.claim.sub','66666666-6666-4666-8666-666666666666',false);
do $revoked_queue$
begin
 if (select count(*) from public.appointments
  where starts_at >= '2032-01-02T00:00:00Z'
    and starts_at < '2032-01-03T00:00:00Z')<>0 then
  raise exception 'Revoked staff saw 300 queue rows';
 end if;
end $revoked_queue$;
reset role;
select 'PASS: real PG17 queue 0/249/250/251/300, stable identical-time (starts_at,id) ordering and nonstaff denials' as queue_verdict;
