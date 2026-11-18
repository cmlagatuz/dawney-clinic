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

-- P1: prove that global staff roles cannot mutate owner/pet identity through
-- Phase2 permissive UPDATE/INSERT policies. CI-only users, no hosted requests.
-- Owner B/pet B is Cavite-only; owner A/pet A is shared across Naga/Cavite.
insert into public.appointments
 (id,owner_id,pet_id,resource_id,starts_at,ends_at,status,concern,created_by)
values('bbbbbbbb-7777-4777-8777-cccccccccccc',
 '22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444',
 '22222222-7777-4777-8777-222222222222',
 now()+interval '33 days',now()+interval '33 days 30 minutes',
 'requested','CI Cavite-only patient',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
create table clinic_ci.issue77_p1_owner_snapshot as
 select o.id,to_jsonb(o) old_row from public.owners o
 where o.id in ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');
create table clinic_ci.issue77_p1_pet_snapshot as
 select p.id,to_jsonb(p) old_row from public.pets p
 where p.id in ('33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444');

-- Temporarily simulate Naga-ONLY receptionist and administrator grants. Keep
-- the established Cavite role fixtures unchanged after this isolated block.
update public.staff_branch_memberships set is_active=false
 where user_id in
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')
 and branch_id='22222222-0000-4000-8000-000000000077';
insert into public.staff_branch_memberships(user_id,branch_id,role,is_active)
 values
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-0000-4000-8000-000000000077','receptionist',true),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','11111111-0000-4000-8000-000000000077','administrator',true);

-- Naga-only receptionist: shared identities are readable, NEVER globally writable.
set role authenticated;
set request.jwt.claim.sub='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
set request.jwt.claims='{"is_anonymous":false}';
set request.jwt.claim.active_branch_id='22222222-0000-4000-8000-000000000077';
do $p1_receptionist$
declare
 n integer;
 returned text;
 target uuid;
begin
 if (select count(*) from public.owners where id='11111111-1111-4111-8111-111111111111')<>1
    or (select count(*) from public.pets where id='33333333-3333-4333-8333-333333333333')<>1
    or exists(select 1 from public.owners where id='22222222-2222-4222-8222-222222222222')
    or exists(select 1 from public.pets where id='44444444-4444-4444-8444-444444444444') then
  raise exception 'ISSUE77_P1_FAIL: receptionist branch read setup invalid';end if;
 -- UPDATE ... RETURNING must yield NO row even for legitimately visible
 -- shared Naga/Cavite identity. Invisible Cavite-only rows also yield none.
 returned:=null;
 update public.owners set first_name='P1_STAFF_FORGED_receptionist'
  where id='11111111-1111-4111-8111-111111111111' returning first_name into returned;
 get diagnostics n=row_count;
 if n<>0 or returned is not null then
  raise exception 'ISSUE77_P1_FAIL: receptionist changed shared owner (RETURNING)';end if;
 returned:=null;
 update public.pets set name='P1_STAFF_FORGED_receptionist'
  where id='33333333-3333-4333-8333-333333333333' returning name into returned;
 get diagnostics n=row_count;
 if n<>0 or returned is not null then
  raise exception 'ISSUE77_P1_FAIL: receptionist changed shared pet (RETURNING)';end if;
 returned:=null;
 update public.owners set first_name='P1_CAVITE_FORGED_receptionist'
  where id='22222222-2222-4222-8222-222222222222' returning first_name into returned;
 get diagnostics n=row_count;
 if n<>0 or returned is not null then
  raise exception 'ISSUE77_P1_FAIL: receptionist changed Cavite-only owner (RETURNING)';end if;
 returned:=null;
 update public.pets set name='P1_CAVITE_FORGED_receptionist'
  where id='44444444-4444-4444-8444-444444444444' returning name into returned;
 get diagnostics n=row_count;
 if n<>0 or returned is not null then
  raise exception 'ISSUE77_P1_FAIL: receptionist changed Cavite-only pet (RETURNING)';end if;
 -- Both shared and Cavite-only owner ids must reject staff INSERT, not merely
 -- skip invisible rows or fail because of a missing column-level grant.
 for target in select unnest(array['11111111-1111-4111-8111-111111111111'::uuid,'22222222-2222-4222-8222-222222222222'::uuid]) loop
  begin
   insert into public.pets(owner_id,name,species,breed)
    values(target,'P1 STAFF FORGED receptionist','Dog','Chow Chow');
   raise exception 'ISSUE77_P1_FAIL: receptionist staff pet INSERT accepted';
  exception when insufficient_privilege then
   if position('row-level security' in sqlerrm)=0 then
    raise exception 'ISSUE77_P1_FAIL: receptionist insert failed outside RLS: %',sqlerrm;
   end if;
  end;
 end loop;
end
$p1_receptionist$;
reset role;

-- Naga-only administrator: shared identities are readable, NEVER globally writable.
set role authenticated;
set request.jwt.claim.sub='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
set request.jwt.claims='{"is_anonymous":false}';
set request.jwt.claim.active_branch_id='22222222-0000-4000-8000-000000000077';
do $p1_administrator$
declare
 n integer;
 returned text;
 target uuid;
begin
 if (select count(*) from public.owners where id='11111111-1111-4111-8111-111111111111')<>1
    or (select count(*) from public.pets where id='33333333-3333-4333-8333-333333333333')<>1
    or exists(select 1 from public.owners where id='22222222-2222-4222-8222-222222222222')
    or exists(select 1 from public.pets where id='44444444-4444-4444-8444-444444444444') then
  raise exception 'ISSUE77_P1_FAIL: administrator branch read setup invalid';end if;
 -- UPDATE ... RETURNING must yield NO row even for legitimately visible
 -- shared Naga/Cavite identity. Invisible Cavite-only rows also yield none.
 returned:=null;
 update public.owners set first_name='P1_STAFF_FORGED_administrator'
  where id='11111111-1111-4111-8111-111111111111' returning first_name into returned;
 get diagnostics n=row_count;
 if n<>0 or returned is not null then
  raise exception 'ISSUE77_P1_FAIL: administrator changed shared owner (RETURNING)';end if;
 returned:=null;
 update public.pets set name='P1_STAFF_FORGED_administrator'
  where id='33333333-3333-4333-8333-333333333333' returning name into returned;
 get diagnostics n=row_count;
 if n<>0 or returned is not null then
  raise exception 'ISSUE77_P1_FAIL: administrator changed shared pet (RETURNING)';end if;
 returned:=null;
 update public.owners set first_name='P1_CAVITE_FORGED_administrator'
  where id='22222222-2222-4222-8222-222222222222' returning first_name into returned;
 get diagnostics n=row_count;
 if n<>0 or returned is not null then
  raise exception 'ISSUE77_P1_FAIL: administrator changed Cavite-only owner (RETURNING)';end if;
 returned:=null;
 update public.pets set name='P1_CAVITE_FORGED_administrator'
  where id='44444444-4444-4444-8444-444444444444' returning name into returned;
 get diagnostics n=row_count;
 if n<>0 or returned is not null then
  raise exception 'ISSUE77_P1_FAIL: administrator changed Cavite-only pet (RETURNING)';end if;
 -- Both shared and Cavite-only owner ids must reject staff INSERT, not merely
 -- skip invisible rows or fail because of a missing column-level grant.
 for target in select unnest(array['11111111-1111-4111-8111-111111111111'::uuid,'22222222-2222-4222-8222-222222222222'::uuid]) loop
  begin
   insert into public.pets(owner_id,name,species,breed)
    values(target,'P1 STAFF FORGED administrator','Dog','Chow Chow');
   raise exception 'ISSUE77_P1_FAIL: administrator staff pet INSERT accepted';
  exception when insufficient_privilege then
   if position('row-level security' in sqlerrm)=0 then
    raise exception 'ISSUE77_P1_FAIL: administrator insert failed outside RLS: %',sqlerrm;
   end if;
  end;
 end loop;
end
$p1_administrator$;
reset role;

-- Privileged follow-up: UPDATE RETURNING and INSERT produced zero persistent
-- writes, including shared rows that the Naga staff could SELECT.
do $p1_verify$
begin
 if exists(select 1 from clinic_ci.issue77_p1_owner_snapshot x
  join public.owners o using(id) where to_jsonb(o) is distinct from x.old_row)
 or exists(select 1 from clinic_ci.issue77_p1_pet_snapshot x
  join public.pets p using(id) where to_jsonb(p) is distinct from x.old_row)
 or (select count(*) from public.pets)<>2 then
  raise exception 'ISSUE77_P1_FAIL: unauthorized owner/pet write persisted';
 end if;
end
$p1_verify$;

delete from public.staff_branch_memberships
 where branch_id='11111111-0000-4000-8000-000000000077' and user_id in
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
update public.staff_branch_memberships set is_active=true
 where branch_id='22222222-0000-4000-8000-000000000077' and user_id in
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');

-- True authenticated owner retains profile UPDATE RETURNING, pet UPDATE
-- RETURNING and pet INSERT (including the existing Chow Chow taxonomy).
set role authenticated;
set request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
do $p1_owner_a$
declare got text; affected integer; created uuid;
begin
 update public.owners set first_name='OwnerSelfService'
  where id='11111111-1111-4111-8111-111111111111' returning first_name into got;
 get diagnostics affected=row_count;
 if affected<>1 or got<>'OwnerSelfService' then
  raise exception 'ISSUE77_P1_FAIL: true owner profile update denied';end if;
 update public.owners set first_name='Synthetic'
  where id='11111111-1111-4111-8111-111111111111';
 update public.pets set name='OwnerSelfServicePet'
  where id='33333333-3333-4333-8333-333333333333' returning name into got;
 get diagnostics affected=row_count;
 if affected<>1 or got<>'OwnerSelfServicePet' then
  raise exception 'ISSUE77_P1_FAIL: true owner pet update denied';end if;
 update public.pets set name='Synthetic Chow'
  where id='33333333-3333-4333-8333-333333333333';
 insert into public.pets(owner_id,name,species,breed)
  values('11111111-1111-4111-8111-111111111111',
   'P1 Owner Test Dog','Dog','Chow Chow')
  returning id into created;
 if created is null then
  raise exception 'ISSUE77_P1_FAIL: true owner pet creation denied';end if;
 -- True owner A may not insert under owner B, regardless of staff grants.
 begin
  insert into public.pets(owner_id,name,species,breed)
   values('22222222-2222-4222-8222-222222222222','P1 Stolen Pet','Dog','Chow Chow');
  raise exception 'ISSUE77_P1_FAIL: owner A inserted under owner B';
 exception when insufficient_privilege then null;end;
 got:=null;
 update public.pets set name='P1 Owner B Tampered'
  where id='44444444-4444-4444-8444-444444444444' returning name into got;
 get diagnostics affected=row_count;
 if affected<>0 or got is not null then
  raise exception 'ISSUE77_P1_FAIL: owner A updated owner B pet';end if;
end
$p1_owner_a$;
reset role;
-- Cavite-only genuine owner B also retains UPDATE RETURNING for their own
-- owner and pet, and may not edit Naga/shared owner A.
set role authenticated;
set request.jwt.claim.sub='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
do $p1_owner_b$
declare got text; affected integer;
begin
 update public.owners set first_name='OwnerBSelfService'
  where id='22222222-2222-4222-8222-222222222222'
  returning first_name into got;
 get diagnostics affected=row_count;
 if affected<>1 or got<>'OwnerBSelfService' then
  raise exception 'ISSUE77_P1_FAIL: Cavite true owner profile update denied';end if;
 update public.owners set first_name='Synthetic'
  where id='22222222-2222-4222-8222-222222222222';
 update public.pets set name='OwnerBSelfServicePet'
  where id='44444444-4444-4444-8444-444444444444'
  returning name into got;
 get diagnostics affected=row_count;
 if affected<>1 or got<>'OwnerBSelfServicePet' then
  raise exception 'ISSUE77_P1_FAIL: Cavite true owner pet update denied';end if;
 update public.pets set name='Synthetic Cat'
  where id='44444444-4444-4444-8444-444444444444';
 got:=null;
 update public.owners set first_name='P1 Owner A Tampered'
  where id='11111111-1111-4111-8111-111111111111'
  returning first_name into got;
 get diagnostics affected=row_count;
 if affected<>0 or got is not null then
  raise exception 'ISSUE77_P1_FAIL: Cavite owner updated shared Naga owner';end if;
end
$p1_owner_b$;
reset role;

-- Force a stronger future-grant scenario in this DISPOSABLE PG only: even if a
-- broad column privilege is accidentally added, WITH CHECK blocks assigning a
-- pet or owner to someone else's Auth UID. Revoke these CI-only grants afterward.
grant update(user_id) on public.owners to authenticated;
grant update(owner_id) on public.pets to authenticated;
set role authenticated;
set request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
do $p1_reassignment$
begin
 begin
  update public.owners set user_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
   where id='11111111-1111-4111-8111-111111111111';
  raise exception 'ISSUE77_P1_FAIL: owner user_id reassignment accepted';
 exception when insufficient_privilege then
  if position('row-level security' in sqlerrm)=0 then
   raise exception 'ISSUE77_P1_FAIL: owner reassignment not blocked by RLS: %',sqlerrm;
  end if;
 end;
 begin
  update public.pets set owner_id='22222222-2222-4222-8222-222222222222'
   where id='33333333-3333-4333-8333-333333333333';
  raise exception 'ISSUE77_P1_FAIL: pet owner_id reassignment accepted';
 exception when insufficient_privilege then
  if position('row-level security' in sqlerrm)=0 then
   raise exception 'ISSUE77_P1_FAIL: pet reassignment not blocked by RLS: %',sqlerrm;
  end if;
 end;
end
$p1_reassignment$;
reset role;
revoke update(user_id) on public.owners from authenticated;
revoke update(owner_id) on public.pets from authenticated;
-- Restore all fixture snapshots after allowed owner round-trips and ephemeral
-- pet cleanup. Historic Dog/Chow Chow bytes and branch attribution untouched.
delete from public.pets
 where owner_id='11111111-1111-4111-8111-111111111111'
 and name='P1 Owner Test Dog';
do $p1_final$
begin
 if exists(select 1 from clinic_ci.issue77_p1_owner_snapshot x
  join public.owners o using(id) where to_jsonb(o) is distinct from x.old_row)
 or exists(select 1 from clinic_ci.issue77_p1_pet_snapshot x
  join public.pets p using(id) where to_jsonb(p) is distinct from x.old_row)
 or (select count(*) from public.pets)<>2
 or (select count(*) from public.pets where id='33333333-3333-4333-8333-333333333333'
  and species='Dog' and breed='Chow Chow'
  and species_id='dog' and breed_id='dog-chow-chow')<>1
 or has_column_privilege('authenticated','public.owners','user_id','UPDATE')
 or has_column_privilege('authenticated','public.pets','owner_id','UPDATE') then
  raise exception 'ISSUE77_P1_FAIL: owner self-service changed historic rows or left elevated grants';
 end if;
end
$p1_final$;
\echo 'PASS: ISSUE77 P1 real PG17 denied Naga receptionist/admin owner/pet UPDATE RETURNING and pet INSERT for Cavite-only and shared identity; no persistence; true owners work; reassignment WITH CHECK; historic Chow Chow unchanged'

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
