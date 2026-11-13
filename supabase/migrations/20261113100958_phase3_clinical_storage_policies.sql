-- Clinic-only file authorization. Create the private bucket using the Storage API/Dashboard;
-- never insert into storage.buckets or storage.objects using SQL.
-- Object paths:
-- pets/<pet uuid>/owners/<owner auth uuid>/<random uuid>.pdf|png|jpg|jpeg
-- pets/<pet uuid>/clinic/<random uuid>.pdf|png|jpg|jpeg
-- Clinical uploads are immutable to ordinary users: no UPDATE/DELETE policies.
create policy "clinical_attachments_read_scoped"
on storage.objects for select to authenticated
using (
  bucket_id = 'clinical-attachments'
  and (select clinic_private.is_permanent_user())
  and array_length(storage.foldername(name),1) in (3,4)
  and (storage.foldername(name))[1] = 'pets'
  and storage.filename(name) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|png|jpe?g)$'
  and (
    (
      array_length(storage.foldername(name),1) = 4
      and (storage.foldername(name))[3] = 'owners'
      and (storage.foldername(name))[4] = (select auth.uid())::text
      and exists (
        select 1 from public.pets p
        join public.owners o on o.id = p.owner_id
        where p.id::text = (storage.foldername(name))[2]
          and o.user_id = (select auth.uid())
      )
    )
    or (
      (select clinic_private.has_staff_role(array['receptionist','veterinarian','administrator']))
      and exists (select 1 from public.pets p
                  where p.id::text = (storage.foldername(name))[2])
    )
  )
);

create policy "clinical_attachments_insert_scoped"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'clinical-attachments'
  and (select clinic_private.is_permanent_user())
  and array_length(storage.foldername(name),1) in (3,4)
  and (storage.foldername(name))[1] = 'pets'
  and storage.filename(name) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|png|jpe?g)$'
  and (
    (
      array_length(storage.foldername(name),1) = 4
      and (storage.foldername(name))[3] = 'owners'
      and (storage.foldername(name))[4] = (select auth.uid())::text
      and exists (
        select 1 from public.pets p
        join public.owners o on o.id=p.owner_id
        where p.id::text=(storage.foldername(name))[2]
          and o.user_id=(select auth.uid())
      )
    )
    or (
      array_length(storage.foldername(name),1) = 3
      and (storage.foldername(name))[3] = 'clinic'
      and (select clinic_private.has_staff_role(array['veterinarian','administrator']))
      and exists (select 1 from public.pets p
                  where p.id::text=(storage.foldername(name))[2])
    )
  )
);

