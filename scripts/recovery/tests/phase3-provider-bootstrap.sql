-- CI-ONLY Supabase provider boundary for the six UNMODIFIED Phase2/3 migrations.
-- PostgreSQL 17 on localhost, no real Auth/Storage API or production changes.
-- Clinical schema, grants, appointment policies and triggers come from migrations,
-- NEVER from this bootstrap.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create schema storage;
create schema extensions;
create schema clinic_ci;

create table auth.users (
 id uuid primary key,
 email text not null unique,
 email_confirmed_at timestamptz,
 is_anonymous boolean not null default false,
 deleted_at timestamptz,
 banned_until timestamptz
);
create table auth.identities (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 provider text not null,
 provider_id text not null,
 unique(provider,provider_id)
);
create function auth.uid() returns uuid language sql stable
 set search_path = '' as $$
 select nullif(pg_catalog.current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
create function auth.jwt() returns jsonb language sql stable
 set search_path = '' as $$
 select coalesce(
  nullif(pg_catalog.current_setting('request.jwt.claims',true),''),
  '{}')::jsonb
$$;
grant usage on schema auth to anon,authenticated;
grant usage on schema public to anon,authenticated;
grant execute on function auth.uid(),auth.jwt() to anon,authenticated;

-- Deliberate provider-only metadata representation; no Storage API claims.
create table storage.buckets (
 id text primary key,
 public boolean not null default false
);
create table storage.objects (
 id uuid primary key default gen_random_uuid(),
 bucket_id text not null references storage.buckets(id),
 name text not null,
 metadata jsonb not null,
 constraint storage_object_name_unique unique(bucket_id,name)
);
alter table storage.objects enable row level security;
create function storage.foldername(path text) returns text[]
 language sql immutable set search_path='' as $$
 select (pg_catalog.string_to_array(path,'/'))
   [1:greatest(
     pg_catalog.array_length(pg_catalog.string_to_array(path,'/'),1)-1,0)]
$$;
create function storage.filename(path text) returns text
 language sql immutable set search_path='' as $$
 select pg_catalog.reverse(pg_catalog.split_part(pg_catalog.reverse(path),'/',1))
$$;
grant usage on schema storage to authenticated;
grant select on storage.objects to authenticated;
grant insert(id,bucket_id,name,metadata) on storage.objects to authenticated;

-- This records the *fixture version*, not a Supabase managed migration ledger.
create table clinic_ci.recovery_fixture(
 version text primary key, created_at timestamptz not null default now(),
 description text not null
);
insert into clinic_ci.recovery_fixture(version,description)
values('phase3-real-six-migrations-v1',
 'Synthetic provider shims + six original Phase2/3 migrations; no production Auth/Storage representation');
