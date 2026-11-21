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
 -- Synthetic unconfirmed veterinarian membership exists ONLY inside this
 -- rollback-scoped test, with both legitimate grant tables populated.
 INSERT INTO public.staff_memberships(user_id,role,is_active)
 VALUES ('22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb','veterinarian',true);
 INSERT INTO public.staff_branch_memberships(user_id,branch_id,role,is_active)
 VALUES ('22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb',naga,'veterinarian',true);
 IF (SELECT count(*) FROM auth.users u JOIN public.staff_memberships m ON m.user_id=u.id
   JOIN public.staff_branch_memberships b ON b.user_id=u.id AND b.branch_id=naga
   WHERE u.id='22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
   AND u.email_confirmed_at IS NULL AND NOT u.is_anonymous
   AND m.role='veterinarian' AND m.is_active
   AND b.role='veterinarian' AND b.is_active)<>1
 THEN RAISE EXCEPTION 'CLINICAL_RESTORE_FAIL: unconfirmed vet fixture not genuine'; END IF;
END $fixture$;
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
RESET ROLE;
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
 IF (SELECT count(*) FROM public.clinical_encounter_drafts)<>1
 OR (SELECT count(*) FROM clinic_private.clinical_draft_audit)<>3
 OR (SELECT count(*) FROM clinic_private.clinical_draft_requests)<>3
 OR (SELECT count(*) FROM clinic_private.clinical_record_provenance)<>1
 THEN RAISE EXCEPTION 'CLINICAL_RESTORE_FAIL: negative probe persisted private writes'; END IF;
END $after_denials$;
ROLLBACK;
\echo 'PASS: exact actor fixture validation, real unconfirmed veterinarian denied, restored draft create/replay/mismatch/stale/second vet attribution/audit/nonce and no unauthorized persistence';
