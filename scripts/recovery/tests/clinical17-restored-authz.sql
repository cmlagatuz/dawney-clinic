-- Clinical #16/#17 restored-authorization acceptance, disposable PG17 ONLY.
-- Run once on source and once on restored DB with identical synthetic fixture.
\set ON_ERROR_STOP on
DO $roles$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon')
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
  RAISE EXCEPTION 'CLINICAL_RESTORE_FAIL: required browser roles absent';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='clinic_private') THEN
  RAISE EXCEPTION 'CLINICAL_RESTORE_FAIL: private schema absent';
 END IF;
END $roles$;
DO $acl$
DECLARE
 f regprocedure;
 role text; tbl text;
BEGIN
 FOREACH f IN ARRAY ARRAY[
 'public.read_staff_patient_chart(uuid,uuid,text,timestamptz,uuid,integer)'::regprocedure,
 'public.save_staff_clinical_encounter_draft(uuid,uuid,uuid,uuid,integer,text,text,text,text)'::regprocedure,
 'public.create_staff_appointment_clinical_record(uuid,uuid,text,numeric,numeric,text)'::regprocedure
 ] LOOP
  IF has_function_privilege('anon',f,'EXECUTE')
    OR NOT has_function_privilege('authenticated',f,'EXECUTE')
    OR EXISTS (
      SELECT 1 FROM pg_proc p,
      LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) ace
      WHERE p.oid=f::oid AND ace.grantee=0 AND ace.privilege_type='EXECUTE'
    ) THEN
    RAISE EXCEPTION 'CLINICAL_RESTORE_FAIL: clinical RPC execute matrix: %',f;
  END IF;
  IF NOT EXISTS (
   SELECT 1 FROM pg_proc p
   WHERE p.oid=f::oid AND p.prosecdef AND
    ('search_path='=ANY(p.proconfig) OR 'search_path=""'=ANY(p.proconfig))
  ) THEN RAISE EXCEPTION 'CLINICAL_RESTORE_FAIL: RPC definer/search_path: %',f;
  END IF;
 END LOOP;
 IF has_table_privilege('authenticated','public.clinical_records','INSERT')
  OR has_column_privilege('authenticated','public.clinical_records','branch_id','INSERT')
  OR has_column_privilege('authenticated','public.clinical_records','procedure','INSERT')
  OR has_table_privilege('anon','public.clinical_records','INSERT')
 THEN RAISE EXCEPTION 'CLINICAL_RESTORE_FAIL: browser direct medical INSERT exposed'; END IF;
 FOREACH tbl IN ARRAY ARRAY[
  'clinic_private.clinical_record_provenance',
  'clinic_private.clinical_draft_audit',
  'clinic_private.clinical_draft_requests'
 ] LOOP
  FOREACH role IN ARRAY ARRAY['anon','authenticated'] LOOP
   IF has_table_privilege(role,tbl,'SELECT') OR
      has_table_privilege(role,tbl,'INSERT') OR
      has_table_privilege(role,tbl,'UPDATE') OR
      has_table_privilege(role,tbl,'DELETE') OR
      has_table_privilege(role,tbl,'TRUNCATE') THEN
    RAISE EXCEPTION 'CLINICAL_RESTORE_FAIL: private table privilege % %',role,tbl;
   END IF;
  END LOOP;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.clinical_records'::regclass AND relrowsecurity)
 OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.clinical_encounter_drafts'::regclass AND relrowsecurity)
 OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='clinic_private.clinical_record_provenance'::regclass AND relrowsecurity)
 OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='clinic_private.clinical_draft_requests'::regclass AND relrowsecurity)
 OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='clinic_private.clinical_draft_audit'::regclass AND relrowsecurity)
 THEN RAISE EXCEPTION 'CLINICAL_RESTORE_FAIL: RLS disabled'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.clinical_records'::regclass AND polname='clinical_record_trusted_staff_only')
 OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.clinical_encounter_drafts'::regclass
 AND tgname='clinical_draft_cursor_protection' AND tgenabled='O')
 OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='clinic_private.clinical_record_provenance'::regclass
 AND tgname='clinical_provenance_append_only' AND tgenabled='O')
 OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='clinic_private.clinical_draft_audit'::regclass
 AND tgname='clinical_draft_audit_no_update_delete' AND tgenabled='O')
 THEN RAISE EXCEPTION 'CLINICAL_RESTORE_FAIL: mandatory policy/append-only trigger missing'; END IF;
END $acl$;
-- All real actor operations below run in a transaction and leave no writes.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
SET LOCAL request.jwt.claims='{"role":"authenticated","is_anonymous":false}';
DO $vet$
DECLARE result jsonb;
BEGIN
 result:=public.create_staff_appointment_clinical_record(
  'aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa',
  'a2929292-2222-4222-8222-333333333333',
  'RESTORE CLINICIAN AUTHORIZATION SYNTHETIC',38.2,11.5,null);
 IF result->>'petId'<>'33333333-3333-4333-8333-333333333333' OR
 result->>'branchId'<>'11111111-0000-4000-8000-000000000077' OR
 result->>'authorId'<>'dddddddd-dddd-4ddd-8ddd-dddddddddddd' THEN
  RAISE EXCEPTION 'CLINICAL_RESTORE_FAIL: authorized clinician provenance wrong';
 END IF;
 result:=public.read_staff_patient_chart(
  '11111111-0000-4000-8000-000000000077',
  '33333333-3333-4333-8333-333333333333','records',null,null,50);
 IF result->>'kind'<>'ok' OR jsonb_array_length(result->'items')=0 THEN
  RAISE EXCEPTION 'CLINICAL_RESTORE_FAIL: authorized clinical read missing';
 END IF;
END $vet$;
DO $denied$
DECLARE who uuid; who_name text;
BEGIN
 FOR who_name,who IN SELECT label,actor FROM (VALUES
  ('owner','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid),
  ('receptionist','cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid),
  ('administrator','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid),
  ('revoked','ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid)
 ) t(label,actor) LOOP
  PERFORM set_config('request.jwt.claim.sub',who::text,true);
  BEGIN
   PERFORM public.create_staff_appointment_clinical_record(
    'aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa',gen_random_uuid(),
    'UNAUTHORIZED WRITER '||who_name);
   RAISE EXCEPTION 'CLINICAL_RESTORE_FAIL: % wrote protected record',who_name;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
 END LOOP;
 PERFORM set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',true);
 PERFORM set_config('request.jwt.claims','{"role":"authenticated","is_anonymous":true}',true);
 BEGIN
  PERFORM public.create_staff_appointment_clinical_record(
   'aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa',gen_random_uuid(),
   'UNAUTHORIZED ANONYMOUS');
  RAISE EXCEPTION 'CLINICAL_RESTORE_FAIL: anonymous JWT wrote';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $denied$;
ROLLBACK;
-- Signed restore exact historical and private clinical data assertions.
DO $history$
BEGIN
 IF (SELECT count(*) FROM clinic_private.clinical_record_provenance
   WHERE creator_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    AND branch_id='11111111-0000-4000-8000-000000000077'
    AND pet_id='33333333-3333-4333-8333-333333333333')<>1
 OR (SELECT count(*) FROM public.clinical_encounter_drafts
  WHERE status='draft' AND revision=1
   AND author_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
   AND last_edited_by='dddddddd-dddd-4ddd-8ddd-dddddddddddd')<>1
 OR (SELECT count(*) FROM clinic_private.clinical_draft_audit
   WHERE revision=1 AND actor_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    AND action='created')<>1
 OR (SELECT count(*) FROM clinic_private.clinical_draft_requests
   WHERE actor_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    AND response->>'kind'='saved')<>1
 OR (SELECT count(*) FROM public.pets
  WHERE id='33333333-3333-4333-8333-333333333333'
   AND species='Dog' AND breed='Chow Chow' AND breed_id='dog-chow-chow')<>1
 OR (SELECT count(*) FROM public.appointments
  WHERE id='55555555-5555-4555-8555-555555555555'
   AND status='requested' AND branch_id IS NULL)<>1
 THEN RAISE EXCEPTION 'CLINICAL_RESTORE_FAIL: clinical data or history missing'; END IF;
END $history$;
\echo 'PASS: CLINICAL17 source/restored active veterinarian operation, correctly labeled owner/receptionist/administrator/revoked/anonymous deny; unconfirmed veterinarian separately fixture-proven, exact RPC grants, RLS/definer/triggers, drafts/audit/nonce/provenance and Chow Chow'
