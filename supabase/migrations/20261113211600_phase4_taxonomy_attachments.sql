-- Phase 4 P0: additive animal taxonomy + immutable private patient attachment index.
-- Safe: no deletion of existing pets, appointments, species/breed text or Storage objects.
-- Owner must coordinate applying this migration ahead of Claude's frontend rollout.
create table public.species_catalog (
  id text primary key check (id ~ '^[a-z][a-z0-9-]{1,59}$'),
  label text not null unique check (length(btrim(label)) between 2 and 120),
  group_name text not null check (group_name in ('companion','livestock','birds','reptiles_amphibians','aquatic','other')),
  scientific_name text,
  is_active boolean not null default true,
  clinic_supported boolean not null default false,
  review_status text not null default 'curated' check (review_status in ('curated','staff_reviewed','pending')),
  source_name text not null default 'Dawney curated types',
  source_url text,
  created_at timestamptz not null default now()
);
create table public.breed_catalog (
  id text primary key check (id ~ '^[a-z][a-z0-9-]{1,100}$'),
  species_id text not null references public.species_catalog(id) on delete restrict,
  label text not null check (length(btrim(label)) between 2 and 150),
  kind text not null default 'recognized' check (kind in ('recognized','mixed','unknown','not_applicable')),
  is_active boolean not null default true,
  review_status text not null default 'curated' check (review_status in ('curated','staff_reviewed','pending')),
  source_name text not null,
  source_url text,
  created_at timestamptz not null default now(),
  constraint breed_unique_species_label unique (species_id,label),
  constraint breed_unique_id_species unique (id,species_id),
  constraint special_breed_kind unique (species_id,kind,label)
);
create index breed_catalog_species_active on public.breed_catalog(species_id,label) where is_active;
alter table public.species_catalog enable row level security;
alter table public.breed_catalog enable row level security;
revoke all on public.species_catalog, public.breed_catalog from public, anon, authenticated;
grant select on public.species_catalog, public.breed_catalog to authenticated;
create policy species_catalog_read on public.species_catalog for select to authenticated
 using ((select clinic_private.is_permanent_user()) and is_active and review_status <> 'pending');
create policy breed_catalog_read on public.breed_catalog for select to authenticated
 using ((select clinic_private.is_permanent_user()) and is_active and review_status <> 'pending'
  and exists(select 1 from public.species_catalog s where s.id=species_id and s.is_active));

-- Existing legacy text remains authoritative archival evidence; catalog identifiers are additive.
alter table public.pets add column species_id text references public.species_catalog(id) on delete restrict;
alter table public.pets add column breed_id text;
alter table public.pets add column taxonomy_review_needed boolean not null default false;
alter table public.pets add constraint pets_breed_requires_species check (breed_id is null or species_id is not null);
alter table public.pets add constraint pets_breed_species_fk
 foreign key (breed_id,species_id) references public.breed_catalog(id,species_id) on delete restrict;
create index pets_taxon_id_idx on public.pets(species_id,breed_id);
grant insert (species_id,breed_id) on public.pets to authenticated;
grant update (species_id,breed_id) on public.pets to authenticated;

-- Staff-reviewed additions require a trusted SQL operator; no user mutations of catalogs.
-- Legacy UI text is resolved through the curated catalog on insert/update.
-- Unknown *existing* legacy species/breed stays unchanged and is flagged, not destroyed.
create function clinic_private.resolve_pet_taxonomy()
returns trigger language plpgsql security invoker set search_path='' as $$
declare s public.species_catalog%rowtype;
declare b public.breed_catalog%rowtype;
begin
  if tg_op='UPDATE' and new.species is not distinct from old.species
     and new.breed is not distinct from old.breed
     and new.species_id is not distinct from old.species_id
     and new.breed_id is not distinct from old.breed_id then return new; end if;

  if new.species_id is null then
    select * into s from public.species_catalog
    where lower(label)=lower(btrim(new.species)) and is_active and review_status<>'pending';
    if not found then
      -- Only unchanged legacy rows may stay unnormalized.
      if tg_op='UPDATE' and old.species_id is null
         and new.species is not distinct from old.species
         and new.breed is not distinct from old.breed then
        new.taxonomy_review_needed:=true; return new;
      end if;
      raise exception 'Select a catalog animal type' using errcode='23514';
    end if;
    new.species_id:=s.id;
  else
    select * into s from public.species_catalog where id=new.species_id;
    if not found or not s.is_active or s.review_status='pending' then
      raise exception 'Inactive or unknown animal type' using errcode='23514';
    end if;
  end if;

  if new.breed_id is null and nullif(btrim(coalesce(new.breed,'')),'') is not null then
    select * into b from public.breed_catalog
    where species_id=new.species_id and lower(label)=lower(btrim(new.breed))
      and is_active and review_status<>'pending';
    if not found then
      -- Existing unmapped legacy records are grandfathered only while unchanged.
      if tg_op='UPDATE' and old.species_id is null
        and new.species is not distinct from old.species
        and new.breed is not distinct from old.breed then
        new.species_id:=null;new.taxonomy_review_needed:=true;return new;
      end if;
      raise exception 'Breed must belong to the selected animal type' using errcode='23514';
    end if;
    new.breed_id:=b.id;
  elsif new.breed_id is not null then
    select * into b from public.breed_catalog where id=new.breed_id and species_id=new.species_id;
    if not found or not b.is_active or b.review_status='pending' then
      raise exception 'Breed must belong to the selected animal type' using errcode='23514';
    end if;
  end if;

  new.species:=s.label;
  new.breed:=case when new.breed_id is null then null else b.label end;
  new.taxonomy_review_needed:=false;
  return new;
end;
$$;
revoke all on function clinic_private.resolve_pet_taxonomy() from public,anon,authenticated;

-- Attachment rows are write-once; latest version number is the current photo/card.
-- File replacement is a NEW object and metadata version, never an UPDATE/UPSERT.
create table public.pet_attachments (
 id uuid primary key default gen_random_uuid(),
 pet_id uuid not null references public.pets(id) on delete restrict,
 category text not null check (category in ('profile_photo','health_card','vaccination_card')),
 version_no integer not null check (version_no>0),
 object_path text not null unique check (length(object_path) between 80 and 280),
 original_filename text not null check (
   length(btrim(original_filename)) between 1 and 180
   and position('/' in original_filename)=0 and position(chr(92) in original_filename)=0
   and original_filename !~ '[[:cntrl:]]'
 ),
 mime_type text not null check (mime_type in ('image/png','image/jpeg','application/pdf')),
 size_bytes bigint not null check (size_bytes between 1 and 5242880),
 uploaded_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 constraint pet_attachment_version_unique unique(pet_id,category,version_no),
 constraint photo_mime_only check (category <> 'profile_photo' or mime_type in ('image/png','image/jpeg'))
);
create index pet_attachment_pet_category on public.pet_attachments(pet_id,category,version_no desc);
alter table public.pet_attachments enable row level security;
revoke all on public.pet_attachments from public,anon,authenticated;
grant select on public.pet_attachments to authenticated;
grant insert (pet_id,category,object_path,original_filename,mime_type,size_bytes)
  on public.pet_attachments to authenticated;

create policy pet_attachments_read_scoped on public.pet_attachments for select to authenticated
 using (
   (select clinic_private.is_permanent_user())
   and (
     ((select clinic_private.has_staff_role(array['receptionist','veterinarian','administrator'])))
     or (
       object_path like ('pets/'||pet_id::text||'/owners/'||(select auth.uid())::text||'/%')
       and exists(select 1 from public.pets p join public.owners o on o.id=p.owner_id
           where p.id=pet_id and o.user_id=(select auth.uid()))
     )
   )
 );
create policy pet_attachments_insert_scoped on public.pet_attachments for insert to authenticated
 with check (
   (select clinic_private.is_permanent_user()) and uploaded_by=(select auth.uid())
   and (
     (object_path like ('pets/'||pet_id::text||'/owners/'||(select auth.uid())::text||'/%')
      and exists(select 1 from public.pets p join public.owners o on o.id=p.owner_id
       where p.id=pet_id and o.user_id=(select auth.uid())))
     or
     (object_path like ('pets/'||pet_id::text||'/clinic/%')
      and (select clinic_private.has_staff_role(array['veterinarian','administrator'])))
   )
 );

create function clinic_private.validate_pet_attachment()
returns trigger language plpgsql security invoker set search_path='' as $$
declare obj storage.objects%rowtype;
declare suffix text;
declare expected_mime text;
declare owner_path text;
declare clinic_path text;
begin
  if new.uploaded_by is distinct from (select auth.uid())
      or not (select clinic_private.is_permanent_user()) then
    raise exception 'Attachment uploader mismatch' using errcode='42501';
  end if;
  owner_path:='pets/'||new.pet_id::text||'/owners/'||new.uploaded_by::text||'/';
  clinic_path:='pets/'||new.pet_id::text||'/clinic/';
  if new.object_path like (owner_path||'%') then
    if not exists(select 1 from public.pets p join public.owners o on o.id=p.owner_id
      where p.id=new.pet_id and o.user_id=new.uploaded_by) then
      raise exception 'Attachment owner mismatch' using errcode='42501';
    end if;
    suffix:=substr(new.object_path,length(owner_path)+1);
  elsif new.object_path like (clinic_path||'%') then
    if not (select clinic_private.has_staff_role(array['veterinarian','administrator'])) then
      raise exception 'Clinic uploads require verified veterinarian or administrator' using errcode='42501';
    end if;
    suffix:=substr(new.object_path,length(clinic_path)+1);
  else
    raise exception 'Attachment path must match the patient and uploader' using errcode='23514';
  end if;

  if suffix !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpe?g|pdf)$' then
    raise exception 'Attachment object filename must be random UUID and approved extension' using errcode='23514';
  end if;
  if lower(right(suffix,4))='.png' then expected_mime:='image/png';
  elsif lower(right(suffix,4))='.pdf' then expected_mime:='application/pdf';
  else expected_mime:='image/jpeg'; end if;
  if new.mime_type<>expected_mime then
    raise exception 'Attachment MIME and filename extension mismatch' using errcode='23514';
  end if;
  if new.category='profile_photo' and new.mime_type='application/pdf' then
    raise exception 'Profile pictures must be images' using errcode='23514';
  end if;
  select * into obj from storage.objects
    where bucket_id='clinical-attachments' and name=new.object_path;
  if not found then
    raise exception 'Upload private object before attaching metadata' using errcode='23514';
  end if;
  if obj.metadata->>'mimetype' is distinct from new.mime_type
     or not coalesce((obj.metadata->>'size') ~ '^[0-9]+$',false)
     or (obj.metadata->>'size')::bigint <> new.size_bytes then
    raise exception 'Attachment object metadata does not match stored file' using errcode='23514';
  end if;
  -- Serializes version allocation for each patient/category, no client-supplied version.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(new.pet_id::text),pg_catalog.hashtext(new.category));
  select coalesce(max(version_no),0)+1 into new.version_no
    from public.pet_attachments where pet_id=new.pet_id and category=new.category;
  return new;
end;
$$;
revoke all on function clinic_private.validate_pet_attachment() from public,anon,authenticated;

-- No public UPDATE/DELETE of attachments. Privacy depends also on existing Storage RLS.
-- Trusted operator reconciliation must handle post-upload metadata failures.
create trigger attachment_validate before insert on public.pet_attachments
 for each row execute function clinic_private.validate_pet_attachment();
