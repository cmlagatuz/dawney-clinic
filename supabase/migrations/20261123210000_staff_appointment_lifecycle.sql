-- #21 ASTRA staff appointment lifecycle. Source-only, additive after frozen #1-#20.
-- No branch enablement, appointments, people, resources, or approved schedules seeded.
begin;
set local search_path = pg_catalog;

alter table public.appointments
  add column lifecycle_revision integer not null default 1
    check (lifecycle_revision > 0);

-- Preserve the original owner cancellation API, but close the pre-existing
-- loophole that let an authenticated staff user PATCH status without a nonce.
-- The RPC below executes as postgres (SECURITY DEFINER); all browser-direct
-- UPDATE(status) operations are limited to verified live-session OWNERS who
-- cancel their own requested or confirmed appointment.
create or replace function clinic_private.enforce_appointment_lifecycle()
returns trigger language plpgsql security invoker set search_path='' as $guard$
declare v_actor uuid;
begin
  if tg_op='INSERT' then
    if current_user='authenticated' and new.starts_at<=pg_catalog.statement_timestamp() then
      raise exception 'Appointment start must be in the future' using errcode='23514';
    end if;
    return new;
  end if;
  if new.status is not distinct from old.status then
    return new;
  end if;
  if current_user='authenticated' then
    -- Invoker trigger must use the explicitly callable read-only live-session guard;
    -- the private VOLATILE writer helper is reserved for SECURITY DEFINER RPCs.
    if not clinic_private.operational_read_session_live() then
      raise exception 'Live verified Auth session required' using errcode='42501';
    end if;
    v_actor:=(select auth.uid());
    if old.status not in ('requested','confirmed')
      or new.status<>'cancelled'
      or not exists(select 1 from public.owners o
          where o.id=old.owner_id and o.user_id=v_actor)
    then
      raise exception 'Direct appointment status change not authorized' using errcode='42501';
    end if;
    -- Retain the existing owner UI cancellation DML, but count its CAS revision.
    new.lifecycle_revision:=old.lifecycle_revision+1;
  elsif current_user not in ('postgres','service_role') then
    raise exception 'Only reviewed appointment RPC may mutate staff statuses'
      using errcode='42501';
  end if;
  if not (
    (old.status='requested' and new.status in ('confirmed','cancelled','no_show'))
    or (old.status='confirmed' and new.status in ('checked_in','cancelled','no_show'))
    or (old.status='checked_in' and new.status='completed')
  ) then
    raise exception 'Invalid appointment status transition: % to %',old.status,new.status
      using errcode='23514';
  end if;
  return new;
end;
$guard$;

-- Private, immutable operational event and request receipts (no client DML).
-- Actor UUID is an immutable historical identifier even after Auth user deletion.
create table clinic_private.appointment_transition_events (
  id bigint generated always as identity primary key,
  appointment_id uuid not null references public.appointments(id) on delete restrict,
  branch_id uuid not null references public.clinic_branches(id) on delete restrict,
  actor_id uuid not null,
  request_id uuid not null,
  action text not null check(action in ('confirm','decline','check_in','complete','no_show','cancel')),
  old_status text not null,
  new_status text not null,
  old_revision integer not null,
  new_revision integer not null check(new_revision=old_revision+1),
  happened_at timestamptz not null default clock_timestamp(),
  unique(actor_id,request_id),
  unique(appointment_id,new_revision)
);
create table clinic_private.appointment_transition_receipts (
  actor_id uuid not null,
  request_id uuid not null,
  request_payload jsonb not null,
  response jsonb not null,
  appointment_id uuid not null references public.appointments(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  primary key(actor_id,request_id)
);
create function clinic_private.reject_appointment_history_mutation()
returns trigger language plpgsql security invoker set search_path='' as $immut$
begin
 raise exception 'Appointment lifecycle audit/nonce history is append-only' using errcode='42501';
end;
$immut$;
create trigger appointment_transition_events_immutable
  before update or delete or truncate on clinic_private.appointment_transition_events
  for each statement execute function clinic_private.reject_appointment_history_mutation();
create trigger appointment_transition_receipts_immutable
  before update or delete or truncate on clinic_private.appointment_transition_receipts
  for each statement execute function clinic_private.reject_appointment_history_mutation();
alter table clinic_private.appointment_transition_events enable row level security;
alter table clinic_private.appointment_transition_receipts enable row level security;
revoke all on clinic_private.appointment_transition_events,
  clinic_private.appointment_transition_receipts from public,anon,authenticated;
revoke all on function clinic_private.reject_appointment_history_mutation()
 from public,anon,authenticated;

-- One canonical staff action RPC. Never trust browser role, owner ID, resource,
-- selected branch, or a JWT active_branch claim as authorization evidence.
create function public.transition_staff_appointment(
  p_appointment uuid,p_branch uuid,p_action text,
  p_expected_revision integer,p_request_id uuid
) returns jsonb language plpgsql volatile security definer
set search_path='' as $transition$
declare
  v_actor uuid;
  v_row public.appointments%rowtype;
  v_resource public.appointment_resources%rowtype;
  v_payload jsonb; v_result jsonb;
  v_old_status text; v_new_status text;
  v_receipt clinic_private.appointment_transition_receipts%rowtype;
  v_policy record; v_service record; v_species text;
  v_local_start timestamp; v_local_end timestamp;
  v_day text; v_slot_minutes integer; v_hours jsonb; v_window jsonb;
  v_ok boolean := false;
begin
  v_actor:=clinic_private.require_operational_actor();
  if p_appointment is null or p_branch is null or p_request_id is null
    or p_action is null
    or p_action not in ('confirm','decline','check_in','complete','no_show','cancel')
    or p_expected_revision is null or p_expected_revision<1
  then raise exception 'Invalid appointment transition input' using errcode='22023'; end if;

  if not clinic_private.has_branch_role(p_branch,
    case when p_action='complete'
      then array['veterinarian','administrator']::text[]
      else array['receptionist','veterinarian','administrator']::text[] end)
  then raise exception 'Current branch staff authorization required' using errcode='42501'; end if;

  v_payload:=pg_catalog.jsonb_build_object('appointmentId',p_appointment,
     'branchId',p_branch,'action',p_action,'expectedRevision',p_expected_revision);
  -- Serialize retries BEFORE row locking: same actor/nonce cannot mutate twice.
  perform pg_catalog.pg_advisory_xact_lock(
     pg_catalog.hashtextextended(v_actor::text||':'||p_request_id::text,0));
  select * into v_receipt from clinic_private.appointment_transition_receipts
    where actor_id=v_actor and request_id=p_request_id;
  if found then
    if v_receipt.request_payload is distinct from v_payload then
      raise exception 'Appointment request nonce reused for different payload'
        using errcode='23505';
    end if;
    return v_receipt.response;
  end if;

  select * into v_row from public.appointments
    where id=p_appointment and branch_id=p_branch for update;
  if not found then
    raise exception 'Appointment unavailable in authorized branch' using errcode='42501';
  end if;
  if v_row.lifecycle_revision<>p_expected_revision then
    raise exception 'Stale appointment lifecycle revision' using errcode='40001';
  end if;
  if not exists (select 1 from public.pets p join public.owners o on o.id=p.owner_id
    where p.id=v_row.pet_id and p.owner_id=v_row.owner_id and o.id=v_row.owner_id) then
    raise exception 'Appointment patient ownership invalid' using errcode='42501';
  end if;
  select * into v_resource from public.appointment_resources r
    where r.id=v_row.resource_id and r.branch_id=p_branch and r.is_active;
  if not found then
    raise exception 'Appointment resource is inactive or mismatched' using errcode='23514';
  end if;

  v_old_status:=v_row.status;
  v_new_status:=case
    when p_action='confirm' and v_old_status='requested' then 'confirmed'
    when p_action='decline' and v_old_status='requested' then 'cancelled'
    when p_action='check_in' and v_old_status='confirmed' then 'checked_in'
    when p_action='complete' and v_old_status='checked_in' then 'completed'
    when p_action='no_show' and v_old_status='confirmed' then 'no_show'
    when p_action='cancel' and v_old_status in ('requested','confirmed') then 'cancelled'
    else null end;
  if v_new_status is null then
    raise exception 'Incompatible appointment state transition' using errcode='23514';
  end if;

  if p_action='confirm' then
    -- Existing owner booking validated on INSERT, but approvals and operating
    -- hours can change between request and staff confirmation.
    if v_row.service_id is null or v_row.request_nonce is null
       or v_row.starts_at<=pg_catalog.clock_timestamp()
    then raise exception 'Approved future service booking required' using errcode='23514'; end if;
    select s.duration_minutes into v_service from public.clinic_services s
      where s.id=v_row.service_id and s.branch_id=p_branch and s.is_active
        and s.owner_approved_at is not null and s.owner_approved_by is not null
        and s.published_at is not null;
    if not found or v_row.ends_at<>v_row.starts_at+
       pg_catalog.make_interval(mins=>v_service.duration_minutes)
    then raise exception 'Service approval or duration changed' using errcode='23514'; end if;
    select p.species_id into v_species from public.pets p where p.id=v_row.pet_id;
    if v_species is null or not exists(
       select 1 from public.clinic_service_species ss
       join public.species_catalog sp on sp.id=ss.species_id
       where ss.service_id=v_row.service_id and ss.species_id=v_species
         and sp.is_active and sp.clinic_supported and sp.review_status<>'pending'
    ) or not exists(
       select 1 from public.clinic_service_resources sr
       where sr.service_id=v_row.service_id and sr.resource_id=v_row.resource_id
         and sr.capacity=1
    ) then raise exception 'Service/species/resource not currently eligible' using errcode='23514'; end if;
    select bp.timezone,bp.weekly_hours,bp.holidays,bp.slot_step_minutes
      into v_policy from public.branch_booking_policies bp
      join public.clinic_branches b on b.id=bp.branch_id
      where bp.branch_id=p_branch and bp.is_approved and b.booking_enabled;
    if not found or v_policy.slot_step_minutes is null or
      v_policy.slot_step_minutes not between 5 and 60
    then raise exception 'Branch booking approval is inactive' using errcode='23514'; end if;
    if not exists(select 1 from pg_catalog.pg_timezone_names where name=v_policy.timezone)
    then raise exception 'Branch timezone invalid' using errcode='23514'; end if;
    v_local_start:=v_row.starts_at at time zone v_policy.timezone;
    v_local_end:=v_row.ends_at at time zone v_policy.timezone;
    if v_local_start::date<>v_local_end::date
       or v_local_start::date=any(v_policy.holidays)
    then raise exception 'Appointment outside approved day' using errcode='23514'; end if;
    v_slot_minutes:=extract(hour from v_local_start)::integer*60+
                    extract(minute from v_local_start)::integer;
    if v_slot_minutes % v_policy.slot_step_minutes<>0 or
       extract(second from v_local_start)<>0
    then raise exception 'Appointment slot alignment changed' using errcode='23514'; end if;
    v_day:=(array['sun','mon','tue','wed','thu','fri','sat'])
      [extract(dow from v_local_start)::integer+1];
    v_hours:=v_policy.weekly_hours->v_day;
    if pg_catalog.jsonb_typeof(v_hours)<>'array'
    then raise exception 'Approved operating hours absent' using errcode='23514'; end if;
    for v_window in select value from pg_catalog.jsonb_array_elements(v_hours) loop
      if coalesce(v_window->>'open','') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       and coalesce(v_window->>'close','') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       and (v_window->>'open')::time<(v_window->>'close')::time
       and v_local_start::time>=(v_window->>'open')::time
       and v_local_end::time<=(v_window->>'close')::time
      then v_ok:=true;exit;end if;
    end loop;
    if not v_ok then raise exception 'Appointment outside approved hours' using errcode='23514';end if;
    -- GiST exclusion checks active resource overlaps on every new booking.
    -- Never change start/end/resource on status transition.
    if exists (select 1 from public.appointments a
       where a.id<>v_row.id and a.resource_id=v_row.resource_id
        and a.status in ('requested','confirmed','checked_in')
        and pg_catalog.tstzrange(a.starts_at,a.ends_at,'[)') &&
            pg_catalog.tstzrange(v_row.starts_at,v_row.ends_at,'[)')
    ) then raise exception 'Conflicting appointment already occupies slot' using errcode='23P01';end if;
  elsif p_action='check_in' then
    if pg_catalog.clock_timestamp()<v_row.starts_at-interval '1 hour'
       or pg_catalog.clock_timestamp()>v_row.ends_at+interval '1 day'
    then raise exception 'Check-in is outside visit window' using errcode='23514';end if;
  elsif p_action='complete' then
    if not exists(select 1 from public.branch_encounters e
      where e.appointment_id=v_row.id and e.branch_id=p_branch
        and e.pet_id=v_row.pet_id)
    then raise exception 'Visit cannot complete without persisted encounter' using errcode='23514';end if;
  elsif p_action='no_show' then
    if v_row.starts_at>pg_catalog.clock_timestamp()
    then raise exception 'Cannot mark future appointment no-show' using errcode='23514';end if;
  end if;

  update public.appointments set status=v_new_status,
    lifecycle_revision=lifecycle_revision+1
    where id=v_row.id and branch_id=p_branch and lifecycle_revision=p_expected_revision
    returning * into v_row;
  if not found then raise exception 'Appointment revision changed concurrently' using errcode='40001';end if;
  v_result:=pg_catalog.jsonb_build_object('kind','staff_appointment_transition',
    'appointmentId',v_row.id,'branchId',p_branch,'status',v_row.status,
    'revision',v_row.lifecycle_revision,'action',p_action);
  insert into clinic_private.appointment_transition_events
   (appointment_id,branch_id,actor_id,request_id,action,
    old_status,new_status,old_revision,new_revision)
  values(v_row.id,p_branch,v_actor,p_request_id,p_action,
    v_old_status,v_new_status,p_expected_revision,v_row.lifecycle_revision);
  insert into clinic_private.appointment_transition_receipts
   (actor_id,request_id,request_payload,response,appointment_id)
  values(v_actor,p_request_id,v_payload,v_result,v_row.id);
  return v_result;
end;
$transition$;
revoke all on function public.transition_staff_appointment(uuid,uuid,text,integer,uuid)
 from public,anon,authenticated;
grant execute on function public.transition_staff_appointment(uuid,uuid,text,integer,uuid)
 to authenticated;
commit;
