-- Phase 2 Auth integration schema/security verification (read-only).
do $$
declare app_table_count integer;
declare wrong_rls_count integer;
declare private_admin_calls integer;
declare migration_count integer;
begin
  select count(*) into app_table_count from pg_catalog.pg_tables
   where schemaname='public'
     and tablename in ('staff_memberships','owners','pets','clinical_records',
                        'appointment_resources','appointments','appointment_events');
  if app_table_count <> 7 then raise exception 'Expected exactly 7 public app tables'; end if;

  select count(*) into wrong_rls_count
  from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname in ('staff_memberships','owners','pets',
  'clinical_records','appointment_resources','appointments','appointment_events')
  and c.relrowsecurity is not true;
  if wrong_rls_count <> 0 then raise exception 'Missing RLS on application tables'; end if;

  select count(*) into migration_count from supabase_migrations.schema_migrations
  where version in ('20261113070302','20261113070834','20261113074938');
  if migration_count <> 3 then raise exception 'Missing versioned migrations'; end if;

  if pg_catalog.has_table_privilege('anon','public.owners','SELECT') then
   raise exception 'Anon SELECT grant discovered'; end if;
  if pg_catalog.has_table_privilege('authenticated','public.staff_memberships','INSERT') then
   raise exception 'Self-promotion grant discovered'; end if;
  if pg_catalog.has_function_privilege('authenticated',
      'clinic_private.bootstrap_first_administrator(uuid)','EXECUTE') then
   raise exception 'Authenticated user can invoke admin bootstrap'; end if;
  if pg_catalog.has_function_privilege('anon',
      'clinic_private.grant_verified_staff(uuid,text,uuid)','EXECUTE') then
   raise exception 'Anon can grant staff roles'; end if;
  select count(*) into private_admin_calls
  from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where n.nspname='clinic_private'
    and p.proname in ('bootstrap_first_administrator','grant_verified_staff')
    and p.prosecdef=true;
  if private_admin_calls <> 0 then raise exception 'Staff bootstrap must be SECURITY INVOKER'; end if;
end $$;

select
  (select count(*) from auth.users) as real_auth_accounts,
  (select count(*) from public.owners) as owners,
  (select count(*) from public.pets) as pets,
  (select count(*) from public.clinical_records) as clinical_records,
  (select count(*) from public.appointments) as appointments,
  (select count(*) from public.staff_memberships) as staff,
  (select count(*) from public.appointment_resources) as resources,
  (select count(*) from supabase_migrations.schema_migrations) as migration_count;
