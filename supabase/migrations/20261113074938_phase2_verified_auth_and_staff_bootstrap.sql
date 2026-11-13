-- Additional Phase 2 Auth gate and trusted-only staff invitation/bootstrap.
-- IMPORTANT: These functions are private, not browser RPCs; execute only in Supabase SQL Editor as postgres.
create or replace function clinic_private.is_permanent_user()
returns boolean language sql stable security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and not coalesce((auth.jwt()->>'is_anonymous')::boolean, false)
    and exists (
      select 1 from auth.users u
      where u.id = (select auth.uid())
        and u.email_confirmed_at is not null
        and not u.is_anonymous
        and u.deleted_at is null
        and (u.banned_until is null or u.banned_until <= now())
    );
$$;
revoke all on function clinic_private.is_permanent_user() from public, anon, authenticated;
grant execute on function clinic_private.is_permanent_user() to authenticated;

create or replace function clinic_private.has_staff_role(allowed_roles text[])
returns boolean language sql stable security definer
set search_path = ''
as $$
  select (select clinic_private.is_permanent_user())
    and exists (
      select 1 from public.staff_memberships s
      where s.user_id = (select auth.uid())
        and s.is_active and s.role = any(allowed_roles)
    );
$$;
revoke all on function clinic_private.has_staff_role(text[]) from public, anon, authenticated;
grant execute on function clinic_private.has_staff_role(text[]) to authenticated;

-- One-time first-admin bootstrap. Cannot be called as anon/authenticated via API.
create or replace function clinic_private.bootstrap_first_administrator(target_user_id uuid)
returns void language plpgsql security invoker
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(20261113, 1);
  if exists (select 1 from public.staff_memberships where role = 'administrator') then
    raise exception 'Initial administrator was already assigned';
  end if;
  if not exists (
    select 1 from auth.users u
    where u.id = target_user_id and u.email_confirmed_at is not null
      and not u.is_anonymous and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now())
  ) then
    raise exception 'Target must be a verified active Auth user';
  end if;
  insert into public.staff_memberships (user_id, role, is_active)
  values (target_user_id, 'administrator', true);
end;
$$;
revoke all on function clinic_private.bootstrap_first_administrator(uuid)
  from public, anon, authenticated;

-- After dashboard-level Auth invitation and email verification:
-- a trusted SQL operator can assign a staff role, recording which admin authorized it.
create or replace function clinic_private.grant_verified_staff(
  target_user_id uuid, requested_role text, authorized_by_admin uuid
)
returns void language plpgsql security invoker
set search_path = ''
as $$
begin
  if requested_role not in ('receptionist', 'veterinarian', 'administrator') then
    raise exception 'Unrecognized staff role';
  end if;
  if not exists (
    select 1 from public.staff_memberships s
    where s.user_id = authorized_by_admin and s.role = 'administrator'
      and s.is_active
  ) then
    raise exception 'An active administrator must authorize the assignment';
  end if;
  if not exists (
    select 1 from auth.users u
    where u.id = target_user_id and u.email_confirmed_at is not null
      and not u.is_anonymous and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now())
  ) then
    raise exception 'Staff account must be verified and active';
  end if;
  insert into public.staff_memberships (
    user_id, role, is_active, assigned_at, assigned_by
  ) values (
    target_user_id, requested_role, true, now(), authorized_by_admin
  )
  on conflict (user_id) do update
    set role = excluded.role,
        is_active = true,
        assigned_at = now(),
        assigned_by = excluded.assigned_by;
end;
$$;
revoke all on function clinic_private.grant_verified_staff(uuid, text, uuid)
  from public, anon, authenticated;
