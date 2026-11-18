-- ISSUE58 disposable CI fixture ONLY. Run AFTER existing Issue77 PG17 denials
-- and BEFORE proposed Issue51 #13 booking validation (legacy fixture seed).
-- 251 simultaneous appointments use DIFFERENT Naga resources, so genuine
-- GiST overlap constraints are preserved; Cavite shares the UTC instant.
-- CI-only timestamps are NOT clinic scheduling approval or clinical hours.
create table clinic_ci.issue58_window as
select ((date_trunc('day',now() at time zone 'Asia/Manila')
 + interval '200 days 10 hours') at time zone 'Asia/Manila') as slot_start;
insert into public.appointment_resources(id,name,branch_id)
select gen_random_uuid(),'ISSUE58 Naga distinct room '||n,
 '11111111-0000-4000-8000-000000000077'
from generate_series(1,251) n;
insert into public.appointments
 (id,owner_id,pet_id,resource_id,starts_at,ends_at,status,concern,created_by)
select gen_random_uuid(),
 '11111111-1111-4111-8111-111111111111',
 '33333333-3333-4333-8333-333333333333',
 r.id,w.slot_start,w.slot_start+interval '30 minutes',
 'requested','ISSUE58 synthetic single-day Naga #251',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
from public.appointment_resources r cross join clinic_ci.issue58_window w
where r.name like 'ISSUE58 Naga distinct room %';
insert into public.appointment_resources(id,name,branch_id)
values ('abab5858-0000-4000-8000-000000000077',
 'ISSUE58 synthetic same-UTC Cavite room',
 '22222222-0000-4000-8000-000000000077');
insert into public.appointments
 (id,owner_id,pet_id,resource_id,starts_at,ends_at,status,concern,created_by)
select gen_random_uuid(),
 '22222222-2222-4222-8222-222222222222',
 '44444444-4444-4444-8444-444444444444',
 'abab5858-0000-4000-8000-000000000077',
 w.slot_start,w.slot_start+interval '30 minutes',
 'requested','ISSUE58 Cavite same-hour negative sentinel',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
from clinic_ci.issue58_window w;
do $fixture$
begin
 if (select count(*) from public.appointments where concern='ISSUE58 synthetic single-day Naga #251')<>251
 or (select count(*) from public.appointments where concern='ISSUE58 Cavite same-hour negative sentinel')<>1
 or (select count(*) from public.appointments where id='55555555-5555-4555-8555-555555555555'
 and branch_id is null and status='requested')<>1 then
  raise exception 'ISSUE58_FIXTURE_FAIL: expected 251+1 arrivals and historical UNKNOWN';
 end if;
end $fixture$;
\echo 'PASS: ISSUE58 251 same-day Naga arrivals plus one same-hour Cavite sentinel in distinct rooms (GiST preserved)'
