-- Isolated PostgreSQL 17 SQL regression. Never execute on live Supabase.
do $$begin
 if (select count(*) from public.species_catalog)<>50 then raise exception 'Animal type seed count mismatch'; end if;
 if (select count(*) from public.breed_catalog)<220 then raise exception 'Breed seed coverage too small'; end if;
 if exists(select 1 from public.species_catalog where clinic_supported) then
  raise exception 'No animal type may be auto-approved for treatment'; end if;
 if not exists(select 1 from public.species_catalog where id='cattle')
   or not exists(select 1 from public.breed_catalog where id='cattle-holstein' and species_id='cattle')
   then raise exception 'Cattle breed coverage missing'; end if;
 if not exists(select 1 from public.pets where
   id='33333333-3333-4333-8333-333333333333' and species='Canine'
   and breed='Unlisted historic cross' and taxonomy_review_needed)
   then raise exception 'Legacy canine text lost or unreviewed mismatch hidden'; end if;
 if not exists(select 1 from public.pets where
   id='44444444-4444-4444-8444-444444444444'
   and species='Uncatalogued Legacy Animal' and breed='Historic breed'
   and species_id is null and taxonomy_review_needed)
   then raise exception 'Unknown legacy species not preserved'; end if;
 if not exists(select 1 from public.pets where
   id='55555555-5555-4555-8555-555555555555'
   and species='Dog' and breed='Golden Retriever'
   and species_id='dog' and breed_id='dog-golden-retriever'
   and not taxonomy_review_needed)
   then raise exception 'Known legacy breed not mapped correctly'; end if;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
do $$
declare tax text; kind text;
begin
 insert into public.pets(owner_id,name,species,breed)
 values('11111111-1111-4111-8111-111111111111','New Dog','Dog','Beagle')
 returning species_id,breed_id into tax,kind;
 if tax<>'dog' or kind<>'dog-beagle' then
  raise exception 'Legacy text insert not mapped to species+breed IDs'; end if;
 -- Incorrect dog+cat breed rejected at trigger/FK.
 begin
  insert into public.pets(owner_id,name,species,breed,species_id,breed_id)
    values('11111111-1111-4111-8111-111111111111',
       'Forgery','Dog','Siamese','dog','cat-siamese');
  raise exception 'Breed cross-species forgery unexpectedly accepted';
 exception when check_violation or foreign_key_violation then null;
 end;
 -- New off-catalog type not silently accepted.
 begin
  insert into public.pets(owner_id,name,species,breed)
  values('11111111-1111-4111-8111-111111111111','Forgery','Unapproved wild dragon','');
  raise exception 'Unlisted new species unexpectedly accepted';
 exception when check_violation then null;
 end;
 -- Caller cannot mutate B's protected patient even if they know UUID.
 begin
  update public.pets set species='Cat',breed='Siamese'
   where id='44444444-4444-4444-8444-444444444444';
  if found then raise exception 'Foreign owner patient updated'; end if;
 end;
end $$;

-- Seed fake private Storage objects ONLY in disposable isolated Postgres service.
reset role;
insert into storage.objects(bucket_id,name,metadata) values
 ('clinical-attachments',
  'pets/55555555-5555-4555-8555-555555555555/owners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/66666666-6666-4666-8666-666666666666.png',
  '{"mimetype":"image/png","size":8}'::jsonb),
 ('clinical-attachments',
  'pets/55555555-5555-4555-8555-555555555555/owners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/77777777-7777-4777-8777-777777777777.png',
  '{"mimetype":"image/png","size":8}'::jsonb),
 ('clinical-attachments',
  'pets/55555555-5555-4555-8555-555555555555/owners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/88888888-8888-4888-8888-888888888888.pdf',
  '{"mimetype":"application/pdf","size":5}'::jsonb);
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
insert into public.pet_attachments(pet_id,category,object_path,original_filename,mime_type,size_bytes)
 values ('55555555-5555-4555-8555-555555555555','profile_photo',
 'pets/55555555-5555-4555-8555-555555555555/owners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/66666666-6666-4666-8666-666666666666.png',
 'photo.png','image/png',8);
insert into public.pet_attachments(pet_id,category,object_path,original_filename,mime_type,size_bytes)
 values ('55555555-5555-4555-8555-555555555555','profile_photo',
 'pets/55555555-5555-4555-8555-555555555555/owners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/77777777-7777-4777-8777-777777777777.png',
 'photo-v2.png','image/png',8);
do $$begin
 if (select count(*) from public.pet_attachments where category='profile_photo')<>2
    or (select max(version_no) from public.pet_attachments where category='profile_photo')<>2
    then raise exception 'Immutable file versions are not increasing'; end if;
 -- Enforce uploaded object existence.
 begin
  insert into public.pet_attachments(pet_id,category,object_path,original_filename,mime_type,size_bytes)
  values ('55555555-5555-4555-8555-555555555555','health_card',
   'pets/55555555-5555-4555-8555-555555555555/owners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/99999999-9999-4999-8999-999999999999.pdf',
   'missing.pdf','application/pdf',5);
  raise exception 'Missing object accepted';
 exception when check_violation then null;
 end;
 -- No PDFs as patient profile photos, even if object exists.
 begin
  insert into public.pet_attachments(pet_id,category,object_path,original_filename,mime_type,size_bytes)
  values ('55555555-5555-4555-8555-555555555555','profile_photo',
   'pets/55555555-5555-4555-8555-555555555555/owners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/88888888-8888-4888-8888-888888888888.pdf',
   'fake-profile.pdf','application/pdf',5);
  raise exception 'PDF profile photo accepted';
 exception when check_violation then null;
 end;
 -- MIME-size mismatch, wrong MIME, oversized attachments rejected.
 begin
  insert into public.pet_attachments(pet_id,category,object_path,original_filename,mime_type,size_bytes)
  values ('55555555-5555-4555-8555-555555555555','health_card',
   'pets/55555555-5555-4555-8555-555555555555/owners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/88888888-8888-4888-8888-888888888888.pdf',
   'card.pdf','application/pdf',4);
  raise exception 'File size mismatch accepted';
 exception when check_violation then null;
 end;
 begin
  insert into public.pet_attachments(pet_id,category,object_path,original_filename,mime_type,size_bytes)
  values ('55555555-5555-4555-8555-555555555555','health_card',
   'pets/55555555-5555-4555-8555-555555555555/owners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/88888888-8888-4888-8888-888888888888.pdf',
   'card.svg','image/svg+xml',5);
  raise exception 'SVG metadata accepted';
 exception when check_violation then null;
 end;
 begin
  insert into public.pet_attachments(pet_id,category,object_path,original_filename,mime_type,size_bytes)
  values ('55555555-5555-4555-8555-555555555555','health_card',
   'pets/55555555-5555-4555-8555-555555555555/owners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/88888888-8888-4888-8888-888888888888.pdf',
   'card.pdf','application/pdf',5242881);
  raise exception 'Oversized metadata accepted';
 exception when check_violation then null;
 end;
 begin
  update public.pet_attachments set original_filename='altered.png';
  raise exception 'Attachment metadata update unexpectedly allowed';
 exception when insufficient_privilege then null;
 end;
 begin
  delete from public.pet_attachments;
  raise exception 'Attachment destructive deletion unexpectedly allowed';
 exception when insufficient_privilege then null;
 end;
end $$;
-- Owner B sees no owner A private metadata and cannot forge storage paths.
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
do $$begin
 if (select count(*) from public.pet_attachments)<>0 then
  raise exception 'Foreign owner can view patient attachments';
 end if;
 begin
  insert into public.pet_attachments(pet_id,category,object_path,original_filename,mime_type,size_bytes)
  values ('55555555-5555-4555-8555-555555555555','health_card',
   'pets/55555555-5555-4555-8555-555555555555/owners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/88888888-8888-4888-8888-888888888888.pdf',
   'forgery.pdf','application/pdf',5);
  raise exception 'Foreign owner forged patient metadata';
 exception when insufficient_privilege or check_violation then null;
 end;
end $$;
set role anon;
do $$begin
 begin
  perform count(*) from public.pet_attachments;
  raise exception 'Anonymous metadata view accepted';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
do $$begin
 if (select count(*) from public.pet_attachments)<>2 then
  raise exception 'Denied writes created stray metadata';
 end if;
end $$;
select 'PASS isolated taxonomy/attachment RLS/preservation regression' as result;
