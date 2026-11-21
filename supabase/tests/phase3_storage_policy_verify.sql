-- Clinical Storage policy structural assertions; no bucket/object metadata is modified.
-- These are not proof of end-to-end upload/download; use real JWTs and Storage API.
begin read only;
do $$
declare
  row_level_enabled boolean;
  policy_count integer;
  unsafe_commands integer;
  bucket_public boolean;
  bucket_bytes bigint;
  bucket_types text[];
  path text[] := storage.foldername(
    'pets/11111111-1111-4111-8111-111111111111/owners/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333.pdf'
  );
begin
  select c.relrowsecurity into row_level_enabled
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='storage' and c.relname='objects';
  if row_level_enabled is distinct from true then
    raise exception 'FAIL storage.objects missing RLS'; end if;

  select count(*) into policy_count from pg_policies
  where schemaname='storage' and tablename='objects'
    and roles = array['authenticated'::name]
    and ((policyname='clinical_attachments_read_scoped' and cmd='SELECT')
      or (policyname='clinical_attachments_insert_scoped' and cmd='INSERT'));
  if policy_count<>2 then raise exception 'FAIL expected exactly two RLS policies'; end if;

  select count(*) into unsafe_commands from pg_policies
  where schemaname='storage' and tablename='objects'
    and (cmd in ('UPDATE','DELETE','ALL') or 'anon'=any(roles));
  if unsafe_commands<>0 then raise exception 'FAIL unexpected Storage mutation/anonymous RLS';end if;

  if path[1]<>'pets' or path[3]<>'owners' or array_length(path,1)<>4
    or storage.filename('pets/test/document.pdf')<>'document.pdf'
    or storage.extension('pets/test/document.pdf')<>'pdf' then
    raise exception 'FAIL Storage path parser mismatch';end if;

  select public,file_size_limit,allowed_mime_types
    into bucket_public,bucket_bytes,bucket_types
  from storage.buckets where id='clinical-attachments';
  if found then
    if bucket_public is distinct from false then raise exception 'FAIL public bucket';end if;
    if bucket_bytes is null or bucket_bytes>5242880 then raise exception 'FAIL missing 5MB limit';end if;
    if bucket_types is null or not (
      bucket_types <@ array['application/pdf','image/png','image/jpeg']::text[]
    ) then raise exception 'FAIL unrestricted MIME list';end if;
  end if;
end $$;
rollback;
