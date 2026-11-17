-- Disposable PG17 only. Extends the existing taxonomy bootstrap with the
-- minimal *real-shape* Phase3 booking contract BEFORE all four migrations.
-- NO real owner/patient data, live credentials, or Supabase connection.
create extension if not exists btree_gist;
alter table auth.users add column email_confirmed_at timestamptz,
 add column is_anonymous boolean not null default false;
update auth.users set email_confirmed_at=now();
create or replace function clinic_private.is_permanent_user()
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u
  where u.id=auth.uid() and u.email_confirmed_at is not null and not u.is_anonymous)
$$;
create table public.staff_memberships(
 user_id uuid primary key references auth.users(id),
 role text not null check(role in ('receptionist','veterinarian','administrator')),
 is_active boolean not null default true
);
create or replace function clinic_private.has_staff_role(roles text[])
returns boolean language sql stable security definer set search_path='' as $$
 select clinic_private.is_permanent_user() and exists(
  select 1 from public.staff_memberships s
  where s.user_id=auth.uid() and s.is_active and s.role=any(roles))
$$;
revoke all on function clinic_private.is_permanent_user(),
 clinic_private.has_staff_role(text[]) from public,anon,authenticated;
grant execute on function clinic_private.is_permanent_user(),
 clinic_private.has_staff_role(text[]) to authenticated;
alter table public.owners add constraint chain_owner_user_unique unique(user_id);
alter table public.owners enable row level security;
create policy chain_owner_read on public.owners for select to authenticated
 using(user_id=auth.uid() and clinic_private.is_permanent_user());
alter table public.pets add constraint chain_pet_owner_unique unique(id,owner_id);

create table public.appointment_resources(
 id uuid primary key, name text not null, is_active boolean not null default true
);
alter table public.appointment_resources enable row level security;
create policy chain_resource_read on public.appointment_resources for select to authenticated
 using(clinic_private.is_permanent_user());
grant select on public.appointment_resources to authenticated;

create table public.appointments(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.owners(id),
 pet_id uuid not null,
 resource_id uuid not null references public.appointment_resources(id),
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 concern text not null check(length(btrim(concern)) between 1 and 300),
 details text,
 status text not null default 'requested'
  check(status in ('requested','confirmed','checked_in','completed','cancelled','no_show')),
 created_by uuid default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 constraint chain_duration check(ends_at>starts_at
   and ends_at<=starts_at+interval '8 hours'),
 constraint chain_pet_owner_fk foreign key(pet_id,owner_id)
  references public.pets(id,owner_id),
 constraint chain_no_active_overlap exclude using gist(
  resource_id with =,tstzrange(starts_at,ends_at,'[)') with &&)
  where(status in ('requested','confirmed','checked_in'))
);
alter table public.appointments enable row level security;
create policy chain_appointment_read on public.appointments for select to authenticated
 using(exists(select 1 from public.owners o
  where o.id=owner_id and o.user_id=auth.uid())
  or clinic_private.has_staff_role(array['receptionist','veterinarian','administrator']));
create policy chain_appointment_insert on public.appointments for insert to authenticated
 with check(created_by=auth.uid() and status='requested'
  and exists(select 1 from public.owners o where o.id=owner_id
   and o.user_id=auth.uid() and clinic_private.is_permanent_user()));
create policy chain_appointment_cancel on public.appointments for update to authenticated
 using(status in ('requested','confirmed') and exists(
  select 1 from public.owners o where o.id=owner_id and o.user_id=auth.uid()))
 with check(status='cancelled' and exists(
  select 1 from public.owners o where o.id=owner_id and o.user_id=auth.uid()));
create policy chain_appointment_staff on public.appointments for update to authenticated
 using(clinic_private.has_staff_role(array['receptionist','veterinarian','administrator']))
 with check(clinic_private.has_staff_role(array['receptionist','veterinarian','administrator']));
revoke all on public.appointments,public.staff_memberships
 from public,anon,authenticated;
grant select on public.appointments to authenticated;
grant insert(owner_id,pet_id,resource_id,starts_at,ends_at,concern,details)
 on public.appointments to authenticated;
grant update(status) on public.appointments to authenticated;

-- Synthetic legacy Dog / Chow Chow and mixed-case variants. These records
-- predate every Phase4 migration; their historical labels must not be changed.
insert into public.pets(id,owner_id,name,species,breed) values
 ('66666666-6666-4666-8666-666666666666',
  '11111111-1111-4111-8111-111111111111',
  'CI Old Chow','Dog','Chow Chow'),
 ('77777777-7777-4777-8777-777777777777',
  '22222222-2222-4222-8222-222222222222',
  'CI Old Case',' dog  ',' chOW cHoW  ');
insert into public.appointment_resources(id,name) values
 ('55555555-5555-4555-8555-555555555555','CI Shared Resource'),
 ('99999999-9999-4999-8999-999999999999','CI Historical Resource');
insert into public.appointments(
 id,owner_id,pet_id,resource_id,starts_at,ends_at,concern,status,created_by)
 values('88888888-8888-4888-8888-888888888888',
 '11111111-1111-4111-8111-111111111111',
 '66666666-6666-4666-8666-666666666666',
 '99999999-9999-4999-8999-999999999999',
 now()+interval '15 days',now()+interval '15 days 30 minutes',
 'CI pre-migration appointment','requested',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
create schema clinic_ci;
create table clinic_ci.legacy_pets as select id,to_jsonb(p) as archival_fields
 from public.pets p;
create table clinic_ci.legacy_appointments as select id,to_jsonb(a) as archival_fields
 from public.appointments a;
