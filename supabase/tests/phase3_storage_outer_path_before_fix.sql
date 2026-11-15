-- Expected defect before new migration: owners/staff cannot see valid objects
-- because unqualified name binds p.name inside nested patient subqueries.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
select set_config('request.jwt.claims','{"role":"authenticated","is_anonymous":false}',true);
do $pre$
declare denied boolean:=false;
begin
 if not clinic_private.is_permanent_user()
   or (select count(*) from public.pets)<>1
   or (select count(*) from public.appointments)<>1
   or (select count(*) from storage.objects)<>0 then
  raise exception 'Legacy owner Storage SELECT defect prerequisite changed';
 end if;
 begin
  insert into storage.objects(bucket_id,name,metadata) values
  ('clinical-attachments',
   'pets/33333333-3333-4333-8333-333333333333/owners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png',
   '{"mimetype":"image/png"}');
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Legacy owner Storage INSERT defect prerequisite changed'; end if;
end $pre$;
select set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',true);
do $vet_pre$
declare denied boolean:=false;
begin
 if not clinic_private.has_staff_role(array['veterinarian'])
    or (select count(*) from storage.objects)<>0 then
  raise exception 'Legacy veterinarian Storage read defect prerequisite changed';
 end if;
 begin
  insert into storage.objects(bucket_id,name,metadata) values
  ('clinical-attachments',
   'pets/33333333-3333-4333-8333-333333333333/clinic/aaaaaaaa-bbbb-4aaa-8aaa-aaaaaaaaaaaa.pdf',
   '{"mimetype":"application/pdf"}');
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Legacy veterinarian clinic INSERT defect prerequisite changed'; end if;
end $vet_pre$;
rollback;
select 'PASS: four pre-fix owner/staff read+insert failures reproduced in real Phase3 PostgreSQL 17 policy' as verdict;
