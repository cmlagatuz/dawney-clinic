-- Phase 2 RLS + exclusion-constraint regression. ALL fixtures rollback.
-- Run with a trusted SQL editor/connector only; never use production patient records.
begin;
insert into auth.users(id,aud,role,email) values
('11111111-1111-4111-8111-111111111111','authenticated','authenticated','phase2-a@example.invalid'),
('22222222-2222-4222-8222-222222222222','authenticated','authenticated','phase2-b@example.invalid'),
('33333333-3333-4333-8333-333333333333','authenticated','authenticated','phase2-vet@example.invalid');
insert into public.owners(id,user_id,first_name,last_name) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Fixture','A'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','Fixture','B');
insert into public.pets(id,owner_id,name,species) values
('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Fixture A','cat'),
('bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Fixture B','dog');
insert into public.staff_memberships(user_id,role) values
('33333333-3333-4333-8333-333333333333','veterinarian');

set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":false}',true);
do $$
begin
 if (select count(*) from public.owners)<>1 then raise exception 'FAIL A owner isolation'; end if;
 if (select count(*) from public.pets)<>1 then raise exception 'FAIL A pet isolation'; end if;
end $$;
insert into public.appointments(owner_id,pet_id,resource_id,starts_at,ends_at,concern)
select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
id,'2032-01-10 09:00+00','2032-01-10 09:30+00','Consultation'
from public.appointment_resources limit 1;
do $$
begin
 if (select count(*) from public.appointment_events)<>1 then raise exception 'FAIL insert audit'; end if;
 if has_column_privilege('authenticated','public.appointments','owner_id','UPDATE') then
  raise exception 'FAIL owner ID mutable';
 end if;
end $$;

select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","is_anonymous":false}',true);
do $$
declare denied bool:=false; collided bool:=false; note_denied bool:=false;
begin
 if (select count(*) from public.owners)<>1 then raise exception 'FAIL B owner isolation'; end if;
 if (select count(*) from public.pets)<>1 then raise exception 'FAIL B pet isolation'; end if;
 if (select count(*) from public.appointments)<>0 then raise exception 'FAIL B appointment privacy'; end if;
 if (select count(*) from public.appointment_events)<>0 then raise exception 'FAIL B audit privacy'; end if;
 begin
  insert into public.appointments(owner_id,pet_id,resource_id,starts_at,ends_at,concern)
  select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
  id,'2032-01-11 09:00+00','2032-01-11 09:30+00','Forged pet'
  from public.appointment_resources limit 1;
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'FAIL foreign pet booking accepted'; end if;
 begin
  insert into public.appointments(owner_id,pet_id,resource_id,starts_at,ends_at,concern)
  select 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb',
  id,'2032-01-10 09:15+00','2032-01-10 09:45+00','Collision'
  from public.appointment_resources limit 1;
 exception when exclusion_violation then collided:=true; end;
 if not collided then raise exception 'FAIL appointment overlap accepted'; end if;
 begin
  insert into public.clinical_records(pet_id,procedure)
  values('bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb','Forged note');
 exception when insufficient_privilege then note_denied:=true; end;
 if not note_denied then raise exception 'FAIL client clinical note accepted'; end if;
end $$;

select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":false}',true);
update public.appointments set status='cancelled' where owner_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
do $$
begin if (select count(*) from public.appointment_events)<>2 then
 raise exception 'FAIL cancellation audit'; end if; end $$;

select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","is_anonymous":false}',true);
insert into public.appointments(owner_id,pet_id,resource_id,starts_at,ends_at,concern)
select 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb',
id,'2032-01-10 09:00+00','2032-01-10 09:30+00','Rebook freed slot'
from public.appointment_resources limit 1;

select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","is_anonymous":false}',true);
insert into public.clinical_records(pet_id,procedure,temperature_c)
values('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa','Vet examination',38.4);
do $$
begin
 if (select count(*) from public.clinical_records)<>1 then raise exception 'FAIL vet note'; end if;
 if (select count(*) from public.owners)<>2 then raise exception 'FAIL vet staff read'; end if;
end $$;

set local role anon;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$
declare denied bool:=false;
begin
 begin perform count(*) from public.owners;
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'FAIL anon owners access'; end if;
end $$;

set local role postgres;
update public.staff_memberships set is_active=false
where user_id='33333333-3333-4333-8333-333333333333';
set local role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","is_anonymous":false}',true);
do $$
begin
 if (select count(*) from public.owners)<>0 then raise exception 'FAIL revoked staff owners'; end if;
 if (select count(*) from public.clinical_records)<>0 then raise exception 'FAIL revoked staff records'; end if;
end $$;
rollback;
