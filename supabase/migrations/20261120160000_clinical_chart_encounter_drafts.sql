-- DAWNEY #16 — UNAPPLIED secure clinical chart and clinician encounter DRAFT.
-- Requires original immutable eleven + proposed #12/#13/#14/#15 in that order.
-- NO patient attribution/backfill, branch activation, clinician signoff or prescription.
begin;
create table public.clinical_encounter_drafts (
 id uuid primary key default gen_random_uuid(),
 branch_id uuid not null references public.clinic_branches(id) on delete restrict,
 pet_id uuid not null references public.pets(id) on delete restrict,
 appointment_id uuid not null unique,
 author_id uuid not null references auth.users(id) on delete restrict,
 revision integer not null default 1 check(revision between 1 and 2147483647),
 status text not null default 'draft' check(status='draft'),
 complaint text not null check(length(btrim(complaint)) between 1 and 4000),
 examination text not null default '' check(length(examination)<=4000),
 assessment text not null default '' check(length(assessment)<=4000),
 plan text not null default '' check(length(plan)<=4000),
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 constraint clinical_draft_appointment_exact
  foreign key(appointment_id,branch_id,pet_id)
  references public.appointments(id,branch_id,pet_id) on delete restrict
);
create index clinical_draft_branch_pet_recent
 on public.clinical_encounter_drafts(branch_id,pet_id,updated_at desc,id desc);
alter table public.clinical_encounter_drafts enable row level security;
revoke all on public.clinical_encounter_drafts from public,anon,authenticated;
-- Inaccessible even to authenticated via direct table REST; RPC returns allowed columns only.
create table clinic_private.clinical_draft_requests (
 actor_id uuid not null references auth.users(id) on delete restrict,
 request_id uuid not null,
 branch_id uuid not null,
 pet_id uuid not null,
 appointment_id uuid not null,
 payload jsonb not null,
 response jsonb not null,
 received_at timestamptz not null default clock_timestamp(),
 primary key(actor_id,request_id)
);
create table clinic_private.clinical_draft_audit (
 event_id bigint generated always as identity primary key,
 draft_id uuid not null references public.clinical_encounter_drafts(id) on delete restrict,
 branch_id uuid not null,
 pet_id uuid not null,
 appointment_id uuid not null,
 actor_id uuid not null references auth.users(id) on delete restrict,
 request_id uuid not null,
 revision integer not null check(revision>=1),
 action text not null check(action in ('created','revised')),
 payload jsonb not null,
 happened_at timestamptz not null default clock_timestamp(),
 unique(draft_id,revision),
 unique(actor_id,request_id)
);
create index clinical_audit_visit_history
 on clinic_private.clinical_draft_audit(branch_id,pet_id,appointment_id,revision desc);
alter table clinic_private.clinical_draft_requests enable row level security;
alter table clinic_private.clinical_draft_audit enable row level security;
revoke all on clinic_private.clinical_draft_requests,
 clinic_private.clinical_draft_audit from public,anon,authenticated;
create function clinic_private.clinical_audit_append_only()
returns trigger language plpgsql security invoker set search_path='' as $audit$
begin
 raise exception 'Clinical audit is append-only' using errcode='42501';
end;
$audit$;
revoke all on function clinic_private.clinical_audit_append_only() from public,anon,authenticated;
create trigger clinical_draft_audit_no_update_delete
 before update or delete on clinic_private.clinical_draft_audit
 for each row execute function clinic_private.clinical_audit_append_only();
create trigger clinical_draft_audit_no_truncate
 before truncate on clinic_private.clinical_draft_audit
 for each statement execute function clinic_private.clinical_audit_append_only();
create trigger clinical_draft_requests_no_update_delete
 before update or delete on clinic_private.clinical_draft_requests
 for each row execute function clinic_private.clinical_audit_append_only();
create trigger clinical_draft_requests_no_truncate
 before truncate on clinic_private.clinical_draft_requests
 for each statement execute function clinic_private.clinical_audit_append_only();

-- Definer is necessary ONLY because new tables have zero client grants/RLS policies.
-- Explicit trusted-role membership and actual appointment linkage are checked
-- BEFORE any privileged read/write; no dynamic SQL and empty search_path.
create function public.read_staff_patient_chart(
 p_branch uuid,p_pet uuid,p_section text default 'appointments',
 p_after_at timestamptz default null,p_after_id uuid default null,
 p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path='' as $read$
declare v_actor uuid := auth.uid();
 v_patient jsonb; v_items jsonb; v_next jsonb := null;
 v_count integer; v_allowed boolean;
begin
 if v_actor is null or not clinic_private.has_branch_role(p_branch,
   array['receptionist','veterinarian','administrator']) then
  raise exception 'Clinical chart access denied' using errcode='42501';
 end if;
 if p_pet is null or p_branch is null or p_section not in ('appointments','records','drafts')
    or p_section is null or p_limit is null or p_limit<1 or p_limit>50
    or (p_after_at is null)<>(p_after_id is null) then
  raise exception 'Invalid chart cursor or limit' using errcode='22023';
 end if;
 -- A CURRENT, branch-attributed visit is the sole proof of local patient care.
 -- NULL-branch historical visits cannot authorize a chart (even for superusers).
 select pg_catalog.jsonb_build_object('id',p.id,'ownerId',p.owner_id,
  'name',p.name,'species',p.species,'breed',p.breed,'sex',p.sex,
  'birthDate',p.birth_date,'taxonomyReviewNeeded',p.taxonomy_review_needed)
 into v_patient from public.pets p
 where p.id=p_pet and exists(
  select 1 from public.appointments a
   where a.pet_id=p.id and a.owner_id=p.owner_id
     and a.branch_id=p_branch);
 if v_patient is null then
  return pg_catalog.jsonb_build_object('kind','not_found');
 end if;
 v_allowed:=clinic_private.has_branch_role(p_branch,
   array['veterinarian','administrator']);
 if p_section<>'appointments' and not v_allowed then
  raise exception 'Clinical notes restricted to clinicians' using errcode='42501';
 end if;

 if p_section='appointments' then
  select count(*) into v_count from (
   select a.id from public.appointments a
   where a.branch_id=p_branch and a.pet_id=p_pet
     and (p_after_at is null or (a.starts_at,a.id)<(p_after_at,p_after_id))
   order by a.starts_at desc,a.id desc limit p_limit+1) page;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'id',t.id,'branchId',t.branch_id,'petId',t.pet_id,
   'startsAt',t.starts_at,'endsAt',t.ends_at,'status',t.status,
   'concern',t.concern) order by t.starts_at desc,t.id desc),'[]'::jsonb)
   into v_items from (
    select a.id,a.branch_id,a.pet_id,a.starts_at,a.ends_at,a.status,a.concern
    from public.appointments a
    where a.branch_id=p_branch and a.pet_id=p_pet
     and (p_after_at is null or (a.starts_at,a.id)<(p_after_at,p_after_id))
    order by a.starts_at desc,a.id desc limit p_limit) t;
  if v_count>p_limit then
   select pg_catalog.jsonb_build_object('at',q.starts_at,'id',q.id)
   into v_next from (
    select a.starts_at,a.id from public.appointments a
    where a.branch_id=p_branch and a.pet_id=p_pet
     and (p_after_at is null or (a.starts_at,a.id)<(p_after_at,p_after_id))
    order by a.starts_at desc,a.id desc limit 1 offset p_limit-1) q;
  end if;
 elsif p_section='records' then
  -- No legacy/unattributed clinical record is ever exposed via this RPC.
  select count(*) into v_count from (
   select c.id from public.clinical_records c
   where c.branch_id=p_branch and c.pet_id=p_pet
    and (p_after_at is null or (c.performed_at,c.id)<(p_after_at,p_after_id))
   order by c.performed_at desc,c.id desc limit p_limit+1) page;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'id',t.id,'branchId',t.branch_id,'petId',t.pet_id,
   'performedAt',t.performed_at,'procedure',t.procedure,
   'temperatureC',t.temperature_c,'weightKg',t.weight_kg,
   'comments',t.comments,'authoredBy',t.authored_by)
    order by t.performed_at desc,t.id desc),'[]'::jsonb) into v_items
  from (select c.id,c.branch_id,c.pet_id,c.performed_at,c.procedure,
    c.temperature_c,c.weight_kg,c.comments,c.authored_by
    from public.clinical_records c
    where c.branch_id=p_branch and c.pet_id=p_pet
      and (p_after_at is null or (c.performed_at,c.id)<(p_after_at,p_after_id))
    order by c.performed_at desc,c.id desc limit p_limit) t;
  if v_count>p_limit then
   select pg_catalog.jsonb_build_object('at',q.performed_at,'id',q.id)
    into v_next from (select c.performed_at,c.id from public.clinical_records c
    where c.branch_id=p_branch and c.pet_id=p_pet
      and (p_after_at is null or (c.performed_at,c.id)<(p_after_at,p_after_id))
    order by c.performed_at desc,c.id desc limit 1 offset p_limit-1) q;
  end if;
 else
  select count(*) into v_count from (
   select d.id from public.clinical_encounter_drafts d
   where d.branch_id=p_branch and d.pet_id=p_pet
    and (p_after_at is null or (d.updated_at,d.id)<(p_after_at,p_after_id))
   order by d.updated_at desc,d.id desc limit p_limit+1) page;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id',d.id,'appointmentId',d.appointment_id,'branchId',d.branch_id,
    'petId',d.pet_id,'authorId',d.author_id,'revision',d.revision,
    'status',d.status,'complaint',d.complaint,'examination',d.examination,
    'assessment',d.assessment,'plan',d.plan,
    'createdAt',d.created_at,'updatedAt',d.updated_at)
    order by d.updated_at desc,d.id desc),'[]'::jsonb) into v_items
  from (select * from public.clinical_encounter_drafts d
    where d.branch_id=p_branch and d.pet_id=p_pet
    and (p_after_at is null or (d.updated_at,d.id)<(p_after_at,p_after_id))
    order by d.updated_at desc,d.id desc limit p_limit) d;
  if v_count>p_limit then
   select pg_catalog.jsonb_build_object('at',q.updated_at,'id',q.id)
   into v_next from (select d.updated_at,d.id
     from public.clinical_encounter_drafts d
     where d.branch_id=p_branch and d.pet_id=p_pet
      and (p_after_at is null or (d.updated_at,d.id)<(p_after_at,p_after_id))
     order by d.updated_at desc,d.id desc limit 1 offset p_limit-1) q;
  end if;
 end if;
 return pg_catalog.jsonb_build_object('kind','ok','accountId',v_actor,
  'branchId',p_branch,'patient',v_patient,'section',p_section,
  'items',v_items,'nextCursor',v_next,'hasMore',v_count>p_limit);
end;
$read$;

create function public.save_staff_clinical_encounter_draft(
 p_branch uuid,p_pet uuid,p_appointment uuid,p_request_id uuid,
 p_expected_revision integer,p_complaint text,p_examination text,
 p_assessment text,p_plan text)
returns jsonb language plpgsql volatile security definer set search_path='' as $write$
declare v_actor uuid := auth.uid(); v_appointment public.appointments%rowtype;
 v_previous public.clinical_encounter_drafts%rowtype;
 v_role uuid; v_payload jsonb; v_existing clinic_private.clinical_draft_requests%rowtype;
 v_id uuid; v_revision integer; v_now timestamptz; v_response jsonb; v_action text;
begin
 if v_actor is null or not clinic_private.has_branch_role(p_branch,array['veterinarian']) then
  raise exception 'Clinician branch access denied' using errcode='42501';
 end if;
 if p_branch is null or p_pet is null or p_appointment is null
    or p_request_id is null or p_expected_revision is null
    or p_expected_revision<0 or p_expected_revision>=2147483647
    or p_complaint is null or length(btrim(p_complaint)) not between 1 and 4000
    or p_examination is null or length(p_examination)>4000
    or p_assessment is null or length(p_assessment)>4000
    or p_plan is null or length(p_plan)>4000 then
  raise exception 'Invalid clinical draft fields' using errcode='22023';
 end if;
 -- SQL-only short critical section serializes first-create, concurrent edits
 -- and UUID idempotency without trusting client-side version or branch metadata.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
   'dawney-clinical-encounter:'||p_appointment::text,0));
 -- Lock both live staff grants and Auth identity through commit; revocation
 -- cannot interleave between authorization and write.
 select bm.user_id into v_role from public.staff_branch_memberships bm
 join public.staff_memberships sm on sm.user_id=bm.user_id
 join auth.users u on u.id=sm.user_id
 where bm.user_id=v_actor and bm.branch_id=p_branch and bm.is_active
   and bm.role='veterinarian' and sm.is_active and sm.role=bm.role
   and u.email_confirmed_at is not null and not u.is_anonymous
   and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())
 for share of bm,sm,u;
 if v_role is null then
  raise exception 'Clinical role was revoked' using errcode='42501';
 end if;
 select a.* into v_appointment from public.appointments a
  join public.pets p on p.id=a.pet_id and p.owner_id=a.owner_id
  where a.id=p_appointment and a.branch_id=p_branch and a.pet_id=p_pet
  for share of a;
 if not found then
  raise exception 'Patient or appointment not available in branch'
  using errcode='42501';
 end if;
 v_payload:=pg_catalog.jsonb_build_object('branchId',p_branch,'petId',p_pet,
  'appointmentId',p_appointment,'expectedRevision',p_expected_revision,
  'complaint',btrim(p_complaint),'examination',p_examination,
  'assessment',p_assessment,'plan',p_plan);
 select * into v_existing from clinic_private.clinical_draft_requests
  where actor_id=v_actor and request_id=p_request_id;
 if found then
  if v_existing.payload is distinct from v_payload
   or v_existing.branch_id<>p_branch or v_existing.pet_id<>p_pet
   or v_existing.appointment_id<>p_appointment then
   raise exception 'Clinical nonce reused with changed payload'
    using errcode='23505';
  end if;
  return v_existing.response;
 end if;
 select * into v_previous from public.clinical_encounter_drafts
  where appointment_id=p_appointment for update;
 if found then
  if v_previous.branch_id<>p_branch or v_previous.pet_id<>p_pet
   or v_previous.revision<>p_expected_revision then
   raise exception 'Clinical revision conflict' using errcode='40001';
  end if;
  v_revision:=v_previous.revision+1;v_id:=v_previous.id;v_action:='revised';
  update public.clinical_encounter_drafts set
   revision=v_revision,complaint=btrim(p_complaint),
   examination=p_examination,assessment=p_assessment,plan=p_plan,
   updated_at=clock_timestamp()
   where id=v_id
   returning updated_at into v_now;
 else
  if p_expected_revision<>0 then
   raise exception 'Clinical revision conflict' using errcode='40001';
  end if;
  v_action:='created';
  insert into public.clinical_encounter_drafts
   (branch_id,pet_id,appointment_id,author_id,complaint,examination,assessment,plan)
   values(p_branch,p_pet,p_appointment,v_actor,btrim(p_complaint),
    p_examination,p_assessment,p_plan)
   returning id,revision,updated_at into v_id,v_revision,v_now;
 end if;
 -- Audits and idempotency response are atomic with the encounter revision.
 insert into clinic_private.clinical_draft_audit
  (draft_id,branch_id,pet_id,appointment_id,actor_id,request_id,revision,action,payload)
  values(v_id,p_branch,p_pet,p_appointment,v_actor,p_request_id,v_revision,v_action,v_payload);
 v_response:=pg_catalog.jsonb_build_object('kind','saved','id',v_id,
  'appointmentId',p_appointment,'branchId',p_branch,'petId',p_pet,
  'authorId',v_actor,'status','draft','revision',v_revision,'updatedAt',v_now);
 insert into clinic_private.clinical_draft_requests
  (actor_id,request_id,branch_id,pet_id,appointment_id,payload,response)
  values(v_actor,p_request_id,p_branch,p_pet,p_appointment,v_payload,v_response);
 return v_response;
end;
$write$;
revoke all on function public.read_staff_patient_chart(uuid,uuid,text,timestamptz,uuid,integer)
 from public,anon,authenticated;
grant execute on function public.read_staff_patient_chart(uuid,uuid,text,timestamptz,uuid,integer)
 to authenticated;
revoke all on function public.save_staff_clinical_encounter_draft(uuid,uuid,uuid,uuid,integer,text,text,text,text)
 from public,anon,authenticated;
grant execute on function public.save_staff_clinical_encounter_draft(uuid,uuid,uuid,uuid,integer,text,text,text,text)
 to authenticated;
commit;
