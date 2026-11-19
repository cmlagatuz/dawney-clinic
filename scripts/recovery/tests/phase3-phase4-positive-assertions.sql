-- After signed five-component Phase3-equivalent RESTORE, run the exact reviewed
-- four Phase4 SQL migrations before this suite. Disposable PG17 ONLY.
-- This SQL cannot and must not modify hosted Supabase.
do $migration_contract$
begin
 if (select count(*) from auth.users)<>5
    or (select count(*) from auth.identities)<>5
    or (select count(*) from public.owners)<>2
    or (select count(*) from public.pets)<>2
    or (select count(*) from public.appointments)<>1
    or (select count(*) from storage.objects)<>2 then
   raise exception 'Recovered identity/patient/appointment/storage count changed';
 end if;
 if (select count(*) from auth.identities i join auth.users u on u.id=i.user_id)<>5
    or (select count(*) from public.pets p
        join public.owners o on o.id=p.owner_id
        join auth.users u on u.id=o.user_id)<>2
    or (select count(*) from public.staff_memberships s
        join auth.users u on u.id=s.user_id)<>2 then
   raise exception 'Recovered Auth/owner/patient/staff relationships changed';
 end if;
 if not exists(select 1 from public.pets where
    id='33333333-3333-4333-8333-333333333333' and name='Synthetic Chow'
    and species='Dog' and breed='Chow Chow'
    and species_id='dog' and breed_id='dog-chow-chow'
    and taxonomy_review_needed=false) then
   raise exception 'Four migrations failed to preserve/normalize Chow Chow';
 end if;
 if not exists(select 1 from public.pets where
    id='44444444-4444-4444-8444-444444444444'
    and species='Cat' and breed is null and species_id='cat'
    and breed_id is null) then
   raise exception 'Companion pet migration changed legacy data';
 end if;
 if not exists (select 1 from public.appointments where
    id='55555555-5555-4555-8555-555555555555'
    and pet_id='33333333-3333-4333-8333-333333333333'
    and status='requested' and service_id is null and request_nonce is null
    and concern='Synthetic Chow historic appointment') then
   raise exception 'Historical appointment not preserved after migration';
 end if;
 if (select count(*) from pg_trigger
    where tgrelid='public.pets'::regclass
      and tgfoid='clinic_private.resolve_pet_taxonomy()'::regprocedure
      and tgenabled in ('O','A') and not tgisinternal)<>1 then
   raise exception 'Exactly one Chow Chow taxonomy trigger required';
 end if;
 if (select count(*) from public.species_catalog where clinic_supported)<>0
    or (select count(*) from public.clinic_services)<>0
    or (select count(*) from public.clinic_booking_policy
        where policy_id=1 and not is_approved
          and weekly_hours->'mon'='[]'::jsonb)<>1 then
   raise exception 'Phase4 invented clinic approval or public hours';
 end if;
 if to_regprocedure('public.request_service_appointment(uuid,uuid,uuid,timestamptz,uuid,text,text)')
      is null or has_function_privilege('anon',
      'public.request_service_appointment(uuid,uuid,uuid,timestamptz,uuid,text,text)',
      'EXECUTE') then
   raise exception 'Booking invoker RPC missing or anonymous execution allowed';
 end if;
 if (select count(*) from storage.buckets
      where id='clinical-attachments' and public=false)<>1 then
   raise exception 'Private Storage bucket visibility changed';
 end if;
 if not exists(select 1 from clinic_ci.recovery_fixture
     where version='phase3-real-six-migrations-v1') then
   raise exception 'Versioned Phase3 fixture provenance lost';
 end if;
end $migration_contract$;

-- CI-only synthetic Storage path diagnostics.
do $storage_shape$
declare obj record;
begin
 for obj in select name,
   storage.foldername(name) as dirs,
   storage.filename(name) as filename,
   array_length(storage.foldername(name),1) as depth,
   (storage.filename(name) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|png|jpe?g)$') as matches
 from storage.objects loop
  raise notice 'SYNTHETIC storage dirs=%, filename=%, depth=%, valid=%',
   obj.dirs,obj.filename,obj.depth,obj.matches;
 end loop;
 raise notice 'SYNTHETIC Storage read policy count=%',
   (select count(*) from pg_policies
    where schemaname='storage' and tablename='objects' and cmd='SELECT');
end $storage_shape$;

-- All role tests use transaction-local claims, intentionally not real JWT
-- signatures. No synthetic test booking/confirmation is committed.
begin;
set local role anon;
do $db_anon$
declare denied boolean:=false;
begin
 if has_any_column_privilege('anon','public.appointments','SELECT') then
   raise exception 'Database anon role gained private appointments';
 end if;
 begin
   perform count(*) from public.appointments;
 exception when insufficient_privilege then denied:=true;
 end;
 if not denied then raise exception 'Database anon SELECT unexpectedly worked';end if;
end $db_anon$;
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","is_anonymous":false}',true);
do $owner_a$
declare denied boolean:=false;
declare resource uuid;
declare legacy_count integer;
declare qualified_count integer;
begin
 -- Reproduce Phase3 Storage SELECT policy's nested unqualified 'name' against
 -- the explicit object path, with exactly the same confirmed owner identity.
 -- Within the nested pets query 'name' can bind to p.name, not object.name.
 raise notice 'SYNTHETIC Storage correlated path: unqualified_count=%, explicit_path_count=%',
   (select count(*) from public.pets p
     join public.owners o on o.id=p.owner_id
     where p.id::text=(storage.foldername(name))[2]
       and o.user_id=(select auth.uid())),
   (select count(*) from public.pets p
     join public.owners o on o.id=p.owner_id
     where p.id::text=(storage.foldername(
       'pets/33333333-3333-4333-8333-333333333333/owners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/88888888-8888-4888-8888-888888888888.png'))[2]
       and o.user_id=(select auth.uid()));
 if not clinic_private.is_permanent_user()
    or (select count(*) from public.appointments)<>1
    or (select count(*) from public.pets)<>1
    or clinic_private.has_staff_role(array['receptionist','veterinarian','administrator']) then
    raise exception 'Owner-A RLS values: permanent=%, appts=%, pets=%, storage=%, staff=%',
     clinic_private.is_permanent_user(),
     (select count(*) from public.appointments),
     (select count(*) from public.pets),
     (select count(*) from storage.objects),
     clinic_private.has_staff_role(array['receptionist','veterinarian','administrator']);
 end if;
 select id into resource from public.appointment_resources
    where name='General appointments';
 begin
  perform public.request_service_appointment(
   '33333333-3333-4333-8333-333333333333',
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    resource,now()+interval '8 days',
   '99999999-8888-4888-8888-888888888888',
   'Synthetic unpublished booking',null);
  raise exception 'Unapproved service booking was permitted';
 exception when check_violation then null;
 end;
 begin
   update public.appointments set status='confirmed'
     where id='55555555-5555-4555-8555-555555555555';
   raise exception 'Owner forged staff confirmation';
 exception when insufficient_privilege then denied:=true;
 end;
 if not denied or (select status from public.appointments
   where id='55555555-5555-4555-8555-555555555555')<>'requested' then
   raise exception 'Owner privileged confirmation was not blocked';
 end if;
end $owner_a$;

select pg_catalog.set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
do $owner_b$
begin
 if (select count(*) from public.appointments)<>0
    or (select count(*) from public.appointment_events)<>0
    or (select count(*) from public.pets)<>1
    or (select count(*) from storage.objects)>1 then
   raise exception 'Unrelated owner accessed private appointment/data';
 end if;
end $owner_b$;

select pg_catalog.set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',true);
do $revoked$
begin
 if clinic_private.has_staff_role(array['receptionist','veterinarian','administrator'])
    or (select count(*) from public.appointments)<>0
    or (select count(*) from public.appointment_events)<>0 then
   raise exception 'Revoked staff retained clinical access';
 end if;
end $revoked$;

select pg_catalog.set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',true);
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","is_anonymous":true}',true);
do $anonymous_auth$
begin
 if clinic_private.is_permanent_user()
    or (select count(*) from public.appointments)<>0
    or (select count(*) from storage.objects)<>0 then
   raise exception 'Anonymous Auth fixture accessed private records';
 end if;
end $anonymous_auth$;

select pg_catalog.set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true);
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","is_anonymous":false}',true);
do $staff$
begin
 if not clinic_private.has_staff_role(array['receptionist'])
    or (select count(*) from public.appointments)<>1
    or (select count(*) from storage.objects)>2 then
   raise exception 'Active staff cannot access historical appointment/private objects';
 end if;
 update public.appointments set status='confirmed'
 where id='55555555-5555-4555-8555-555555555555';
 if (select count(*) from public.appointment_events
    where appointment_id='55555555-5555-4555-8555-555555555555'
      and new_status='confirmed')<>1 then
   raise exception 'Authorized confirmation audit event missing';
 end if;
end $staff$;
rollback;
select 'PASS: Phase4 taxonomy, booking draft denial, owner/staff authorization and historical requested appointment preserved (Storage positive read checked separately)' as scope_verdict;

-- FIXED-policy positive/negative authorization checks in the SAME restored database.
-- Writes to role fixtures and Storage rows are transactional and rolled back.
-- Claims are local UNSIGNED PostgreSQL simulations, never hosted JWT proof.
begin;
do $storage_policy_contract$
begin
 if (select count(*) from pg_policies
     where schemaname='storage' and tablename='objects'
       and roles=array['authenticated'::name]
       and ((policyname='clinical_attachments_read_scoped' and cmd='SELECT')
         or (policyname='clinical_attachments_insert_scoped' and cmd='INSERT')))<>2
    or not (select relrowsecurity from pg_class
            where oid='storage.objects'::regclass)
    or (select count(*) from pg_policies
        where schemaname='storage' and tablename='objects'
          and cmd in ('UPDATE','DELETE','ALL'))<>0
    or has_table_privilege('authenticated','storage.objects','UPDATE')
    or has_table_privilege('authenticated','storage.objects','DELETE')
    or has_table_privilege('anon','storage.objects','SELECT')
    or has_table_privilege('anon','storage.objects','INSERT') then
  raise exception 'Storage correction changed policy count, RLS or minimum grants';
 end if;
end $storage_policy_contract$;

-- Malformed metadata is injected by postgres solely to demonstrate SELECT
-- filtering, not to make any additional clinical document user-accessible.
insert into storage.objects(bucket_id,name,metadata) values
 ('clinical-attachments',
  'pets/33333333-3333-4333-8333-333333333333/owners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/malformed.txt',
  '{"synthetic":true}');
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","is_anonymous":false}',true);
do $owner_storage$
declare path text;
declare blocked boolean;
begin
 if not clinic_private.is_permanent_user()
    or clinic_private.has_staff_role(array['receptionist','veterinarian','administrator'])
    or (select count(*) from storage.objects)<>1
    or not exists(select 1 from storage.objects
         where id='66666666-6666-4666-8666-666666666666') then
  raise exception 'Corrected owner A cannot read exactly the original private photo';
 end if;
 insert into storage.objects(bucket_id,name,metadata) values
  ('clinical-attachments',
   'pets/33333333-3333-4333-8333-333333333333/owners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png',
   '{"synthetic":true}');
 if (select count(*) from storage.objects)<>2 then
  raise exception 'Valid owner A Storage INSERT not visible';
 end if;
 foreach path in array array[
  'pets/44444444-4444-4444-8444-444444444444/owners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/aaaaaaaa-bbbb-4bbb-8bbb-aaaaaaaaaaaa.png',
  'pets/33333333-3333-4333-8333-333333333333/owners/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/aaaaaaaa-cccc-4ccc-8ccc-aaaaaaaaaaaa.png',
  'pets/33333333-3333-4333-8333-333333333333/clinic/aaaaaaaa-dddd-4ddd-8ddd-aaaaaaaaaaaa.png',
  'pets/33333333-3333-4333-8333-333333333333/owners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/invalid.txt',
  'pets/33333333-3333-4333-8333-333333333333/owners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/subfolder/aaaaaaaa-eeee-4eee-8eee-aaaaaaaaaaaa.png',
  'pets/55555555-5555-4555-8555-555555555555/owners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/aaaaaaaa-ffff-4fff-8fff-aaaaaaaaaaaa.pdf'
 ] loop
  blocked:=false;
  begin
   insert into storage.objects(bucket_id,name,metadata) values
    ('clinical-attachments',path,'{"synthetic":true}');
  exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'Forbidden owner path INSERT succeeded: %',path; end if;
 end loop;
end $owner_storage$;

select pg_catalog.set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
do $other_owner_storage$
declare blocked boolean:=false;
begin
 if (select count(*) from storage.objects)<>1
    or not exists(select 1 from storage.objects where id='77777777-7777-4777-8777-777777777777')
    or (select count(*) from public.appointments)<>0 then
  raise exception 'Owner B can see other owner Storage/appointment or cannot see own';
 end if;
 begin
  insert into storage.objects(bucket_id,name,metadata) values
   ('clinical-attachments',
    'pets/33333333-3333-4333-8333-333333333333/owners/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/bbbbbbbb-aaaa-4aaa-8aaa-bbbbbbbbbbbb.png',
    '{"synthetic":true}');
 exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Owner B forged private path to owner A patient'; end if;
end $other_owner_storage$;

select pg_catalog.set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true);
do $reception_storage$
declare blocked boolean:=false;
begin
 if not clinic_private.has_staff_role(array['receptionist'])
    or (select count(*) from storage.objects)<>3
    or (select count(*) from public.appointments)<>1 then
  raise exception 'Authorized receptionist cannot read patient files/appointment';
 end if;
 begin
  insert into storage.objects(bucket_id,name,metadata) values
   ('clinical-attachments',
    'pets/33333333-3333-4333-8333-333333333333/clinic/cccccccc-aaaa-4aaa-8aaa-cccccccccccc.pdf',
    '{"synthetic":true}');
 exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'Receptionist gained veterinarian-only clinic upload'; end if;
end $reception_storage$;

select pg_catalog.set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',true);
do $revoked_storage$
declare blocked boolean:=false;
begin
 if clinic_private.has_staff_role(array['veterinarian'])
    or (select count(*) from storage.objects)<>0
    or (select count(*) from public.appointments)<>0 then
  raise exception 'Revoked staff retained private data access';
 end if;
 begin
  insert into storage.objects(bucket_id,name,metadata) values
   ('clinical-attachments',
    'pets/33333333-3333-4333-8333-333333333333/clinic/dddddddd-aaaa-4aaa-8aaa-dddddddddddd.png',
    '{"synthetic":true}');
 exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'Revoked staff inserted private document';end if;
end $revoked_storage$;

select pg_catalog.set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',true);
select pg_catalog.set_config('request.jwt.claims','{"role":"administrator","is_anonymous":true}',true);
do $anonymous_auth_storage$
declare blocked boolean:=false;
begin
 if clinic_private.is_permanent_user()
    or clinic_private.has_staff_role(array['administrator'])
    or (select count(*) from storage.objects)<>0 then
  raise exception 'Anonymous Auth user or spoofed metadata gained Storage reads';
 end if;
 begin
  insert into storage.objects(bucket_id,name,metadata) values
   ('clinical-attachments',
    'pets/33333333-3333-4333-8333-333333333333/clinic/eeeeeeee-aaaa-4aaa-8aaa-eeeeeeeeeeee.png',
    '{"synthetic":true}');
 exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'Anonymous Auth user inserted private document';end if;
end $anonymous_auth_storage$;

set local role anon;
do $anon_db_storage$
declare blocked boolean:=false;
begin
 begin perform count(*) from storage.objects;
 exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'SQL anon gained private Storage SELECT';end if;
 blocked:=false;
 begin
  insert into storage.objects(bucket_id,name,metadata) values
    ('clinical-attachments',
     'pets/33333333-3333-4333-8333-333333333333/owners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa.png',
     '{"synthetic":true}');
 exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'SQL anon gained private Storage INSERT';end if;
end $anon_db_storage$;

-- Activate a pre-existing synthetic veterinarian in a rollback-only
-- transaction to prove the legitimate clinic upload, then revoke it again.
reset role;
update public.staff_memberships set is_active=true
 where user_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd' and role='veterinarian';
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',true);
select pg_catalog.set_config('request.jwt.claims','{"role":"authenticated","is_anonymous":false}',true);
do $veterinarian_storage$
begin
 if not clinic_private.has_staff_role(array['veterinarian'])
    or (select count(*) from storage.objects)<>3 then
  raise exception 'Active synthetic veterinarian missing legitimate patient Storage read';
 end if;
 insert into storage.objects(bucket_id,name,metadata) values
  ('clinical-attachments',
   'pets/33333333-3333-4333-8333-333333333333/clinic/dddddddd-bbbb-4bbb-8bbb-dddddddddddd.pdf',
   '{"synthetic":true}');
 if (select count(*) from storage.objects)<>4 then
  raise exception 'Veterinarian clinic INSERT invisible after correction';
 end if;
end $veterinarian_storage$;

reset role;
update public.staff_memberships set is_active=false
 where user_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd' and role='veterinarian';
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',true);
do $re_revoked_storage$
begin
 if clinic_private.has_staff_role(array['veterinarian'])
    or (select count(*) from storage.objects)<>0 then
  raise exception 'Revoked synthetic veterinarian still sees clinic upload';
 end if;
end $re_revoked_storage$;
rollback;

select 'PASS: corrected Storage RLS confirmed owner read/insert, receptionist read, veterinarian read/insert, cross-owner/revoked/anonymous/path denial; all fixture mutations rolled back.' as storage_verdict;
