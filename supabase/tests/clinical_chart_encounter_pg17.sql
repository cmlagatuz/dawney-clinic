-- Synthetic-only PG17 clinical #16 regression. No hosted connection.
\set ON_ERROR_STOP on
begin;
set search_path=public,extensions,pg_catalog;
do $integrity$
begin
 if (select count(*) from public.pets where id='33333333-3333-4333-8333-333333333333'
  and species='Dog' and breed='Chow Chow' and breed_id='dog-chow-chow')<>1
 or (select count(*) from public.appointments where id='55555555-5555-4555-8555-555555555555'
  and status='requested' and branch_id is null)<>1 then
  raise exception 'CLINICAL16_FAIL historical Dog/Chow Chow was altered'; end if;
 if has_table_privilege('authenticated','public.clinical_encounter_drafts','SELECT')
 or has_table_privilege('authenticated','public.clinical_encounter_drafts','INSERT')
 or has_table_privilege('authenticated','public.clinical_encounter_drafts','UPDATE')
 or has_table_privilege('authenticated','clinic_private.clinical_draft_audit','SELECT')
 or has_function_privilege('anon',
  'public.read_staff_patient_chart(uuid,uuid,text,timestamptz,uuid,integer)','EXECUTE')
 or has_function_privilege('anon',
  'public.save_staff_clinical_encounter_draft(uuid,uuid,uuid,uuid,integer,text,text,text,text)','EXECUTE')
 or (select count(*) from public.clinical_encounter_drafts)<>0
 or (select count(*) from clinic_private.clinical_draft_audit)<>0 then
   raise exception 'CLINICAL16_FAIL unexpected grants or seeded clinical drafts';end if;
end $integrity$;

-- Only synthetic fixture rows for 50/51 page and two-branch crossovers.
insert into public.clinical_records(pet_id,branch_id,procedure,authored_by,performed_at)
select '33333333-3333-4333-8333-333333333333',
 '11111111-0000-4000-8000-000000000077',
 'CLINICAL16 synthetic Naga medical entry '||n,
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',now()+n*interval '1 second'
from generate_series(1,51) n;
-- Unknown-branch legacy row was seeded BEFORE #12; no unsafe backfill here.
-- Explicit Naga receptionist and admin grants, synthetic fixture ONLY.
insert into public.staff_branch_memberships(user_id,branch_id,role,is_active)
values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
 '11111111-0000-4000-8000-000000000077','receptionist',true),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
 '11111111-0000-4000-8000-000000000077','administrator',true)
on conflict(user_id,branch_id) do update set is_active=true,role=excluded.role;

set role authenticated;
set request.jwt.claim.sub='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false}';
do $vet_read$
declare a jsonb;b jsonb;c jsonb;d jsonb;e jsonb; v_at timestamptz;v_id uuid;
begin
 a:=public.read_staff_patient_chart(
  '11111111-0000-4000-8000-000000000077',
  '33333333-3333-4333-8333-333333333333','appointments',null,null,50);
 if a->>'kind'<>'ok' or a->>'hasMore'<>'true'
 or jsonb_array_length(a->'items')<>50
 or a->'patient'->>'breed'<>'Chow Chow' then
  raise exception 'CLINICAL16_FAIL first 50 patient page'; end if;
 v_at:=(a->'nextCursor'->>'at')::timestamptz;
 v_id:=(a->'nextCursor'->>'id')::uuid;
 b:=public.read_staff_patient_chart(
  '11111111-0000-4000-8000-000000000077',
  '33333333-3333-4333-8333-333333333333','appointments',v_at,v_id,50);
 if b->>'kind'<>'ok' or jsonb_array_length(b->'items')<>50
 or exists(select 1 from jsonb_array_elements(b->'items') as page_item(value)
  where page_item.value->>'branchId'<>'11111111-0000-4000-8000-000000000077') then
  raise exception 'CLINICAL16_FAIL 50/51 stable branch pagination';end if;
 c:=public.read_staff_patient_chart(
  '11111111-0000-4000-8000-000000000077',
  '33333333-3333-4333-8333-333333333333','appointments',null,null,1);
 if jsonb_array_length(c->'items')<>1 or c->>'hasMore'<>'true' then
  raise exception 'CLINICAL16_FAIL 1-row cursor';end if;
 d:=public.read_staff_patient_chart(
  '11111111-0000-4000-8000-000000000077',
  '33333333-3333-4333-8333-333333333333','records',null,null,50);
 if jsonb_array_length(d->'items')<>50 or d->>'hasMore'<>'true'
 or (d->'items')::text like '%old unknown branch record%' then
  raise exception 'CLINICAL16_FAIL 50/51 medical page/legacy privacy';end if;
 e:=public.read_staff_patient_chart(
  '11111111-0000-4000-8000-000000000077',
  '44444444-4444-4444-8444-444444444444','records',null,null,50);
 if e->>'kind'<>'not_found' then
  raise exception 'CLINICAL16_FAIL guessed unrelated patient';end if;
 if public.read_staff_patient_chart(
  '11111111-0000-4000-8000-000000000077',
  '33333333-3333-4333-8333-333333333333','drafts',null,null,50)->>'hasMore'<>'false'
 then raise exception 'CLINICAL16_FAIL unexpected draft';end if;
 begin
  perform public.read_staff_patient_chart(
   '11111111-0000-4000-8000-000000000077',
   '33333333-3333-4333-8333-333333333333','records',null,null,51);
  raise exception 'CLINICAL16_FAIL limit 51 accepted';
 exception when invalid_parameter_value then null;end;
 begin
  perform public.read_staff_patient_chart(
   '22222222-0000-4000-8000-000000000077',
   '33333333-3333-4333-8333-333333333333','appointments',null,null,50);
  raise exception 'CLINICAL16_FAIL unauthorized Cavite read';
 exception when insufficient_privilege then null;end;
end $vet_read$;
do $writes$
declare n uuid:='a1111111-2222-4222-8222-333333333333';n2 uuid:='b1111111-2222-4222-8222-333333333333';
 a jsonb;b jsonb;c jsonb;d jsonb;
begin
 a:=public.save_staff_clinical_encounter_draft(
  '11111111-0000-4000-8000-000000000077',
  '33333333-3333-4333-8333-333333333333',
  'aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa',n,0,
  'Synthetic transient cough','Normal exam','Observe','Recheck');
 b:=public.save_staff_clinical_encounter_draft(
  '11111111-0000-4000-8000-000000000077',
  '33333333-3333-4333-8333-333333333333',
  'aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa',n,0,
  'Synthetic transient cough','Normal exam','Observe','Recheck');
 if a is distinct from b or a->>'kind'<>'saved' or (a->>'revision')::integer<>1
  or a->>'authorId'<>'dddddddd-dddd-4ddd-8ddd-dddddddddddd' then
  raise exception 'CLINICAL16_FAIL UUID idempotency';end if;
 begin
  perform public.save_staff_clinical_encounter_draft(
  '11111111-0000-4000-8000-000000000077',
  '33333333-3333-4333-8333-333333333333',
  'aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa',n,0,
  'Changed payload','Normal exam','Observe','Recheck');
  raise exception 'CLINICAL16_FAIL changed nonce accepted';
 exception when unique_violation then null;end;
 begin
  perform public.save_staff_clinical_encounter_draft(
  '11111111-0000-4000-8000-000000000077',
  '33333333-3333-4333-8333-333333333333',
  'aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa',n2,0,
  'Stale edit','Normal exam','Observe','Recheck');
  raise exception 'CLINICAL16_FAIL stale revision accepted';
 exception when serialization_failure then null;end;
 begin
  perform public.save_staff_clinical_encounter_draft(
  '11111111-0000-4000-8000-000000000077',
  '33333333-3333-4333-8333-333333333333',
  'bbbbbbbb-7777-4777-8777-bbbbbbbbbbbb',n2,0,
  'Wrong branch appointment','Normal exam','Observe','Recheck');
  raise exception 'CLINICAL16_FAIL wrong-branch appointment accepted';
 exception when insufficient_privilege then null;end;
 begin
  perform public.save_staff_clinical_encounter_draft(
  '11111111-0000-4000-8000-000000000077',
  '44444444-4444-4444-8444-444444444444',
  'aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa',n2,0,
  'Wrong patient','Normal exam','Observe','Recheck');
  raise exception 'CLINICAL16_FAIL wrong-pet appointment accepted';
 exception when insufficient_privilege then null;end;
 begin
  perform public.save_staff_clinical_encounter_draft(
  '11111111-0000-4000-8000-000000000077',
  '33333333-3333-4333-8333-333333333333',
  'aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa',n2,1,
  '',repeat('A',5000),'','');
  raise exception 'CLINICAL16_FAIL malicious fields accepted';
 exception when invalid_parameter_value then null;end;
 c:=public.save_staff_clinical_encounter_draft(
  '11111111-0000-4000-8000-000000000077',
  '33333333-3333-4333-8333-333333333333',
  'aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa',n2,1,
  'Follow-up synthetic','Assessment details','No diagnostics','Review later');
 if (c->>'revision')::integer<>2 then
  raise exception 'CLINICAL16_FAIL second revision not persisted';end if;
 d:=public.read_staff_patient_chart(
  '11111111-0000-4000-8000-000000000077',
  '33333333-3333-4333-8333-333333333333','drafts',null,null,50);
 if jsonb_array_length(d->'items')<>1 or d->'items'->0->>'complaint'<>'Follow-up synthetic'
   or (d->'items'->0->>'revision')::integer<>2 then
  raise exception 'CLINICAL16_FAIL persisted draft read';end if;
end $writes$;
reset role;

do $audit$
begin
 if (select count(*) from clinic_private.clinical_draft_requests)<>2
 or (select count(*) from clinic_private.clinical_draft_audit)<>2
 or (select count(distinct revision) from clinic_private.clinical_draft_audit)<>2
 or (select count(*) from public.clinical_encounter_drafts where revision=2 and status='draft')<>1
 then raise exception 'CLINICAL16_FAIL durable audit/replay cardinality';end if;
 begin
  update clinic_private.clinical_draft_audit set action='revised';
  raise exception 'CLINICAL16_FAIL audit was mutable';
 exception when insufficient_privilege then null;end;
end $audit$;

set role authenticated;
set request.jwt.claim.sub='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false}';
do $receptionist$
declare a jsonb;
begin
 a:=public.read_staff_patient_chart(
 '11111111-0000-4000-8000-000000000077',
 '33333333-3333-4333-8333-333333333333','appointments',null,null,2);
 if a->>'kind'<>'ok' then raise exception 'CLINICAL16_FAIL receptionist appointment read';end if;
 begin
  perform public.read_staff_patient_chart(
   '11111111-0000-4000-8000-000000000077',
   '33333333-3333-4333-8333-333333333333','records',null,null,2);
  raise exception 'CLINICAL16_FAIL receptionist clinical details leaked';
 exception when insufficient_privilege then null;end;
 begin
  perform public.save_staff_clinical_encounter_draft(
   '11111111-0000-4000-8000-000000000077',
   '33333333-3333-4333-8333-333333333333',
   'aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa',
   gen_random_uuid(),2,'Unauthorized','', '', '');
  raise exception 'CLINICAL16_FAIL receptionist wrote clinical note';
 exception when insufficient_privilege then null;end;
end $receptionist$;
reset role;

set role authenticated;
set request.jwt.claim.sub='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false}';
do $admin$
begin
 if public.read_staff_patient_chart('11111111-0000-4000-8000-000000000077',
  '33333333-3333-4333-8333-333333333333','drafts',null,null,1)->>'kind'<>'ok'
 then raise exception 'CLINICAL16_FAIL authorized admin review';end if;
 begin
  perform public.save_staff_clinical_encounter_draft(
   '11111111-0000-4000-8000-000000000077',
   '33333333-3333-4333-8333-333333333333',
   'aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa',gen_random_uuid(),2,
   'Admin is not treating vet','','','');
  raise exception 'CLINICAL16_FAIL administrator wrote vet note';
 exception when insufficient_privilege then null;end;
end $admin$;
reset role;

set role authenticated;
set request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false}';
do $owner$
begin
 begin
  perform public.read_staff_patient_chart('11111111-0000-4000-8000-000000000077',
   '33333333-3333-4333-8333-333333333333','appointments',null,null,1);
  raise exception 'CLINICAL16_FAIL owner can call staff chart';
 exception when insufficient_privilege then null;end;
end $owner$;
reset role;

set role authenticated;
set request.jwt.claim.sub='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
set request.jwt.claims='{"role":"authenticated","is_anonymous":true}';
do $anonymous$
begin
 begin
  perform public.read_staff_patient_chart('11111111-0000-4000-8000-000000000077',
   '33333333-3333-4333-8333-333333333333','records',null,null,1);
  raise exception 'CLINICAL16_FAIL anonymous with staff UID can access';
 exception when insufficient_privilege then null;end;
end $anonymous$;
reset role;

-- Revoke genuine vet, then even same UUID idempotent replay MUST fail closed.
update public.staff_branch_memberships set is_active=false
 where user_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
 and branch_id='11111111-0000-4000-8000-000000000077';
set role authenticated;
set request.jwt.claim.sub='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false}';
do $revoked$
begin
 begin
  perform public.save_staff_clinical_encounter_draft(
   '11111111-0000-4000-8000-000000000077',
   '33333333-3333-4333-8333-333333333333',
   'aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa',
   'a1111111-2222-4222-8222-333333333333',0,
   'Synthetic transient cough','Normal exam','Observe','Recheck');
  raise exception 'CLINICAL16_FAIL revoked clinician replay';
 exception when insufficient_privilege then null;end;
 begin
  perform public.read_staff_patient_chart('11111111-0000-4000-8000-000000000077',
   '33333333-3333-4333-8333-333333333333','drafts',null,null,1);
  raise exception 'CLINICAL16_FAIL revoked clinician read';
 exception when insufficient_privilege then null;end;
end $revoked$;
reset role;
do $final$
begin
 if (select count(*) from clinic_private.clinical_draft_audit)<>2
 or (select count(*) from public.clinical_encounter_drafts)<>1
 or exists(select 1 from public.clinical_encounter_drafts
  where status<>'draft') then
  raise exception 'CLINICAL16_FAIL failure broke rollback/audit integrity';end if;
 if (select count(*) from public.pets where id='33333333-3333-4333-8333-333333333333'
  and species='Dog' and breed='Chow Chow')<>1
 or (select count(*) from public.appointments where id='55555555-5555-4555-8555-555555555555'
 and branch_id is null and status='requested')<>1 then
  raise exception 'CLINICAL16_FAIL historical preservation';end if;
end $final$;
rollback;
\echo 'PASS: CLINICAL16 real PG17 50/51+251 pagination, branch/patient/role denials, nonce/stale-revision, audit rollback, history unchanged'
