-- Print a stable SHA-256-able JSON text that stays identical across Phase4
-- even as additive catalog/booking columns are installed.
-- Includes synthetic Auth users + identities, staff, patient text, historical
-- appointment schedule/status/audit, provider metadata, fixture provenance.
select jsonb_build_object(
 'users',(select jsonb_agg(to_jsonb(u) order by id) from auth.users u),
 'identities',(select jsonb_agg(to_jsonb(i) order by id) from auth.identities i),
 'owners',(select jsonb_agg(to_jsonb(o) order by id) from public.owners o),
 'patients',(select jsonb_agg(
   jsonb_build_object('id',p.id,'owner_id',p.owner_id,'name',p.name,
    'species',p.species,'breed',p.breed,'sex',p.sex,'color',p.color,
    'birth_date',p.birth_date,'legacy_pet_id',p.legacy_pet_id,
    'created_at',p.created_at,'updated_at',p.updated_at)
   order by p.id) from public.pets p),
 'appointments',(select jsonb_agg(
  jsonb_build_object('id',a.id,'owner_id',a.owner_id,'pet_id',a.pet_id,
   'resource_id',a.resource_id,'starts_at',a.starts_at,'ends_at',a.ends_at,
   'concern',a.concern,'details',a.details,'status',a.status,
   'created_by',a.created_by,'created_at',a.created_at,
   'legacy_appointment_id',a.legacy_appointment_id)
   order by a.id) from public.appointments a),
 'resources',(select jsonb_agg(to_jsonb(r)-'branch_id' order by id)
   from public.appointment_resources r),
 'events',(select jsonb_agg(to_jsonb(e) order by id)
   from public.appointment_events e),
 'staff',(select jsonb_agg(to_jsonb(s) order by user_id)
   from public.staff_memberships s),
 'staff_audit',(select jsonb_agg(to_jsonb(s) order by event_id)
   from clinic_private.staff_role_events s),
 'buckets',(select jsonb_agg(to_jsonb(b) order by id)
   from storage.buckets b),
 'storage',(select jsonb_agg(to_jsonb(o) order by id)
   from storage.objects o),
 'fixture',(select jsonb_agg(to_jsonb(f) order by version)
   from clinic_ci.recovery_fixture f)
)::text;
