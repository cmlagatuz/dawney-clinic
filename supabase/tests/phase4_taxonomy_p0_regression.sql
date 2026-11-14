-- Disposable PG17 regression. This file is not safe to run against live clinic.
-- Runs after 20261114 P0 corrective migration; no live identifiers or secrets.
do $assert$
begin
 if (select count(*) from public.pets)<>6 then
   raise exception 'P0 correction unexpectedly deleted or inserted a historic patient';
 end if;
 if (select count(*) from public.appointments)<>1 or not exists(
   select 1 from public.appointments
   where id='88888888-8888-4888-8888-888888888888'
     and pet_id='66666666-6666-4666-8666-666666666666'
     and status='requested'
 ) then raise exception 'Existing appointment not preserved'; end if;
 if not exists(
   select 1 from public.pets
   where id='66666666-6666-4666-8666-666666666666'
     and species='Dog' and breed='Chow Chow'
     and species_id='dog' and breed_id='dog-chow-chow'
     and not taxonomy_review_needed
 ) then raise exception 'Exact existing Chow Chow record was changed or not mapped'; end if;
 if not exists(
   select 1 from public.pets
   where id='77777777-7777-4777-8777-777777777777'
     and species=' dog  ' and breed=' chOW cHoW  '
     and species_id='dog' and breed_id='dog-chow-chow'
     and not taxonomy_review_needed
 ) then raise exception 'Case-insensitive Chow Chow mapping rewrote historical raw text'; end if;
 if not exists(
   select 1 from public.pets
   where id='33333333-3333-4333-8333-333333333333'
     and species='Canine' and breed='Unlisted historic cross'
     and taxonomy_review_needed
 ) then raise exception 'Unmatched historical breed was erased'; end if;
 if not exists(
   select 1 from public.pets
   where id='44444444-4444-4444-8444-444444444444'
     and species='Uncatalogued Legacy Animal' and breed='Historic breed'
     and species_id is null and taxonomy_review_needed
 ) then raise exception 'Unknown historical animal was not grandfathered'; end if;
 if (select count(*) from pg_trigger
       where tgrelid='public.pets'::regclass
         and tgfoid='clinic_private.resolve_pet_taxonomy()'::regprocedure
         and tgenabled in ('O','A') and not tgisinternal)<>1 then
     raise exception 'Expected exactly one ENABLED patient taxonomy trigger'; end if;
 if (select count(*) from pg_trigger
       where tgrelid='public.pets'::regclass and tgname='pet_taxonomy_before_write'
         and not tgisinternal)<>1 then
     raise exception 'Incorrect patient taxonomy trigger name/count'; end if;
 if exists(select 1 from pg_proc
       where oid='clinic_private.resolve_pet_taxonomy()'::regprocedure
         and prosecdef) then raise exception 'Taxonomy trigger must not bypass RLS'; end if;
 if not exists(select 1 from pg_proc
       where oid='clinic_private.resolve_pet_taxonomy()'::regprocedure
         and (('search_path=' = any(proconfig))
           or ('search_path=""' = any(proconfig)))) then
     raise exception 'Taxonomy trigger search_path must remain empty'; end if;
 if not exists(select 1 from public.breed_catalog
       where id='dog-chow-chow' and species_id='dog' and label='Chow Chow'
         and kind='recognized' and is_active and review_status='curated'
         and source_url='https://www.akc.org/dog-breeds/chow-chow/') then
    raise exception 'Official Chow Chow catalog choice missing'; end if;
 if exists(select 1 from public.species_catalog where clinic_supported) then
    raise exception 'No species should become clinic-approved because of P0 migration'; end if;
 if not (select relrowsecurity from pg_class where oid='public.pets'::regclass) or
    not (select relrowsecurity from pg_class where oid='public.pet_attachments'::regclass) or
    not (select relrowsecurity from pg_class where oid='public.breed_catalog'::regclass) then
    raise exception 'Patient/catalog/attachment RLS was disabled'; end if;
 if has_table_privilege('authenticated','public.species_catalog','INSERT')
    or has_table_privilege('authenticated','public.breed_catalog','UPDATE')
    or has_table_privilege('anon','public.pet_attachments','SELECT')
    or has_table_privilege('authenticated','public.pet_attachments','UPDATE')
    or has_table_privilege('authenticated','public.pet_attachments','DELETE') then
    raise exception 'Unsafe catalog or attachment API grant'; end if;
 if (select count(*) from public.pet_attachments)<>2 then
   raise exception 'Attachment metadata changed during P0 correction'; end if;
end $assert$;

set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
do $positive$
declare p record;
begin
 -- New records using text and catalog IDs both resolve and canonicalize.
 insert into public.pets(owner_id,name,species,breed,species_id,breed_id)
 values('11111111-1111-4111-8111-111111111111','CI New Chow','Dog','Chow Chow','dog','dog-chow-chow')
 returning * into p;
 if p.species_id<>'dog' or p.breed_id<>'dog-chow-chow' then
   raise exception 'Valid dog/breed insert rejected'; end if;
 insert into public.pets(owner_id,name,species,breed)
 values('11111111-1111-4111-8111-111111111111','CI New Cat','Cat','Siamese')
 returning * into p;
 if p.species_id<>'cat' or p.breed_id<>'cat-siamese' then
   raise exception 'Valid cat/breed insert rejected'; end if;
 -- ID-only legacy backfill has preserved original casing and spacing.
 update public.pets set species=species where id='33333333-3333-4333-8333-333333333333';
 if not exists(select 1 from public.pets
   where id='33333333-3333-4333-8333-333333333333'
     and species='Canine' and breed='Unlisted historic cross'
     and taxonomy_review_needed) then
    raise exception 'Grandfathered unchanged taxonomy was rewritten'; end if;
 update public.pets set color='brown'
  where id='33333333-3333-4333-8333-333333333333';
 if not exists(select 1 from public.pets where
    id='33333333-3333-4333-8333-333333333333'
    and color='brown' and species='Canine' and breed='Unlisted historic cross') then
   raise exception 'Editing unrelated legacy patient field destroyed taxonomy'; end if;
end $positive$;

-- Expected fail SQLSTATE = 23514 (CHECK VIOLATION), not arbitrary exception.
do $denials$
begin
 begin
   insert into public.pets(owner_id,name,species,breed,species_id,breed_id)
   values('11111111-1111-4111-8111-111111111111',
       'Cross-species','Dog','Holstein','dog','cattle-holstein');
   raise exception 'FORGED_PAIR_ALLOWED';
 exception when check_violation then null; end;
 begin
   insert into public.pets(owner_id,name,species,breed,species_id,breed_id)
   values('11111111-1111-4111-8111-111111111111',
       'Forged label','Dog','Chow Chow','cat','dog-chow-chow');
   raise exception 'FORGED_SPECIES_ID_ALLOWED';
 exception when check_violation then null; end;
 begin
   insert into public.pets(owner_id,name,species,breed,species_id,breed_id)
   values('11111111-1111-4111-8111-111111111111',
       'Forged breed text','Dog','Siamese','dog','dog-chow-chow');
   raise exception 'FORGED_BREED_LABEL_ALLOWED';
 exception when check_violation then null; end;
 begin
   insert into public.pets(owner_id,name,species,breed)
   values('11111111-1111-4111-8111-111111111111','Unsupported','Imaginary animal','');
   raise exception 'OFF_CATALOG_ALLOWED';
 exception when check_violation then null; end;
 begin
   update public.pets set species='Imaginary animal' where id='33333333-3333-4333-8333-333333333333';
   raise exception 'GRANDFATHER_EDIT_ALLOWED';
 exception when check_violation then null; end;
 -- Existing verified Dog/Chow Chow patient cannot become Cat with Dog breed.
 begin
   update public.pets set species_id='cat',species='Cat'
     where id='66666666-6666-4666-8666-666666666666';
   raise exception 'INVALID_SPECIES_CHANGE_ALLOWED';
 exception when check_violation then null; end;
end $denials$;

reset role;
-- Only the isolated DB privileged fixture marks a breed/species inactive.
-- No elevated catalog write path exists in the browser.
update public.breed_catalog set is_active=false where id='dog-chow-chow';
update public.species_catalog set is_active=false where id='rabbit';
update public.breed_catalog set review_status='pending' where id='cat-siamese';
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
do $inactive$
begin
 begin
   insert into public.pets(owner_id,name,species,breed,species_id,breed_id)
   values('11111111-1111-4111-8111-111111111111',
     'Inactive breed','Dog','Chow Chow','dog','dog-chow-chow');
   raise exception 'INACTIVE_BREED_ALLOWED';
 exception when check_violation then null; end;
 begin
   insert into public.pets(owner_id,name,species,breed)
   values('11111111-1111-4111-8111-111111111111','Inactive species','Rabbit',null);
   raise exception 'INACTIVE_SPECIES_ALLOWED';
 exception when check_violation then null; end;
 begin
   insert into public.pets(owner_id,name,species,breed,species_id,breed_id)
   values('11111111-1111-4111-8111-111111111111',
     'Pending breed','Cat','Siamese','cat','cat-siamese');
   raise exception 'PENDING_BREED_ALLOWED';
 exception when check_violation then null; end;
end $inactive$;

reset role;
update public.breed_catalog set is_active=true where id='dog-chow-chow';
update public.species_catalog set is_active=true where id='rabbit';
update public.breed_catalog set review_status='curated' where id='cat-siamese';
-- No stray metadata created during permission and taxonomy tests.
do $endcheck$
begin
 if (select count(*) from public.pet_attachments)<>2 then
  raise exception 'Taxonomy correction changed Storage metadata'; end if;
 if (select count(*) from public.appointments)<>1 then
  raise exception 'Taxonomy correction changed appointments'; end if;
end $endcheck$;
select 'PASS P0 taxonomy trigger/Chow Chow/legacy/grants/RLS/Storage integrity' as result;
