-- Phase 4 P0 follow-on correction. Apply ONLY after BOTH 20261113211600 and
-- 20261113211700. Non-destructive: patient species/breed text remains untouched.
-- The seed migration already installs this trigger; this migration verifies it
-- and repairs a partially copied/applied baseline without double installation.
-- No Storage policy, RLS, role, clinic_supported or existing appointment changes.

do $guard$
declare installed record;
begin
 if to_regprocedure('clinic_private.resolve_pet_taxonomy()') is null
    or to_regclass('public.pets') is null
    or to_regclass('public.breed_catalog') is null then
    raise exception 'Phase 4 schema and catalog must be installed before P0 correction';
 end if;
 select t.tgfoid, t.tgenabled into installed
 from pg_trigger t
 where t.tgrelid='public.pets'::regclass
   and t.tgname='pet_taxonomy_before_write' and not t.tgisinternal;
 if not found then
   create trigger pet_taxonomy_before_write
     before insert or update of species,breed,species_id,breed_id on public.pets
     for each row execute function clinic_private.resolve_pet_taxonomy();
 else
   if installed.tgfoid <> 'clinic_private.resolve_pet_taxonomy()'::regprocedure
      or installed.tgenabled not in ('O','A') then
      raise exception 'Existing patient taxonomy trigger is replaced or disabled; manual review required';
   end if;
 end if;
 if (select count(*) from pg_trigger t where t.tgrelid='public.pets'::regclass
       and t.tgfoid='clinic_private.resolve_pet_taxonomy()'::regprocedure
       and not t.tgisinternal) <> 1 then
   raise exception 'Expected exactly one patient taxonomy validation trigger';
 end if;
end $guard$;

-- Keep trigger SECURITY INVOKER, search_path empty. Correct id-only historical
-- backfill to preserve original legacy text (including capitalization/spacing)
-- while requiring active catalog IDs and a same-species breed.
create or replace function clinic_private.resolve_pet_taxonomy()
returns trigger language plpgsql security invoker set search_path='' as $fn$
declare
 s public.species_catalog%rowtype;
 b public.breed_catalog%rowtype;
 preserve_legacy_text boolean := false;
begin
 if tg_op='UPDATE'
    and new.species is not distinct from old.species
    and new.breed is not distinct from old.breed
    and new.species_id is not distinct from old.species_id
    and new.breed_id is not distinct from old.breed_id then
   return new; -- genuine grandfather: unchanged taxonomy, no surprise rewrite
 end if;

 if new.species_id is null then
   select * into s from public.species_catalog
   where lower(btrim(label))=lower(btrim(new.species))
     and is_active and review_status<>'pending';
   if not found then
     raise exception 'Select an active catalog animal type' using errcode='23514';
   end if;
   new.species_id:=s.id;
 else
   select * into s from public.species_catalog where id=new.species_id
     and is_active and review_status<>'pending';
   if not found then
     raise exception 'Inactive or unknown animal type' using errcode='23514';
   end if;
   -- Reject forged mismatched free text when explicitly supplied/changed.
   if tg_op='INSERT' then
     if lower(btrim(new.species))<>lower(btrim(s.label)) then
       raise exception 'Animal type label/identifier mismatch' using errcode='23514';
     end if;
   elsif new.species is distinct from old.species then
     if lower(btrim(new.species))<>lower(btrim(s.label)) then
       raise exception 'Animal type label/identifier mismatch' using errcode='23514';
     end if;
   end if;
 end if;

 if new.breed_id is null then
   if nullif(btrim(coalesce(new.breed,'')),'') is not null then
     select * into b from public.breed_catalog
     where species_id=new.species_id
       and lower(btrim(label))=lower(btrim(new.breed))
       and is_active and review_status<>'pending';
     if not found then
       raise exception 'Breed must belong to selected animal type' using errcode='23514';
     end if;
     new.breed_id:=b.id;
   end if;
 else
   select * into b from public.breed_catalog
    where id=new.breed_id and species_id=new.species_id
      and is_active and review_status<>'pending';
   if not found then
     raise exception 'Inactive, pending or mismatched species/breed' using errcode='23514';
   end if;
   if tg_op='INSERT' then
     if new.breed is null or lower(btrim(new.breed))<>lower(btrim(b.label)) then
       raise exception 'Breed label/identifier mismatch' using errcode='23514';
     end if;
   elsif new.breed is distinct from old.breed then
     if new.breed is null or lower(btrim(new.breed))<>lower(btrim(b.label)) then
       raise exception 'Breed label/identifier mismatch' using errcode='23514';
     end if;
   end if;
 end if;

 -- Only a taxonomy ID backfill whose old text already matches the catalog
 -- (case-insensitively) may keep historical spelling. The IDs still pass
 -- active/pending + composite validation above. Ordinary new writes canonicalize.
 if tg_op='UPDATE' then
   preserve_legacy_text :=
      new.species is not distinct from old.species
      and new.breed is not distinct from old.breed
      and lower(btrim(new.species))=lower(btrim(s.label))
      and (
        (new.breed_id is null and nullif(btrim(coalesce(new.breed,'')),'') is null)
        or (new.breed_id is not null and lower(btrim(new.breed))=lower(btrim(b.label)))
      );
 end if;
 new.taxonomy_review_needed:=false;
 if preserve_legacy_text then return new; end if;
 new.species:=s.label;
 new.breed:=case when new.breed_id is null then null else b.label end;
 return new;
end;
$fn$;
revoke all on function clinic_private.resolve_pet_taxonomy() from public,anon,authenticated;

-- Official AKC catalog entry. Never infer that the clinic offers treatment.
do $seed$
begin
 if exists(select 1 from public.breed_catalog where species_id='dog'
      and lower(btrim(label))='chow chow' and id<>'dog-chow-chow') then
   raise exception 'Conflicting Chow Chow catalog slug; operator review required';
 end if;
 insert into public.breed_catalog
   (id,species_id,label,kind,is_active,review_status,source_name,source_url)
 values ('dog-chow-chow','dog','Chow Chow','recognized',true,'curated',
         'American Kennel Club','https://www.akc.org/dog-breeds/chow-chow/')
 on conflict(id) do nothing;
 if not exists(select 1 from public.breed_catalog
       where id='dog-chow-chow' and species_id='dog' and label='Chow Chow'
         and kind='recognized' and is_active and review_status<>'pending') then
    raise exception 'Chow Chow catalog conflict or inactive entry';
 end if;
end $seed$;

-- Index-only correction for existing Dog/Chow Chow rows. The trigger now
-- preserves their precise historical text while validating matching IDs.
update public.pets p
set species_id='dog',breed_id='dog-chow-chow',taxonomy_review_needed=false
where lower(btrim(p.species))='dog'
  and lower(btrim(coalesce(p.breed,'')))='chow chow'
  and (p.species_id is null or p.species_id='dog')
  and p.breed_id is null;

do $post$
begin
 if exists(select 1 from public.pets
   where lower(btrim(species))='dog' and lower(btrim(coalesce(breed,'')))='chow chow'
     and (species_id is distinct from 'dog'
       or breed_id is distinct from 'dog-chow-chow' or taxonomy_review_needed)) then
   raise exception 'Existing Chow Chow record has conflicting or missing taxonomy IDs; stop rollout';
 end if;
end $post$;
