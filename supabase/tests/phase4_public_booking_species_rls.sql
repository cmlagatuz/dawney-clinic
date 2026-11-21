-- Disposable PG17 service-species SELECT authorization regression for PR #43.
-- Run ONLY in isolated CI immediately after the booking migration; all fixtures ROLLBACK.
-- Tests actual migration-defined RLS/grants under PostgreSQL roles + synthetic auth.uid().
-- Does NOT certify live Supabase JWT, email verification or PostgREST behavior.
begin;

-- All records below are synthetic; no clinic-approved services/hours are created.
insert into public.species_catalog(id,is_active,clinic_supported,review_status) values
 ('ci-species-eligible',true,true,'curated'),
 ('ci-species-another',true,true,'curated'),
 ('ci-species-unsupported',true,false,'curated'),
 ('ci-species-inactive',false,true,'curated'),
 ('ci-species-pending',true,true,'pending');

insert into public.clinic_services
 (id,slug,display_name,duration_minutes,is_active,
  owner_approved_at,owner_approved_by,published_at)
values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1001','ci-published-service',
  'Synthetic published service',30,true,now(),
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',now()),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1002','ci-other-service',
  'Synthetic second service',30,true,now(),
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',now()),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1003','ci-no-species-service',
  'Synthetic service with no eligible species',30,true,now(),
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',now()),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1004','ci-draft-service',
  'Synthetic unpublished draft service',30,false,null,null,null),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1005','ci-inactive-service',
  'Synthetic inactive published service',30,false,now(),
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',now()),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1006','ci-unpublished-service',
  'Synthetic approved but unpublished',30,true,now(),
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null);

insert into public.clinic_service_species(service_id,species_id) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1001','ci-species-eligible'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1001','ci-species-unsupported'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1001','ci-species-inactive'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1001','ci-species-pending'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1002','ci-species-another'),
 -- Published service with a mapping but zero currently eligible species:
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1003','ci-species-unsupported'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1004','ci-species-eligible'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1005','ci-species-eligible'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1006','ci-species-eligible');

-- One role may only read a service's eligible mappings, never a hidden service
-- or an unsupported/inactive/pending species mapping.
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
do $owner_a$
declare mapped text[]; total integer;
begin
 if not has_table_privilege('authenticated',
     'public.clinic_service_species','SELECT') then
  raise exception 'Authenticated service-species SQL grant missing';
 end if;
 select array_agg(species_id order by species_id) into mapped
 from public.clinic_service_species
 where service_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1001';
 if mapped is distinct from array['ci-species-eligible']::text[] then
  raise exception 'Owner A saw unsupported/inactive/pending mapping: %',mapped;
 end if;
 select array_agg(species_id order by species_id) into mapped
 from public.clinic_service_species
 where service_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1002';
 if mapped is distinct from array['ci-species-another']::text[] then
  raise exception 'Service-specific filter leaked another service: %',mapped;
 end if;
 select count(*) into total from public.clinic_service_species;
 if total<>2 then
  raise exception 'Owner A saw % eligible mappings, expected exactly 2',total;
 end if;
 -- An APPROVED/PUBLISHED service with no currently eligible mappings is an
 -- authorized empty read (not a permission error).
 if (select count(*) from public.clinic_services
     where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1003')<>1
   or (select count(*) from public.clinic_service_species
     where service_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1003')<>0 then
  raise exception 'Authorized empty mapping was not distinguishable from missing service';
 end if;
 -- Draft, inactive and owner-approved but unpublished service mappings hidden.
 if (select count(*) from public.clinic_service_species
       where service_id in (
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1004',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1005',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1006'))<>0
   or (select count(*) from public.clinic_services
       where id in (
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1004',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1005',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1006'))<>0 then
  raise exception 'Draft, inactive or unpublished service leaked to authenticated owner';
 end if;
end $owner_a$;

-- Both legitimate owners have the same public approved service-species catalog.
-- The mapping is NOT a pet/owner-level privacy table; no owner IDs are exposed.
select pg_catalog.set_config('request.jwt.claim.sub',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
do $owner_b$
declare mapped text[];
begin
 select array_agg(species_id order by species_id) into mapped
 from public.clinic_service_species
 where service_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1001';
 if mapped is distinct from array['ci-species-eligible']::text[] then
  raise exception 'Owner B eligible published-service mapping mismatch: %',mapped;
 end if;
 if (select count(*) from public.clinic_service_species)<>2
   or (select count(*) from public.clinic_service_species
       where service_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1003')<>0 then
  raise exception 'Owner B cannot distinguish eligible catalog from empty result';
 end if;
end $owner_b$;

-- A zero-row authorized result above is NOT the same as SQL authorization
-- denial. A real anon DB role must fail SELECT with insufficient_privilege,
-- even when its synthetic request.jwt.claim.sub forges an owner ID.
set local role anon;
select pg_catalog.set_config('request.jwt.claim.sub',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
do $anon_denied$
declare denied boolean:=false;
begin
 if has_any_column_privilege('anon','public.clinic_service_species','SELECT') then
  raise exception 'Anon gained a table-wide or column-only species mapping grant';
 end if;
 begin
  perform species_id from public.clinic_service_species
   where service_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1003';
 exception when insufficient_privilege then denied:=true;
 end;
 if not denied then
  raise exception 'Anonymous mapping access returned empty instead of denying SELECT';
 end if;
end $anon_denied$;

reset role;
rollback;

select 'PASS: PG17 service-species RLS owner A/B eligible published mapping, unsupported/inactive/pending/draft denial, authorized empty versus anon permission error' as verdict;
