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
begin
 if not clinic_private.is_permanent_user()
    or (select count(*) from public.appointments)<>1
    or (select count(*) from public.pets)<>1
    or (select count(*) from storage.objects)<>1
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
    or (select count(*) from storage.objects)<>1 then
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
    or (select count(*) from storage.objects)<>2 then
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
select 'PASS: restored full Phase3 roles/RLS, preserved Chow Chow/appointment/storage, reviewed Phase4 taxonomy/booking authorization/denials' as verdict;
