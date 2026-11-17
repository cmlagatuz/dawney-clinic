-- ISSUE77: DISPOSABLE PG17 ONLY. Requires original 11 + synthetic legacy
-- patient/appointment fixture + additive candidate migration. No provider access.
set search_path=public,extensions,pg_catalog;
do $$
begin
 if (select count(*) from public.clinic_branches)<>2
   or (select count(*) from public.clinic_branches where booking_enabled)<>0
   or (select count(*) from public.branch_booking_policies where is_approved)<>0
   or (select count(*) from public.staff_branch_memberships)<>0
   or (select count(*) from public.clinic_services)<>0
 then raise exception 'ISSUE77_FAIL: unauthorized branch publication or grants';end if;
 if (select count(*) from public.clinic_branches where slug='naga' and designation='initial')<>1
 or (select count(*) from public.clinic_branches where slug='cavite' and designation='main')<>1
 or exists(select 1 from public.clinic_branches where public_display_hours ? 'sun') then
  raise exception 'ISSUE77_FAIL: launch ordering or Sunday hours invented';end if;
 if (select count(*) from public.pets where id='33333333-3333-4333-8333-333333333333'
   and species='Dog' and breed='Chow Chow'
   and species_id='dog' and breed_id='dog-chow-chow')<>1
 or (select count(*) from public.appointments where id='55555555-5555-4555-8555-555555555555'
   and branch_id is null and status='requested'
   and service_id is null and request_nonce is null)<>1 then
  raise exception 'ISSUE77_FAIL: historical Chow Chow or requested booking changed';end if;
 if exists(select 1 from clinic_ci.issue77_original_pets o
  left join public.pets p using(id)
  where p.id is null or to_jsonb(p) is distinct from o.old_row)
 or exists(select 1 from clinic_ci.issue77_original_appointments o
  left join public.appointments a using(id)
  where a.id is null or to_jsonb(a)-'branch_id' is distinct from o.old_row)
 then raise exception 'ISSUE77_FAIL: legacy data modified';end if;
end $$;

-- Explicit synthetic grants made by trusted CI-only PG superuser, NEVER migrated.
insert into public.staff_branch_memberships(user_id,branch_id,role,is_active) values
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-0000-4000-8000-000000000077','veterinarian',true),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','22222222-0000-4000-8000-000000000077','receptionist',true),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','22222222-0000-4000-8000-000000000077','administrator',true),
 ('ffffffff-ffff-4fff-8fff-ffffffffffff','11111111-0000-4000-8000-000000000077','veterinarian',true);
insert into public.appointment_resources(id,name,branch_id) values
 ('11111111-7777-4777-8777-111111111111','Naga — CI resource','11111111-0000-4000-8000-000000000077'),
 ('22222222-7777-4777-8777-222222222222','Cavite — CI resource','22222222-0000-4000-8000-000000000077');

-- Same owner and pet at two branches: truly shared identity, separate chart history.
insert into public.appointments
 (id,owner_id,pet_id,resource_id,starts_at,ends_at,status,concern,created_by)
values
 ('aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa',
 '11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333',
 '11111111-7777-4777-8777-111111111111',now()+interval '30 days',
 now()+interval '30 days 30 minutes','requested','CI Naga visit',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('bbbbbbbb-7777-4777-8777-bbbbbbbbbbbb',
 '11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333',
 '22222222-7777-4777-8777-222222222222',now()+interval '31 days',
 now()+interval '31 days 30 minutes','requested','CI Cavite visit',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into public.clinical_records(id,pet_id,branch_id,procedure,authored_by) values
 ('cccccccc-7777-4777-8777-cccccccccccc','33333333-3333-4333-8333-333333333333',
 '11111111-0000-4000-8000-000000000077','Synthetic Naga chart',
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
 ('dddddddd-7777-4777-8777-dddddddddddd','33333333-3333-4333-8333-333333333333',
 '22222222-0000-4000-8000-000000000077','Synthetic Cavite chart',
 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
do $$
begin
 if (select count(*) from public.appointments
  where id in ('aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa','bbbbbbbb-7777-4777-8777-bbbbbbbbbbbb')
    and branch_id is not null and status='requested')<>2 then
  raise exception 'ISSUE77_FAIL: resource-derived branch or requested state missing';end if;
 if (select count(*) from public.appointments
  where id='55555555-5555-4555-8555-555555555555' and branch_id is null)<>1 then
  raise exception 'ISSUE77_FAIL: historic branch fabricated';end if;
end $$;

-- Branch ID tamper cannot bypass appointment/resource link, even via privileged SQL.
do $$
begin
 begin
  insert into public.appointments
    (id,owner_id,pet_id,resource_id,branch_id,starts_at,ends_at,status,concern)
  values
   ('eeeeeeee-7777-4777-8777-eeeeeeeeeeee',
    '11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333',
    '11111111-7777-4777-8777-111111111111',
    '22222222-0000-4000-8000-000000000077',
     now()+interval '40 days',now()+interval '40 days 30 minutes','requested','spoofed branch');
  raise exception 'ISSUE77_FAIL: spoofed appointment branch accepted';
 exception when check_violation then null;end;
 begin
  update public.appointments set branch_id='22222222-0000-4000-8000-000000000077'
   where id='aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa';
  raise exception 'ISSUE77_FAIL: historic branch mutation accepted';
 exception when insufficient_privilege then null;end;
 begin
  update public.appointments set branch_id='11111111-0000-4000-8000-000000000077'
   where id='55555555-5555-4555-8555-555555555555';
  raise exception 'ISSUE77_FAIL: legacy branch attribution without evidence';
 exception when insufficient_privilege then null;end;
end $$;

-- App-selected branch is ignored. Real authorization requires SQL membership.
set role authenticated;
set request.jwt.claim.sub='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
set request.jwt.claims='{"is_anonymous":false}';
set request.jwt.claim.active_branch_id='22222222-0000-4000-8000-000000000077';
do $$
begin
 if (select public.assert_staff_branch('11111111-0000-4000-8000-000000000077')) is null then
  raise exception 'ISSUE77_FAIL: valid branch rejected';end if;
 begin
  perform public.assert_staff_branch('22222222-0000-4000-8000-000000000077');
  raise exception 'ISSUE77_FAIL: browser branch spoof authorized';
 exception when insufficient_privilege then null;end;
 if (select count(*) from public.appointments
     where id in ('aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa',
       'bbbbbbbb-7777-4777-8777-bbbbbbbbbbbb','55555555-5555-4555-8555-555555555555'))<>1
   or (select count(*) from public.clinical_records
     where id in ('cccccccc-7777-4777-8777-cccccccccccc','dddddddd-7777-4777-8777-dddddddddddd'))<>1
 then raise exception 'ISSUE77_FAIL: Naga veterinarian cross-branch history leak';end if;
 if (select count(*) from public.appointment_events e
     where e.appointment_id='bbbbbbbb-7777-4777-8777-bbbbbbbbbbbb')<>0 then
  raise exception 'ISSUE77_FAIL: Cavite appointment event leaked';end if;
 if (select count(*) from public.staff_memberships where user_id<>'dddddddd-dddd-4ddd-8ddd-dddddddddddd')<>0
 then raise exception 'ISSUE77_FAIL: global staff directory exposed';end if;
 if (select count(*) from storage.objects where bucket_id='clinical-attachments')<>0 then
  raise exception 'ISSUE77_FAIL: unattested private Storage chart disclosed';end if;
 begin
  insert into public.staff_branch_memberships(user_id,branch_id,role,is_active)
   values('dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    '22222222-0000-4000-8000-000000000077','veterinarian',true);
  raise exception 'ISSUE77_FAIL: staff granted own foreign branch';
 exception when insufficient_privilege then null;end;
 -- No new booking merely because hours are public; requires owner policy approval.
 begin
  insert into public.appointments(owner_id,pet_id,resource_id,starts_at,ends_at,concern,details)
   values('11111111-1111-4111-8111-111111111111',
    '33333333-3333-4333-8333-333333333333',
    '11111111-7777-4777-8777-111111111111',
    now()+interval '50 days',now()+interval '50 days 30 minutes','Synthetic denied booking',null);
  raise exception 'ISSUE77_FAIL: unapproved branch accepted booking';
 exception when check_violation then null;end;
end $$;
-- Existing requested -> confirmed status transition works only for scoped staff.
update public.appointments set status='confirmed'
 where id='aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa';
do $$
begin
 if (select status from public.appointments
   where id='aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa')<>'confirmed' then
  raise exception 'ISSUE77_FAIL: valid confirmation denied';end if;
 if exists(select 1 from public.appointments
  where id='bbbbbbbb-7777-4777-8777-bbbbbbbbbbbb') then
  raise exception 'ISSUE77_FAIL: staff sees foreign branch post-update';end if;
end $$;
reset role;

-- Cavite admin has global admin role BUT only Cavite branch membership.
set role authenticated;
set request.jwt.claim.sub='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
do $$
begin
 if (select count(*) from public.appointments
  where id in ('aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa','bbbbbbbb-7777-4777-8777-bbbbbbbbbbbb'))<>1
  or exists(select 1 from public.clinical_records
    where id='cccccccc-7777-4777-8777-cccccccccccc') then
  raise exception 'ISSUE77_FAIL: global administrator gained ungranted Naga data';end if;
 begin
  perform public.assert_staff_branch('11111111-0000-4000-8000-000000000077');
  raise exception 'ISSUE77_FAIL: admin ungranted branch switch';
 exception when insufficient_privilege then null;end;
end $$;
reset role;

set role authenticated;
set request.jwt.claim.sub='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
do $$
begin
 if (select count(*) from public.appointments
  where id='bbbbbbbb-7777-4777-8777-bbbbbbbbbbbb')<>1
  or (select count(*) from public.clinical_records)<>0 then
  raise exception 'ISSUE77_FAIL: receptionist clinical privacy or branch queue';end if;
end $$;
reset role;

-- Same actual owner reads their own cross-branch history, no foreign profiles.
set role authenticated;
set request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
do $$
begin
 if (select count(*) from public.appointments where owner_id=
   '11111111-1111-4111-8111-111111111111')<>3
 or (select count(*) from public.clinical_records where pet_id=
   '33333333-3333-4333-8333-333333333333')<>2
 or (select count(*) from public.owners where id='22222222-2222-4222-8222-222222222222')<>0 then
  raise exception 'ISSUE77_FAIL: shared owner chart or foreign owner isolation';end if;
end $$;
reset role;

set role authenticated;
set request.jwt.claim.sub='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
do $$
begin
 if exists(select 1 from public.appointments a
  where a.owner_id='11111111-1111-4111-8111-111111111111')
 or exists(select 1 from public.clinical_records
  where pet_id='33333333-3333-4333-8333-333333333333') then
  raise exception 'ISSUE77_FAIL: cross-owner data leak';end if;
end $$;
reset role;

-- Explicit multi-branch staff grant is legal only via privileged authority.
insert into public.staff_branch_memberships(user_id,branch_id,role,is_active)
values('dddddddd-dddd-4ddd-8ddd-dddddddddddd',
 '22222222-0000-4000-8000-000000000077','veterinarian',true);
set role authenticated;
set request.jwt.claim.sub='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
do $$
begin
 if public.assert_staff_branch('22222222-0000-4000-8000-000000000077')
 <> '22222222-0000-4000-8000-000000000077'::uuid or
 (select count(*) from public.clinical_records where pet_id=
  '33333333-3333-4333-8333-333333333333')<>2 then
  raise exception 'ISSUE77_FAIL: explicitly granted multi-branch doctor blocked';end if;
end $$;
reset role;
update public.staff_branch_memberships set is_active=false
 where user_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
set role authenticated;
set request.jwt.claim.sub='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
do $$
begin
 if exists(select 1 from public.appointments
  where id in ('aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa',
   'bbbbbbbb-7777-4777-8777-bbbbbbbbbbbb'))
 or exists(select 1 from public.clinical_records)
 then raise exception 'ISSUE77_FAIL: branch revocation not immediate';end if;
 begin
  perform public.assert_staff_branch('11111111-0000-4000-8000-000000000077');
  raise exception 'ISSUE77_FAIL: revoked doctor branch switch allowed';
 exception when insufficient_privilege then null;end;
end $$;
reset role;

-- Revoked veterinarian global inactive despite malicious active branch row.
set role authenticated;
set request.jwt.claim.sub='ffffffff-ffff-4fff-8fff-ffffffffffff';
do $$
begin
 if exists(select 1 from public.appointments
  where id='aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa')
 or exists(select 1 from public.clinical_records)
 then raise exception 'ISSUE77_FAIL: global revoked staff bypassed scope';end if;
end $$;
reset role;
do $$
begin
 if (select status from public.appointments
  where id='55555555-5555-4555-8555-555555555555')<>'requested' or
 (select branch_id from public.appointments
  where id='55555555-5555-4555-8555-555555555555') is not null or
 (select status from public.appointments
  where id='aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa')<>'confirmed' then
  raise exception 'ISSUE77_FAIL: statuses or historical branch changed';end if;
end $$;

-- Queue completeness: scoped branch RLS must not accidentally truncate 251 rows
-- to the first 250; a Cavite row at the same times must never leak into Naga.
insert into public.appointments
 (id,owner_id,pet_id,resource_id,starts_at,ends_at,status,concern,created_by)
select gen_random_uuid(),
 '11111111-1111-4111-8111-111111111111',
 '33333333-3333-4333-8333-333333333333',
 '11111111-7777-4777-8777-111111111111',
 now()+interval '100 days'+(i * interval '40 minutes'),
 now()+interval '100 days'+(i * interval '40 minutes')+interval '30 minutes',
 'requested','CI synthetic Naga queue',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
from generate_series(1,251) i;
insert into public.appointments
 (id,owner_id,pet_id,resource_id,starts_at,ends_at,status,concern,created_by)
values(gen_random_uuid(),
 '11111111-1111-4111-8111-111111111111',
 '33333333-3333-4333-8333-333333333333',
 '22222222-7777-4777-8777-222222222222',
 now()+interval '100 days 40 minutes',now()+interval '100 days 70 minutes',
 'requested','CI synthetic Cavite other-branch queue',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
update public.staff_branch_memberships set is_active=true
 where user_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
   and branch_id='11111111-0000-4000-8000-000000000077';
set role authenticated;
set request.jwt.claim.sub='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
do $$
declare n250 integer; n251 integer; n_all integer;
begin
 select count(*) into n250 from (
  select id from public.appointments
  where starts_at>=now()+interval '100 days'
  order by starts_at,id limit 250
 ) q;
 select count(*) into n251 from (
  select id from public.appointments
  where starts_at>=now()+interval '100 days'
  order by starts_at,id limit 251
 ) q;
 select count(*) into n_all from public.appointments
  where starts_at>=now()+interval '100 days';
 if n250<>250 or n251<>251 or n_all<>251 then
  raise exception 'ISSUE77_FAIL: 250/251 queue pagination or cross-branch filter: %/%/%',
   n250,n251,n_all;end if;
end $$;
reset role;

\echo 'PASS: ISSUE77 real PG17 Naga/Cavite cross-branch RLS, browser spoof, global admin isolation, owner shared chart, revocation, immutable history, requested/confirmed, default unpublished policy and Storage deny'
