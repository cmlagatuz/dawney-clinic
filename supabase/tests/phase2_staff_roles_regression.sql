-- Trusted-role and anonymous-user regression. All fixtures roll back.
begin;
insert into auth.users(id,aud,role,email) values
('44444444-4444-4444-8444-444444444444','authenticated','authenticated','phase2-admin@example.invalid'),
('55555555-5555-4555-8555-555555555555','authenticated','authenticated','phase2-outsider@example.invalid');
insert into public.staff_memberships(user_id,role)
values('44444444-4444-4444-8444-444444444444','administrator');
set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","is_anonymous":false}',true);
do $$
declare denied bool:=false;
begin
 if (select count(*) from public.staff_memberships) <> 1 then
  raise exception 'FAIL admin membership read'; end if;
 if not (select clinic_private.has_staff_role(array['administrator'])) then
  raise exception 'FAIL admin role helper'; end if;
 begin
  insert into public.staff_memberships(user_id,role)
  values('55555555-5555-4555-8555-555555555555','administrator');
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'FAIL admin client can grant roles'; end if;
end $$;
select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',true);
select set_config('request.jwt.claims','{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated","is_anonymous":false}',true);
do $$
begin
 if (select count(*) from public.staff_memberships)<>0 then raise exception 'FAIL outsider sees admin role'; end if;
 if (select clinic_private.has_staff_role(array['administrator'])) then raise exception 'FAIL outsider admin'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated","is_anonymous":true}',true);
do $$
begin
 if (select clinic_private.is_permanent_user()) then raise exception 'FAIL anonymous Auth user privileged'; end if;
end $$;
rollback;
