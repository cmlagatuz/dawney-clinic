-- Phase 2 follow-up: address advisor performance findings without data mutation.
create index idx_events_actor on public.appointment_events(actor_id);
create index idx_appointments_creator on public.appointments(created_by);
create index idx_appointments_pet_owner on public.appointments(pet_id, owner_id);
create index idx_clinical_author on public.clinical_records(authored_by);
create index idx_staff_assigned_by on public.staff_memberships(assigned_by);

drop policy "appointments_cancel_own" on public.appointments;
drop policy "appointments_staff_change_status" on public.appointments;
create policy "appointments_update_status_scoped" on public.appointments
for update to authenticated
using (
 (select clinic_private.has_staff_role(array['receptionist','veterinarian','administrator']))
 or (status in ('requested','confirmed')
     and exists (select 1 from public.owners o where o.id=appointments.owner_id
       and o.user_id=(select auth.uid())
       and (select clinic_private.is_permanent_user())))
)
with check (
 (select clinic_private.has_staff_role(array['receptionist','veterinarian','administrator']))
 or (status='cancelled'
    and exists (select 1 from public.owners o where o.id=appointments.owner_id
      and o.user_id=(select auth.uid())
      and (select clinic_private.is_permanent_user())))
);
