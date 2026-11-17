-- CI-only provider boundary, NOT a Supabase Auth or Storage implementation.
-- Used only in disposable PostgreSQL 17 before the six REAL Phase2/3 migrations.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create schema storage;
create schema extensions;

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
 user_id uuid not null references auth.users(id),
 provider text not null,
 provider_id text not null
);
create function auth.uid() returns uuid language sql stable set search_path='' as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
create function auth.jwt() returns jsonb language sql stable set search_path='' as $$
 select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb
$$;
grant usage on schema auth to anon,authenticated;
grant usage on schema public to anon,authenticated;
grant execute on function auth.uid(),auth.jwt() to anon,authenticated;

-- A deliberately minimal mock of provider-managed Storage metadata/permissions.
-- The six actual migrations alone supply application schema, functions and RLS.
create table storage.buckets(
 id text primary key,
 public boolean not null default false
);
create table storage.objects(
 id uuid primary key default gen_random_uuid(),
 bucket_id text not null references storage.buckets(id),
 name text not null,
 metadata jsonb not null default '{}'::jsonb,
 unique(bucket_id,name)
);
alter table storage.objects enable row level security;
create function storage.foldername(path text) returns text[]
 language sql immutable set search_path='' as $$
 select (string_to_array(path,'/'))[
 1:greatest(array_length(string_to_array(path,'/'),1)-1,0)]
$$;
create function storage.filename(path text) returns text
 language sql immutable set search_path='' as $$
 select reverse(split_part(reverse(path),'/',1))
$$;
revoke all on storage.objects from public,anon,authenticated;
grant usage on schema storage to authenticated;
grant select on storage.objects to authenticated;
grant insert(bucket_id,name,metadata) on storage.objects to authenticated;
