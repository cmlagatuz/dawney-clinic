-- DAWNEY ISSUE #77: REVIEW ONLY, FUTURE ADDITIVE MIGRATION. NEVER AUTO-APPLY.
-- Requires exactly the original 11 migrations. No historic attribution, staff grants,
-- approved booking policies, clinical/service data or Storage objects are seeded.
-- Existing historical Dog/Chow Chow patient + appointment remain BRANCH UNKNOWN.
begin;
set local search_path=public,extensions,pg_catalog;

create table public.clinic_branches (
 id uuid primary key,
 slug text not null unique check(slug ~ '^[a-z][a-z0-9-]{1,39}$'),
 display_name text not null,
 designation text not null check(designation in ('initial','main','additional')),
 address_text text not null,
 timezone text not null default 'Asia/Manila',
 public_display_hours jsonb not null default '{}'::jsonb,
 booking_enabled boolean not null default false,
 owner_approved_at timestamptz,
 owner_approved_by uuid references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 constraint branch_booking_approval check (
  (not booking_enabled) or (owner_approved_at is not null and owner_approved_by is not null)
 )
);
insert into public.clinic_branches
 (id,slug,display_name,designation,address_text,public_display_hours)
values
 ('11111111-0000-4000-8000-000000000077','naga','Dawney Animal Clinic — Naga','initial',
  '80 Perpetual Help Street, Peñafrancia Avenue, Naga, Camarines Sur, Philippines',
  '{"mon":"08:00-17:00","tue":"08:00-17:00","wed":"08:00-17:00","thu":"08:00-17:00","fri":"08:00-17:00","sat":"08:00-17:00"}'),
 ('22222222-0000-4000-8000-000000000077','cavite','Dawney Animal Clinic — Cavite','main',
  'Phase 5 Lot 14 Block 1, San Francisco, Brookside Lane, EBS BUILDING, Arnaldo Hwy, General Trias, Cavite, Philippines',
  '{"mon":"08:00-17:00","tue":"08:00-17:00","wed":"08:00-17:00","thu":"08:00-17:00","fri":"08:00-17:00","sat":"08:00-17:00"}');
alter table public.clinic_branches enable row level security;
revoke all on public.clinic_branches from public,anon,authenticated;
grant select(id,slug,display_name,designation,address_text,timezone,public_display_hours,booking_enabled)
 on public.clinic_branches to anon,authenticated;
create policy clinic_branches_public_info on public.clinic_branches
 for select to anon,authenticated using(true);

-- Additional future branches require a separate reviewed insert and no implicit activity.
-- Existing global staff_memberships is preserved; NO automatic branch grants.
create table public.staff_branch_memberships (
 user_id uuid not null references auth.users(id) on delete restrict,
 branch_id uuid not null references public.clinic_branches(id) on delete restrict,
 role text not null check(role in ('receptionist','veterinarian','administrator')),
 is_active boolean not null default false,
 assigned_at timestamptz not null default now(),
 assigned_by uuid references auth.users(id) on delete set null,
 primary key(user_id,branch_id)
);
create index staff_branch_active_lookup on public.staff_branch_memberships
 (branch_id,role,user_id) where is_active;
alter table public.staff_branch_memberships enable row level security;
revoke all on public.staff_branch_memberships from public,anon,authenticated;
grant select(user_id,branch_id,role,is_active,assigned_at) on public.staff_branch_memberships to authenticated;
create policy staff_branch_self_only on public.staff_branch_memberships
 for select to authenticated using(user_id=(select auth.uid()));

-- Authorization uses fresh SQL membership and provider Auth user state.
-- No JWT/app metadata active_branch_id controls access.
create function clinic_private.has_branch_role(p_branch uuid,p_roles text[])
returns boolean language sql stable security definer set search_path='' as $$
 select p_branch is not null and (select auth.uid()) is not null and exists(
  select 1 from public.staff_branch_memberships bm
  join public.staff_memberships sm on sm.user_id=bm.user_id
  join auth.users u on u.id=bm.user_id
  where bm.user_id=(select auth.uid()) and bm.branch_id=p_branch
    and bm.is_active and bm.role=any(p_roles)
    and sm.is_active and sm.role=bm.role
    and u.email_confirmed_at is not null and not u.is_anonymous
    and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())
 );
$$;
revoke all on function clinic_private.has_branch_role(uuid,text[]) from public,anon,authenticated;
grant execute on function clinic_private.has_branch_role(uuid,text[]) to authenticated;

-- Authorization-controlled branch switch: this checks, but NEVER creates, a grant.
create function public.assert_staff_branch(p_branch uuid)
returns uuid language plpgsql stable security invoker set search_path='' as $$
begin
 if not (select clinic_private.has_branch_role(p_branch,
    array['receptionist','veterinarian','administrator'])) then
  raise exception 'Branch access not authorized' using errcode='42501';
 end if;
 return p_branch;
end;
$$;
revoke all on function public.assert_staff_branch(uuid) from public,anon,authenticated;
grant execute on function public.assert_staff_branch(uuid) to authenticated;

-- Nullable legacy rows are explicitly UNATTRIBUTED: no presumed Naga assignment.
alter table public.appointment_resources add column branch_id uuid
 references public.clinic_branches(id) on delete restrict;
alter table public.appointments add column branch_id uuid
 references public.clinic_branches(id) on delete restrict;
alter table public.clinic_services add column branch_id uuid
 references public.clinic_branches(id) on delete restrict;
alter table public.clinical_records add column branch_id uuid
 references public.clinic_branches(id) on delete restrict;
alter table public.pet_attachments add column branch_id uuid
 references public.clinic_branches(id) on delete restrict;
create index appointments_by_branch_start on public.appointments(branch_id,starts_at,id);
create index resources_by_branch on public.appointment_resources(branch_id,is_active);
create index services_by_branch on public.clinic_services(branch_id,id);
create index records_by_branch_pet_date on public.clinical_records(branch_id,pet_id,performed_at desc);
create index attachments_by_branch_pet on public.pet_attachments(branch_id,pet_id);

create function clinic_private.has_branch_pet_care(p_pet uuid,p_roles text[])
returns boolean language sql stable security definer set search_path='' as $
 select exists(
  select 1 from public.appointments a
  where a.pet_id=p_pet and a.branch_id is not null
    and clinic_private.has_branch_role(a.branch_id,p_roles)
 );
$;
create function clinic_private.has_branch_owner_care(p_owner uuid,p_roles text[])
returns boolean language sql stable security definer set search_path='' as $
 select exists(
  select 1 from public.appointments a
  where a.owner_id=p_owner and a.branch_id is not null
    and clinic_private.has_branch_role(a.branch_id,p_roles)
 );
$;
revoke all on function clinic_private.has_branch_pet_care(uuid,text[]),
 clinic_private.has_branch_owner_care(uuid,text[]) from public,anon,authenticated;
grant execute on function clinic_private.has_branch_pet_care(uuid,text[]),
 clinic_private.has_branch_owner_care(uuid,text[]) to authenticated;


-- Retain legacy GLOBAL resource-name and service-slug uniqueness until reviewed
-- namespacing cutover. Branch-specific labels need distinct global names meanwhile.

-- Evidence-gated historical appointment attribution: no automatic backfill.
create table clinic_private.branch_attribution_evidence (
 appointment_id uuid primary key references public.appointments(id) on delete restrict,
 branch_id uuid not null references public.clinic_branches(id) on delete restrict,
 evidence_reference text not null check(length(btrim(evidence_reference)) between 16 and 300),
 reviewed_by uuid not null references auth.users(id) on delete restrict,
 reviewed_at timestamptz not null default now()
);
alter table clinic_private.branch_attribution_evidence enable row level security;
revoke all on clinic_private.branch_attribution_evidence from public,anon,authenticated;

-- Before INSERT, derive appointment branch from resource; no client-selected branch
-- can override it. For old NULL resources, new booking is safely blocked.
create function clinic_private.enforce_appointment_branch()
returns trigger language plpgsql security invoker set search_path='' as $$
declare resource_branch uuid;
begin
 if tg_op='INSERT' then
  select r.branch_id into resource_branch
   from public.appointment_resources r where r.id=new.resource_id;
  if resource_branch is null then
   raise exception 'Resource lacks approved branch attribution' using errcode='23514';
  end if;
  if new.branch_id is not null and new.branch_id<>resource_branch then
   raise exception 'Appointment/resource branch mismatch' using errcode='23514';
  end if;
  new.branch_id:=resource_branch;
  -- Public display hours are NOT booking approval; no new hosted booking
  -- until the exact branch and per-branch schedule are owner approved.
  if current_user='authenticated' and not exists(
    select 1 from public.branch_booking_policies bp
    join public.clinic_branches b on b.id=bp.branch_id
    where bp.branch_id=new.branch_id and bp.is_approved and b.booking_enabled
  ) then
   raise exception 'Branch booking policy is not approved' using errcode='23514';
  end if;
  if new.service_id is not null and not exists(
    select 1 from public.clinic_services s
    where s.id=new.service_id and s.branch_id=new.branch_id) then
   raise exception 'Service belongs to another branch' using errcode='23514';
  end if;
  return new;
 end if;
 if new.branch_id is distinct from old.branch_id then
  if current_user in ('anon','authenticated')
    or old.branch_id is not null or new.branch_id is null
    or not exists(select 1 from clinic_private.branch_attribution_evidence e
      where e.appointment_id=old.id and e.branch_id=new.branch_id) then
   raise exception 'Immutable appointment branch without reviewed provenance'
    using errcode='42501';
  end if;
 end if;
 if new.resource_id is distinct from old.resource_id then
   raise exception 'Resource reassignment requires separate reviewed workflow'
     using errcode='42501';
 end if;
 return new;
end;
$$;
revoke all on function clinic_private.enforce_appointment_branch() from public,anon,authenticated;
create trigger appointment_branch_guard before insert or update on public.appointments
 for each row execute function clinic_private.enforce_appointment_branch();

-- Each clinical record belongs to one known branch for new inserts; legacy NULL
-- records remain readable to their true owner but inaccessible to branch staff.
create function clinic_private.require_clinical_branch()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' and new.branch_id is null then
  raise exception 'Clinical write requires explicit branch' using errcode='23514';
 end if;
 if tg_op='UPDATE' and new.branch_id is distinct from old.branch_id then
  raise exception 'Clinical branch is immutable' using errcode='42501';
 end if;
 return new;
end;
$$;
revoke all on function clinic_private.require_clinical_branch() from public,anon,authenticated;
create trigger clinical_branch_guard before insert or update on public.clinical_records
 for each row execute function clinic_private.require_clinical_branch();
grant insert(branch_id) on public.clinical_records to authenticated;
grant insert(branch_id) on public.pet_attachments to authenticated;

-- Branch scheduling: no copied singleton policy, no invented Sunday, no approvals.
create table public.branch_booking_policies (
 branch_id uuid primary key references public.clinic_branches(id) on delete restrict,
 timezone text not null default 'Asia/Manila',
 weekly_hours jsonb not null default '{}'::jsonb,
 holidays date[] not null default '{}',
 lead_minutes integer,
 max_advance_days integer,
 slot_step_minutes integer,
 is_approved boolean not null default false,
 approved_at timestamptz,
 approved_by uuid references auth.users(id) on delete restrict,
 revision integer not null default 1,
 check(not is_approved or (approved_at is not null and approved_by is not null
    and lead_minutes is not null and max_advance_days is not null
    and slot_step_minutes is not null))
);
insert into public.branch_booking_policies(branch_id)
select id from public.clinic_branches;
alter table public.branch_booking_policies enable row level security;
revoke all on public.branch_booking_policies from public,anon,authenticated;
grant select(branch_id,timezone,weekly_hours,holidays,lead_minutes,max_advance_days,
 slot_step_minutes,is_approved,revision) on public.branch_booking_policies to anon,authenticated;
create policy branch_policy_only_approved on public.branch_booking_policies
 for select to anon,authenticated using(
  is_approved and exists(select 1 from public.clinic_branches b
   where b.id=branch_id and b.booking_enabled)
 );

-- Strict additive RLS: original permissive policies remain but MUST now ALSO
-- satisfy these restrictive guards. No global staff-by-role history access.
create policy staff_global_read_self_only on public.staff_memberships
 as restrictive for select to authenticated using(user_id=(select auth.uid()));

create policy owners_branch_need_to_know on public.owners
 as restrictive for select to authenticated using(
 user_id=(select auth.uid()) or
 clinic_private.has_branch_owner_care(id,array['receptionist','veterinarian','administrator'])
);
create policy pets_branch_need_to_know on public.pets
 as restrictive for select to authenticated using(
 exists(select 1 from public.owners o where o.id=pets.owner_id
    and o.user_id=(select auth.uid())) or
 clinic_private.has_branch_pet_care(id,array['receptionist','veterinarian','administrator'])
);
create policy appointments_branch_read on public.appointments
 as restrictive for select to authenticated using(
 exists(select 1 from public.owners o where o.id=appointments.owner_id
  and o.user_id=(select auth.uid())) or
 clinic_private.has_branch_role(branch_id,array['receptionist','veterinarian','administrator'])
);
create policy appointments_branch_insert on public.appointments
 as restrictive for insert to authenticated with check(
 branch_id is not null
 and exists(select 1 from public.appointment_resources r
  where r.id=resource_id and r.branch_id=appointments.branch_id and r.is_active)
 and (service_id is null or exists(select 1 from public.clinic_services s
  where s.id=service_id and s.branch_id=appointments.branch_id))
 and (exists(select 1 from public.owners o where o.id=appointments.owner_id
  and o.user_id=(select auth.uid())) or
  clinic_private.has_branch_role(branch_id,array['receptionist','veterinarian','administrator']))
);
create policy appointments_branch_update on public.appointments
 as restrictive for update to authenticated using(
 exists(select 1 from public.owners o where o.id=appointments.owner_id
  and o.user_id=(select auth.uid())) or
 clinic_private.has_branch_role(branch_id,array['receptionist','veterinarian','administrator'])
) with check(
 exists(select 1 from public.owners o where o.id=appointments.owner_id
  and o.user_id=(select auth.uid())) or
 clinic_private.has_branch_role(branch_id,array['receptionist','veterinarian','administrator'])
);
create policy appointment_events_branch_read on public.appointment_events
 as restrictive for select to authenticated using(
 exists(select 1 from public.appointments a
  where a.id=appointment_id and (
   exists(select 1 from public.owners o where o.id=a.owner_id
    and o.user_id=(select auth.uid())) or
   clinic_private.has_branch_role(a.branch_id,array['receptionist','veterinarian','administrator'])
  ))
);
create policy clinical_records_branch_read on public.clinical_records
 as restrictive for select to authenticated using(
 exists(select 1 from public.pets p join public.owners o on o.id=p.owner_id
  where p.id=clinical_records.pet_id and o.user_id=(select auth.uid())) or
 (branch_id is not null and
  clinic_private.has_branch_role(branch_id,array['veterinarian','administrator']) and
  clinic_private.has_branch_pet_care(pet_id,array['veterinarian','administrator']))
);
create policy clinical_records_branch_insert on public.clinical_records
 as restrictive for insert to authenticated with check(
 branch_id is not null and
 clinic_private.has_branch_role(branch_id,array['veterinarian','administrator']) and
 clinic_private.has_branch_pet_care(pet_id,array['veterinarian','administrator'])
);
create policy attachment_branch_read on public.pet_attachments
 as restrictive for select to authenticated using(
 exists(select 1 from public.pets p join public.owners o on o.id=p.owner_id
  where p.id=pet_attachments.pet_id and o.user_id=(select auth.uid())) or
 (branch_id is not null and
  clinic_private.has_branch_role(branch_id,array['veterinarian','administrator']) and
  clinic_private.has_branch_pet_care(pet_id,array['veterinarian','administrator']))
);
create policy attachment_branch_insert on public.pet_attachments
 as restrictive for insert to authenticated with check(
 (branch_id is null and exists(select 1 from public.pets p
  join public.owners o on o.id=p.owner_id
  where p.id=pet_id and o.user_id=(select auth.uid()))) or
 (branch_id is not null and
  clinic_private.has_branch_role(branch_id,array['veterinarian','administrator']) and
  clinic_private.has_branch_pet_care(pet_id,array['veterinarian','administrator']))
);
create policy resources_branch_read on public.appointment_resources
 as restrictive for select to authenticated using(
 branch_id is not null and
 (clinic_private.has_branch_role(branch_id,array['receptionist','veterinarian','administrator'])
  or (clinic_private.is_permanent_user() and exists(
   select 1 from public.clinic_branches b where b.id=branch_id and b.booking_enabled)))
);
create policy services_branch_read on public.clinic_services
 as restrictive for select to anon,authenticated using(
 branch_id is not null and exists(select 1 from public.clinic_branches b
  where b.id=branch_id and b.booking_enabled)
);
create policy service_resources_branch_read on public.clinic_service_resources
 as restrictive for select to anon,authenticated using(
 exists(select 1 from public.clinic_services s
  join public.appointment_resources r on r.id=resource_id
  join public.branch_booking_policies p on p.branch_id=s.branch_id
  where s.id=service_id and s.branch_id=r.branch_id and p.is_approved)
);
create policy service_species_branch_read on public.clinic_service_species
 as restrictive for select to authenticated using(
 exists(select 1 from public.clinic_services s where s.id=service_id
  and s.branch_id is not null)
);
-- Retire public exposure of the single global policy. Existing RPC fails closed
-- until a separately reviewed branch-aware RPC/policy activation is approved.
create policy legacy_singleton_policy_is_not_branch_authority
 on public.clinic_booking_policy as restrictive
 for select to anon,authenticated using(false);

-- Storage paths are legacy pet-based, NOT branch-authenticated. Staff READ requires
-- a branch-attributed attachment row + authorized pet visit; staff clinic-path
-- uploads are DENIED until a separate reviewed branch-encoded upload workflow.
create policy clinical_storage_branch_read_guard on storage.objects
 as restrictive for select to authenticated using(
 bucket_id<>'clinical-attachments' or (
  ((storage.foldername(storage.objects.name))[3]='owners'
   and (storage.foldername(storage.objects.name))[4]=(select auth.uid())::text
   and exists(select 1 from public.pets p join public.owners o on o.id=p.owner_id
    where p.id::text=(storage.foldername(storage.objects.name))[2]
     and o.user_id=(select auth.uid())))
  or exists(select 1 from public.pet_attachments a
   where a.object_path=storage.objects.name and a.branch_id is not null
    and clinic_private.has_branch_role(a.branch_id,array['veterinarian','administrator'])
    and clinic_private.has_branch_pet_care(a.pet_id,array['veterinarian','administrator']))
 ));
create policy clinical_storage_branch_insert_guard on storage.objects
 as restrictive for insert to authenticated with check(
 bucket_id<>'clinical-attachments' or (
  (storage.foldername(storage.objects.name))[3]='owners'
  and (storage.foldername(storage.objects.name))[4]=(select auth.uid())::text
  and exists(select 1 from public.pets p join public.owners o on o.id=p.owner_id
   where p.id::text=(storage.foldername(storage.objects.name))[2]
    and o.user_id=(select auth.uid()))
 ));

-- Future clinical visits and treatments have immutable branch links by composite FK.
create unique index appointments_id_branch_unique on public.appointments(id,branch_id);
create unique index appointments_id_branch_pet_unique on public.appointments(id,branch_id,pet_id);
create table public.branch_encounters (
 id uuid primary key default gen_random_uuid(),
 appointment_id uuid not null,
 branch_id uuid not null,
 pet_id uuid not null references public.pets(id) on delete restrict,
 opened_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
 opened_at timestamptz not null default now(),
 foreign key(appointment_id,branch_id,pet_id) references public.appointments(id,branch_id,pet_id) on delete restrict
);
create index branch_encounters_pet on public.branch_encounters(branch_id,pet_id,opened_at desc);
alter table public.branch_encounters enable row level security;
revoke all on public.branch_encounters from public,anon,authenticated;
grant select on public.branch_encounters to authenticated;
create policy encounters_read on public.branch_encounters for select to authenticated using(
 exists(select 1 from public.pets p join public.owners o on o.id=p.owner_id
  where p.id=pet_id and o.user_id=(select auth.uid())) or
 clinic_private.has_branch_role(branch_id,array['veterinarian','administrator'])
);
-- No direct client INSERT until a reviewed visit-creation RPC guarantees pet identity.

create table public.branch_treatments (
 id uuid primary key default gen_random_uuid(),
 encounter_id uuid not null references public.branch_encounters(id) on delete restrict,
 branch_id uuid not null references public.clinic_branches(id) on delete restrict,
 procedure_text text not null,
 authored_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now()
);
create unique index branch_encounters_id_branch_unique on public.branch_encounters(id,branch_id);
alter table public.branch_treatments add constraint treatments_encounter_branch_match
 foreign key(encounter_id,branch_id) references public.branch_encounters(id,branch_id) on delete restrict;
alter table public.branch_treatments enable row level security;
revoke all on public.branch_treatments from public,anon,authenticated;
grant select on public.branch_treatments to authenticated;
create policy treatments_read on public.branch_treatments for select to authenticated using(
 exists(select 1 from public.branch_encounters e
  where e.id=encounter_id and e.branch_id=branch_id)
 and clinic_private.has_branch_role(branch_id,array['veterinarian','administrator'])
);
-- Stock movements are separately audited future #78 scope; no client privileges.
create table public.branch_inventory_movements (
 id uuid primary key default gen_random_uuid(),
 branch_id uuid not null references public.clinic_branches(id) on delete restrict,
 occurred_at timestamptz not null default now(),
 reference_code text not null,
 quantity_delta numeric(14,3) not null,
 recorded_by uuid references auth.users(id) on delete restrict
);
alter table public.branch_inventory_movements enable row level security;
revoke all on public.branch_inventory_movements from public,anon,authenticated;

commit;
