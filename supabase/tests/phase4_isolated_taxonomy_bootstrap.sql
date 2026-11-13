-- SELF-CONTAINED DISPOSABLE Postgres 17 CI fixture only. NEVER run on connected clinic.
create role authenticated nologin;
create role anon nologin;
create schema auth;
create schema clinic_private;
create schema storage;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
grant usage on schema auth to authenticated,anon;
grant execute on function auth.uid() to authenticated,anon;
grant usage on schema clinic_private to authenticated;
create function clinic_private.is_permanent_user() returns boolean language sql stable as $$
 select auth.uid() is not null
$$;
create function clinic_private.has_staff_role(text[]) returns boolean language sql stable as $$
 select false
$$;
grant execute on function clinic_private.is_permanent_user() to authenticated;
grant execute on function clinic_private.has_staff_role(text[]) to authenticated;
create table public.owners (
 id uuid primary key,
 user_id uuid not null references auth.users(id)
);
create table public.pets (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.owners(id),
 name text not null,
 species text not null,
 breed text,
 sex text not null default 'unknown',
 color text,
 birth_date date,
 created_at timestamptz not null default now()
);
create table storage.objects (
 bucket_id text,
 name text,
 metadata jsonb,
 primary key(bucket_id,name)
);
alter table storage.objects enable row level security;
create policy fake_storage_owner_select on storage.objects
 for select to authenticated
 using (name like ('pets/%/owners/'||auth.uid()::text||'/%'));
revoke all on storage.objects from public,anon,authenticated;
grant usage on schema storage to authenticated;
grant select on storage.objects to authenticated;
alter table public.pets enable row level security;
create policy fixture_owner_pet on public.pets for all to authenticated
 using (exists(select 1 from public.owners o where o.id=owner_id and o.user_id=auth.uid()))
 with check (exists(select 1 from public.owners o where o.id=owner_id and o.user_id=auth.uid()));
revoke all on public.owners,public.pets from public,anon,authenticated;
grant select on public.owners,public.pets to authenticated;
grant insert (owner_id,name,species,breed,sex,color,birth_date) on public.pets to authenticated;
grant update (name,species,breed,sex,color,birth_date) on public.pets to authenticated;
grant usage on schema public to authenticated,anon;
insert into auth.users(id) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.owners(id,user_id) values
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
-- The preexisting legacy pet is not fabricated in live Supabase: this fixture
-- is only in isolated disposable CI database for preservation assertions.
insert into public.pets(id,owner_id,name,species,breed) values
 ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111',
  'Historic One','Canine','Unlisted historic cross'),
 ('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222',
  'Historic Two','Uncatalogued Legacy Animal','Historic breed'),
 ('55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111',
  'Historic Dog','Dog','Golden Retriever');
