-- ISSUE58 disposable PostgreSQL17 branch-count and RLS acceptance.
-- Run original pinned 11 + unchanged #12 + approved #13 + proposed #14;
-- synthetic legacy + 251 same-day Naga / Cavite sentinel already populated.
-- ONLY local SQL session settings impersonate JWT claims; NOT hosted proof.
\set ON_ERROR_STOP on
begin;
set search_path=public,extensions,pg_catalog;
do $preflight$
begin
 if (select prosecdef from pg_proc where oid=
   'public.get_branch_dashboard_counts(uuid)'::regprocedure) then
  raise exception 'ISSUE58_FAIL: branch count RPC must remain SECURITY INVOKER';
 end if;
 if has_function_privilege('anon','public.get_branch_dashboard_counts(uuid)','EXECUTE')
 or not has_function_privilege('authenticated','public.get_branch_dashboard_counts(uuid)','EXECUTE')
 or exists(select 1 from public.clinic_branches where booking_enabled)
 or exists(select 1 from public.branch_booking_policies where is_approved) then
  raise exception 'ISSUE58_FAIL: permissions or branch feature flags were widened';
 end if;
 if (select count(*) from public.appointments
    where concern='ISSUE58 synthetic single-day Naga #251')<>251
 or (select count(*) from public.appointments
    where concern='ISSUE58 Cavite same-hour negative sentinel')<>1 then
  raise exception 'ISSUE58_FAIL: synthetic paginated fixture missing';
 end if;
end $preflight$;
-- Make receptionist C and administrator E Naga ONLY. Existing Cavite
-- memberships are temporarily inactive; the original PG fixture is intact.
update public.staff_branch_memberships set is_active=false
where user_id in
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')
 and branch_id='22222222-0000-4000-8000-000000000077';
insert into public.staff_branch_memberships(user_id,branch_id,role,is_active)
values
('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
 '11111111-0000-4000-8000-000000000077','receptionist',true),
('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
 '11111111-0000-4000-8000-000000000077','administrator',true);
-- Naga-only receptionist sees 251 in same Manila day, not 252 from Cavite.
set role authenticated;
set request.jwt.claim.sub='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false}';
set request.jwt.claim.active_branch_id='22222222-0000-4000-8000-000000000077';
do $receptionist$
declare s timestamptz; w_start timestamptz; w_end timestamptz;
        n250 int; n251 int; n252 int;
        p bigint; req bigint; conf bigint;
begin
 if public.assert_staff_branch('11111111-0000-4000-8000-000000000077')
   is distinct from '11111111-0000-4000-8000-000000000077'::uuid then
  raise exception 'ISSUE58_FAIL: Naga receptionist unable to assert own branch';
 end if;
 begin
  perform public.assert_staff_branch('22222222-0000-4000-8000-000000000077');
  raise exception 'ISSUE58_FAIL: branch ID spoof via active_branch_id JWT reached Cavite';
 exception when insufficient_privilege then null;end;
 begin
  perform public.get_branch_dashboard_counts('22222222-0000-4000-8000-000000000077');
  raise exception 'ISSUE58_FAIL: Cavite dashboard count leaked';
 exception when insufficient_privilege then null;end;
 select patients,requested_appointments,confirmed_appointments into p,req,conf
 from public.get_branch_dashboard_counts('11111111-0000-4000-8000-000000000077');
 if p<>1 or req<>502 or conf<>1 then
  raise exception 'ISSUE58_FAIL: Naga scoped patient/request/confirmed counts %/%/%',p,req,conf;
 end if;
 select min(starts_at) into s from public.appointments
 where concern='ISSUE58 synthetic single-day Naga #251';
 if s is null then raise exception 'ISSUE58_FAIL: Naga scoped window unavailable';end if;
 w_start:=(date_trunc('day',s at time zone 'Asia/Manila') at time zone 'Asia/Manila');
 w_end:=((date_trunc('day',s at time zone 'Asia/Manila')+interval '1 day') at time zone 'Asia/Manila');
 if (extract(epoch from w_end-w_start))<>86400 or s<w_start or s>=w_end then
  raise exception 'ISSUE58_FAIL: Manila local day UTC bounds invalid';end if;
 select count(*) into n250 from (
  select id from public.appointments where branch_id='11111111-0000-4000-8000-000000000077'
    and starts_at>=w_start and starts_at<w_end
    order by starts_at,id limit 250
 ) w;
 select count(*) into n251 from (
  select id from public.appointments where branch_id='11111111-0000-4000-8000-000000000077'
    and starts_at>=w_start and starts_at<w_end
    order by starts_at,id limit 251
 ) w;
 select count(*) into n252 from public.appointments where branch_id='11111111-0000-4000-8000-000000000077'
    and starts_at>=w_start and starts_at<w_end;
 if n250<>250 or n251<>251 or n252<>251
 or exists(select 1 from public.appointments where concern='ISSUE58 Cavite same-hour negative sentinel')
 or exists(select 1 from public.clinical_records) then
  raise exception 'ISSUE58_FAIL: 250/251 day pagination or Cavite/medical leak %/%/%',
   n250,n251,n252;
 end if;
end $receptionist$;
reset role;

-- Naga administrator is globally admin but membership is branch-scoped.
set role authenticated;
set request.jwt.claim.sub='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false}';
do $naga_admin$
declare n integer; p bigint; req bigint; conf bigint;
begin
 select count(*) into n from public.clinical_records;
 if n<>1 or exists(select 1 from public.clinical_records
   where branch_id='22222222-0000-4000-8000-000000000077') then
  raise exception 'ISSUE58_FAIL: Naga admin read Cavite or lost Naga medical chart: %',n;end if;
 select patients,requested_appointments,confirmed_appointments into p,req,conf
 from public.get_branch_dashboard_counts('11111111-0000-4000-8000-000000000077');
 if p<>1 or req<>502 or conf<>1 then
   raise exception 'ISSUE58_FAIL: Naga administrator dashboard differs';end if;
 begin
  perform public.get_branch_dashboard_counts('22222222-0000-4000-8000-000000000077');
  raise exception 'ISSUE58_FAIL: global administrator read Cavite count without grant';
 exception when insufficient_privilege then null;end;
end $naga_admin$;
reset role;
-- Inactive BRANCH membership denies even with otherwise active global role.
update public.staff_branch_memberships set is_active=false
 where user_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
 and branch_id='11111111-0000-4000-8000-000000000077';
set role authenticated;
set request.jwt.claim.sub='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
do $revoked_branch$
begin
 begin
  perform public.assert_staff_branch('11111111-0000-4000-8000-000000000077');
  raise exception 'ISSUE58_FAIL: inactive branch membership asserted';exception when insufficient_privilege then null;end;
 begin
  perform public.get_branch_dashboard_counts('11111111-0000-4000-8000-000000000077');
  raise exception 'ISSUE58_FAIL: inactive branch counted rows';exception when insufficient_privilege then null;end;
 if exists(select 1 from public.appointments
  where branch_id='11111111-0000-4000-8000-000000000077') then
  raise exception 'ISSUE58_FAIL: revoked receptionist can still read queue';end if;
end $revoked_branch$;
reset role;
-- Inactive GLOBAL membership cannot be bypassed by an active branch row.
-- Use receptionist C, not admin E: the existing audited database trigger
-- correctly forbids disabling the LAST active administrator.
update public.staff_branch_memberships set is_active=true
 where user_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
 and branch_id='11111111-0000-4000-8000-000000000077';
update public.staff_memberships set is_active=false
 where user_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
set role authenticated;
set request.jwt.claim.sub='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
do $revoked_global$
begin
 begin
  perform public.assert_staff_branch('11111111-0000-4000-8000-000000000077');
  raise exception 'ISSUE58_FAIL: revoked global receptionist asserted';exception when insufficient_privilege then null;end;
 begin
  perform public.get_branch_dashboard_counts('11111111-0000-4000-8000-000000000077');
  raise exception 'ISSUE58_FAIL: revoked global receptionist counted patients';exception when insufficient_privilege then null;end;
end $revoked_global$;
reset role;
-- Account change to real owner B / unconfirmed / anonymous, never inherited.
set role authenticated;
set request.jwt.claim.sub='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
do $owner_b$
begin
 begin
  perform public.get_branch_dashboard_counts('11111111-0000-4000-8000-000000000077');
  raise exception 'ISSUE58_FAIL: account switch owner B gained Naga staff count';
 exception when insufficient_privilege then null;end;
end $owner_b$;
reset role;
set role authenticated;
set request.jwt.claim.sub='22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
do $unconfirmed$
begin
 begin
  perform public.assert_staff_branch('11111111-0000-4000-8000-000000000077');
  raise exception 'ISSUE58_FAIL: unconfirmed impersonation gained staff membership';
 exception when insufficient_privilege then null;end;
end $unconfirmed$;
reset role;
set role authenticated;
set request.jwt.claim.sub='11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set request.jwt.claims='{"role":"authenticated","is_anonymous":true}';
do $anon$
begin
 begin
  perform public.get_branch_dashboard_counts('11111111-0000-4000-8000-000000000077');
  raise exception 'ISSUE58_FAIL: anonymous role gained staff dashboard';
 exception when insufficient_privilege then null;end;
end $anon$;
reset role;
-- Historical Dog/Chow Chow+requested remain immutable and NULL branch.
do $history$
begin
 if (select count(*) from public.appointments where id=
    '55555555-5555-4555-8555-555555555555'
    and branch_id is null and status='requested')<>1
 or (select count(*) from public.pets where id=
    '33333333-3333-4333-8333-333333333333'
    and species='Dog' and breed='Chow Chow'
    and breed_id='dog-chow-chow')<>1
 or exists(select 1 from clinic_ci.issue77_original_appointments old
  join public.appointments a using(id)
  where to_jsonb(a)-'branch_id' is distinct from old.old_row) then
  raise exception 'ISSUE58_FAIL: historical Chow Chow or unknown attribution changed';
 end if;
end $history$;
rollback;
\echo 'PASS: ISSUE58 real PG17 Naga receptionist/admin 250/251 Manila-day queue, branch dashboard distinct pet, Cavite/medical deny, JWT branch spoof, membership/global revocation, account change, historical Chow Chow UNKNOWN'
