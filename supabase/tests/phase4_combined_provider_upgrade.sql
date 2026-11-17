-- CI-only additive provider metadata shim. NOT a production migration.
-- PR59 bootstrap omits email and private-object metadata (its own suite does not
-- need them). This adds fields exclusively for PR62's original Storage fixture;
-- nullable email preserves PR59's unchanged synthetic Auth INSERT contract.
alter table auth.users add column email text unique;
create table auth.identities (
 id uuid primary key,
 user_id uuid not null references auth.users(id),
 provider text not null,
 provider_id text not null
);
create table storage.buckets (
 id text primary key,
 public boolean not null default false
);
alter table storage.objects
 add column metadata jsonb not null default '{}'::jsonb,
 add constraint combined_object_bucket_fk foreign key (bucket_id)
 references storage.buckets(id);
create unique index combined_object_path_idx on storage.objects(bucket_id,name);
grant usage on schema storage to authenticated;
grant select on storage.objects to authenticated;
grant insert(bucket_id,name,metadata) on storage.objects to authenticated;
