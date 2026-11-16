-- Dawney Phase 4 operator-only READ-ONLY preflight.
-- Must be run by owner-controlled trusted DB operator before any migration.
-- Store printed fingerprints and counts in encrypted private release evidence,
-- NEVER in a public issue/PR, chat log or CI artifact.
select version,name from supabase_migrations.schema_migrations order by version;
select
 (select count(*) from public.pets) as pet_rows,
 (select count(*) from public.appointments) as appointment_rows,
 (select count(*) from public.clinical_records) as clinical_record_rows,
 (select count(*) from public.staff_memberships) as staff_rows,
 (select count(*) from storage.objects where bucket_id='clinical-attachments') as attachment_objects;
-- Historical species/breed spelling/whitespace and pet ownership fingerprint.
select md5(coalesce(string_agg(
 jsonb_build_array(id,owner_id,name,species,breed,sex,color,birth_date,legacy_pet_id,created_at)::text,
 E'\n' order by id),''))
 as legacy_pet_fields_fingerprint from public.pets;
-- Historical appointments (exclude NEW service/nonce fields in both snapshots).
select md5(coalesce(string_agg(
 jsonb_build_array(id,owner_id,pet_id,resource_id,starts_at,ends_at,
   concern,details,status,created_by,legacy_appointment_id,created_at)::text,
 E'\n' order by id),''))
 as legacy_appointment_fields_fingerprint from public.appointments;
select md5(coalesce(string_agg(
 jsonb_build_array(id,pet_id,performed_at,procedure,temperature_c,weight_kg,
   comments,authored_by,legacy_record_id,created_at)::text,
 E'\n' order by id),''))
 as clinical_history_fingerprint from public.clinical_records;
select count(*) as chow_chow_rows from public.pets
 where lower(btrim(species))='dog' and lower(btrim(coalesce(breed,'')))='chow chow';
select id,public,file_size_limit,allowed_mime_types
 from storage.buckets where id='clinical-attachments';
select to_regclass('public.species_catalog') as current_species_catalog,
 to_regclass('public.breed_catalog') as current_breed_catalog,
 to_regclass('public.pet_attachments') as current_pet_attachments,
 to_regclass('public.clinic_services') as current_clinic_services;
-- No write transaction is opened. If an unexpected Phase 4 object already exists,
-- STOP and reconcile migration history before attempting a migration.
