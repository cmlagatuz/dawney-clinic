-- Issue #37 static audit (read-only catalog checks). Do not run against production
-- patient data writes. Safe to run on a throwaway database after migrations, or as a
-- reviewer checklist: every assertion below is currently expected to FAIL on master
-- until Astra lands the fixes named in docs/audits/phase4-grok-issue37.md.
--
-- Evidence reviewed at master f37a884 (2026-11-14):
-- * supabase/migrations/20261113211600_phase4_taxonomy_attachments.sql defines
--   clinic_private.resolve_pet_taxonomy() but never CREATE TRIGGER for it.
-- * Only trigger in that file is attachment_validate on public.pet_attachments.
-- * supabase/migrations/20261113211700_phase4_animal_catalog_seed.sql has species dog
--   and no breed label Chow Chow (ON CONFLICT (id) DO NOTHING).

select 1/0 as fail_taxonomy_trigger_missing
where not exists (
  select 1 from pg_trigger t
  join pg_proc p on p.oid = t.tgfoid
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where not t.tgisinternal
    and n.nspname = 'public'
    and c.relname = 'pets'
    and p.proname = 'resolve_pet_taxonomy'
);

select 1/0 as fail_chow_chow_missing
where not exists (
  select 1 from public.breed_catalog
  where species_id = 'dog' and label = 'Chow Chow' and is_active and review_status <> 'pending'
);

select 1/0 as fail_attachment_update_policy_present
where exists (
  select 1 from pg_policies
  where schemaname = 'public' and tablename = 'pet_attachments' and cmd in ('UPDATE','DELETE')
);

select 1/0 as fail_attachment_insert_allows_receptionist
where exists (
  select 1 from pg_policies
  where schemaname = 'public'
    and tablename = 'pet_attachments'
    and cmd = 'INSERT'
    and coalesce(with_check, qual) ilike '%receptionist%'
);
