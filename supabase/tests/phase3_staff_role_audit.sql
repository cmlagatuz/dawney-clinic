-- Staff audit and last-admin protection integration test. All fixtures ROLLBACK.
begin;
insert into auth.users(id,aud,role,email,email_confirmed_at) values
('88888888-8888-4888-8888-888888888888','authenticated','authenticated','staff-admin-one@example.invalid',now()),
('99999999-9999-4999-8999-999999999999','authenticated','authenticated','staff-admin-two@example.invalid',now()),
('aaaaaaaa-8888-4888-8888-aaaaaaaaaaaa','authenticated','authenticated','staff-vet@example.invalid',now());
insert into auth.users(id,aud,role,email) values
('bbbbbbbb-8888-4888-8888-bbbbbbbbbbbb','authenticated','authenticated','staff-unverified@example.invalid');

select clinic_private.bootstrap_first_administrator('88888888-8888-4888-8888-888888888888');
select clinic_private.grant_verified_staff('99999999-9999-4999-8999-999999999999','administrator','88888888-8888-4888-8888-888888888888');
select clinic_private.grant_verified_staff('aaaaaaaa-8888-4888-8888-aaaaaaaaaaaa','veterinarian','88888888-8888-4888-8888-888888888888');
update public.staff_memberships set is_active=false
where user_id='aaaaaaaa-8888-4888-8888-aaaaaaaaaaaa';

do $$
declare denied boolean:=false;
begin
 if (select count(*) from clinic_private.staff_role_events where event_kind='grant')<>3 then
   raise exception 'FAIL missing grant history';end if;
 if (select count(*) from clinic_private.staff_role_events where event_kind='revocation')<>1 then
   raise exception 'FAIL missing revoke history';end if;
 begin
   insert into public.staff_memberships(user_id,role)
   values('bbbbbbbb-8888-4888-8888-bbbbbbbbbbbb','veterinarian');
 exception when check_violation then denied:=true;end;
 if not denied then raise exception 'FAIL unverified direct insert';end if;
end$$;

update public.staff_memberships set is_active=false
where user_id='88888888-8888-4888-8888-888888888888';

do $$
declare denied boolean:=false;
begin
 begin
 update public.staff_memberships set is_active=false
 where user_id='99999999-9999-4999-8999-999999999999';
 exception when check_violation then denied:=true;end;
 if not denied then raise exception 'FAIL last admin disabled';end if;
 if (select count(*) from public.staff_memberships
    where role='administrator' and is_active)<>1 then
    raise exception 'FAIL last admin count';end if;
 if (select count(*) from clinic_private.staff_role_events)<>5 then
    raise exception 'FAIL audit row count';end if;
end$$;

set local role authenticated;
select set_config('request.jwt.claim.sub','99999999-9999-4999-8999-999999999999',true);
select set_config('request.jwt.claims','{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated","is_anonymous":false}',true);
do $$
declare denied boolean:=false;
begin
 begin perform count(*) from clinic_private.staff_role_events;
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'FAIL browser-accessible audit table';end if;
end$$;
rollback;
