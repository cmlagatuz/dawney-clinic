-- Post-fix REAL PostgreSQL 17 RLS regression on the actual six Phase2/3
-- migrations. All test writes/role claims are local and ROLLED BACK.
begin;
do $structural$
begin
 if (select count(*) from pg_policies where schemaname='storage'
      and tablename='objects' and
      ((policyname='clinical_attachments_read_scoped' and cmd='SELECT')
       or (policyname='clinical_attachments_insert_scoped' and cmd='INSERT'))
      and roles=array['authenticated'::name])<>2 then
  raise exception 'The two authenticated-only Storage clinical policies changed';
 end if;
 if (select count(*) from pg_policies where schemaname='storage'
      and tablename='objects' and cmd in ('UPDATE','DELETE','ALL'))<>0
    or has_table_privilege('authenticated','storage.objects','UPDATE')
    or has_table_privilege('authenticated','storage.objects','DELETE')
    or has_table_privilege('anon','storage.objects','SELECT')
    or has_table_privilege('anon','storage.objects','INSERT') then
  raise exception 'Storage UPDATE/DELETE or anon rights widened';
 end if;
 if not (select relrowsecurity from pg_class where oid='storage.objects'::regclass)
    or (select count(*) from storage.buckets where id='clinical-attachments' and public=false)<>1
    or (select count(*) from public.pets where id='33333333-3333-4333-8333-333333333333'
      and species='Dog' and breed='Chow Chow' and name='Synthetic Chow')<>1
    or (select count(*) from public.appointments
      where id='55555555-5555-4555-8555-555555555555'
        and pet_id='33333333-3333-4333-8333-333333333333'
        and status='requested')<>1 then
  raise exception 'Private bucket, RLS, Dog Chow Chow or historical appointment changed';
 end if;
end $structural$;

set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
select set_config('request.jwt.claims','{"role":"authenticated","is_anonymous":false}',true);
do $owner_a$
declare candidate text;
declare denied boolean;
begin
 if not clinic_private.is_permanent_user()
    or clinic_private.has_staff_role(array['receptionist','veterinarian','administrator'])
    or (select count(*) from storage.objects)<>1
    or (select count(*) from public.pets)<>1
    or (select count(*) from public.appointments)<>1 then
  raise exception 'Owner A cannot SELECT its own valid private object, pet and appointment';
 end if;
 -- Valid own owner path succeeds for confirmed owner.
 insert into storage.objects(bucket_id,name,metadata) values
 ('clinical-attachments',
  'pets/33333333-3333-4333-8333-333333333333/owners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png',
  '{"mimetype":"image/png"}');
 if (select count(*) from storage.objects)<>2 then
  raise exception 'Owner A valid private INSERT is not visible';
 end if;

 -- These all look plausible to a browser but MUST fail INSERT (no file API
 -- involved). Includes cross-owner, wrong pet, forged role, clinic namespace,
 -- bad filename/extension, unknown patient and extra path segment.
 foreach candidate in array array[
  'pets/44444444-4444-4444-8444-444444444444/owners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png',
  'pets/33333333-3333-4333-8333-333333333333/owners/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png',
  'pets/33333333-3333-4333-8333-333333333333/clinic/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png',
  'pets/33333333-3333-4333-8333-333333333333/owners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/not-a-random-uuid.png',
  'pets/33333333-3333-4333-8333-333333333333/owners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.exe',
  'pets/33333333-3333-4333-8333-333333333333/owners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/subfolder/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.pdf',
  'pets/55555555-5555-4555-8555-555555555555/owners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.pdf'
 ] loop
  denied:=false;
  begin
   insert into storage.objects(bucket_id,name,metadata)
    values('clinical-attachments',candidate,'{"mimetype":"image/png"}');
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Owner A malicious Storage path was accepted: %',candidate; end if;
 end loop;
 denied:=false;
 begin
  insert into storage.objects(bucket_id,name,metadata) values
  ('other-private',
   'pets/33333333-3333-4333-8333-333333333333/owners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.pdf',
   '{"mimetype":"application/pdf"}');
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Nonclinical bucket INSERT was accepted'; end if;
end $owner_a$;

select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
do $owner_b$
declare denied boolean:=false;
begin
 if (select count(*) from storage.objects)<>1
    or (select count(*) from public.pets)<>1
    or (select count(*) from public.appointments)<>0 then
  raise exception 'Owner B gained access to owner A or lost own object';
 end if;
 insert into storage.objects(bucket_id,name,metadata) values
 ('clinical-attachments',
  'pets/44444444-4444-4444-8444-444444444444/owners/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/aaaaaaaa-bbbb-4bbb-8bbb-aaaaaaaaaaaa.pdf',
  '{"mimetype":"application/pdf"}');
 if (select count(*) from storage.objects)<>2 then
   raise exception 'Owner B valid INSERT refused';
 end if;
 begin
  insert into storage.objects(bucket_id,name,metadata) values
  ('clinical-attachments',
   'pets/33333333-3333-4333-8333-333333333333/owners/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/aaaaaaaa-bbbb-4bbb-8bbb-aaaaaaaaaaab.pdf',
   '{"mimetype":"application/pdf"}');
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Owner B inserted owner A pet via own auth directory';end if;
end $owner_b$;

select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true);
do $reception$
declare denied boolean:=false;
begin
 if not clinic_private.has_staff_role(array['receptionist'])
    or (select count(*) from storage.objects)<>6 then
   raise exception 'Active receptionist private staff READ scope broken';
 end if;
 begin
  insert into storage.objects(bucket_id,name,metadata) values
  ('clinical-attachments',
   'pets/33333333-3333-4333-8333-333333333333/clinic/aaaaaaaa-cccc-4ccc-8ccc-aaaaaaaaaaaa.pdf',
   '{"mimetype":"application/pdf"}');
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Receptionist gained vet-only clinic INSERT'; end if;
end $reception$;

select set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',true);
do $veterinarian$
declare denied boolean:=false;
begin
 if not clinic_private.has_staff_role(array['veterinarian'])
    or (select count(*) from storage.objects)<>6 then
  raise exception 'Active veterinarian staff READ scope broken';
 end if;
 insert into storage.objects(bucket_id,name,metadata) values
 ('clinical-attachments',
  'pets/33333333-3333-4333-8333-333333333333/clinic/aaaaaaaa-dddd-4ddd-8ddd-aaaaaaaaaaaa.png',
  '{"mimetype":"image/png"}');
 if (select count(*) from storage.objects)<>7 then
  raise exception 'Veterinarian clinic INSERT rejected';
 end if;
 begin
  insert into storage.objects(bucket_id,name,metadata) values
  ('clinical-attachments',
   'pets/44444444-4444-4444-8444-444444444444/owners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/aaaaaaaa-dddd-4ddd-8ddd-aaaaaaaaaaaa.png',
   '{"mimetype":"image/png"}');
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Veterinarian forged unrelated owner-path INSERT'; end if;
end $veterinarian$;

select set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',true);
do $admin$
begin
 if not clinic_private.has_staff_role(array['administrator'])
    or (select count(*) from storage.objects)<>7 then
  raise exception 'Active administrator clinic READ scope broken';
 end if;
 insert into storage.objects(bucket_id,name,metadata) values
 ('clinical-attachments',
  'pets/44444444-4444-4444-8444-444444444444/clinic/aaaaaaaa-eeee-4eee-8eee-aaaaaaaaaaaa.pdf',
  '{"mimetype":"application/pdf"}');
 if (select count(*) from storage.objects)<>8 then
  raise exception 'Administrator clinic INSERT rejected';
 end if;
end $admin$;

select set_config('request.jwt.claim.sub','ffffffff-ffff-4fff-8fff-ffffffffffff',true);
do $revoked$
declare denied boolean:=false;
begin
 if clinic_private.has_staff_role(array['veterinarian'])
   or (select count(*) from storage.objects)<>0 then
  raise exception 'Revoked veterinarian retained Storage READ';
 end if;
 begin
  insert into storage.objects(bucket_id,name,metadata) values
  ('clinical-attachments',
   'pets/33333333-3333-4333-8333-333333333333/clinic/aaaaaaaa-ffff-4fff-8fff-aaaaaaaaaaaa.pdf',
   '{"mimetype":"application/pdf"}');
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Revoked veterinarian retained clinic INSERT';end if;
end $revoked$;

-- Anonymous Auth is also under the authenticated SQL role; verified account
-- and is_anonymous both must reject. User-editable role claim never authorizes.
select set_config('request.jwt.claim.sub','11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
select set_config('request.jwt.claims','{"role":"administrator","is_anonymous":true}',true);
do $anonymous_auth$
declare denied boolean:=false;
begin
 if clinic_private.is_permanent_user()
   or clinic_private.has_staff_role(array['administrator'])
   or (select count(*) from storage.objects)<>0 then
  raise exception 'Anonymous Auth could see clinical Storage or spoof staff';
 end if;
 begin
  insert into storage.objects(bucket_id,name,metadata) values
  ('clinical-attachments',
   'pets/33333333-3333-4333-8333-333333333333/clinic/aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa.png',
   '{}');
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Anonymous Auth INSERT unexpectedly passed'; end if;
end $anonymous_auth$;

select set_config('request.jwt.claim.sub','22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
select set_config('request.jwt.claims','{"role":"authenticated","is_anonymous":false}',true);
do $unconfirmed$
begin
 if clinic_private.is_permanent_user()
   or (select count(*) from storage.objects)<>0 then
  raise exception 'Unconfirmed Auth can read private Storage';
 end if;
end $unconfirmed$;

select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
select set_config('request.jwt.claims','{"role":"administrator","is_anonymous":false}',true);
do $claim_spoof$
begin
 if clinic_private.has_staff_role(array['administrator'])
   or (select count(*) from storage.objects)<>2 then
  raise exception 'User-supplied administrator JWT claim widened clinical READ';
 end if;
end $claim_spoof$;

set local role anon;
do $db_anon$
declare denied boolean:=false;
begin
 begin perform count(*) from storage.objects;
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Database anon role can SELECT private Storage';end if;
end $db_anon$;
rollback;

-- Rollback includes all synthetic inserts from the privilege test.
do $preservation$
begin
 if (select count(*) from storage.objects)<>6
   or (select count(*) from public.pets)<>2
   or (select count(*) from public.appointments)<>1
   or (select count(*) from public.pets
       where species='Dog' and breed='Chow Chow'
       and id='33333333-3333-4333-8333-333333333333')<>1
   or (select count(*) from public.appointments
       where id='55555555-5555-4555-8555-555555555555'
        and status='requested')<>1 then
  raise exception 'Synthetic rollback changed historical patient or Storage rows';
 end if;
end $preservation$;
select 'PASS: corrected Storage RLS owner SELECT/INSERT, staff roles, cross-owner/anon/revoked denials, malicious paths, unchanged historical Dog/Chow Chow' as verdict;
