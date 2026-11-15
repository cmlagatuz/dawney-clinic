-- CI-ONLY synthetic auth/storage shims for the REAL Phase2/3 SQL migrations.
-- Standalone disposable PostgreSQL 17 service; do not use with Supabase.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create schema extensions;
create schema storage;
create schema clinic_ci;

create table auth.users (
 id uuid primary key,
 email_confirmed_at timestamptz,
 is_anonymous boolean not null default false,
 deleted_at timestamptz,
 banned_until timestamptz
);
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
create function auth.jwt() returns jsonb language sql stable as $$
 select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb
$$;
grant usage on schema auth to authenticated,anon;
grant usage on schema public to authenticated,anon;
grant execute on function auth.uid(),auth.jwt() to authenticated,anon;

-- Minimal metadata-only Storage shim needed to parse the existing Phase3 policies.
-- No bucket, object, file, or Storage API fixture is created.
create table storage.objects (
 id uuid primary key default gen_random_uuid(),
 bucket_id text not null,
 name text not null
);
alter table storage.objects enable row level security;
create function storage.foldername(path text) returns text[] language sql immutable as $$
 select (string_to_array(path,'/'))[1:greatest(array_length(string_to_array(path,'/'),1)-1,0)]
$$;
create function storage.filename(path text) returns text language sql immutable as $$
 select reverse(split_part(reverse(path),'/',1))
$$;
