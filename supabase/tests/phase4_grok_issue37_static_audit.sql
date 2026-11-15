-- Issue #37 audit snapshot. Read-only. Do not run against production clinical data.
-- Assertion style is DO/IF/RAISE so a false condition cannot constant-fold into an error.
-- PGlite 0.5.8 evidence (2026-11-14): `select 1/0 where false` still raises 22012;
-- `do $$ begin if false then raise exception 'x'; end if; end $$` does not.
--
-- When phase 4 tables are absent this script notices and returns (no false failure).
-- When both phase 4 migrations have been applied on a disposable database it expects:
--   * trigger function resolve_pet_taxonomy installed on public.pets (seed file)
--   * no breed_catalog row labelled Chow Chow (issue #35 still open)
-- Astra's Chow Chow fix must update the Chow assertion in the same PR.

do $$
begin
  if false then
    raise exception 'assertion harness constant-folded a false IF';
  end if;

  if to_regclass('public.breed_catalog') is null or to_regclass('public.pets') is null then
    raise notice 'phase 4 tables absent; source review only';
    return;
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where not t.tgisinternal
      and n.nspname = 'public'
      and c.relname = 'pets'
      and p.proname = 'resolve_pet_taxonomy'
  ) then
    raise exception 'resolve_pet_taxonomy is not installed on public.pets';
  end if;

  if exists (
    select 1 from public.breed_catalog
    where species_id = 'dog' and label = 'Chow Chow'
  ) then
    raise exception 'audit snapshot stale: Chow Chow is now seeded; update this test';
  else
    raise notice 'confirmed issue #35: Dog / Chow Chow is not in breed_catalog';
  end if;
end $$;
