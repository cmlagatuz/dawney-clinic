-- Dawney Phase 4 public service discovery and owner-only appointment requests.
-- STAGED ONLY. Requires Phase 4 taxonomy migrations INCLUDING #40 correction.
-- Zero services published, zero approved hours and zero patient/appointment writes.
-- No unknown clinic hours, advertised treatment/prices or resource capacity assumed.
create table public.clinic_services (
 id uuid primary key default gen_random_uuid(),
 slug text not null unique check (slug ~ '^[a-z][a-z0-9-]{1,79}$'),
 display_name text not null check (length(btrim(display_name)) between 2 and 120),
 summary text check (summary is null or length(summary)<=1500),
 duration_minutes integer not null check (duration_minutes between 5 and 240 and duration_minutes%5=0),
 is_active boolean not null default false,
 owner_approved_at timestamptz,
 owner_approved_by uuid references auth.users(id) on delete restrict,
 published_at timestamptz,
 created_at timestamptz not null default now(),
 constraint service_review_provenance check ((owner_approved_at is null)=(owner_approved_by is null)),
 constraint service_no_unapproved_publication check (published_at is null or
   (owner_approved_at is not null and owner_approved_by is not null))
);
create table public.clinic_service_species (
 service_id uuid not null references public.clinic_services(id) on delete restrict,
 species_id text not null references public.species_catalog(id) on delete restrict,
 primary key(service_id,species_id)
);
create table public.clinic_service_resources (
 service_id uuid not null references public.clinic_services(id) on delete restrict,
 resource_id uuid not null references public.appointment_resources(id) on delete restrict,
 capacity smallint not null default 1 check(capacity=1), -- existing exclusion only supports one
 public_label text check(public_label is null or length(btrim(public_label)) between 2 and 120),
 primary key(service_id,resource_id)
);
-- One proposed (NOT approved) scheduling policy. Times are LOCAL to timezone.
-- Seven weekday arrays, each containing approved {open:"HH:mm",close:"HH:mm"} intervals.
create table public.clinic_booking_policy (
 policy_id smallint primary key check(policy_id=1),
 timezone text not null default 'Asia/Manila' check(length(timezone) between 3 and 80),
 weekly_hours jsonb not null default
   '{"sun":[],"mon":[],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[]}'::jsonb,
 holidays date[] not null default '{}',
 lead_minutes integer check(lead_minutes between 0 and 10080),
 max_advance_days integer check(max_advance_days between 1 and 365),
 slot_step_minutes integer check(slot_step_minutes between 5 and 60),
 is_approved boolean not null default false,
 approved_at timestamptz,
 approved_by uuid references auth.users(id) on delete restrict,
 revision integer not null default 1 check(revision>0),
 constraint policy_approved_complete check (
   (not is_approved and approved_at is null and approved_by is null)
   or (is_approved and approved_at is not null and approved_by is not null
      and lead_minutes is not null and max_advance_days is not null
      and slot_step_minutes is not null)
 ),
 constraint policy_weekly_shape check(jsonb_typeof(weekly_hours)='object'
  and weekly_hours ?& array['sun','mon','tue','wed','thu','fri','sat']
  and jsonb_typeof(weekly_hours->'sun')='array'
  and jsonb_typeof(weekly_hours->'mon')='array'
  and jsonb_typeof(weekly_hours->'tue')='array'
  and jsonb_typeof(weekly_hours->'wed')='array'
  and jsonb_typeof(weekly_hours->'thu')='array'
  and jsonb_typeof(weekly_hours->'fri')='array'
  and jsonb_typeof(weekly_hours->'sat')='array')
);
insert into public.clinic_booking_policy(policy_id,timezone)
values(1,'Asia/Manila'); -- proposal only, approved=false, no hours

alter table public.clinic_services enable row level security;
alter table public.clinic_service_species enable row level security;
alter table public.clinic_service_resources enable row level security;
alter table public.clinic_booking_policy enable row level security;
revoke all on public.clinic_services,public.clinic_service_species,
  public.clinic_service_resources,public.clinic_booking_policy
  from public,anon,authenticated;
grant select on public.clinic_services, public.clinic_service_species,
  public.clinic_service_resources to anon,authenticated;
grant select on public.clinic_booking_policy to anon,authenticated;
-- Browsing only: no anonymous or normal Auth ability to approve, seed, or publish.
create policy clinic_services_public_read on public.clinic_services
 for select to anon,authenticated using (
   is_active and published_at is not null and owner_approved_at is not null
     and owner_approved_by is not null
 );
create policy clinic_service_species_public_read on public.clinic_service_species
 for select to anon,authenticated using (exists(
  select 1 from public.clinic_services s where s.id=service_id
 ) and exists (
  select 1 from public.species_catalog sp where sp.id=species_id
     and sp.clinic_supported and sp.is_active and sp.review_status<>'pending'
 ));
create policy clinic_service_resources_public_read on public.clinic_service_resources
 for select to anon,authenticated using (exists (
   select 1 from public.clinic_services s where s.id=service_id
 ) and exists (
   select 1 from public.clinic_booking_policy bp
   where bp.policy_id=1 and bp.is_approved
 ));
-- Approved opening hours only, no visibility of draft clinic policy/holidays.
create policy clinic_booking_policy_public_read on public.clinic_booking_policy
 for select to anon,authenticated using(is_approved);

-- Original appointment rows are untouched, and old requests remain service_id=NULL.
alter table public.appointments
  add column service_id uuid references public.clinic_services(id) on delete restrict,
  add column request_nonce uuid;
create unique index appointments_owner_nonce_unique
 on public.appointments(owner_id,request_nonce) where request_nonce is not null;
create unique index appointments_service_duplicate_guard
 on public.appointments(owner_id,pet_id,service_id,resource_id,starts_at)
 where service_id is not null and status in ('requested','confirmed','checked_in');
grant insert(service_id,request_nonce) on public.appointments to authenticated;
alter table public.appointments add constraint service_request_requires_nonce
 check(service_id is null or request_nonce is not null);

-- Security-invoker validation is attached to EVERY direct SQL/API INSERT,
-- including client attempts to bypass the purpose-built request RPC.
create function clinic_private.validate_service_appointment()
returns trigger language plpgsql security invoker set search_path='' as $$
declare
 service public.clinic_services%rowtype;
 policy public.clinic_booking_policy%rowtype;
 pet_species text;
 v_day text;
 local_start timestamp;
 local_end timestamp;
 local_minutes integer;
 entries jsonb;
 valid_hours boolean := false;
 interval_entry jsonb;
begin
 if new.service_id is null then
   -- Legacy unlinked requests are preserved while migration/React rollout
   -- is pending. Once service booking is approved, do not allow bypass.
   if exists (select 1 from public.clinic_booking_policy where policy_id=1 and is_approved)
     and new.request_nonce is null then
     raise exception 'Select an approved service to request a clinic appointment' using errcode='23514';
   end if;
   if new.request_nonce is not null then
     raise exception 'Request token requires service selection' using errcode='23514';
   end if;
   return new;
 end if;
 if not (select clinic_private.is_permanent_user())
    or new.created_by is distinct from (select auth.uid()) then
   raise exception 'Verified customer identity required' using errcode='42501';
 end if;
 if new.status <> 'requested' or new.request_nonce is null then
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
 select * into service from public.clinic_services
   where id=new.service_id and is_active and published_at is not null
     and owner_approved_at is not null and owner_approved_by is not null;
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
     and sr.capacity=1 and ar.is_active) then
   raise exception 'Unapproved or inactive clinic resource' using errcode='23514';
 end if;
 select * into policy from public.clinic_booking_policy
   where policy_id=1 and is_approved and approved_at is not null
     and approved_by is not null;
 if not found or policy.lead_minutes is null or policy.max_advance_days is null
    or policy.slot_step_minutes is null then
   raise exception 'Clinic booking schedule awaits owner approval' using errcode='23514';
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
revoke all on function clinic_private.validate_service_appointment() from public,anon,authenticated;
create trigger appointment_service_booking_guard
 before insert on public.appointments
 for each row execute function clinic_private.validate_service_appointment();

-- Insertion is atomic and owner_id is always derived, never user-supplied.
-- SECURITY INVOKER preserves all existing appointment RLS, grants, triggers.
create function public.request_service_appointment(
 p_pet_id uuid,p_service_id uuid,p_resource_id uuid,p_starts_at timestamptz,
 p_request_nonce uuid,p_concern text,p_details text default null
) returns uuid language plpgsql security invoker set search_path='' as $$
declare
 v_owner uuid;
 v_minutes integer;
 v_existing public.appointments%rowtype;
 v_id uuid;
begin
 if not (select clinic_private.is_permanent_user()) then
   raise exception 'Confirmed Supabase Auth user required' using errcode='42501';
 end if;
 if p_request_nonce is null or p_pet_id is null or p_service_id is null
    or p_resource_id is null or p_starts_at is null
    or length(btrim(coalesce(p_concern,''))) not between 1 and 300
    or length(coalesce(p_details,''))>3000 then
   raise exception 'Invalid service request parameters' using errcode='23514';
 end if;
 select id into v_owner from public.owners where user_id=(select auth.uid());
 if not found then
   raise exception 'Complete owner profile before booking' using errcode='42501';
 end if;
 if not exists(select 1 from public.pets where id=p_pet_id and owner_id=v_owner) then
   raise exception 'Register a patient owned by this account' using errcode='42501';
 end if;
 select duration_minutes into v_minutes from public.clinic_services
   where id=p_service_id and is_active and published_at is not null
    and owner_approved_at is not null and owner_approved_by is not null;
 if not found then raise exception 'Service is not approved' using errcode='23514'; end if;

 select * into v_existing from public.appointments
   where owner_id=v_owner and request_nonce=p_request_nonce;
 if found then
   if v_existing.pet_id=p_pet_id and v_existing.service_id=p_service_id
     and v_existing.resource_id=p_resource_id and v_existing.starts_at=p_starts_at
     and v_existing.ends_at=p_starts_at+pg_catalog.make_interval(mins=>v_minutes)
     and v_existing.concern=p_concern
     and v_existing.details is not distinct from p_details then
      return v_existing.id; -- exact retry; never double-create
   end if;
   raise exception 'Request token already belongs to another booking' using errcode='23505';
 end if;
 begin
  insert into public.appointments
    (owner_id,pet_id,service_id,resource_id,starts_at,ends_at,
     request_nonce,concern,details)
  values(v_owner,p_pet_id,p_service_id,p_resource_id,p_starts_at,
      p_starts_at+pg_catalog.make_interval(mins=>v_minutes),p_request_nonce,
      p_concern,p_details)
  returning id into v_id;
  return v_id;
 exception when unique_violation then
  -- Handles concurrent same-token retries; never hide a distinct token conflict.
  select * into v_existing from public.appointments
    where owner_id=v_owner and request_nonce=p_request_nonce;
  if found and v_existing.pet_id=p_pet_id and v_existing.service_id=p_service_id
      and v_existing.resource_id=p_resource_id and v_existing.starts_at=p_starts_at
      and v_existing.ends_at=p_starts_at+pg_catalog.make_interval(mins=>v_minutes)
      and v_existing.concern=p_concern
      and v_existing.details is not distinct from p_details then
    return v_existing.id;
  end if;
  raise;
 end;
end;
$$;
revoke all on function public.request_service_appointment(uuid,uuid,uuid,timestamptz,uuid,text,text)
 from public,anon,authenticated;
grant execute on function public.request_service_appointment(uuid,uuid,uuid,timestamptz,uuid,text,text)
 to authenticated;
