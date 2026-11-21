-- OPERATOR-ONLY preview: synthetic Phase 3 integration fixtures.
-- Replace the SINGLE DAWNEY_SMOKE_REPLACE_WITH_RUN_ID value below with the
-- EXACT fixture marker printed by the completed GitHub Actions smoke run.
-- PREVIEW by default (ROLLBACK at end). Never run against unreviewed clinical data.
-- If storage mode ran, first remove only the corresponding synthetic PDFs through
-- the authenticated Supabase Storage Dashboard/API (NEVER DELETE FROM storage.objects).

begin;
set local dawney.cleanup_marker = 'DAWNEY_SMOKE_REPLACE_WITH_RUN_ID';

do $$
declare
  marker text := current_setting('dawney.cleanup_marker',true);
  pet_count integer;
  appointment_count integer;
begin
  if marker !~ '^DAWNEY_SMOKE_[0-9]{5,20}$' then
    raise exception 'Replace marker with the numeric GitHub Actions run ID before preview';
  end if;
  select count(*) into pet_count
    from public.pets p
    where p.name in (marker||'_A', marker||'_B')
      and p.species='Synthetic test';
  select count(*) into appointment_count
    from public.appointments a
    where a.details=marker and a.concern='Synthetic integration smoke';

  if pet_count>2 or appointment_count>2 then
    raise exception 'Unexpected fixture counts; review before any deletion';
  end if;
  if exists (
    select 1 from public.clinical_records cr join public.pets p on p.id=cr.pet_id
    where p.name in (marker||'_A',marker||'_B') and p.species='Synthetic test'
  ) then
    raise exception 'Clinical notes attached: stop, review, do not delete';
  end if;
  if exists (
    select 1 from public.appointments a join public.pets p on p.id=a.pet_id
    where p.name in (marker||'_A',marker||'_B') and p.species='Synthetic test'
      and (a.details is distinct from marker or a.concern<>'Synthetic integration smoke')
  ) then
    raise exception 'Non-fixture appointment attached to synthetic pet';
  end if;
  raise notice 'Preview: % synthetic pets and % synthetic bookings match the run marker',
    pet_count, appointment_count;
end $$;

select id, name, owner_id
from public.pets
where name in (current_setting('dawney.cleanup_marker')||'_A',
               current_setting('dawney.cleanup_marker')||'_B')
  and species='Synthetic test';
select id, pet_id, status
from public.appointments
where details=current_setting('dawney.cleanup_marker')
  and concern='Synthetic integration smoke';

-- ALL rows are explicitly tied to the unique marker. Appointments' audit events
-- must be removed first because of their restrictive FK.
delete from public.appointment_events e
using public.appointments a
where e.appointment_id=a.id
  and a.details=current_setting('dawney.cleanup_marker')
  and a.concern='Synthetic integration smoke';
delete from public.appointments
where details=current_setting('dawney.cleanup_marker')
  and concern='Synthetic integration smoke';
delete from public.pets
where name in (current_setting('dawney.cleanup_marker')||'_A',
               current_setting('dawney.cleanup_marker')||'_B')
  and species='Synthetic test';

-- Default: PREVIEW ONLY. Change to COMMIT only after the operator reviewed
-- the exact rows, controlled private Storage cleanup, and authorized rollback.
rollback;
