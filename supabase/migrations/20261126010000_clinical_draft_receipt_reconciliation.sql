-- #22: SOURCE ONLY. Read-only reconciliation; no new clinical mutation or data.
begin;
create function public.reconcile_staff_clinical_draft(
 p_branch uuid,p_pet uuid,p_appointment uuid,
 p_request_id uuid default null,p_before_revision integer default null)
returns jsonb language plpgsql volatile security definer set search_path='' as $receipt$
declare
 v_actor uuid; v_draft public.clinical_encounter_drafts%rowtype;
 v_audit clinic_private.clinical_draft_audit%rowtype;
 v_request clinic_private.clinical_draft_requests%rowtype;
 v_context jsonb; v_revision integer; v_audits bigint; v_requests bigint;
begin
 -- Existing live-session gate locks the current Auth session through commit.
 if (auth.jwt()->>'role') is distinct from 'authenticated' then
  raise exception 'Clinical receipt access denied' using errcode='42501';
 end if;
 v_actor:=clinic_private.require_operational_actor();
 if p_branch is null or p_pet is null or p_appointment is null
  or (p_before_revision is not null and p_before_revision<1)
  or (p_request_id is not null and p_before_revision is not null) then
  raise exception 'Invalid clinical receipt scope' using errcode='22023';
 end if;
 -- Only the current, active veterinarian may recover THEIR OWN requests.
 perform 1 from public.staff_branch_memberships bm
 join public.staff_memberships sm on sm.user_id=bm.user_id
 join auth.users u on u.id=sm.user_id
 where bm.user_id=v_actor and bm.branch_id=p_branch and bm.is_active
  and bm.role='veterinarian' and sm.is_active and sm.role=bm.role
  and u.email_confirmed_at is not null and not u.is_anonymous
  and u.deleted_at is null and (u.banned_until is null or u.banned_until<=pg_catalog.clock_timestamp())
 for share of bm,sm,u;
 if not found then raise exception 'Clinical receipt access denied' using errcode='42501'; end if;
 perform 1 from public.appointments a
 join public.pets p on p.id=a.pet_id and p.owner_id=a.owner_id
 where a.id=p_appointment and a.branch_id=p_branch and a.pet_id=p_pet
 for share of a,p;
 if not found then raise exception 'Clinical receipt access denied' using errcode='42501'; end if;
 v_context:=pg_catalog.jsonb_build_object('accountId',v_actor,'branchId',p_branch,
  'petId',p_pet,'appointmentId',p_appointment,'requestId',p_request_id,
  'beforeRevision',p_before_revision);
 -- Same transaction-scoped visit lock as #17 writer. Never wait for a save
 -- while holding staff/session locks. No lock -> no authoritative observation.
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(
  'dawney-clinical-encounter:'||p_appointment::text,0)) then
  return v_context||pg_catalog.jsonb_build_object('kind','unknown','reason','visit_busy',
    'currentRevision',null,'draftId',null,'receipt',null);
 end if;
 select * into v_draft from public.clinical_encounter_drafts d
  where d.appointment_id=p_appointment and d.branch_id=p_branch and d.pet_id=p_pet;
 v_revision:=coalesce(v_draft.revision,0);
 -- Select from the immutable audit, with exact actor AND exact visit predicates.
 -- Discovery returns one receipt per page, descending immutable revision.
 select * into v_audit from clinic_private.clinical_draft_audit a
  where a.actor_id=v_actor and a.branch_id=p_branch and a.pet_id=p_pet
   and a.appointment_id=p_appointment
   and (p_request_id is null or a.request_id=p_request_id)
   and (p_before_revision is null or a.revision<p_before_revision)
  order by a.revision desc limit 1;
 -- Check journal cardinality in this authorized visit; mismatches are not absence.
 select count(*) into v_audits from clinic_private.clinical_draft_audit a
  where a.actor_id=v_actor and a.branch_id=p_branch and a.pet_id=p_pet
   and a.appointment_id=p_appointment;
 select count(*) into v_requests from clinic_private.clinical_draft_requests q
  where q.actor_id=v_actor and q.branch_id=p_branch and q.pet_id=p_pet
   and q.appointment_id=p_appointment;
 if v_audits<>v_requests or (v_audits>0 and v_draft.id is null)
  or (v_audit.event_id is null and p_request_id is not null and exists(
   select 1 from clinic_private.clinical_draft_requests q
   where q.actor_id=v_actor and q.branch_id=p_branch and q.pet_id=p_pet
    and q.appointment_id=p_appointment and q.request_id=p_request_id)) then
  return v_context||pg_catalog.jsonb_build_object('kind','unknown','reason','receipt_unverified',
    'currentRevision',null,'draftId',null,'receipt',null);
 end if;
 if v_audit.event_id is null then
  return v_context||pg_catalog.jsonb_build_object('kind','not_found','currentRevision',v_revision,
   'draftId',v_draft.id,'receipt',null);
 end if;
 select * into v_request from clinic_private.clinical_draft_requests q
  where q.actor_id=v_actor and q.request_id=v_audit.request_id
   and q.branch_id=p_branch and q.pet_id=p_pet and q.appointment_id=p_appointment;
 if not found or v_audit.draft_id is distinct from v_draft.id
  or v_audit.revision>v_revision
  or v_request.payload is distinct from v_audit.payload
  or not coalesce(v_request.response @> pg_catalog.jsonb_build_object(
   'kind','saved','id',v_audit.draft_id,'branchId',p_branch,'petId',p_pet,
   'appointmentId',p_appointment,'status','draft','revision',v_audit.revision),false)
  or pg_catalog.jsonb_typeof(v_request.response->'updatedAt') is distinct from 'string' then
  return v_context||pg_catalog.jsonb_build_object('kind','unknown','reason','receipt_unverified',
    'currentRevision',null,'draftId',null,'receipt',null);
 end if;
 -- Do not return the request payload, full response, note text, other actors,
 -- or an enumerable global history. Read the actual chart separately.
 return v_context||pg_catalog.jsonb_build_object('kind','committed','currentRevision',v_revision,
  'draftId',v_draft.id,'receipt',pg_catalog.jsonb_build_object(
   'requestId',v_audit.request_id,'revision',v_audit.revision,
   'auditEventId',v_audit.event_id::text,'savedAt',v_request.response->'updatedAt'));
end;
$receipt$;
revoke all on function public.reconcile_staff_clinical_draft(uuid,uuid,uuid,uuid,integer)
 from public,anon,authenticated;
grant execute on function public.reconcile_staff_clinical_draft(uuid,uuid,uuid,uuid,integer)
 to authenticated;
commit;
