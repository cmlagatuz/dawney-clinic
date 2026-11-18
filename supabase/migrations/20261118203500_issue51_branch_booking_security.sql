-- DAWNEY ISSUE #51: POST-12TH SOURCE-ONLY booking authorization correction.
-- Requires all 11 original migrations and unchanged proposed 12th. The
-- original 7-argument RPC signature, old RLS, grants and staff triggers remain.
-- No booking services, live hours or clinic approvals are seeded.
-- appointment_branch_guard fires BEFORE appointment_service_booking_guard
-- alphabetically in PG17; tests assert this ordering.
begin;
create or replace function clinic_private.validate_service_appointment()
returns trigger language plpgsql security invoker set search_path='' as $$
declare
 service record;
 policy record;
 pet_species text;
 v_day text;
 local_start timestamp;
 local_end timestamp;
 local_minutes integer;
 entries jsonb;
 valid_hours boolean := false;
 interval_entry jsonb;
begin
 if new.branch_id is null or new.service_id is null or new.request_nonce is null then
   raise exception 'Branch booking requires approved service and request token'
     using errcode='23514';
 end if;
 if not (select clinic_private.is_permanent_user())
    or new.created_by is distinct from (select auth.uid()) then
   raise exception 'Verified customer identity required' using errcode='42501';
 end if;
 if new.status <> 'requested' or new.request_nonce is null
    or length(coalesce(new.details,''))>3000 then
   raise exception 'New service bookings must be requested and idempotent' using errcode='23514';
 end if;
 if not exists(select 1 from public.owners o where o.id=new.owner_id
   and o.user_id=(select auth.uid())) then
   raise exception 'Booking owner does not match signed-in customer' using errcode='42501';
 end if;
 select p.species_id into pet_species from public.pets p
   where p.id=new.pet_id and p.owner_id=new.owner_id;
 if not found or pet_species is null then
   raise exception 'Registered patient taxonomy is required' using errcode='23514';
 end if;
-- Published/owner-approved ACTIVE service enforced by caller RLS;
 -- explicit service branch must equal resource-derived appointment branch.
 select duration_minutes into service from public.clinic_services
   where id=new.service_id and branch_id=new.branch_id;
 if not found then raise exception 'Service is not published and approved' using errcode='23514'; end if;
 if not exists(select 1 from public.clinic_service_species ss
   join public.species_catalog sp on sp.id=ss.species_id
   where ss.service_id=new.service_id and ss.species_id=pet_species
     and sp.clinic_supported and sp.is_active and sp.review_status<>'pending') then
   raise exception 'Service is not approved for this animal type' using errcode='23514';
 end if;
 if not exists(select 1 from public.clinic_service_resources sr
   join public.appointment_resources ar on ar.id=sr.resource_id
   where sr.service_id=new.service_id and sr.resource_id=new.resource_id
     and sr.capacity=1 and ar.is_active and ar.branch_id=new.branch_id) then
   raise exception 'Unapproved or inactive clinic resource' using errcode='23514';
 end if;
-- The global singleton is permanently hidden after the 12th migration.
 -- Read the approved branch policy with caller RLS (SECURITY INVOKER).
 select bp.timezone,bp.weekly_hours,bp.holidays,bp.lead_minutes,
   bp.max_advance_days,bp.slot_step_minutes,bp.is_approved
 into policy from public.branch_booking_policies bp
 join public.clinic_branches b on b.id=bp.branch_id
 where bp.branch_id=new.branch_id and bp.is_approved and b.booking_enabled;
 if not found or policy.lead_minutes is null
    or policy.lead_minutes not between 0 and 10080
    or policy.max_advance_days not between 1 and 365
    or policy.slot_step_minutes not between 5 and 60
    or pg_catalog.jsonb_typeof(policy.weekly_hours)<>'object'
    or not (policy.weekly_hours ?& array['sun','mon','tue','wed','thu','fri','sat']) then
   raise exception 'Branch booking schedule awaits valid owner approval' using errcode='23514';
 end if;
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=policy.timezone) then
   raise exception 'Invalid clinic IANA timezone' using errcode='23514';
 end if;
 if new.ends_at <> new.starts_at + pg_catalog.make_interval(mins=>service.duration_minutes) then
   raise exception 'Appointment must equal the approved service duration' using errcode='23514';
 end if;
 if new.starts_at < pg_catalog.statement_timestamp() +
        pg_catalog.make_interval(mins=>policy.lead_minutes)
    or new.starts_at > pg_catalog.statement_timestamp() +
        pg_catalog.make_interval(days=>policy.max_advance_days) then
   raise exception 'Outside approved booking notice/horizon' using errcode='23514';
 end if;
 local_start:=new.starts_at at time zone policy.timezone;
 local_end:=new.ends_at at time zone policy.timezone;
 if local_start::date<>local_end::date then
    raise exception 'Booking cannot cross clinic-local midnight' using errcode='23514';
 end if;
 if local_start::date=any(policy.holidays) then
    raise exception 'Clinic is closed for the approved holiday' using errcode='23514';
 end if;
 local_minutes:=extract(hour from local_start)::integer*60 +
                extract(minute from local_start)::integer;
 if local_minutes%policy.slot_step_minutes<>0
    or extract(second from local_start)<>0 then
    raise exception 'Booking does not align to the approved slot step' using errcode='23514';
 end if;
 v_day:=(array['sun','mon','tue','wed','thu','fri','sat'])
      [extract(dow from local_start)::integer+1];
 entries:=policy.weekly_hours->v_day;
 if pg_catalog.jsonb_typeof(entries)<>'array' then
   raise exception 'Missing owner-approved clinic weekday hours' using errcode='23514';
 end if;
 for interval_entry in select value from pg_catalog.jsonb_array_elements(entries) loop
   if coalesce(interval_entry->>'open','') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      and coalesce(interval_entry->>'close','') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
     if (interval_entry->>'open')::time < (interval_entry->>'close')::time
        and local_start::time >= (interval_entry->>'open')::time
        and local_end::time <= (interval_entry->>'close')::time then
       valid_hours:=true;exit;
     end if;
   end if;
 end loop;
 if not valid_hours then
   raise exception 'Slot is outside approved clinic operating hours' using errcode='23514';
 end if;
 return new; -- existing exclusion constraint handles resource concurrency
end;
$$;
commit;
