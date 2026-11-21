-- DAWNEY #18 — self-service staff access approval; SOURCE ONLY / NEVER AUTO-APPLY.
-- Dependent on unchanged #1-#17, including branch membership guards.
-- No staff accounts, first administrator, branch grants or patient rows seeded.
begin;
set local search_path=public,pg_catalog;

-- Accountant is a NEW separate global/branch role, not an alias of administrator.
alter table public.staff_memberships drop constraint staff_memberships_role_check;
alter table public.staff_memberships add constraint staff_memberships_role_check
 check(role in ('receptionist','veterinarian','administrator','accountant'));
alter table public.staff_branch_memberships drop constraint staff_branch_memberships_role_check;
alter table public.staff_branch_memberships add constraint staff_branch_memberships_role_check
 check(role in ('receptionist','veterinarian','administrator','accountant'));

create table public.staff_access_requests (
 user_id uuid primary key references auth.users(id) on delete restrict,
 requested_branch_id uuid not null references public.clinic_branches(id) on delete restrict,
 note text check(note is null or length(note)<=500),
 state text not null default 'pending' check(state in ('pending','approved','rejected','inactive','revoked')),
 revision integer not null default 1 check(revision>0),
 requested_at timestamptz not null default clock_timestamp(),
 reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id) on delete restrict,
 updated_at timestamptz not null default clock_timestamp()
);
create index staff_access_by_branch_state
 on public.staff_access_requests(requested_branch_id,state,requested_at,user_id);
alter table public.staff_access_requests enable row level security;
revoke all on public.staff_access_requests from public,anon,authenticated;
grant select(user_id,requested_branch_id,state,revision,requested_at,reviewed_at)
 on public.staff_access_requests to authenticated;
create policy staff_request_owner_or_branch_admin on public.staff_access_requests
 for select to authenticated using(
  user_id=(select auth.uid())
  or clinic_private.has_branch_role(requested_branch_id,array['administrator'])
 );

create table clinic_private.staff_operation_events (
 id bigint generated always as identity primary key,
 actor_id uuid references auth.users(id) on delete restrict,
 target_id uuid not null references auth.users(id) on delete restrict,
 branch_id uuid references public.clinic_branches(id) on delete restrict,
 action text not null,
 old_state text,
 new_state text,
 old_role text,
 new_role text,
 request_id uuid,
 details jsonb not null default '{}'::jsonb,
 database_role text not null default current_user,
 created_at timestamptz not null default clock_timestamp()
);
create index staff_operation_target_history on clinic_private.staff_operation_events(target_id,created_at,id);
create table clinic_private.staff_review_receipts (
 actor_id uuid not null references auth.users(id) on delete restrict,
 nonce uuid not null,
 request_payload jsonb not null,
 response jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(actor_id,nonce)
);
alter table clinic_private.staff_operation_events enable row level security;
alter table clinic_private.staff_review_receipts enable row level security;
revoke all on clinic_private.staff_operation_events,clinic_private.staff_review_receipts
 from public,anon,authenticated;
revoke all on sequence clinic_private.staff_operation_events_id_seq
 from public,anon,authenticated;

-- Defense in depth: both private administrative journals are append-only.
create trigger staff_operation_events_append_only
 before update or delete on clinic_private.staff_operation_events
 for each row execute function clinic_private.block_inventory_ledger_rewrite();
create trigger staff_operation_events_no_truncate
 before truncate on clinic_private.staff_operation_events
 for each statement execute function clinic_private.block_inventory_ledger_rewrite();
create trigger staff_review_receipts_append_only
 before update or delete on clinic_private.staff_review_receipts
 for each row execute function clinic_private.block_inventory_ledger_rewrite();
create trigger staff_review_receipts_no_truncate
 before truncate on clinic_private.staff_review_receipts
 for each statement execute function clinic_private.block_inventory_ledger_rewrite();

-- Every branch-role grant/revoke, including owner-authorized SQL bootstrap,
-- is auditable regardless of which trusted path caused the write.
create function clinic_private.audit_staff_branch_grant()
returns trigger language plpgsql security invoker set search_path='' as $branch_audit$
begin
 if tg_op='UPDATE' and row(old.role,old.is_active,old.assigned_by)
   is not distinct from row(new.role,new.is_active,new.assigned_by) then
  return new;
 end if;
 insert into clinic_private.staff_operation_events
  (actor_id,target_id,branch_id,action,old_state,new_state,old_role,new_role,details)
 values ((select auth.uid()),
  case when tg_op='DELETE' then old.user_id else new.user_id end,
  case when tg_op='DELETE' then old.branch_id else new.branch_id end,
  'branch_'||lower(tg_op),
  case when tg_op='INSERT' then null else old.is_active::text end,
  case when tg_op='DELETE' then null else new.is_active::text end,
  case when tg_op='INSERT' then null else old.role end,
  case when tg_op='DELETE' then null else new.role end,
  pg_catalog.jsonb_build_object('authorizedBy',
   case when tg_op='DELETE' then old.assigned_by else new.assigned_by end));
 if tg_op='DELETE' then return old; end if;
 return new;
end;
$branch_audit$;
revoke all on function clinic_private.audit_staff_branch_grant()
 from public,anon,authenticated;
create trigger staff_branch_operational_audit
 after insert or update or delete on public.staff_branch_memberships
 for each row execute function clinic_private.audit_staff_branch_grant();

-- The SQL operator remains the ONLY way to bootstrap the first admin;
-- NEVER exposed as a browser RPC or invoked by a self-service request.
-- Require a real existing, unexpired Supabase Auth session on EACH new RPC.
-- PostgREST also validates JWT signature/expiry; this SQL gate additionally
-- rejects an explicitly deleted/revoked auth.sessions ID and stale privileges.
create function clinic_private.require_operational_actor()
returns uuid language plpgsql volatile security definer set search_path='' as $actor$
declare v_actor uuid := (select auth.uid());
 v_claims jsonb := (select auth.jwt()); v_sid text; v_session uuid;
begin
 if v_actor is null or v_claims->>'role'<>'authenticated'
  or coalesce((v_claims->>'is_anonymous')::boolean,false)
  or not clinic_private.is_permanent_user()
  or v_claims->>'exp' is null
  or pg_catalog.to_timestamp((v_claims->>'exp')::bigint)<=pg_catalog.clock_timestamp()
 then raise exception 'Verified active login required' using errcode='42501'; end if;
 v_sid:=v_claims->>'session_id';
 if v_sid is null or v_sid !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 then raise exception 'Live session required' using errcode='42501'; end if;
 v_session:=v_sid::uuid;
 -- Hold the live session row through commit; concurrent signout/revoke DELETE
 -- cannot race after this check into a privileged inventory/staff mutation.
 perform 1 from auth.sessions s where s.id=v_session and s.user_id=v_actor for share;
 if not found then
  raise exception 'Session no longer active' using errcode='42501'; end if;
 return v_actor;
end;
$actor$;
revoke all on function clinic_private.require_operational_actor() from public,anon,authenticated;

create function clinic_private.require_operational_admin(p_branch uuid)
returns uuid language plpgsql volatile security definer set search_path='' as $admin$
declare v_actor uuid;
begin
 v_actor:=clinic_private.require_operational_actor();
 if p_branch is null or
   not clinic_private.has_branch_role(p_branch,array['administrator'])
 then raise exception 'Branch administrator required' using errcode='42501'; end if;
 return v_actor;
end;
$admin$;
revoke all on function clinic_private.require_operational_admin(uuid)
 from public,anon,authenticated;

create function public.request_staff_access(p_branch uuid,p_note text default null)
returns jsonb language plpgsql volatile security definer set search_path='' as $request$
declare v_actor uuid; v_row public.staff_access_requests%rowtype;
begin
 v_actor:=clinic_private.require_operational_actor();
 if p_branch is null or not exists(select 1 from public.clinic_branches where id=p_branch)
  or p_note is not null and length(p_note)>500
 then raise exception 'Invalid staff access request' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('staff-request:'||v_actor::text,0));
 if exists(select 1 from public.staff_memberships m
  where m.user_id=v_actor and m.is_active)
 then raise exception 'Existing active staff cannot self-request elevation' using errcode='42501'; end if;
 select * into v_row from public.staff_access_requests where user_id=v_actor for update;
 if found then
  if v_row.state='pending' and v_row.requested_branch_id=p_branch then
   return pg_catalog.jsonb_build_object('kind','staff_request','state','pending',
     'revision',v_row.revision,'branchId',p_branch);
  end if;
  if v_row.state in ('approved','revoked') then
   raise exception 'Staff access requires administrator review' using errcode='42501';
  end if;
  update public.staff_access_requests set requested_branch_id=p_branch,note=p_note,
   state='pending',revision=revision+1,requested_at=clock_timestamp(),
   reviewed_at=null,reviewed_by=null,updated_at=clock_timestamp()
   where user_id=v_actor returning * into v_row;
 else
  insert into public.staff_access_requests(user_id,requested_branch_id,note)
   values(v_actor,p_branch,p_note) returning * into v_row;
 end if;
 insert into clinic_private.staff_operation_events
  (actor_id,target_id,branch_id,action,new_state)
 values(v_actor,v_actor,p_branch,'request','pending');
 return pg_catalog.jsonb_build_object('kind','staff_request','state',v_row.state,
    'revision',v_row.revision,'branchId',v_row.requested_branch_id);
end;
$request$;

create function public.get_my_staff_access()
returns jsonb language plpgsql volatile security definer set search_path='' as $mine$
declare v_actor uuid; v_status text; v_role text; v_branches jsonb;
begin
 v_actor:=clinic_private.require_operational_actor();
 select state into v_status from public.staff_access_requests where user_id=v_actor;
 select role into v_role from public.staff_memberships
  where user_id=v_actor and is_active;
 select coalesce(pg_catalog.jsonb_agg(b.branch_id order by b.branch_id),'[]'::jsonb)
 into v_branches from public.staff_branch_memberships b
 where b.user_id=v_actor and b.is_active and b.role=v_role
  and clinic_private.has_branch_role(b.branch_id,array[v_role]);
 return pg_catalog.jsonb_build_object('kind','my_staff_access',
  'state',coalesce(v_status,'none'),'role',v_role,
  'branches',v_branches);
end;
$mine$;

create function public.list_staff_access_requests(p_branch uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $list$
declare v_actor uuid; v_items jsonb;
begin
 v_actor:=clinic_private.require_operational_admin(p_branch);
 select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'userId',q.user_id,'requestedBranchId',q.requested_branch_id,
   'state',q.state,'revision',q.revision,
   'requestedAt',q.requested_at,'reviewedAt',q.reviewed_at)
   order by q.requested_at,q.user_id),'[]'::jsonb)
 into v_items from public.staff_access_requests q
 where q.requested_branch_id=p_branch;
 return pg_catalog.jsonb_build_object('kind','staff_requests',
   'branchId',p_branch,'items',v_items);
end;
$list$;

create function public.review_staff_access(
 p_target uuid,p_action text,p_role text,p_branches uuid[],
 p_expected_revision integer,p_request_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $review$
declare v_actor uuid; v_branch uuid; v_req public.staff_access_requests%rowtype;
 v_old_role text; v_new_state text; v_effective_role text;
 v_payload jsonb; v_response jsonb; v_prior clinic_private.staff_review_receipts%rowtype;
 v_branches uuid[]; v_existing uuid;
begin
 v_actor:=clinic_private.require_operational_actor();
 if p_target=v_actor then
  raise exception 'Administrator cannot approve or change own access' using errcode='42501'; end if;
 if p_target is null or p_request_id is null
  or p_expected_revision is null or p_expected_revision<1
  or p_action is null or p_action not in ('approve','reject','inactivate','revoke','role_change')
 then raise exception 'Invalid staff review action' using errcode='22023'; end if;
 v_branches:=coalesce(p_branches,array[]::uuid[]);
 if pg_catalog.cardinality(v_branches)>32 then
  raise exception 'Too many target branches' using errcode='22023'; end if;
 if p_action in ('approve','role_change') then
  if p_role is null or p_role not in ('administrator','veterinarian','receptionist','accountant')
   or pg_catalog.cardinality(v_branches)=0
   or exists(select 1 from pg_catalog.unnest(v_branches) x
      where x is null)
   or pg_catalog.cardinality(v_branches)<>(select count(distinct x) from pg_catalog.unnest(v_branches) x)
  then raise exception 'Role or branches invalid' using errcode='22023'; end if;
 else
  if pg_catalog.cardinality(v_branches)<>0 or p_role is not null then
   raise exception 'This review action cannot grant a role or branch' using errcode='22023'; end if;
 end if;
 -- Current grant scope checked BEFORE idempotent replay; revoked reviewer cannot replay.
 perform pg_catalog.pg_advisory_xact_lock(20261113,1);
 select * into v_req from public.staff_access_requests
  where user_id=p_target for update;
 if not found then raise exception 'Staff request unavailable' using errcode='42501'; end if;
 v_actor:=clinic_private.require_operational_admin(v_req.requested_branch_id);
 for v_existing in select b.branch_id from public.staff_branch_memberships b
   where b.user_id=p_target loop
  perform clinic_private.require_operational_admin(v_existing);
 end loop;
 foreach v_branch in array v_branches loop
  perform clinic_private.require_operational_admin(v_branch);
 end loop;
 v_payload:=pg_catalog.jsonb_build_object('target',p_target,'action',p_action,
   'role',p_role,'branches',v_branches,'expectedRevision',p_expected_revision);
 select * into v_prior from clinic_private.staff_review_receipts
  where actor_id=v_actor and nonce=p_request_id;
 if found then
  if v_prior.request_payload is distinct from v_payload then
   raise exception 'Staff review nonce reused' using errcode='23505'; end if;
  return v_prior.response;
 end if;
 if v_req.revision<>p_expected_revision then
  raise exception 'Stale staff request revision' using errcode='40001'; end if;
 if p_action='approve' and v_req.state<>'pending'
  or p_action='reject' and v_req.state<>'pending'
  or p_action='role_change' and v_req.state<>'approved'
  or p_action='inactivate' and v_req.state<>'approved'
  or p_action='revoke' and v_req.state not in ('approved','inactive')
 then raise exception 'Invalid staff state transition' using errcode='23514'; end if;
 if p_action in ('approve','role_change') and not exists(
  select 1 from auth.users u where u.id=p_target
   and u.email_confirmed_at is not null and not u.is_anonymous
   and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now()))
 then raise exception 'Staff account must be verified' using errcode='42501'; end if;
 select role into v_old_role from public.staff_memberships where user_id=p_target;
 if p_action in ('approve','role_change') then
  insert into public.staff_memberships(user_id,role,is_active,assigned_by)
   values(p_target,p_role,true,v_actor)
   on conflict(user_id) do update
    set role=excluded.role,is_active=true,assigned_by=v_actor,assigned_at=clock_timestamp();
  -- Any branch removed from the new set is deactivated, never silently reassigned.
  update public.staff_branch_memberships b set is_active=false,assigned_by=v_actor,
    assigned_at=clock_timestamp()
   where b.user_id=p_target and b.is_active
    and not (b.branch_id=any(v_branches));
  foreach v_branch in array v_branches loop
   insert into public.staff_branch_memberships(user_id,branch_id,role,is_active,assigned_by)
    values(p_target,v_branch,p_role,true,v_actor)
    on conflict(user_id,branch_id) do update
     set role=excluded.role,is_active=true,assigned_by=v_actor,assigned_at=clock_timestamp();
  end loop;
  v_new_state:='approved';
 elsif p_action in ('inactivate','revoke') then
  update public.staff_memberships set is_active=false,assigned_by=v_actor,
   assigned_at=clock_timestamp() where user_id=p_target;
  update public.staff_branch_memberships set is_active=false,assigned_by=v_actor,
   assigned_at=clock_timestamp() where user_id=p_target and is_active;
  v_new_state:=case when p_action='revoke' then 'revoked' else 'inactive' end;
 else
  v_new_state:='rejected';
 end if;
 update public.staff_access_requests set state=v_new_state,
   revision=revision+1,reviewed_by=v_actor,reviewed_at=clock_timestamp(),
   updated_at=clock_timestamp()
 where user_id=p_target returning * into v_req;
 select role into v_effective_role from public.staff_memberships
   where user_id=p_target and is_active;
 select coalesce(pg_catalog.jsonb_agg(b.branch_id order by b.branch_id),'[]'::jsonb)
  into v_response from public.staff_branch_memberships b
  where b.user_id=p_target and b.is_active;
 v_response:=pg_catalog.jsonb_build_object('kind','staff_review','userId',p_target,
  'state',v_new_state,'role',v_effective_role,
  'branches',v_response,'revision',v_req.revision);
 insert into clinic_private.staff_operation_events
  (actor_id,target_id,branch_id,action,old_state,new_state,old_role,new_role,request_id)
 values(v_actor,p_target,v_req.requested_branch_id,p_action,
  case when p_action='approve' then 'pending' else
   case when p_action='role_change' or p_action='inactivate' then 'approved'
   when p_action='revoke' then 'approved_or_inactive' else 'pending' end end,
  v_new_state,v_old_role,v_effective_role,p_request_id);
 insert into clinic_private.staff_review_receipts(actor_id,nonce,request_payload,response)
  values(v_actor,p_request_id,v_payload,v_response);
 return v_response;
end;
$review$;

revoke all on function public.request_staff_access(uuid,text),
 public.get_my_staff_access(),public.list_staff_access_requests(uuid),
 public.review_staff_access(uuid,text,text,uuid[],integer,uuid)
 from public,anon,authenticated;
grant execute on function public.request_staff_access(uuid,text),
 public.get_my_staff_access(),public.list_staff_access_requests(uuid),
 public.review_staff_access(uuid,text,text,uuid[],integer,uuid)
 to authenticated;
commit;
