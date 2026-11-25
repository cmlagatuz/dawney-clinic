-- #23 SOURCE ONLY: clinical authorization alignment; preserve #1–22.
-- Stable read snapshot (#20); transaction-locked live session for mutations (#18).
begin;
create or replace function public.read_staff_patient_chart(
 p_branch uuid,p_pet uuid,p_section text default 'appointments',
 p_after_at timestamptz default null,p_after_id uuid default null,
 p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path='' as $read$
declare v_actor uuid := auth.uid();
 v_patient jsonb; v_items jsonb; v_next jsonb := null;
 v_count integer; v_allowed boolean;
begin
 if not clinic_private.operational_read_session_live() or v_actor is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
   or not clinic_private.has_branch_role(p_branch,
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
   select c.id from public.clinical_records c join clinic_private.clinical_record_provenance v on v.record_id=c.id and v.pet_id=c.pet_id and v.branch_id=c.branch_id
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
    from public.clinical_records c join clinic_private.clinical_record_provenance v on v.record_id=c.id and v.pet_id=c.pet_id and v.branch_id=c.branch_id
    where c.branch_id=p_branch and c.pet_id=p_pet
      and (p_after_at is null or (c.performed_at,c.id)<(p_after_at,p_after_id))
    order by c.performed_at desc,c.id desc limit p_limit) t;
  if v_count>p_limit then
   select pg_catalog.jsonb_build_object('at',q.performed_at,'id',q.id)
    into v_next from (select c.performed_at,c.id from public.clinical_records c join clinic_private.clinical_record_provenance v on v.record_id=c.id and v.pet_id=c.pet_id and v.branch_id=c.branch_id
    where c.branch_id=p_branch and c.pet_id=p_pet
      and (p_after_at is null or (c.performed_at,c.id)<(p_after_at,p_after_id))
    order by c.performed_at desc,c.id desc limit 1 offset p_limit-1) q;
  end if;
 else
  select count(*) into v_count from (
   select d.id from public.clinical_encounter_drafts d
   where d.branch_id=p_branch and d.pet_id=p_pet
    and (p_after_at is null or (d.created_at,d.id)<(p_after_at,p_after_id))
   order by d.created_at desc,d.id desc limit p_limit+1) page;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id',d.id,'appointmentId',d.appointment_id,'branchId',d.branch_id,
    'petId',d.pet_id,'authorId',d.author_id,'editorId',coalesce(d.last_edited_by,d.author_id),'revision',d.revision,
    'status',d.status,'complaint',d.complaint,'examination',d.examination,
    'assessment',d.assessment,'plan',d.plan,
    'createdAt',d.created_at,'updatedAt',d.updated_at)
    order by d.created_at desc,d.id desc),'[]'::jsonb) into v_items
  from (select * from public.clinical_encounter_drafts d
    where d.branch_id=p_branch and d.pet_id=p_pet
    and (p_after_at is null or (d.created_at,d.id)<(p_after_at,p_after_id))
    order by d.created_at desc,d.id desc limit p_limit) d;
  if v_count>p_limit then
   select pg_catalog.jsonb_build_object('at',q.created_at,'id',q.id)
   into v_next from (select d.created_at,d.id
     from public.clinical_encounter_drafts d
     where d.branch_id=p_branch and d.pet_id=p_pet
      and (p_after_at is null or (d.created_at,d.id)<(p_after_at,p_after_id))
     order by d.created_at desc,d.id desc limit 1 offset p_limit-1) q;
  end if;
 end if;
 return pg_catalog.jsonb_build_object('kind','ok','accountId',v_actor,
  'branchId',p_branch,'patient',v_patient,'section',p_section,
  'items',v_items,'nextCursor',v_next,'hasMore',v_count>p_limit);
end;
$read$;

create or replace function public.save_staff_clinical_encounter_draft(
 p_branch uuid,p_pet uuid,p_appointment uuid,p_request_id uuid,
 p_expected_revision integer,p_complaint text,p_examination text,
 p_assessment text,p_plan text)
returns jsonb language plpgsql volatile security definer set search_path='' as $write$
declare v_actor uuid := auth.uid(); v_appointment public.appointments%rowtype;
 v_previous public.clinical_encounter_drafts%rowtype;
 v_role uuid; v_payload jsonb; v_existing clinic_private.clinical_draft_requests%rowtype;
 v_id uuid; v_revision integer; v_now timestamptz; v_response jsonb; v_action text;
begin
 if (auth.jwt()->>'role') is distinct from 'authenticated' then
  raise exception 'Clinical access denied' using errcode='42501';
 end if;
 v_actor:=clinic_private.require_operational_actor();
 if v_actor is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
   or not clinic_private.has_branch_role(p_branch,array['veterinarian']) then
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
   and u.deleted_at is null and (u.banned_until is null or u.banned_until<=pg_catalog.clock_timestamp())
 for share of bm,sm,u;
 if v_role is null then
  raise exception 'Clinical role was revoked' using errcode='42501';
 end if;
 select a.* into v_appointment from public.appointments a
  join public.pets p on p.id=a.pet_id and p.owner_id=a.owner_id
  where a.id=p_appointment and a.branch_id=p_branch and a.pet_id=p_pet
  for share of a,p;
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
   revision=v_revision,last_edited_by=v_actor,complaint=btrim(p_complaint),
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
   (branch_id,pet_id,appointment_id,author_id,last_edited_by,complaint,examination,assessment,plan)
   values(p_branch,p_pet,p_appointment,v_actor,v_actor,btrim(p_complaint),
    p_examination,p_assessment,p_plan)
   returning id,revision,updated_at into v_id,v_revision,v_now;
 end if;
 -- Audits and idempotency response are atomic with the encounter revision.
 insert into clinic_private.clinical_draft_audit
  (draft_id,branch_id,pet_id,appointment_id,actor_id,request_id,revision,action,payload)
  values(v_id,p_branch,p_pet,p_appointment,v_actor,p_request_id,v_revision,v_action,v_payload);
 v_response:=pg_catalog.jsonb_build_object('kind','saved','id',v_id,
  'appointmentId',p_appointment,'branchId',p_branch,'petId',p_pet,
  'authorId',coalesce(v_previous.author_id,v_actor),'editorId',v_actor,'status','draft','revision',v_revision,'updatedAt',v_now);
 insert into clinic_private.clinical_draft_requests
  (actor_id,request_id,branch_id,pet_id,appointment_id,payload,response)
  values(v_actor,p_request_id,p_branch,p_pet,p_appointment,v_payload,v_response);
 return v_response;
end;
$write$;

create or replace function public.create_staff_appointment_clinical_record(
 p_appointment uuid,p_request_id uuid,p_procedure text,
 p_temperature_c numeric default null,p_weight_kg numeric default null,
 p_comments text default null)
returns jsonb language plpgsql volatile security definer set search_path='' as $rec$
declare v_actor uuid := auth.uid(); v_appt public.appointments%rowtype;
 v_staff uuid; v_payload jsonb; v_prior clinic_private.clinical_record_provenance%rowtype;
 v_id uuid; v_at timestamptz;
begin
 if (auth.jwt()->>'role') is distinct from 'authenticated' then
  raise exception 'Clinical access denied' using errcode='42501';
 end if;
 v_actor:=clinic_private.require_operational_actor();
 if v_actor is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
  raise exception 'Clinician identity denied' using errcode='42501'; end if;
 if p_appointment is null or p_request_id is null
 or p_procedure is null or length(btrim(p_procedure)) not between 1 and 500
 or (p_temperature_c is not null and (p_temperature_c<0 or p_temperature_c>60))
 or (p_weight_kg is not null and p_weight_kg<0)
 or (p_comments is not null and length(p_comments)>8000) then
  raise exception 'Invalid clinical record fields' using errcode='22023';end if;
 -- Serializes both identical and changed nonce submissions for this actor.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  'dawney-record:'||v_actor::text||':'||p_request_id::text,0));
 select a.* into v_appt from public.appointments a
  join public.pets p on p.id=a.pet_id and p.owner_id=a.owner_id
  where a.id=p_appointment for share of a,p;
 if not found or v_appt.branch_id is null
 then raise exception 'Unproven patient appointment' using errcode='42501';end if;
 if not clinic_private.has_branch_role(v_appt.branch_id,array['veterinarian']) then
  raise exception 'Clinician branch denied' using errcode='42501';end if;
 -- Hold branch/global staff and live Auth rows locked through the write.
 select bm.user_id into v_staff from public.staff_branch_memberships bm
 join public.staff_memberships sm on sm.user_id=bm.user_id
 join auth.users u on u.id=bm.user_id
 where bm.user_id=v_actor and bm.branch_id=v_appt.branch_id and bm.is_active
  and bm.role='veterinarian' and sm.is_active and sm.role=bm.role
  and u.email_confirmed_at is not null and not u.is_anonymous
  and u.deleted_at is null and (u.banned_until is null or u.banned_until<=pg_catalog.clock_timestamp())
 for share of bm,sm,u;
 if v_staff is null then raise exception 'Clinician role revoked' using errcode='42501';end if;
 v_payload:=pg_catalog.jsonb_build_object('appointmentId',p_appointment,
  'procedure',btrim(p_procedure),'temperatureC',p_temperature_c,
  'weightKg',p_weight_kg,'comments',p_comments);
 select * into v_prior from clinic_private.clinical_record_provenance
  where creator_id=v_actor and request_id=p_request_id;
 if found then
  if v_prior.payload is distinct from v_payload or v_prior.appointment_id<>p_appointment then
   raise exception 'Clinical record nonce changed' using errcode='23505';end if;
  select c.performed_at into v_at from public.clinical_records c where c.id=v_prior.record_id;
  return pg_catalog.jsonb_build_object('kind','saved','id',v_prior.record_id,
   'appointmentId',v_prior.appointment_id,'branchId',v_prior.branch_id,
   'petId',v_prior.pet_id,'authorId',v_prior.creator_id,'performedAt',v_at);
 end if;
 insert into public.clinical_records
  (pet_id,branch_id,procedure,temperature_c,weight_kg,comments,authored_by)
 values(v_appt.pet_id,v_appt.branch_id,btrim(p_procedure),
  p_temperature_c,p_weight_kg,p_comments,v_actor)
 returning id,performed_at into v_id,v_at;
 insert into clinic_private.clinical_record_provenance
  (record_id,appointment_id,branch_id,pet_id,creator_id,request_id,payload)
 values(v_id,v_appt.id,v_appt.branch_id,v_appt.pet_id,v_actor,p_request_id,v_payload);
 return pg_catalog.jsonb_build_object('kind','saved','id',v_id,
  'appointmentId',v_appt.id,'branchId',v_appt.branch_id,
  'petId',v_appt.pet_id,'authorId',v_actor,'performedAt',v_at);
end;
$rec$;

-- Restrictive predicates AND existing owner, branch and provenance rules.
-- No grant or permissive policy added. No effect on unrelated buckets.
create policy clinical23_live_clinical_records on public.clinical_records
 as restrictive for select to authenticated
 using ((select clinic_private.operational_read_session_live()));
create policy clinical23_live_clinical_encounter_drafts on public.clinical_encounter_drafts
 as restrictive for select to authenticated
 using ((select clinic_private.operational_read_session_live()));
create policy clinical23_live_branch_encounters on public.branch_encounters
 as restrictive for select to authenticated
 using ((select clinic_private.operational_read_session_live()));
create policy clinical23_live_branch_treatments on public.branch_treatments
 as restrictive for select to authenticated
 using ((select clinic_private.operational_read_session_live()));
create policy clinical23_live_pet_attachments on public.pet_attachments
 as restrictive for select to authenticated
 using ((select clinic_private.operational_read_session_live()));
create policy clinical23_live_attachment_insert on public.pet_attachments
 as restrictive for insert to authenticated
 with check ((select clinic_private.operational_read_session_live()));
create policy clinical23_live_storage_read on storage.objects
 as restrictive for select to authenticated
 using (bucket_id<>'clinical-attachments' or (select clinic_private.operational_read_session_live()));
create policy clinical23_live_storage_insert on storage.objects
 as restrictive for insert to authenticated
 with check (bucket_id<>'clinical-attachments' or (select clinic_private.operational_read_session_live()));
commit;
