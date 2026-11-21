-- PG17 only. Real synthetic actor rows, never provider identities or hosted SQL.
-- Execute on BOTH source and signed restored DB. Every grant/write rolls back.
\set ON_ERROR_STOP on
BEGIN;
DO $fixture$
DECLARE naga uuid:='11111111-0000-4000-8000-000000000077';
 cavite uuid:='22222222-0000-4000-8000-000000000077';
BEGIN
 -- Read actual state, not the label attached to a UUID in a test.
 IF (SELECT count(*) FROM auth.users u JOIN public.staff_memberships m ON m.user_id=u.id
   JOIN public.staff_branch_memberships b ON b.user_id=u.id AND b.branch_id=naga
   WHERE u.id='dddddddd-dddd-4ddd-8ddd-dddddddddddd' AND u.email_confirmed_at IS NOT NULL
   AND NOT u.is_anonymous AND m.role='veterinarian' AND m.is_active
   AND b.role='veterinarian' AND b.is_active)<>1
 OR (SELECT count(*) FROM auth.users u JOIN public.staff_memberships m ON m.user_id=u.id
   JOIN public.staff_branch_memberships b ON b.user_id=u.id AND b.branch_id=cavite
   WHERE u.id='cccccccc-cccc-4ccc-8ccc-cccccccccccc' AND u.email_confirmed_at IS NOT NULL
   AND m.role='receptionist' AND m.is_active AND b.role='receptionist' AND b.is_active)<>1
 OR (SELECT count(*) FROM auth.users u JOIN public.staff_memberships m ON m.user_id=u.id
   JOIN public.staff_branch_memberships b ON b.user_id=u.id AND b.branch_id=cavite
   WHERE u.id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' AND u.email_confirmed_at IS NOT NULL
   AND m.role='administrator' AND m.is_active AND b.role='administrator' AND b.is_active)<>1
 OR (SELECT count(*) FROM auth.users u JOIN public.staff_memberships m ON m.user_id=u.id
   WHERE u.id='ffffffff-ffff-4fff-8fff-ffffffffffff' AND m.role='veterinarian'
   AND NOT m.is_active AND u.email_confirmed_at IS NOT NULL)<>1
 OR (SELECT count(*) FROM auth.users u
   WHERE u.id='22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    AND u.email_confirmed_at IS NULL AND NOT u.is_anonymous AND u.deleted_at IS NULL)<>1
 OR EXISTS (SELECT 1 FROM public.staff_memberships
   WHERE user_id='22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
 THEN RAISE EXCEPTION 'CLINICAL_RESTORE_FAIL: actor baseline fixture identity or status wrong'; END IF;
END $fixture$;
-- An active UNCONFIRMED staff row is intentionally impossible to create
-- through normal writes: enforce_staff_membership_safety rejects it. To test
-- corrupt restored rows, privileged disposable CI bypasses EXACTLY the INSERT
-- protection trigger for one synthetic row and restores it immediately.
-- Never do this against Supabase, clinical patient data, or a real account.
ALTER TABLE public.staff_memberships DISABLE TRIGGER staff_membership_before_write;
INSERT INTO public.staff_memberships(user_id,role,is_active)
 VALUES ('22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb','veterinarian',true);
ALTER TABLE public.staff_memberships ENABLE TRIGGER staff_membership_before_write;
INSERT INTO public.staff_branch_memberships(user_id,branch_id,role,is_active)
 VALUES ('22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '11111111-0000-4000-8000-000000000077','veterinarian',true);
DO $verify_unconfirmed_fixture$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger
  WHERE tgrelid='public.staff_memberships'::regclass
   AND tgname='staff_membership_before_write' AND tgenabled='O')
 OR (SELECT count(*) FROM auth.users u JOIN public.staff_memberships m ON m.user_id=u.id
   JOIN public.staff_branch_memberships b ON b.user_id=u.id
   WHERE u.id='22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
   AND u.email_confirmed_at IS NULL AND NOT u.is_anonymous
   AND m.role='veterinarian' AND m.is_active
   AND b.branch_id='11111111-0000-4000-8000-000000000077'
   AND b.role='veterinarian' AND b.is_active)<>1
 THEN RAISE EXCEPTION 'CLINICAL_RESTORE_FAIL: unconfirmed veterinarian state or insert guard incorrect'; END IF;
END $verify_unconfirmed_fixture$;

-- Dedicated NEW branch-attributed appointment, created after the restore.
-- This appointment and all subsequent RPC writes roll back with this script.
-- Synthetic PG17 already-scheduled visit: temporarily bypass ONLY the
-- public booking insert guard for this ONE post-restore fixture. Restore
-- and assert trigger ON immediately BEFORE any authenticated clinical RPC.
-- Forbidden in hosted, staging, production, or real owner/patient contexts.
ALTER TABLE public.appointments DISABLE TRIGGER appointment_service_booking_guard;
INSERT INTO public.appointments(id,owner_id,pet_id,resource_id,starts_at,ends_at,status,concern,created_by)
VALUES ('a7171717-7777-4717-8717-171717171717','11111111-1111-4111-8111-111111111111',
 '33333333-3333-4333-8333-333333333333',
 '11111111-7777-4777-8777-111111111111',
 now()+interval '400 days',now()+interval '400 days 30 minutes',
 'requested','RESTORE17 disposable first-draft visit',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
ALTER TABLE public.appointments ENABLE TRIGGER appointment_service_booking_guard;
DO $fresh_baseline$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.appointments'::regclass
  AND tgname='appointment_service_booking_guard' AND tgenabled='O')
 OR (SELECT count(*) FROM public.appointments WHERE id='a7171717-7777-4717-8717-171717171717'
   AND branch_id='11111111-0000-4000-8000-000000000077'
   AND pet_id='33333333-3333-4333-8333-333333333333')<>1
 OR EXISTS(SELECT 1 FROM public.clinical_encounter_drafts WHERE appointment_id='a7171717-7777-4717-8717-171717171717')
 OR EXISTS(SELECT 1 FROM clinic_private.clinical_draft_audit WHERE appointment_id='a7171717-7777-4717-8717-171717171717')
 OR EXISTS(SELECT 1 FROM clinic_private.clinical_draft_requests WHERE appointment_id='a7171717-7777-4717-8717-171717171717')
 THEN RAISE EXCEPTION 'CLINICAL_RESTORE_FAIL: fresh appointment/branch or zero-draft preflight'; END IF;
END $fresh_baseline$;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
SET LOCAL request.jwt.claims='{"role":"authenticated","is_anonymous":false}';
DO $draft_creation$
DECLARE a jsonb;b jsonb; n uuid:='a3939393-2222-4222-8222-333333333333';
BEGIN
 a:=public.save_staff_clinical_encounter_draft(
  '11111111-0000-4000-8000-000000000077',
  '33333333-3333-4333-8333-333333333333',
  'aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa',n,1,
  'RESTORED SYNTHETIC DRAFT','Normal','Observe','Recheck');
 b:=public.save_staff_clinical_encounter_draft(
  '11111111-0000-4000-8000-000000000077',
  '33333333-3333-4333-8333-333333333333',
  'aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa',n,1,
  'RESTORED SYNTHETIC DRAFT','Normal','Observe','Recheck');
 IF a IS DISTINCT FROM b OR a->>'kind'<>'saved' OR
   (a->>'revision')::integer<>2 OR
   a->>'authorId'<>'dddddddd-dddd-4ddd-8ddd-dddddddddddd' OR
   a->>'editorId'<>'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
 THEN RAISE EXCEPTION 'CLINICAL_RESTORE_FAIL: original draft writer replay/author failed'; END IF;
 BEGIN
  PERFORM public.save_staff_clinical_encounter_draft(
   '11111111-0000-4000-8000-000000000077',
   '33333333-3333-4333-8333-333333333333',
   'aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa',n,1,
   'CHANGED REPLAY','Normal','Observe','Recheck');
  RAISE EXCEPTION 'CLINICAL_RESTORE_FAIL: modified nonce replay accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN
  PERFORM public.save_staff_clinical_encounter_draft(
   '11111111-0000-4000-8000-000000000077',
   '33333333-3333-4333-8333-333333333333',
   'aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa',
   'b3939393-2222-4222-8222-333333333333',1,
   'STALE','Normal','Observe','Recheck');
  RAISE EXCEPTION 'CLINICAL_RESTORE_FAIL: stale draft revision accepted';
 EXCEPTION WHEN serialization_failure THEN NULL; END;
 BEGIN
  PERFORM public.save_staff_clinical_encounter_draft(
   '22222222-0000-4000-8000-000000000077',
   '33333333-3333-4333-8333-333333333333',
   'aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa',
   'c3939393-2222-4222-8222-333333333333',2,
   'WRONG BRANCH','Normal','Observe','Recheck');
  RAISE EXCEPTION 'CLINICAL_RESTORE_FAIL: wrong-branch draft accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $draft_creation$;

-- Explicit restored INSERT path (expected revision zero), not the archived draft.
DO $fresh_insert$
DECLARE first_result jsonb; replay_result jsonb;
BEGIN
 first_result:=public.save_staff_clinical_encounter_draft(
 '11111111-0000-4000-8000-000000000077','33333333-3333-4333-8333-333333333333',
 'a7171717-7777-4717-8717-171717171717','a8171717-7777-4717-8717-171717171717',0,
 'FRESH RESTORED DRAFT','First examination','Observe','Return');
 replay_result:=public.save_staff_clinical_encounter_draft(
 '11111111-0000-4000-8000-000000000077','33333333-3333-4333-8333-333333333333',
 'a7171717-7777-4717-8717-171717171717','a8171717-7777-4717-8717-171717171717',0,
 'FRESH RESTORED DRAFT','First examination','Observe','Return');
 IF first_result IS DISTINCT FROM replay_result
 OR first_result->>'kind'<>'saved' OR first_result->>'id' IS NULL
 OR (first_result->>'revision')::integer<>1
 OR first_result->>'appointmentId'<>'a7171717-7777-4717-8717-171717171717'
 OR first_result->>'branchId'<>'11111111-0000-4000-8000-000000000077'
 OR first_result->>'petId'<>'33333333-3333-4333-8333-333333333333'
 OR first_result->>'authorId'<>'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
 OR first_result->>'editorId'<>'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
 THEN RAISE EXCEPTION 'CLINICAL_RESTORE_FAIL: fresh create/replay response or attribution'; END IF;
 BEGIN
  PERFORM public.save_staff_clinical_encounter_draft(
   '11111111-0000-4000-8000-000000000077','33333333-3333-4333-8333-333333333333',
   'a7171717-7777-4717-8717-171717171717','a8171717-7777-4717-8717-171717171717',0,
   'CHANGED REPLAY PAYLOAD','First examination','Observe','Return');
  RAISE EXCEPTION 'CLINICAL_RESTORE_FAIL: changed fresh nonce replay accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
END $fresh_insert$;
RESET ROLE;

-- Private-row checks execute as PG17 superuser after role RESET; no extra grants.
DO $fresh_insert_fidelity$
DECLARE d public.clinical_encounter_drafts%rowtype;
BEGIN
 SELECT * INTO d FROM public.clinical_encounter_drafts WHERE appointment_id='a7171717-7777-4717-8717-171717171717';
 IF NOT FOUND OR d.revision<>1 OR d.status<>'draft'
 OR d.author_id<>'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
 OR d.last_edited_by<>'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
 OR d.branch_id<>'11111111-0000-4000-8000-000000000077'
 OR d.pet_id<>'33333333-3333-4333-8333-333333333333'
 OR d.complaint<>'FRESH RESTORED DRAFT'
 OR (SELECT count(*) FROM public.clinical_encounter_drafts WHERE appointment_id='a7171717-7777-4717-8717-171717171717')<>1
 OR (SELECT count(*) FROM clinic_private.clinical_draft_audit
 WHERE appointment_id='a7171717-7777-4717-8717-171717171717' AND draft_id=d.id AND revision=1
  AND action='created' AND actor_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  AND request_id='a8171717-7777-4717-8717-171717171717')<>1
 OR (SELECT count(*) FROM clinic_private.clinical_draft_audit
 WHERE appointment_id='a7171717-7777-4717-8717-171717171717')<>1
 OR (SELECT count(*) FROM clinic_private.clinical_draft_requests
 WHERE appointment_id='a7171717-7777-4717-8717-171717171717' AND actor_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  AND request_id='a8171717-7777-4717-8717-171717171717' AND payload->>'expectedRevision'='0'
  AND response->>'id'=d.id::text AND response->>'revision'='1')<>1
 OR (SELECT count(*) FROM clinic_private.clinical_draft_requests
 WHERE appointment_id='a7171717-7777-4717-8717-171717171717')<>1
 THEN RAISE EXCEPTION 'CLINICAL_RESTORE_FAIL: fresh creator/editor/created audit/one receipt'; END IF;
END $fresh_insert_fidelity$;
DO $editor_fixture$
BEGIN
 -- A different previously revoked veterinarian is activated only inside the
 -- disposable transaction. Its ORIGINAL revoked state was asserted above.
 UPDATE public.staff_memberships SET is_active=true
  WHERE user_id='ffffffff-ffff-4fff-8fff-ffffffffffff';
 UPDATE public.staff_branch_memberships SET is_active=true
  WHERE user_id='ffffffff-ffff-4fff-8fff-ffffffffffff'
    AND branch_id='11111111-0000-4000-8000-000000000077';
 IF (SELECT count(*) FROM auth.users u JOIN public.staff_memberships m ON m.user_id=u.id
   JOIN public.staff_branch_memberships b ON b.user_id=u.id
   WHERE u.id='ffffffff-ffff-4fff-8fff-ffffffffffff'
    AND u.email_confirmed_at IS NOT NULL AND m.role='veterinarian' AND m.is_active
    AND b.branch_id='11111111-0000-4000-8000-000000000077'
    AND b.role='veterinarian' AND b.is_active)<>1
 THEN RAISE EXCEPTION 'CLINICAL_RESTORE_FAIL: second vet activation not verified'; END IF;
END $editor_fixture$;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='ffffffff-ffff-4fff-8fff-ffffffffffff';
SET LOCAL request.jwt.claims='{"role":"authenticated","is_anonymous":false}';
DO $second_editor$
DECLARE a jsonb;
BEGIN
 a:=public.save_staff_clinical_encounter_draft(
  '11111111-0000-4000-8000-000000000077',
  '33333333-3333-4333-8333-333333333333',
  'aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa',
  'd3939393-2222-4222-8222-333333333333',2,
  'REVISED BY SECOND VET','Follow-up','Check','Return');
 IF a->>'authorId'<>'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  OR a->>'editorId'<>'ffffffff-ffff-4fff-8fff-ffffffffffff'
  OR (a->>'revision')::integer<>3
 THEN RAISE EXCEPTION 'CLINICAL_RESTORE_FAIL: changed editor/immutable author'; END IF;

 -- Independently prove the SECOND authorized veterinarian revises FRESH draft.
 a:=public.save_staff_clinical_encounter_draft(
  '11111111-0000-4000-8000-000000000077',
  '33333333-3333-4333-8333-333333333333',
  'a7171717-7777-4717-8717-171717171717','b8171717-7777-4717-8717-171717171717',1,
  'FRESH SECOND VET REVISION','Second examination','Review','Return');
 IF a->>'kind'<>'saved' OR (a->>'revision')::integer<>2
 OR a->>'appointmentId'<>'a7171717-7777-4717-8717-171717171717'
 OR a->>'authorId'<>'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
 OR a->>'editorId'<>'ffffffff-ffff-4fff-8fff-ffffffffffff'
 THEN RAISE EXCEPTION 'CLINICAL_RESTORE_FAIL: fresh second editor revision/creator'; END IF;
 BEGIN
  PERFORM public.save_staff_clinical_encounter_draft(
   '11111111-0000-4000-8000-000000000077',
   '33333333-3333-4333-8333-333333333333',
   'a7171717-7777-4717-8717-171717171717','c8171717-7777-4717-8717-171717171717',1,
   'STALE FRESH REVISION','Second examination','Review','Return');
  RAISE EXCEPTION 'CLINICAL_RESTORE_FAIL: stale freshly created revision accepted';
 EXCEPTION WHEN serialization_failure THEN NULL; END;
 BEGIN
  PERFORM public.save_staff_clinical_encounter_draft(
   '22222222-0000-4000-8000-000000000077',
   '33333333-3333-4333-8333-333333333333',
   'a7171717-7777-4717-8717-171717171717','d8171717-7777-4717-8717-171717171717',2,
   'FOREIGN BRANCH','Second examination','Review','Return');
  RAISE EXCEPTION 'CLINICAL_RESTORE_FAIL: wrong branch freshly created draft accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $second_editor$;
RESET ROLE;
DO $post_edit$
BEGIN
 IF (SELECT count(*) FROM public.clinical_encounter_drafts
    WHERE revision=3 AND author_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    AND last_edited_by='ffffffff-ffff-4fff-8fff-ffffffffffff'
    AND complaint='REVISED BY SECOND VET')<>1
 OR (SELECT count(*) FROM clinic_private.clinical_draft_audit
   WHERE actor_id='ffffffff-ffff-4fff-8fff-ffffffffffff'
     AND action='revised' AND revision=3)<>1
 OR (SELECT count(*) FROM clinic_private.clinical_draft_audit
   WHERE actor_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
     AND action='revised' AND revision=2)<>1
 OR (SELECT count(*) FROM clinic_private.clinical_draft_requests
   WHERE actor_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
     AND request_id='a3939393-2222-4222-8222-333333333333'
     AND response->>'kind'='saved')<>1
 OR (SELECT count(*) FROM clinic_private.clinical_draft_requests
   WHERE actor_id='ffffffff-ffff-4fff-8fff-ffffffffffff'
     AND request_id='d3939393-2222-4222-8222-333333333333'
     AND response->>'kind'='saved')<>1
 OR (SELECT count(*) FROM public.clinical_encounter_drafts
  WHERE appointment_id='a7171717-7777-4717-8717-171717171717' AND revision=2
   AND author_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
   AND last_edited_by='ffffffff-ffff-4fff-8fff-ffffffffffff'
   AND complaint='FRESH SECOND VET REVISION')<>1
 OR (SELECT count(*) FROM clinic_private.clinical_draft_audit
  WHERE appointment_id='a7171717-7777-4717-8717-171717171717' AND revision=2 AND action='revised'
   AND actor_id='ffffffff-ffff-4fff-8fff-ffffffffffff'
   AND request_id='b8171717-7777-4717-8717-171717171717')<>1
 OR (SELECT count(*) FROM clinic_private.clinical_draft_audit
  WHERE appointment_id='a7171717-7777-4717-8717-171717171717')<>2
 OR (SELECT count(*) FROM clinic_private.clinical_draft_requests
  WHERE appointment_id='a7171717-7777-4717-8717-171717171717' AND actor_id='ffffffff-ffff-4fff-8fff-ffffffffffff'
   AND request_id='b8171717-7777-4717-8717-171717171717' AND response->>'revision'='2')<>1
 OR (SELECT count(*) FROM clinic_private.clinical_draft_requests
  WHERE appointment_id='a7171717-7777-4717-8717-171717171717')<>2
 THEN RAISE EXCEPTION 'CLINICAL_RESTORE_FAIL: draft audit receipt or immutable attribution'; END IF;
 -- Restore F to original revoked security subject BEFORE testing rejection.
 UPDATE public.staff_memberships SET is_active=false
 WHERE user_id='ffffffff-ffff-4fff-8fff-ffffffffffff';
END $post_edit$;
DO $denied_fixture$
BEGIN
 IF EXISTS(SELECT 1 FROM auth.users u JOIN public.staff_memberships m ON m.user_id=u.id
  WHERE u.id='ffffffff-ffff-4fff-8fff-ffffffffffff' AND m.is_active)
 OR NOT EXISTS(SELECT 1 FROM auth.users u JOIN public.staff_memberships m ON m.user_id=u.id
  JOIN public.staff_branch_memberships b ON b.user_id=u.id
  WHERE u.id='22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
   AND u.email_confirmed_at IS NULL AND m.role='veterinarian' AND m.is_active
   AND b.branch_id='11111111-0000-4000-8000-000000000077'
   AND b.is_active AND b.role='veterinarian')
 THEN RAISE EXCEPTION 'CLINICAL_RESTORE_FAIL: revoked or unconfirmed actor state drift'; END IF;
END $denied_fixture$;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims='{"role":"authenticated","is_anonymous":false}';
DO $denied$
DECLARE who uuid; label text;
BEGIN
 FOR label,who IN SELECT x.label,x.actor FROM (VALUES
  ('owner','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid),
  ('receptionist','cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid),
  ('administrator','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid),
  ('revoked_veterinarian','ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid),
  ('unconfirmed_veterinarian','22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid)
 ) x(label,actor) LOOP
  PERFORM set_config('request.jwt.claim.sub',who::text,true);
  BEGIN
   PERFORM public.save_staff_clinical_encounter_draft(
    '11111111-0000-4000-8000-000000000077',
    '33333333-3333-4333-8333-333333333333',
    'aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa',gen_random_uuid(),3,
    'UNAUTHORIZED '||label,'','','');
   RAISE EXCEPTION 'CLINICAL_RESTORE_FAIL: % wrote prohibited draft',label;
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  BEGIN
   PERFORM public.save_staff_clinical_encounter_draft(
    '11111111-0000-4000-8000-000000000077',
    '33333333-3333-4333-8333-333333333333',
    'a7171717-7777-4717-8717-171717171717',gen_random_uuid(),2,
    'UNAUTHORIZED FRESH '||label,'','','');
   RAISE EXCEPTION 'CLINICAL_RESTORE_FAIL: % edited new restored draft',label;
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
   PERFORM public.create_staff_appointment_clinical_record(
    'aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa',gen_random_uuid(),
    'UNAUTHORIZED MEDICAL RECORD '||label);
   RAISE EXCEPTION 'CLINICAL_RESTORE_FAIL: % wrote prohibited clinical record',label;
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 END LOOP;
 PERFORM set_config('request.jwt.claim.sub',
  '22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
 PERFORM set_config('request.jwt.claims',
  '{"role":"authenticated","is_anonymous":true}',true);
 BEGIN
  PERFORM public.save_staff_clinical_encounter_draft(
   '11111111-0000-4000-8000-000000000077',
   '33333333-3333-4333-8333-333333333333',
   'aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa',gen_random_uuid(),3,
   'ANONYMOUS','','','');
  RAISE EXCEPTION 'CLINICAL_RESTORE_FAIL: anonymous wrote draft';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $denied$;
RESET ROLE;
DO $after_denials$
BEGIN
 IF (SELECT count(*) FROM public.clinical_encounter_drafts)<>2
 OR (SELECT count(*) FROM clinic_private.clinical_draft_audit)<>5
 OR (SELECT count(*) FROM clinic_private.clinical_draft_requests)<>5
 OR (SELECT count(*) FROM clinic_private.clinical_record_provenance)<>1
 THEN RAISE EXCEPTION 'CLINICAL_RESTORE_FAIL: negative probe persisted private writes'; END IF;
END $after_denials$;
ROLLBACK;
\echo 'PASS: exact actor fixture validation, real unconfirmed veterinarian denied, archived-draft revision plus FRESH restored insert/replay/nonce/revision/second vet/stale/branch/role/audit/receipt and rollback';
