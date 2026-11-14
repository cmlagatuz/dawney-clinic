-- Dawney Phase 4 owner-controlled READ-ONLY postflight AFTER all four
-- migrations have separately been approved and applied IN ORDER.
-- Compare fingerprints manually with the encrypted preflight output.
select version,name from supabase_migrations.schema_migrations order by version;
select
 (select count(*) from public.pets) as pet_rows,
 (select count(*) from public.appointments) as appointment_rows,
 (select count(*) from public.clinical_records) as clinical_record_rows,
 (select count(*) from public.staff_memberships) as staff_rows,
 (select count(*) from storage.objects where bucket_id='clinical-attachments') as attachment_objects,
 (select count(*) from public.species_catalog) as species_catalog_rows,
 (select count(*) from public.breed_catalog) as breed_catalog_rows,
 (select count(*) from public.pet_attachments) as attachment_metadata_rows,
 (select count(*) from public.clinic_services) as published_plus_draft_services;
select md5(coalesce(string_agg(
 jsonb_build_array(id,owner_id,name,species,breed,sex,color,birth_date,legacy_pet_id,created_at)::text,
 E'\n' order by id),''))
 as legacy_pet_fields_fingerprint from public.pets;
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
select count(*) as original_chow_chow_rows,
 count(*) filter (where species_id='dog' and breed_id='dog-chow-chow'
                         and taxonomy_review_needed=false) as mapped_rows
 from public.pets where lower(btrim(species))='dog'
 and lower(btrim(coalesce(breed,'')))='chow chow';
select t.tgname,t.tgenabled,p.proname,p.prosecdef,p.proconfig
 from pg_trigger t join pg_proc p on p.oid=t.tgfoid
 where t.tgrelid='public.pets'::regclass and not t.tgisinternal;
select count(*) as enabled_taxonomy_trigger_count from pg_trigger
 where tgrelid='public.pets'::regclass
   and tgfoid='clinic_private.resolve_pet_taxonomy()'::regprocedure
   and tgenabled in ('O','A') and not tgisinternal;
select relname,relrowsecurity from pg_class
 where oid in ('public.species_catalog'::regclass,
 'public.breed_catalog'::regclass,'public.pet_attachments'::regclass,
 'public.clinic_services'::regclass,'public.clinic_service_species'::regclass,
 'public.clinic_service_resources'::regclass,'public.clinic_booking_policy'::regclass);
-- Public catalog and booking policy use COLUMN grants (not table-wide SELECT).
-- has_table_privilege(...,'SELECT') is false even when approved columns are readable.
select has_column_privilege('anon','public.clinic_services','display_name','SELECT')
  as anon_may_read_public_service_name,
 not has_column_privilege('anon','public.clinic_services','owner_approved_by','SELECT')
  as anon_cannot_read_service_approver,
 not has_column_privilege('anon','public.clinic_services','owner_approved_at','SELECT')
  as anon_cannot_read_service_approval_timestamp,
 not has_column_privilege('authenticated','public.clinic_services','owner_approved_by','SELECT')
  as owner_cannot_read_service_approver,
 not has_column_privilege('authenticated','public.clinic_services','owner_approved_at','SELECT')
  as owner_cannot_read_service_approval_timestamp,
 has_column_privilege('anon','public.clinic_booking_policy','timezone','SELECT')
  as anon_may_read_approved_schedule_timezone,
 not has_column_privilege('anon','public.clinic_booking_policy','approved_by','SELECT')
  as anon_cannot_read_schedule_approver,
 not has_column_privilege('anon','public.clinic_booking_policy','approved_at','SELECT')
  as anon_cannot_read_schedule_approval_timestamp,
 not has_column_privilege('authenticated','public.clinic_booking_policy','approved_by','SELECT')
  as owner_cannot_read_schedule_approver,
 not has_column_privilege('authenticated','public.clinic_booking_policy','approved_at','SELECT')
  as owner_cannot_read_schedule_approval_timestamp,
 not has_table_privilege('anon','public.appointments','SELECT')
  as anon_cannot_read_appointments,
 not has_table_privilege('anon','public.pet_attachments','SELECT')
  as anon_cannot_read_clinical_metadata,
 not has_table_privilege('authenticated','public.clinic_services','INSERT')
  as owner_cannot_publish_services;
select count(*) as unapproved_catalog_service_rows,
 count(*) filter(where is_active or published_at is not null or owner_approved_at is not null)
    as unexpectedly_enabled_services from public.clinic_services;
select policy_id,timezone,is_approved,revision,
 jsonb_array_length(weekly_hours->'mon') as monday_intervals,
 jsonb_array_length(weekly_hours->'sun') as sunday_intervals
 from public.clinic_booking_policy;
select id,public,file_size_limit,allowed_mime_types from storage.buckets
 where id='clinical-attachments';
-- Any count/fingerprint mismatch or enabled catalog/hours before owner approval:
-- STOP and do not activate the new React booking UI.
