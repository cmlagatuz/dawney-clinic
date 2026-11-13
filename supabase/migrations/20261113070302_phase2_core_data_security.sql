-- Dawney Clinic Phase 2: baseline schema. Non-destructive; no clinical data seeded.
create schema if not exists clinic_private;
revoke all on schema clinic_private from public, anon, authenticated;
grant usage on schema clinic_private to authenticated;
create extension if not exists btree_gist with schema extensions;
set search_path = public, extensions, pg_catalog;

create table public.staff_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('receptionist', 'veterinarian', 'administrator')),
  is_active boolean not null default true,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users(id) on delete set null
);

create function clinic_private.is_permanent_user()
returns boolean language sql stable security invoker
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and not coalesce((auth.jwt()->>'is_anonymous')::boolean, false);
$$;

create function clinic_private.has_staff_role(allowed_roles text[])
returns boolean language sql stable security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1 from public.staff_memberships s
      where s.user_id = (select auth.uid())
        and s.is_active and s.role = any(allowed_roles)
    );
$$;

revoke all on function clinic_private.is_permanent_user() from public, anon, authenticated;
revoke all on function clinic_private.has_staff_role(text[]) from public, anon, authenticated;
grant execute on function clinic_private.is_permanent_user() to authenticated;
grant execute on function clinic_private.has_staff_role(text[]) to authenticated;

create table public.owners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() unique references auth.users(id) on delete restrict,
  first_name text not null check (length(btrim(first_name)) between 1 and 150),
  last_name text not null check (length(btrim(last_name)) between 1 and 150),
  phone text,
  address text,
  legacy_owner_id bigint unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 150),
  species text not null check (length(btrim(species)) between 1 and 120),
  breed text,
  sex text not null default 'unknown' check (sex in ('male','female','unknown')),
  color text,
  birth_date date,
  legacy_pet_id bigint unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pets_id_owner_unique unique (id, owner_id)
);

create table public.clinical_records (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete restrict,
  performed_at timestamptz not null default now(),
  procedure text not null check (length(btrim(procedure)) between 1 and 500),
  temperature_c numeric(5,2) check (temperature_c between 0 and 60),
  weight_kg numeric(10,3) check (weight_kg >= 0),
  comments text,
  authored_by uuid default auth.uid() references auth.users(id) on delete set null,
  legacy_record_id bigint unique,
  created_at timestamptz not null default now()
);

create table public.appointment_resources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true
);
insert into public.appointment_resources(name) values ('General appointments');

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete restrict,
  pet_id uuid not null,
  resource_id uuid not null references public.appointment_resources(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  concern text not null check (length(btrim(concern)) between 1 and 300),
  details text,
  status text not null default 'requested'
    check (status in ('requested','confirmed','checked_in','completed','cancelled','no_show')),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  legacy_appointment_id bigint unique,
  created_at timestamptz not null default now(),
  constraint appointments_valid_range check (ends_at > starts_at and ends_at <= starts_at + interval '8 hours'),
  constraint appointments_pet_same_owner foreign key (pet_id, owner_id)
    references public.pets(id, owner_id) on delete restrict,
  constraint appointments_no_active_overlap
    exclude using gist (resource_id with =, tstzrange(starts_at, ends_at, '[)') with &&)
    where (status in ('requested', 'confirmed', 'checked_in'))
);

create table public.appointment_events (
  id bigint generated always as identity primary key,
  appointment_id uuid not null references public.appointments(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  previous_status text,
  new_status text not null,
  happened_at timestamptz not null default now()
);

create function clinic_private.log_appointment_status()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.appointment_events(appointment_id, actor_id, previous_status, new_status)
  values (new.id, (select auth.uid()), case when tg_op='UPDATE' then old.status else null end, new.status);
  return new;
end;
$$;
revoke all on function clinic_private.log_appointment_status() from public, anon, authenticated;
create trigger appointment_status_log after insert or update of status on public.appointments
  for each row execute function clinic_private.log_appointment_status();

-- Service-only legacy account linking; do not expose schema in Supabase Data API.
create table clinic_private.legacy_user_links (
  legacy_user_id bigint primary key,
  auth_user_id uuid not null unique references auth.users(id) on delete restrict,
  mapped_at timestamptz not null default now(),
  mapping_method text not null check (mapping_method in ('verified_invitation','verified_reset','operator_verified'))
);
revoke all on table clinic_private.legacy_user_links from public, anon, authenticated;

create index idx_pets_owner on public.pets(owner_id);
create index idx_clinical_records_pet_date on public.clinical_records(pet_id, performed_at desc);
create index idx_appointments_owner_date on public.appointments(owner_id, starts_at desc);
create index idx_appointments_pet on public.appointments(pet_id);
create index idx_appointment_events_app on public.appointment_events(appointment_id, happened_at desc);

alter table public.staff_memberships enable row level security;
alter table public.owners enable row level security;
alter table public.pets enable row level security;
alter table public.clinical_records enable row level security;
alter table public.appointment_resources enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_events enable row level security;
alter table clinic_private.legacy_user_links enable row level security;

create policy "staff_self_or_admin_read" on public.staff_memberships
for select to authenticated
using (user_id = (select auth.uid()) or (select clinic_private.has_staff_role(array['administrator'])));

create policy "owners_select_own_or_staff" on public.owners
for select to authenticated
using ((user_id = (select auth.uid()) and (select clinic_private.is_permanent_user()))
 or (select clinic_private.has_staff_role(array['receptionist','veterinarian','administrator'])));
create policy "owners_insert_own" on public.owners
for insert to authenticated
with check (user_id = (select auth.uid()) and (select clinic_private.is_permanent_user()));
create policy "owners_update_own_or_staff" on public.owners
for update to authenticated
using ((user_id = (select auth.uid()) and (select clinic_private.is_permanent_user()))
 or (select clinic_private.has_staff_role(array['receptionist','administrator'])))
with check ((user_id = (select auth.uid()) and (select clinic_private.is_permanent_user()))
 or (select clinic_private.has_staff_role(array['receptionist','administrator'])));

create policy "pets_select_own_or_staff" on public.pets
for select to authenticated
using (exists (select 1 from public.owners o where o.id = pets.owner_id and o.user_id = (select auth.uid())
    and (select clinic_private.is_permanent_user()))
 or (select clinic_private.has_staff_role(array['receptionist','veterinarian','administrator'])));
create policy "pets_insert_own_or_staff" on public.pets
for insert to authenticated
with check (exists (select 1 from public.owners o where o.id = pets.owner_id and o.user_id = (select auth.uid())
    and (select clinic_private.is_permanent_user()))
 or (select clinic_private.has_staff_role(array['receptionist','administrator'])));
create policy "pets_update_own_or_staff" on public.pets
for update to authenticated
using (exists (select 1 from public.owners o where o.id = pets.owner_id and o.user_id = (select auth.uid())
    and (select clinic_private.is_permanent_user()))
 or (select clinic_private.has_staff_role(array['receptionist','administrator'])))
with check (exists (select 1 from public.owners o where o.id = pets.owner_id and o.user_id = (select auth.uid())
    and (select clinic_private.is_permanent_user()))
 or (select clinic_private.has_staff_role(array['receptionist','administrator'])));

create policy "clinical_records_read_own_or_staff" on public.clinical_records
for select to authenticated
using (exists (
  select 1 from public.pets p join public.owners o on o.id=p.owner_id
  where p.id=clinical_records.pet_id and o.user_id=(select auth.uid())
    and (select clinic_private.is_permanent_user())
) or (select clinic_private.has_staff_role(array['receptionist','veterinarian','administrator'])));
create policy "clinical_records_insert_vet_or_admin" on public.clinical_records
for insert to authenticated
with check (authored_by=(select auth.uid()) and
  (select clinic_private.has_staff_role(array['veterinarian','administrator'])));

create policy "resources_read_signed_in" on public.appointment_resources
for select to authenticated
using ((select clinic_private.is_permanent_user())
 or (select clinic_private.has_staff_role(array['receptionist','veterinarian','administrator'])));

create policy "appointments_read_own_or_staff" on public.appointments
for select to authenticated
using (exists (select 1 from public.owners o where o.id=appointments.owner_id
    and o.user_id=(select auth.uid()) and (select clinic_private.is_permanent_user()))
 or (select clinic_private.has_staff_role(array['receptionist','veterinarian','administrator'])));
create policy "appointments_insert_client_or_staff" on public.appointments
for insert to authenticated
with check (
  created_by=(select auth.uid()) and status='requested'
  and exists(select 1 from public.appointment_resources r where r.id=resource_id and r.is_active)
  and (
    exists(select 1 from public.owners o where o.id=appointments.owner_id
      and o.user_id=(select auth.uid()) and (select clinic_private.is_permanent_user()))
    or (select clinic_private.has_staff_role(array['receptionist','veterinarian','administrator']))
  )
);
create policy "appointments_cancel_own" on public.appointments
for update to authenticated
using (status in ('requested','confirmed') and exists(
  select 1 from public.owners o where o.id=appointments.owner_id
  and o.user_id=(select auth.uid()) and (select clinic_private.is_permanent_user())))
with check (status='cancelled' and exists (
  select 1 from public.owners o where o.id=appointments.owner_id
  and o.user_id=(select auth.uid()) and (select clinic_private.is_permanent_user())));
create policy "appointments_staff_change_status" on public.appointments
for update to authenticated
using ((select clinic_private.has_staff_role(array['receptionist','veterinarian','administrator'])))
with check ((select clinic_private.has_staff_role(array['receptionist','veterinarian','administrator'])));

create policy "appointment_events_read_own_or_staff" on public.appointment_events
for select to authenticated
using (exists (select 1 from public.appointments a join public.owners o on o.id=a.owner_id
  where a.id=appointment_events.appointment_id and o.user_id=(select auth.uid())
    and (select clinic_private.is_permanent_user()))
  or (select clinic_private.has_staff_role(array['receptionist','veterinarian','administrator'])));

-- Avoid implicit Supabase default privileges for API roles. Grant only intended columns.
revoke all on public.staff_memberships, public.owners, public.pets, public.clinical_records,
  public.appointment_resources, public.appointments, public.appointment_events
  from public, anon, authenticated;
revoke all on sequence public.appointment_events_id_seq from public, anon, authenticated;
grant select on public.staff_memberships, public.owners, public.pets, public.clinical_records,
  public.appointment_resources, public.appointments, public.appointment_events to authenticated;
grant insert (first_name,last_name,phone,address) on public.owners to authenticated;
grant update (first_name,last_name,phone,address) on public.owners to authenticated;
grant insert (owner_id,name,species,breed,sex,color,birth_date) on public.pets to authenticated;
grant update (name,species,breed,sex,color,birth_date) on public.pets to authenticated;
grant insert (pet_id,performed_at,procedure,temperature_c,weight_kg,comments) on public.clinical_records to authenticated;
grant insert (owner_id,pet_id,resource_id,starts_at,ends_at,concern,details) on public.appointments to authenticated;
grant update (status) on public.appointments to authenticated;
