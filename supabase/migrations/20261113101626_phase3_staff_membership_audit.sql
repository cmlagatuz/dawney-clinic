-- Trusted administrative staff membership safety and append-only audit.
-- Existing staff record rows are preserved. No client privileges are added.
create table clinic_private.staff_role_events (
  event_id bigint generated always as identity primary key,
  staff_user_id uuid not null,
  event_kind text not null check (event_kind in ('grant','role_change','activation','revocation','assignment_refresh','delete')),
  previous_role text,
  next_role text,
  previous_active boolean,
  next_active boolean,
  authorized_by_id uuid,
  request_actor_id uuid,
  database_role text not null,
  occurred_at timestamptz not null default now()
);
alter table clinic_private.staff_role_events enable row level security;
revoke all on clinic_private.staff_role_events from public,anon,authenticated;
revoke all on sequence clinic_private.staff_role_events_event_id_seq from public,anon,authenticated;

create function clinic_private.enforce_staff_membership_safety()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  -- Serialize all staff membership writes and first-admin bootstrap.
  perform pg_catalog.pg_advisory_xact_lock(20261113,1);
  if tg_op='DELETE' then
    if old.role='administrator' and old.is_active
      and not exists (
        select 1 from public.staff_memberships s
        where s.user_id<>old.user_id and s.role='administrator' and s.is_active
      ) then
      raise exception 'Cannot remove the last active administrator' using errcode='23514';
    end if;
    return old;
  end if;

  if new.is_active and not exists (
    select 1 from auth.users u
    where u.id=new.user_id and u.email_confirmed_at is not null
      and not u.is_anonymous and u.deleted_at is null
      and (u.banned_until is null or u.banned_until<=now())
  ) then
    raise exception 'Active staff member requires a verified Auth account' using errcode='23514';
  end if;

  if tg_op='UPDATE' and old.role='administrator' and old.is_active
    and (new.role<>'administrator' or not new.is_active)
    and not exists (
      select 1 from public.staff_memberships s
      where s.user_id<>old.user_id and s.role='administrator' and s.is_active
    ) then
    raise exception 'Cannot remove the last active administrator' using errcode='23514';
  end if;
  return new;
end;
$$;
revoke all on function clinic_private.enforce_staff_membership_safety() from public,anon,authenticated;
create trigger staff_membership_before_write
before insert or update or delete on public.staff_memberships
for each row execute function clinic_private.enforce_staff_membership_safety();

create function clinic_private.audit_staff_membership_change()
returns trigger language plpgsql security invoker set search_path='' as $$
declare kind text;
begin
  if tg_op='INSERT' then
    kind:='grant';
  elsif tg_op='DELETE' then
    kind:='delete';
  elsif old.role is distinct from new.role then
    kind:='role_change';
  elsif old.is_active is distinct from new.is_active then
    kind:=case when new.is_active then 'activation' else 'revocation' end;
  elsif old.assigned_by is distinct from new.assigned_by then
    kind:='assignment_refresh';
  else
    return new;
  end if;

  insert into clinic_private.staff_role_events (
    staff_user_id,event_kind,previous_role,next_role,previous_active,
    next_active,authorized_by_id,request_actor_id,database_role
  )
  values (
    case when tg_op='DELETE' then old.user_id else new.user_id end,
    kind,
    case when tg_op='INSERT' then null else old.role end,
    case when tg_op='DELETE' then null else new.role end,
    case when tg_op='INSERT' then null else old.is_active end,
    case when tg_op='DELETE' then null else new.is_active end,
    case when tg_op='DELETE' then old.assigned_by else new.assigned_by end,
    (select auth.uid()), current_user
  );

  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function clinic_private.audit_staff_membership_change() from public,anon,authenticated;
create trigger staff_membership_after_write
after insert or update or delete on public.staff_memberships
for each row execute function clinic_private.audit_staff_membership_change();
