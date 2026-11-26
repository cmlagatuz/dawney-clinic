-- Synthetic-only known-row RLS/attachment regression. Transaction is rolled back.
\set ON_ERROR_STOP on
begin;
insert into auth.sessions(id,user_id) values ('a2400000-1111-4111-8111-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),('a2400000-1111-4111-8111-000000000002','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
-- Use actual #23 record provenance, not legacy unverified rows (staff cannot read those).
select set_config('clinic_ci.scope_record_a',record_id::text,true)
 from clinic_private.clinical_record_provenance
 where request_id='a2300000-0000-4000-8000-000000000002';
insert into public.staff_branch_memberships(user_id,branch_id,role,is_active)
 values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','22222222-0000-4000-8000-000000000077','veterinarian',true)
 on conflict(user_id,branch_id) do update set role='veterinarian',is_active=true;
set local role authenticated;
set local request.jwt.claim.sub='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
set local request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"a2200000-1111-4111-8111-000000000001"}';
select set_config('clinic_ci.scope_record_b',public.create_staff_appointment_clinical_record(
 'bbbbbbbb-7777-4777-8777-bbbbbbbbbbbb','a2400000-0000-4000-8000-000000000006','synthetic Cavite verified scope')->>'id',true);
reset role;
do $fixture$
begin
 if (select count(*) from public.clinical_records where id in (current_setting('clinic_ci.scope_record_a')::uuid,current_setting('clinic_ci.scope_record_b')::uuid))<>2 then raise exception 'CLINICAL23_SCOPE fixture missing'; end if;
end $fixture$;
update public.staff_branch_memberships set is_active=false where user_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd' and branch_id<>'11111111-0000-4000-8000-000000000077';
set local role authenticated;
do $vet$
begin
 if not exists(select 1 from public.clinical_records where id=current_setting('clinic_ci.scope_record_a')::uuid) or exists(select 1 from public.clinical_records where id=current_setting('clinic_ci.scope_record_b')::uuid) then raise exception 'CLINICAL23_SCOPE veterinarian branch boundary'; end if;
end $vet$;
set local request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"a2400000-1111-4111-8111-000000000001"}';
do $owner$
begin
 if (select count(*) from public.clinical_records where id in (current_setting('clinic_ci.scope_record_a')::uuid,current_setting('clinic_ci.scope_record_b')::uuid))<>2 then raise exception 'CLINICAL23_SCOPE shared patient owner access'; end if;
 insert into storage.objects(bucket_id,name,metadata) values ('clinical-attachments','pets/33333333-3333-4333-8333-333333333333/owners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/a2400000-0000-4000-8000-000000000001.png','{"mimetype":"image/png","size":16}');
 insert into public.pet_attachments(pet_id,category,object_path,original_filename,mime_type,size_bytes)
 values ('33333333-3333-4333-8333-333333333333','profile_photo','pets/33333333-3333-4333-8333-333333333333/owners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/a2400000-0000-4000-8000-000000000001.png','synthetic.png','image/png',16);
 if not exists(select 1 from public.pet_attachments where object_path='pets/33333333-3333-4333-8333-333333333333/owners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/a2400000-0000-4000-8000-000000000001.png') then raise exception 'CLINICAL23_SCOPE live attachment missing'; end if;
 insert into storage.objects(bucket_id,name,metadata) values ('clinical-attachments','pets/33333333-3333-4333-8333-333333333333/owners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/a2400000-0000-4000-8000-000000000002.png','{"mimetype":"image/png","size":16}');
end $owner$;
set local request.jwt.claim.sub='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
set local request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"a2400000-1111-4111-8111-000000000002"}';
do $other$
begin
 if not exists(select 1 from storage.objects where bucket_id='clinical-attachments' and name='pets/44444444-4444-4444-8444-444444444444/owners/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/99999999-9999-4999-8999-999999999999.pdf') then raise exception 'CLINICAL23_SCOPE other owner positive'; end if;
 if exists(select 1 from public.clinical_records where id in (current_setting('clinic_ci.scope_record_a')::uuid,current_setting('clinic_ci.scope_record_b')::uuid)) or exists(select 1 from public.pet_attachments where object_path='pets/33333333-3333-4333-8333-333333333333/owners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/a2400000-0000-4000-8000-000000000001.png') or exists(select 1 from storage.objects where name='pets/33333333-3333-4333-8333-333333333333/owners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/a2400000-0000-4000-8000-000000000001.png') then raise exception 'CLINICAL23_SCOPE other owner boundary'; end if;
end $other$;
reset role;
delete from auth.sessions where id='a2400000-1111-4111-8111-000000000001';
set local role authenticated;
set local request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"a2400000-1111-4111-8111-000000000001"}';
do $revoked$
begin
 if exists(select 1 from public.clinical_records where id in (current_setting('clinic_ci.scope_record_a')::uuid,current_setting('clinic_ci.scope_record_b')::uuid)) or exists(select 1 from public.pet_attachments where object_path='pets/33333333-3333-4333-8333-333333333333/owners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/a2400000-0000-4000-8000-000000000001.png') or exists(select 1 from storage.objects where name='pets/33333333-3333-4333-8333-333333333333/owners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/a2400000-0000-4000-8000-000000000001.png') then raise exception 'CLINICAL23_SCOPE revoked owner read'; end if;
 begin
 insert into storage.objects(bucket_id,name,metadata) values ('clinical-attachments','pets/33333333-3333-4333-8333-333333333333/owners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/a2400000-0000-4000-8000-000000000003.png','{"mimetype":"image/png","size":16}');
 raise exception 'CLINICAL23_SCOPE revoked object insert';
 exception when insufficient_privilege then null; end;
 begin
 insert into public.pet_attachments(pet_id,category,object_path,original_filename,mime_type,size_bytes)
 values ('33333333-3333-4333-8333-333333333333','health_card','pets/33333333-3333-4333-8333-333333333333/owners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/a2400000-0000-4000-8000-000000000002.png','synthetic.png','image/png',16);
 raise exception 'CLINICAL23_SCOPE revoked metadata insert';
 exception when insufficient_privilege or check_violation then null; end;
end $revoked$;
reset role;
do $parity$
begin
 if (select count(*) from public.pet_attachments where object_path='pets/33333333-3333-4333-8333-333333333333/owners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/a2400000-0000-4000-8000-000000000001.png')<>1 or exists(select 1 from public.pet_attachments where object_path='pets/33333333-3333-4333-8333-333333333333/owners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/a2400000-0000-4000-8000-000000000002.png') then raise exception 'CLINICAL23_SCOPE attachment persistence mismatch'; end if;
end $parity$;
rollback;
\echo 'PASS: known-row branch/owner scope, owner metadata and object INSERT, revoked session denial'
