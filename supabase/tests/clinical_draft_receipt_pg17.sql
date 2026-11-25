-- Disposable CI only. Historical #1–21 already applied.
\set ON_ERROR_STOP on
do $acl$
begin
 if has_function_privilege('anon','public.reconcile_staff_clinical_draft(uuid,uuid,uuid,uuid,integer)','EXECUTE')
 or not has_function_privilege('authenticated','public.reconcile_staff_clinical_draft(uuid,uuid,uuid,uuid,integer)','EXECUTE')
 or has_table_privilege('authenticated','clinic_private.clinical_draft_requests','SELECT')
 or has_table_privilege('authenticated','clinic_private.clinical_draft_audit','SELECT')
 then raise exception 'RECEIPT_FAIL: ACL'; end if;
end $acl$;
set role authenticated;
set request.jwt.claim.sub='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"c4444444-aaaa-4aaa-8aaa-444444444444"}';
do $receipt$
declare
 b uuid:='11111111-0000-4000-8000-000000000077';
 p uuid:='33333333-3333-4333-8333-333333333333';
 a uuid:='aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa';
 n1 uuid:='a2200000-0000-4000-8000-000000000001';
 n2 uuid:='a2200000-0000-4000-8000-000000000002';
 x jsonb; y jsonb; z jsonb;
begin
 x:=public.reconcile_staff_clinical_draft(b,p,a,n1);
 if x->>'kind' is distinct from 'not_found' or x->>'currentRevision' is distinct from '0'
 then raise exception 'RECEIPT_FAIL: empty authorized visit'; end if;
 y:=public.save_staff_clinical_encounter_draft(b,p,a,n1,0,'synthetic draft first','','','');
 z:=public.save_staff_clinical_encounter_draft(b,p,a,n2,1,'synthetic draft revision','','','');
 x:=public.reconcile_staff_clinical_draft(b,p,a,n1);
 if x->>'kind' is distinct from 'committed' or x->>'currentRevision' is distinct from '2'
 or x->'receipt'->>'revision' is distinct from '1'
 or x->>'draftId' is distinct from y->>'id'
 or x->'receipt'->>'requestId' is distinct from n1::text
 or x->'receipt'->>'savedAt' is distinct from y->>'updatedAt'
 or x->'receipt'->>'auditEventId' is null
 or x::text like '%synthetic draft%' then raise exception 'RECEIPT_FAIL: exact historical receipt'; end if;
 x:=public.reconcile_staff_clinical_draft(b,p,a);
 if x->>'kind' is distinct from 'committed' or x->'receipt'->>'revision' is distinct from '2'
 or x->'receipt'->>'requestId' is distinct from n2::text
 or x->>'draftId' is distinct from z->>'id' then raise exception 'RECEIPT_FAIL: latest discovery'; end if;
 x:=public.reconcile_staff_clinical_draft(b,p,a,null,2);
 if x->'receipt'->>'requestId' is distinct from n1::text then raise exception 'RECEIPT_FAIL: prior discovery'; end if;
 x:=public.reconcile_staff_clinical_draft(b,p,a,null,1);
 if x->>'kind' is distinct from 'not_found' or x->>'currentRevision' is distinct from '2'
 then raise exception 'RECEIPT_FAIL: end of discovery'; end if;
 x:=public.reconcile_staff_clinical_draft(b,p,a,gen_random_uuid());
 if x->>'kind' is distinct from 'not_found' or x->>'currentRevision' is distinct from '2'
 then raise exception 'RECEIPT_FAIL: unknown nonce observation'; end if;
 if public.save_staff_clinical_encounter_draft(b,p,a,n1,0,'synthetic draft first','','','') is distinct from y
 then raise exception 'RECEIPT_FAIL: original replay changed'; end if;
 begin
  perform public.save_staff_clinical_encounter_draft(b,p,a,gen_random_uuid(),1,'stale synthetic','','','');
  raise exception 'RECEIPT_FAIL: stale edit';
 exception when serialization_failure then null; end;
 begin
  perform public.reconcile_staff_clinical_draft(b,'44444444-4444-4444-8444-444444444444',a,n1);
  raise exception 'RECEIPT_FAIL: wrong patient';
 exception when insufficient_privilege then null; end;
 begin
  perform public.reconcile_staff_clinical_draft('22222222-0000-4000-8000-000000000077',p,a,n1);
  raise exception 'RECEIPT_FAIL: wrong branch';
 exception when insufficient_privilege then null; end;
 begin
  perform public.reconcile_staff_clinical_draft(b,p,'55555555-5555-4555-8555-555555555555',n1);
  raise exception 'RECEIPT_FAIL: historical visit';
 exception when insufficient_privilege then null; end;
end $receipt$;
reset role;
-- New session after sign-out: actor is durable, session is not a receipt key.
insert into auth.sessions(id,user_id) values
 ('a2200000-1111-4111-8111-000000000001','dddddddd-dddd-4ddd-8ddd-dddddddddddd');
set role authenticated;
set request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"a2200000-1111-4111-8111-000000000001"}';
do $reload$
begin
 if public.reconcile_staff_clinical_draft('11111111-0000-4000-8000-000000000077',
 '33333333-3333-4333-8333-333333333333','aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa')->'receipt'->>'revision'
 is distinct from '2' then raise exception 'RECEIPT_FAIL: new session discovery'; end if;
end $reload$;
reset role;
-- Each negative uses a known existing visit. No persistent changes to roles.
begin;
delete from auth.sessions where id='a2200000-1111-4111-8111-000000000001';
set local role authenticated;
do $deleted$
begin
 begin
  perform public.reconcile_staff_clinical_draft('11111111-0000-4000-8000-000000000077',
   '33333333-3333-4333-8333-333333333333','aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa');
  raise exception 'RECEIPT_FAIL: deleted session';
 exception when insufficient_privilege then null; end;
end $deleted$;
rollback;
begin;
update public.staff_memberships set is_active=false where user_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
set local role authenticated;
do $revoked$
begin
 begin
  perform public.reconcile_staff_clinical_draft('11111111-0000-4000-8000-000000000077',
   '33333333-3333-4333-8333-333333333333','aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa');
  raise exception 'RECEIPT_FAIL: revoked staff';
 exception when insufficient_privilege then null; end;
end $revoked$;
rollback;
begin;
update public.staff_memberships set is_active=true where user_id='ffffffff-ffff-4fff-8fff-ffffffffffff';
update public.staff_branch_memberships set is_active=true where user_id='ffffffff-ffff-4fff-8fff-ffffffffffff'
 and branch_id='11111111-0000-4000-8000-000000000077';
insert into auth.sessions(id,user_id) values
 ('a2200000-1111-4111-8111-000000000002','ffffffff-ffff-4fff-8fff-ffffffffffff');
set local role authenticated;
set local request.jwt.claim.sub='ffffffff-ffff-4fff-8fff-ffffffffffff';
set local request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"a2200000-1111-4111-8111-000000000002"}';
do $actor$
declare x jsonb;
begin
 x:=public.reconcile_staff_clinical_draft('11111111-0000-4000-8000-000000000077',
 '33333333-3333-4333-8333-333333333333','aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa',
 'a2200000-0000-4000-8000-000000000001');
 if x->>'kind' is distinct from 'not_found' or x->'receipt' is distinct from 'null'::jsonb
 then raise exception 'RECEIPT_FAIL: another veterinarian receipt'; end if;
end $actor$;
rollback;
do $preserved$
begin
 if (select count(*) from public.clinical_encounter_drafts where appointment_id='aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa' and revision=2)<>1
 or (select count(*) from clinic_private.clinical_draft_audit where appointment_id='aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa')<>2
 or (select count(*) from clinic_private.clinical_draft_requests where appointment_id='aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa')<>2
 or (select count(*) from public.pets where species='Dog' and breed='Chow Chow')<>1
 or (select count(*) from public.appointments where id='55555555-5555-4555-8555-555555555555' and branch_id is null and status='requested')<>1
 then raise exception 'RECEIPT_FAIL: cardinality/history'; end if;
end $preserved$;
\echo 'PASS: clinical22 exact/discovery, current versus saved revision, reload/new session, actor, wrong visit, revoked session and historical patient'
