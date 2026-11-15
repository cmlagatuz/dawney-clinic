-- Dawney Phase3 Storage RLS security correction (new additive migration).
-- Must follow 20261113100958_phase3_clinical_storage_policies.sql.
-- A nested EXISTS over public.pets binds unqualified "name" to pets.name
-- instead of the outer storage.objects.name; use the explicit outer column.
-- The two original policy predicates are otherwise preserved verbatim.
-- No additional table grants, UPDATE/DELETE policies or bucket changes.
begin;
do $expected_clinic_policies$
begin
 if (select count(*) from pg_policies
      where schemaname='storage' and tablename='objects'
      and policyname in ('clinical_attachments_read_scoped',
                         'clinical_attachments_insert_scoped')
      and roles = array['authenticated'::name]
      and ((policyname='clinical_attachments_read_scoped' and cmd='SELECT')
        or (policyname='clinical_attachments_insert_scoped' and cmd='INSERT'))
    ) <> 2 then
  raise exception 'Expected both existing authenticated-only clinic Storage policies'
   using errcode='42501';
 end if;
 if not (select relrowsecurity from pg_class
      where oid='storage.objects'::regclass) then
  raise exception 'storage.objects RLS must already be enabled' using errcode='42501';
 end if;
end $expected_clinic_policies$;
drop policy "clinical_attachments_read_scoped" on storage.objects;
drop policy "clinical_attachments_insert_scoped" on storage.objects;
create policy "clinical_attachments_read_scoped"
on storage.objects for select to authenticated
using (
  bucket_id = 'clinical-attachments'
  and (select clinic_private.is_permanent_user())
  and array_length(storage.foldername(storage.objects.name),1) in (3,4)
  and (storage.foldername(storage.objects.name))[1] = 'pets'
  and storage.filename(storage.objects.name) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|png|jpe?g)$'
  and (
    (
      array_length(storage.foldername(storage.objects.name),1) = 4
      and (storage.foldername(storage.objects.name))[3] = 'owners'
      and (storage.foldername(storage.objects.name))[4] = (select auth.uid())::text
      and exists (
        select 1 from public.pets p
        join public.owners o on o.id = p.owner_id
        where p.id::text = (storage.foldername(storage.objects.name))[2]
          and o.user_id = (select auth.uid())
      )
    )
    or (
      (select clinic_private.has_staff_role(array['receptionist','veterinarian','administrator']))
      and exists (select 1 from public.pets p
                  where p.id::text = (storage.foldername(storage.objects.name))[2])
    )
  )
);

create policy "clinical_attachments_insert_scoped"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'clinical-attachments'
  and (select clinic_private.is_permanent_user())
  and array_length(storage.foldername(storage.objects.name),1) in (3,4)
  and (storage.foldername(storage.objects.name))[1] = 'pets'
  and storage.filename(storage.objects.name) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|png|jpe?g)$'
  and (
    (
      array_length(storage.foldername(storage.objects.name),1) = 4
      and (storage.foldername(storage.objects.name))[3] = 'owners'
      and (storage.foldername(storage.objects.name))[4] = (select auth.uid())::text
      and exists (
        select 1 from public.pets p
        join public.owners o on o.id=p.owner_id
        where p.id::text=(storage.foldername(storage.objects.name))[2]
          and o.user_id=(select auth.uid())
      )
    )
    or (
      array_length(storage.foldername(storage.objects.name),1) = 3
      and (storage.foldername(storage.objects.name))[3] = 'clinic'
      and (select clinic_private.has_staff_role(array['veterinarian','administrator']))
      and exists (select 1 from public.pets p
                  where p.id::text=(storage.foldername(storage.objects.name))[2])
    )
  )
);


commit;
