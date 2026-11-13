-- Private administrator/bootstrap helper tests. Privileged SQL only, never live public API.
-- Uses controlled Auth fixtures inside a transaction and ALWAYS rolls back.
begin;
insert into auth.users (id,aud,role,email,email_confirmed_at) values
 ('44444444-4444-4444-8444-444444444444','authenticated','authenticated','bootstrap-admin@example.invalid',now()),
 ('55555555-5555-4555-8555-555555555555','authenticated','authenticated','bootstrap-staff@example.invalid',now());
insert into auth.users (id,aud,role,email) values
 ('66666666-6666-4666-8666-666666666666','authenticated','authenticated','bootstrap-unverified@example.invalid');

do $$
declare blocked boolean := false;
begin
  begin
    perform clinic_private.bootstrap_first_administrator('66666666-6666-4666-8666-666666666666');
  exception when raise_exception then blocked := true; end;
  if not blocked then raise exception 'FAIL: unverified admin accepted'; end if;
end $$;

select clinic_private.bootstrap_first_administrator('44444444-4444-4444-8444-444444444444');
do $$
declare blocked boolean := false;
begin
  if (select count(*) from public.staff_memberships where role='administrator')<>1 then
    raise exception 'FAIL: initial administrator not recorded'; end if;
  begin
    perform clinic_private.bootstrap_first_administrator('55555555-5555-4555-8555-555555555555');
  exception when raise_exception then blocked := true; end;
  if not blocked then raise exception 'FAIL: second bootstrap accepted'; end if;
end $$;

select clinic_private.grant_verified_staff(
 '55555555-5555-4555-8555-555555555555','veterinarian','44444444-4444-4444-8444-444444444444');
do $$
declare blocked boolean := false;
begin
 if not exists (select 1 from public.staff_memberships where
  user_id='55555555-5555-4555-8555-555555555555'
  and role='veterinarian'
  and assigned_by='44444444-4444-4444-8444-444444444444')
 then raise exception 'FAIL: verified staff invite'; end if;
 begin
  perform clinic_private.grant_verified_staff(
    '66666666-6666-4666-8666-666666666666','administrator','44444444-4444-4444-8444-444444444444');
 exception when raise_exception then blocked := true; end;
 if not blocked then raise exception 'FAIL: unverified staff accepted'; end if;
end $$;

-- Browser role can never bootstrap or assign staff, regardless of JWT claims.
set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","is_anonymous":false}',true);
do $$
declare a boolean := false; b boolean := false;
begin
 if not (select clinic_private.is_permanent_user()) then raise exception 'FAIL: confirmed user check'; end if;
 begin
  perform clinic_private.bootstrap_first_administrator('44444444-4444-4444-8444-444444444444');
 exception when insufficient_privilege then a:=true; end;
 begin
  perform clinic_private.grant_verified_staff(
    '55555555-5555-4555-8555-555555555555','administrator','44444444-4444-4444-8444-444444444444');
 exception when insufficient_privilege then b:=true; end;
 if not a or not b then raise exception 'FAIL: public executor privilege leaked'; end if;
end $$;
select set_config('request.jwt.claim.sub','66666666-6666-4666-8666-666666666666',true);
select set_config('request.jwt.claims','{"sub":"66666666-6666-4666-8666-666666666666","role":"authenticated","is_anonymous":false}',true);
do $$
begin
 if (select clinic_private.is_permanent_user()) then raise exception 'FAIL: unverified user passes RLS gate'; end if;
 if (select clinic_private.has_staff_role(array['administrator'])) then raise exception 'FAIL: unverified role'; end if;
end $$;
rollback;
