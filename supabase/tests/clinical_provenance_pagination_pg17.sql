-- DAWNEY #17 disposable PostgreSQL17: P2 provenance/pagination reproduction.
-- All fixture role/row changes are rolled back. Never connect to hosted Supabase.
\set ON_ERROR_STOP on
begin;
set search_path=public,extensions,pg_catalog;
-- Test-only trusted grants. Real clinical staff are NEVER created/activated by migration.
update public.staff_branch_memberships set is_active=true
 where user_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
 and branch_id in ('11111111-0000-4000-8000-000000000077',
 '22222222-0000-4000-8000-000000000077');
update public.staff_memberships set is_active=true
 where user_id='ffffffff-ffff-4fff-8fff-ffffffffffff';
update public.staff_branch_memberships set is_active=true
 where user_id='ffffffff-ffff-4fff-8fff-ffffffffffff'
 and branch_id='11111111-0000-4000-8000-000000000077';
do $perm$
begin
 if has_column_privilege('authenticated','public.clinical_records','branch_id','INSERT')
 or has_column_privilege('authenticated','public.clinical_records','procedure','INSERT')
 or has_table_privilege('authenticated','clinic_private.clinical_record_provenance','INSERT')
 or has_table_privilege('authenticated','clinic_private.clinical_record_provenance','SELECT')
 or has_function_privilege('anon',
   'public.create_staff_appointment_clinical_record(uuid,uuid,text,numeric,numeric,text)','EXECUTE')
 then raise exception 'CLINICAL17_FAIL direct clinical provenance or grants unsafe';end if;
end $perm$;

set role authenticated;
set request.jwt.claim.sub='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false}';
do $p2_provenance$
declare naga uuid:='11111111-0000-4000-8000-000000000077';
 cavite uuid:='22222222-0000-4000-8000-000000000077';
 pet uuid:='33333333-3333-4333-8333-333333333333';
 a jsonb; b jsonb; c jsonb; n uuid:='a1717171-1111-4111-8111-111111111111';
begin
 -- P2-01 exploit: even a legitimate dual-branch vet may not select any
 -- arbitrary branch ID through direct generic clinical_records INSERT.
 begin
  insert into public.clinical_records(pet_id,branch_id,procedure)
  values(pet,cavite,'MALICIOUS FALSE CAVITE ORIGIN');
  raise exception 'CLINICAL17_FAIL dual-branch doctor forged direct record';
 exception when insufficient_privilege then null;end;
 if exists(select 1 from public.clinical_records
   where procedure='MALICIOUS FALSE CAVITE ORIGIN') then
  raise exception 'CLINICAL17_FAIL forged record persisted';end if;
 a:=public.read_staff_patient_chart(naga,pet,'records',null,null,50);
 b:=public.read_staff_patient_chart(cavite,pet,'records',null,null,50);
 if jsonb_array_length(a->'items')<>0 or jsonb_array_length(b->'items')<>0 then
  raise exception 'CLINICAL17_FAIL unsigned legacy/branch-labeled records leaked';end if;
 c:=public.create_staff_appointment_clinical_record(
  'aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa',n,'NAGA VERIFIED EXAM',38.1,12.5,'synthetic');
 if c->>'branchId'<>naga::text or c->>'petId'<>pet::text
 or c->>'authorId'<>'dddddddd-dddd-4ddd-8ddd-dddddddddddd' then
  raise exception 'CLINICAL17_FAIL server-derived exact visit';end if;
 if public.create_staff_appointment_clinical_record(
  'aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa',n,'NAGA VERIFIED EXAM',38.1,12.5,'synthetic') is distinct from c
 then raise exception 'CLINICAL17_FAIL stable record nonce replay';end if;
 begin
  perform public.create_staff_appointment_clinical_record(
   'aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa',n,'CHANGED NONCE',38.1,12.5,'synthetic');
  raise exception 'CLINICAL17_FAIL changed-payload record replay';
 exception when unique_violation then null;end;
 begin
  perform public.create_staff_appointment_clinical_record(
   '55555555-5555-4555-8555-555555555555',gen_random_uuid(),'OLD UNKNOWN VISIT');
  raise exception 'CLINICAL17_FAIL historic null-branch provenance';
 exception when insufficient_privilege then null;end;
 if jsonb_array_length(public.read_staff_patient_chart(cavite,pet,'records',null,null,50)->'items')<>0
 then raise exception 'CLINICAL17_FAIL Naga record leaked into Cavite';end if;
 if jsonb_array_length(public.read_staff_patient_chart(naga,pet,'records',null,null,50)->'items')<>1
 then raise exception 'CLINICAL17_FAIL proven Naga record absent';end if;
 c:=public.create_staff_appointment_clinical_record(
  'bbbbbbbb-7777-4777-8777-bbbbbbbbbbbb',gen_random_uuid(),
  'CAVITE VERIFIED EXAM',38.2,11.5,null);
 if c->>'branchId'<>cavite::text then
  raise exception 'CLINICAL17_FAIL Cavite provenance';end if;
 if jsonb_array_length(public.read_staff_patient_chart(naga,pet,'records',null,null,50)->'items')<>1
 or jsonb_array_length(public.read_staff_patient_chart(cavite,pet,'records',null,null,50)->'items')<>1
 then raise exception 'CLINICAL17_FAIL cross-branch history isolation';end if;
 -- Real 50/51 pagination for only exact-provenance medical entries, with
 -- inherited untrusted rows excluded even if their branch label matches.
 for i in 1..50 loop
  perform public.create_staff_appointment_clinical_record(
   'aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa',gen_random_uuid(),
   'SYNTHETIC VERIFIED '||i::text,null,null,null);
 end loop;
 a:=public.read_staff_patient_chart(naga,pet,'records',null,null,50);
 if jsonb_array_length(a->'items')<>50 or a->>'hasMore'<>'true' then
  raise exception 'CLINICAL17_FAIL medical history first 50';end if;
 b:=public.read_staff_patient_chart(naga,pet,'records',
  (a->'nextCursor'->>'at')::timestamptz,(a->'nextCursor'->>'id')::uuid,50);
 if jsonb_array_length(b->'items')<>1 or b->>'hasMore'<>'false' then
  raise exception 'CLINICAL17_FAIL medical history 51st row';end if;
end $p2_provenance$;
reset role;

-- P2-02 reproduction: B is an unseen older created draft. Revise it
-- between pages so updated_at jumps above A, but created_at remains fixed.
set role authenticated;
set request.jwt.claim.sub='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false}';
do $setup$
declare pet uuid:='33333333-3333-4333-8333-333333333333';
 branch uuid:='11111111-0000-4000-8000-000000000077';
 b_appointment uuid;
 b jsonb; a jsonb;
begin
 select id into b_appointment from public.appointments
 where branch_id=branch and pet_id=pet and concern='CI synthetic Naga queue'
 order by id limit 1;
 if b_appointment is null then raise exception 'CLINICAL17_FAIL missing second appointment fixture';end if;
 perform set_config('clinic_ci.b_appointment',b_appointment::text,true);
 -- B first (older), then A (newer) with separate appointment.
 b:=public.save_staff_clinical_encounter_draft(branch,pet,b_appointment,
  'b1717171-1111-4111-8111-111111111111',0,
  'Synthetic B prior note','','','');
 perform pg_sleep(0.025);
 a:=public.save_staff_clinical_encounter_draft(branch,pet,
  'aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa',
  'a1717171-1111-4111-8111-111111111111',0,
  'Synthetic A newer note','','','');
 if b->>'authorId'<>'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
 or a->>'editorId'<>'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
 then raise exception 'CLINICAL17_FAIL creator/editor initial';end if;
end $setup$;
do $page1$
declare p jsonb;
begin
 p:=public.read_staff_patient_chart(
  '11111111-0000-4000-8000-000000000077',
  '33333333-3333-4333-8333-333333333333','drafts',null,null,1);
 if jsonb_array_length(p->'items')<>1 or p->>'hasMore'<>'true'
 or p->'items'->0->>'complaint'<>'Synthetic A newer note' then
  raise exception 'CLINICAL17_FAIL immutable first draft cursor';end if;
 perform set_config('clinic_ci.first_cursor_at',p->'nextCursor'->>'at',true);
 perform set_config('clinic_ci.first_cursor_id',p->'nextCursor'->>'id',true);
end $page1$;
reset role;

-- A different currently-active veterinarian revises unseen draft B.
set role authenticated;
set request.jwt.claim.sub='ffffffff-ffff-4fff-8fff-ffffffffffff';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false}';
do $editor$
declare b uuid;reply jsonb;
begin
 b:=current_setting('clinic_ci.b_appointment')::uuid;
 reply:=public.save_staff_clinical_encounter_draft(
 '11111111-0000-4000-8000-000000000077',
 '33333333-3333-4333-8333-333333333333',b,
 'c1717171-1111-4111-8111-111111111111',1,
 'Synthetic B edited AFTER page one','vet F revised','','');
 if reply->>'authorId'<>'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
 or reply->>'editorId'<>'ffffffff-ffff-4fff-8fff-ffffffffffff'
 or (reply->>'revision')::integer<>2
 then raise exception 'CLINICAL17_FAIL creator/editor response lies';end if;
end $editor$;
reset role;

set role authenticated;
set request.jwt.claim.sub='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false}';
do $page2$
declare p jsonb;q jsonb;v uuid;
begin
 p:=public.read_staff_patient_chart('11111111-0000-4000-8000-000000000077',
 '33333333-3333-4333-8333-333333333333','drafts',
 current_setting('clinic_ci.first_cursor_at')::timestamptz,
 current_setting('clinic_ci.first_cursor_id')::uuid,1);
 if jsonb_array_length(p->'items')<>1 or p->>'hasMore'<>'false'
 or p->'items'->0->>'complaint'<>'Synthetic B edited AFTER page one'
 or p->'items'->0->>'editorId'<>'ffffffff-ffff-4fff-8fff-ffffffffffff'
 or p->'items'->0->>'authorId'<>'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
 then raise exception 'CLINICAL17_FAIL edited unseen draft vanished between pages';end if;
 if p->'items'->0->>'id'=current_setting('clinic_ci.first_cursor_id') then
  raise exception 'CLINICAL17_FAIL duplicate draft across pages';end if;
 -- Request nonce replay by second editor cannot change creator attribution.
 v:=current_setting('clinic_ci.b_appointment')::uuid;
 q:=public.save_staff_clinical_encounter_draft(
  '11111111-0000-4000-8000-000000000077',
  '33333333-3333-4333-8333-333333333333',v,
  'd1717171-1111-4111-8111-111111111111',2,
  'Synthetic B edited third time','','','');
 if q->>'authorId'<>'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
 or q->>'editorId'<>'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
 then raise exception 'CLINICAL17_FAIL creator not immutable after multi-vet edit';end if;
end $page2$;
reset role;
do $audit$
begin
 if (select count(*) from clinic_private.clinical_draft_audit
   where revision=2 and actor_id='ffffffff-ffff-4fff-8fff-ffffffffffff')<>1
 or (select count(*) from public.clinical_encounter_drafts
   where author_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd')<>2
 or (select count(*) from clinic_private.clinical_record_provenance)<>52
 then raise exception 'CLINICAL17_FAIL immutable audit/clinical provenance cardinality';end if;
 begin
  update clinic_private.clinical_record_provenance set pet_id=
   '44444444-4444-4444-8444-444444444444';
  raise exception 'CLINICAL17_FAIL proven clinical link mutable';
 exception when insufficient_privilege then null;end;
 if (select count(*) from public.pets where id='33333333-3333-4333-8333-333333333333'
  and species='Dog' and breed='Chow Chow')<>1
 or (select count(*) from public.appointments
  where id='55555555-5555-4555-8555-555555555555'
    and branch_id is null and status='requested')<>1 then
  raise exception 'CLINICAL17_FAIL historical Dog Chow Chow appointment changed';end if;
end $audit$;
rollback;
\echo 'PASS: CLINICAL17 real PG17 dual-branch false provenance denied, only visit-linked 50/51 clinical rows, immutable draft cursor under cross-vet update, creator/editor/audit and historical Chow Chow preserved';
