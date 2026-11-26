-- Disposable PG17 only; rollback fixture changes so the same checks run after restore.
\set ON_ERROR_STOP on
begin;
insert into public.staff_branch_memberships(user_id,branch_id,role,is_active) values
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','11111111-0000-4000-8000-000000000077','administrator',true),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-0000-4000-8000-000000000077','receptionist',true)
 on conflict(user_id,branch_id) do update set is_active=true;
insert into auth.sessions(id,user_id) values ('a2300000-1111-4111-8111-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') on conflict(id) do nothing;
do $acl$
declare f text;
begin
 foreach f in array array['public.read_staff_patient_chart(uuid,uuid,text,timestamptz,uuid,integer)',
 'public.save_staff_clinical_encounter_draft(uuid,uuid,uuid,uuid,integer,text,text,text,text)',
 'public.create_staff_appointment_clinical_record(uuid,uuid,text,numeric,numeric,text)',
 'public.reconcile_staff_clinical_draft(uuid,uuid,uuid,uuid,integer)'] loop
 if has_function_privilege('anon',f,'EXECUTE') or not has_function_privilege('authenticated',f,'EXECUTE')
 then raise exception 'CLINICAL23_FAIL routine ACL'; end if;
 end loop;
 if has_column_privilege('authenticated','public.clinical_records','procedure','INSERT')
 or has_table_privilege('authenticated','clinic_private.clinical_draft_requests','SELECT')
 or has_table_privilege('authenticated','public.clinical_encounter_drafts','SELECT')
 then raise exception 'CLINICAL23_FAIL direct privilege'; end if;
end $acl$;
set local role authenticated;
set local request.jwt.claim.sub='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
set local request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"a2200000-1111-4111-8111-000000000001"}';
do $positive$
declare b uuid:='11111111-0000-4000-8000-000000000077'; p uuid:='33333333-3333-4333-8333-333333333333'; a uuid:='aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa'; x jsonb; y jsonb; rev int; n uuid:=gen_random_uuid(); m uuid:=gen_random_uuid();
begin
 x:=public.read_staff_patient_chart(b,p,'drafts');
 if x->>'kind' is distinct from 'ok' or jsonb_array_length(x->'items')<1 then raise exception 'CLINICAL23_FAIL live chart'; end if;
 x:=public.reconcile_staff_clinical_draft(b,p,a); rev:=(x->>'currentRevision')::int;
 if x->>'kind' is distinct from 'committed' then raise exception 'CLINICAL23_FAIL existing receipt'; end if;
 y:=public.save_staff_clinical_encounter_draft(b,p,a,n,rev,'synthetic alignment','','','');
 if (y->>'revision')::int<>rev+1 or public.save_staff_clinical_encounter_draft(b,p,a,n,rev,'synthetic alignment','','','') is distinct from y then raise exception 'CLINICAL23_FAIL revision or replay'; end if;
 if public.reconcile_staff_clinical_draft(b,p,a,n)->'receipt'->>'revision' is distinct from y->>'revision' then raise exception 'CLINICAL23_FAIL receipt'; end if;
 begin perform public.save_staff_clinical_encounter_draft(b,p,a,gen_random_uuid(),rev,'stale synthetic','','','');
 raise exception 'CLINICAL23_FAIL stale revision'; exception when serialization_failure then null; end;
 x:=public.create_staff_appointment_clinical_record(a,m,'synthetic alignment record');
 if x->>'branchId' is distinct from b::text or x->>'petId' is distinct from p::text or public.create_staff_appointment_clinical_record(a,m,'synthetic alignment record') is distinct from x then raise exception 'CLINICAL23_FAIL exact visit or replay'; end if;
 if not exists(select 1 from public.clinical_records where id=(x->>'id')::uuid) then raise exception 'CLINICAL23_FAIL live direct record'; end if;
end $positive$;
do $roles$
declare m record; b uuid:='11111111-0000-4000-8000-000000000077'; p uuid:='33333333-3333-4333-8333-333333333333'; a uuid:='aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa'; x jsonb;
begin
 for m in select * from (values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','c2222222-aaaa-4aaa-8aaa-222222222222','administrator'),('cccccccc-cccc-4ccc-8ccc-cccccccccccc','c3333333-aaaa-4aaa-8aaa-333333333333','receptionist'),('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a2300000-1111-4111-8111-000000000001','owner')) v(actor,sid,role_name)
 loop
 perform set_config('request.jwt.claim.sub',m.actor,true);
 perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','is_anonymous',false,'exp',4102444800,'session_id',m.sid)::text,true);
 if m.role_name in ('administrator','receptionist') then
 x:=public.read_staff_patient_chart(b,p,'appointments');
 if x->>'kind' is distinct from 'ok' then raise exception 'CLINICAL23_FAIL appointment access'; end if;
 end if;
 if m.role_name='administrator' then
 if public.read_staff_patient_chart(b,p,'drafts')->>'kind' is distinct from 'ok' or public.read_staff_patient_chart(b,p,'records')->>'kind' is distinct from 'ok' then raise exception 'CLINICAL23_FAIL admin read'; end if;
 else
 begin perform public.read_staff_patient_chart(b,p,'drafts'); raise exception 'CLINICAL23_FAIL restricted notes'; exception when insufficient_privilege then null; end;
 end if;
 begin perform public.save_staff_clinical_encounter_draft(b,p,a,gen_random_uuid(),0,'synthetic denied','','',''); raise exception 'CLINICAL23_FAIL restricted save'; exception when insufficient_privilege then null; end;
 begin perform public.create_staff_appointment_clinical_record(a,gen_random_uuid(),'synthetic denied'); raise exception 'CLINICAL23_FAIL restricted record'; exception when insufficient_privilege then null; end;
 begin perform public.reconcile_staff_clinical_draft(b,p,a); raise exception 'CLINICAL23_FAIL restricted receipt'; exception when insufficient_privilege then null; end;
 if m.role_name='owner' then
 if not exists(select 1 from public.clinical_records where pet_id=p) or not exists(select 1 from storage.objects where bucket_id='clinical-attachments' and name like 'pets/'||p::text||'/owners/%') then raise exception 'CLINICAL23_FAIL owner positive'; end if;
 end if;
 end loop;
end $roles$;
set local request.jwt.claim.sub='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
do $sessions$
declare m jsonb; b uuid:='11111111-0000-4000-8000-000000000077'; p uuid:='33333333-3333-4333-8333-333333333333'; a uuid:='aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa';
begin
 for m in select * from (values
 ('{"role":"authenticated","is_anonymous":false,"exp":1,"session_id":"a2200000-1111-4111-8111-000000000001"}'::jsonb),
 ('{"role":"authenticated","is_anonymous":false,"exp":4102444800}'),
 ('{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"c4444444-aaaa-4aaa-8aaa-444444444444"}'),
 ('{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"c2222222-aaaa-4aaa-8aaa-222222222222"}'),
 ('{"role":"authenticated","is_anonymous":true,"exp":4102444800,"session_id":"a2200000-1111-4111-8111-000000000001"}')) v(claims)
 loop
 perform set_config('request.jwt.claims',m::text,true);
 begin perform public.read_staff_patient_chart(b,p,'drafts'); raise exception 'CLINICAL23_FAIL session chart'; exception when insufficient_privilege then null; end;
 begin perform public.save_staff_clinical_encounter_draft(b,p,a,gen_random_uuid(),0,'synthetic denied','','',''); raise exception 'CLINICAL23_FAIL session save'; exception when insufficient_privilege then null; end;
 begin perform public.create_staff_appointment_clinical_record(a,gen_random_uuid(),'synthetic denied'); raise exception 'CLINICAL23_FAIL session record'; exception when insufficient_privilege then null; end;
 begin perform public.reconcile_staff_clinical_draft(b,p,a); raise exception 'CLINICAL23_FAIL session receipt'; exception when insufficient_privilege then null; end;
 if exists(select 1 from public.clinical_records) or exists(select 1 from public.pet_attachments) or exists(select 1 from storage.objects where bucket_id='clinical-attachments') then raise exception 'CLINICAL23_FAIL session direct read'; end if;
 end loop;
end $sessions$;
reset role;
delete from auth.sessions where id='a2200000-1111-4111-8111-000000000001';
set local role authenticated;
set local request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"a2200000-1111-4111-8111-000000000001"}';
do $deleted$
declare b uuid:='11111111-0000-4000-8000-000000000077'; p uuid:='33333333-3333-4333-8333-333333333333'; a uuid:='aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa';
begin
 begin perform public.read_staff_patient_chart(b,p,'drafts'); raise exception 'CLINICAL23_FAIL deleted session chart'; exception when insufficient_privilege then null; end;
 begin perform public.save_staff_clinical_encounter_draft(b,p,a,gen_random_uuid(),0,'synthetic denied','','',''); raise exception 'CLINICAL23_FAIL deleted session save'; exception when insufficient_privilege then null; end;
 begin perform public.create_staff_appointment_clinical_record(a,gen_random_uuid(),'synthetic denied'); raise exception 'CLINICAL23_FAIL deleted session record'; exception when insufficient_privilege then null; end;
 begin perform public.reconcile_staff_clinical_draft(b,p,a); raise exception 'CLINICAL23_FAIL deleted session receipt'; exception when insufficient_privilege then null; end;
end $deleted$;
rollback;
\echo 'PASS: clinical23 live role/session, direct read, existing receipt, CAS and record replay (rollback-only)'

-- Active session alone is insufficient after committed role or Auth changes.
begin;
update public.staff_branch_memberships set is_active=false where user_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd' and branch_id='11111111-0000-4000-8000-000000000077';
set local role authenticated;
set local request.jwt.claim.sub='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
set local request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"a2200000-1111-4111-8111-000000000001"}';
do $revoked$
begin
 begin perform public.read_staff_patient_chart('11111111-0000-4000-8000-000000000077','33333333-3333-4333-8333-333333333333','records'); raise exception 'CLINICAL23_FAIL branch revocation API 1'; exception when insufficient_privilege then null; end;
 begin perform public.save_staff_clinical_encounter_draft('11111111-0000-4000-8000-000000000077','33333333-3333-4333-8333-333333333333','aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa',gen_random_uuid(),0,'synthetic denied','','',''); raise exception 'CLINICAL23_FAIL branch revocation API 2'; exception when insufficient_privilege then null; end;
 begin perform public.create_staff_appointment_clinical_record('aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa',gen_random_uuid(),'synthetic denied'); raise exception 'CLINICAL23_FAIL branch revocation API 3'; exception when insufficient_privilege then null; end;
 begin perform public.reconcile_staff_clinical_draft('11111111-0000-4000-8000-000000000077','33333333-3333-4333-8333-333333333333','aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa'); raise exception 'CLINICAL23_FAIL branch revocation API 4'; exception when insufficient_privilege then null; end;
end $revoked$;
rollback;
begin;
update public.staff_memberships set is_active=false where user_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
set local role authenticated;
set local request.jwt.claim.sub='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
set local request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"a2200000-1111-4111-8111-000000000001"}';
do $revoked$
begin
 begin perform public.read_staff_patient_chart('11111111-0000-4000-8000-000000000077','33333333-3333-4333-8333-333333333333','records'); raise exception 'CLINICAL23_FAIL global revocation API 1'; exception when insufficient_privilege then null; end;
 begin perform public.save_staff_clinical_encounter_draft('11111111-0000-4000-8000-000000000077','33333333-3333-4333-8333-333333333333','aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa',gen_random_uuid(),0,'synthetic denied','','',''); raise exception 'CLINICAL23_FAIL global revocation API 2'; exception when insufficient_privilege then null; end;
 begin perform public.create_staff_appointment_clinical_record('aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa',gen_random_uuid(),'synthetic denied'); raise exception 'CLINICAL23_FAIL global revocation API 3'; exception when insufficient_privilege then null; end;
 begin perform public.reconcile_staff_clinical_draft('11111111-0000-4000-8000-000000000077','33333333-3333-4333-8333-333333333333','aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa'); raise exception 'CLINICAL23_FAIL global revocation API 4'; exception when insufficient_privilege then null; end;
end $revoked$;
rollback;
begin;
update auth.users set banned_until=clock_timestamp()+interval '2 hours' where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
set local role authenticated;
set local request.jwt.claim.sub='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
set local request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"a2200000-1111-4111-8111-000000000001"}';
do $revoked$
begin
 begin perform public.read_staff_patient_chart('11111111-0000-4000-8000-000000000077','33333333-3333-4333-8333-333333333333','records'); raise exception 'CLINICAL23_FAIL Auth ban API 1'; exception when insufficient_privilege then null; end;
 begin perform public.save_staff_clinical_encounter_draft('11111111-0000-4000-8000-000000000077','33333333-3333-4333-8333-333333333333','aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa',gen_random_uuid(),0,'synthetic denied','','',''); raise exception 'CLINICAL23_FAIL Auth ban API 2'; exception when insufficient_privilege then null; end;
 begin perform public.create_staff_appointment_clinical_record('aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa',gen_random_uuid(),'synthetic denied'); raise exception 'CLINICAL23_FAIL Auth ban API 3'; exception when insufficient_privilege then null; end;
 begin perform public.reconcile_staff_clinical_draft('11111111-0000-4000-8000-000000000077','33333333-3333-4333-8333-333333333333','aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa'); raise exception 'CLINICAL23_FAIL Auth ban API 4'; exception when insufficient_privilege then null; end;
end $revoked$;
rollback;
\echo 'PASS: clinical23 current branch/global/Auth revocation across all four APIs'
