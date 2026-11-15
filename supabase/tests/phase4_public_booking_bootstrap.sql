-- Disposable PostgreSQL 17 fixture only. Does NOT connect to Supabase.
-- Mirrors existing RLS/constraints relevant to service-linked booking.
create role authenticated nologin;
create role anon nologin;
create schema auth;
create schema clinic_private;
create extension if not exists btree_gist;
create table auth.users(
 id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean not null default false
);
create function auth.uid() returns uuid language sql stable set search_path='' as $$
 select nullif(pg_catalog.current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
grant usage on schema auth,clinic_private to authenticated;
grant execute on function auth.uid() to authenticated;
create function clinic_private.is_permanent_user()
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u where u.id=auth.uid()
  and u.email_confirmed_at is not null and not u.is_anonymous)
$$;
create table public.staff_memberships(user_id uuid primary key references auth.users(id),
 role text not null check(role in ('receptionist','veterinarian','administrator')),
 is_active boolean not null default true);
create function clinic_private.has_staff_role(roles text[])
returns boolean language sql stable security definer set search_path='' as $$
 select clinic_private.is_permanent_user() and exists(
  select 1 from public.staff_memberships s where s.user_id=auth.uid()
  and s.is_active and s.role=any(roles))
$$;
revoke all on function clinic_private.is_permanent_user(),clinic_private.has_staff_role(text[])
 from public,anon,authenticated;
grant execute on function clinic_private.is_permanent_user(),clinic_private.has_staff_role(text[])
 to authenticated;
create table public.owners (
 id uuid primary key, user_id uuid not null unique references auth.users(id)
);
create table public.species_catalog(
 id text primary key, is_active boolean not null default true,
 clinic_supported boolean not null default false,
 review_status text not null default 'curated'
);
create table public.pets (
 id uuid primary key,owner_id uuid not null references public.owners(id),
 species_id text references public.species_catalog(id),
 constraint fixture_pets_owner_unique unique(id,owner_id)
);
create table public.appointment_resources(
 id uuid primary key, name text not null, is_active boolean not null default true
);
create table public.appointments(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.owners(id),
 pet_id uuid not null,
 resource_id uuid not null references public.appointment_resources(id),
 starts_at timestamptz not null, ends_at timestamptz not null,
 concern text not null check(length(btrim(concern)) between 1 and 300),
 details text, status text not null default 'requested'
 check(status in ('requested','confirmed','checked_in','completed','cancelled','no_show')),
 created_by uuid default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 constraint booking_fixture_range check(ends_at>starts_at and ends_at<=starts_at+interval '8 hours'),
 constraint booking_fixture_pet_owner foreign key(pet_id,owner_id)
 references public.pets(id,owner_id),
 constraint appointments_no_active_overlap exclude using gist(
 resource_id with =,tstzrange(starts_at,ends_at,'[)') with &&)
 where(status in ('requested','confirmed','checked_in'))
);
alter table public.owners enable row level security;
alter table public.pets enable row level security;
alter table public.species_catalog enable row level security;
alter table public.appointment_resources enable row level security;
alter table public.appointments enable row level security;
alter table public.staff_memberships enable row level security;
create policy owner_read on public.owners for select to authenticated
 using(user_id=auth.uid() and clinic_private.is_permanent_user());
create policy pet_read on public.pets for select to authenticated
 using(exists(select 1 from public.owners o
 where o.id=owner_id and o.user_id=auth.uid()));
create policy species_read on public.species_catalog for select to authenticated
 using(is_active and review_status<>'pending');
create policy resource_read on public.appointment_resources for select to authenticated
 using(clinic_private.is_permanent_user());
create policy appointment_read on public.appointments for select to authenticated
 using(exists(select 1 from public.owners o
 where o.id=owner_id and o.user_id=auth.uid()) or
 clinic_private.has_staff_role(array['receptionist','veterinarian','administrator']));
create policy appointment_insert on public.appointments for insert to authenticated
 with check(created_by=auth.uid() and status='requested'
 and exists(select 1 from public.owners o where o.id=owner_id
 and o.user_id=auth.uid() and clinic_private.is_permanent_user()));
create policy appointment_owner_cancel on public.appointments for update to authenticated
 using(status in ('requested','confirmed') and exists(
 select 1 from public.owners o where o.id=owner_id and o.user_id=auth.uid()))
 with check(status='cancelled' and exists(
 select 1 from public.owners o where o.id=owner_id and o.user_id=auth.uid()));
create policy appointment_staff_update on public.appointments for update to authenticated
 using(clinic_private.has_staff_role(array['receptionist','veterinarian','administrator']))
 with check(clinic_private.has_staff_role(array['receptionist','veterinarian','administrator']));
revoke all on public.owners,public.pets,public.species_catalog,
 public.staff_memberships,public.appointment_resources,public.appointments
 from public,anon,authenticated;
grant select on public.owners,public.pets,public.species_catalog,
 public.appointment_resources,public.appointments to authenticated;
grant insert(owner_id,pet_id,resource_id,starts_at,ends_at,concern,details)
 on public.appointments to authenticated;
grant update(status) on public.appointments to authenticated;

insert into auth.users(id,email_confirmed_at) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',now()),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',now());
insert into public.owners(id,user_id) values
('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.species_catalog(id,is_active,clinic_supported) values
('dog',true,false),('cat',true,false);
insert into public.pets(id,owner_id,species_id) values
('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','dog'),
('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222','cat');
insert into public.appointment_resources(id,name) values
('55555555-5555-4555-8555-555555555555','CI Resource A'),
('66666666-6666-4666-8666-666666666666','CI Resource B');
-- Historical appointment unrelated to service; remains unchanged.
insert into public.appointments(id,owner_id,pet_id,resource_id,starts_at,ends_at,concern,
 status,created_by)
values('77777777-7777-4777-8777-777777777777',
 '22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444',
 '66666666-6666-4666-8666-666666666666',
 now()+interval '15 days',now()+interval '15 days 30 minutes',
 'CI historical request','requested','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
