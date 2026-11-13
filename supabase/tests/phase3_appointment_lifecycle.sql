-- Run with migration DDL in same transaction. Fully synthetic, always rolled back.
begin;
-- DDL is inserted by the harness when testing BEFORE migration.
insert into auth.users(id,aud,role,email,email_confirmed_at)
values ('77777777-7777-4777-8777-777777777777','authenticated','authenticated','phase3-scheduling@example.invalid',now());
insert into public.owners(id,user_id,first_name,last_name)
values ('77777777-7777-4777-8777-aaaaaaaaaaaa','77777777-7777-4777-8777-777777777777','Synthetic','Owner');
insert into public.pets(id,owner_id,name,species)
values ('77777777-7777-4777-8777-bbbbbbbbbbbb','77777777-7777-4777-8777-aaaaaaaaaaaa','Synthetic Pet','Dog');
set local role authenticated;
select set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777777',true);
select set_config('request.jwt.claims','{"sub":"77777777-7777-4777-8777-777777777777","role":"authenticated","is_anonymous":false}',true);
do $$
declare denied boolean:=false;
begin
 begin
  insert into public.appointments(owner_id,pet_id,resource_id,starts_at,ends_at,concern)
  select '77777777-7777-4777-8777-aaaaaaaaaaaa','77777777-7777-4777-8777-bbbbbbbbbbbb',
    id,now()-interval '1 hour',now()-interval '30 minutes','Past booking'
  from public.appointment_resources limit 1;
 exception when check_violation then denied:=true; end;
 if not denied then raise exception 'FAIL: past booking accepted';end if;
end$$;
insert into public.appointments(owner_id,pet_id,resource_id,starts_at,ends_at,concern)
select '77777777-7777-4777-8777-aaaaaaaaaaaa','77777777-7777-4777-8777-bbbbbbbbbbbb',
 id,'2032-01-02 09:00+00','2032-01-02 09:30+00','Follow up'
from public.appointment_resources limit 1;
set local role postgres;
do $$
declare denied boolean:=false;
begin
 begin
  update public.appointments set status='completed' where owner_id='77777777-7777-4777-8777-aaaaaaaaaaaa';
 exception when check_violation then denied:=true; end;
 if not denied then raise exception 'FAIL: requested -> completed accepted';end if;
end$$;
update public.appointments set status='confirmed' where owner_id='77777777-7777-4777-8777-aaaaaaaaaaaa';
update public.appointments set status='checked_in' where owner_id='77777777-7777-4777-8777-aaaaaaaaaaaa';
update public.appointments set status='completed' where owner_id='77777777-7777-4777-8777-aaaaaaaaaaaa';
do $$
declare denied boolean:=false;
begin
 begin
  update public.appointments set status='requested' where owner_id='77777777-7777-4777-8777-aaaaaaaaaaaa';
 exception when check_violation then denied:=true; end;
 if not denied then raise exception 'FAIL: terminal booking reopened';end if;
end$$;
rollback;