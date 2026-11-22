-- RED: exercise the original #18/#19 RLS bypass BEFORE additive #20.
-- This script passes ONLY if it observes the missing deleted-session check,
-- against actual persisted synthetic staff + stock rows. CI fixture only.
\set ON_ERROR_STOP on
set role authenticated;
set request.jwt.claim.sub='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"c2222222-aaaa-4aaa-8aaa-222222222222"}';
do $active$
begin
 if not exists(select 1 from public.staff_access_requests where user_id='bbbbbbbb-6666-4666-8666-bbbbbbbbbbbb')
 or not exists(select 1 from public.branch_stock_batches where branch_id='22222222-0000-4000-8000-000000000077')
 then raise exception 'RED_REPRO_INVALID: no known-existing authorized rows';end if;
end $active$;
reset role;
delete from auth.sessions where id='c2222222-aaaa-4aaa-8aaa-222222222222';
set role authenticated;
set request.jwt.claim.sub='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
set request.jwt.claims='{"role":"authenticated","is_anonymous":false,"exp":4102444800,"session_id":"c2222222-aaaa-4aaa-8aaa-222222222222"}';
do $leak$
begin
 if not exists(select 1 from public.staff_access_requests where user_id='bbbbbbbb-6666-4666-8666-bbbbbbbbbbbb')
 or not exists(select 1 from public.branch_stock_batches where branch_id='22222222-0000-4000-8000-000000000077')
 or not exists(select 1 from public.medicine_catalog where product_code='OPS-SUP-001')
 or not exists(select 1 from public.stock_movements where branch_id='22222222-0000-4000-8000-000000000077')
 or not exists(select 1 from public.branch_medicine_rules where branch_id='22222222-0000-4000-8000-000000000077')
 then raise exception 'RED_REPRO_INVALID: pre-fix leak was not reproduced';end if;
 begin
  perform public.list_staff_access_requests('22222222-0000-4000-8000-000000000077');
  raise exception 'RED_REPRO_INVALID: revoked RPC unexpectedly accepted';
 exception when insufficient_privilege then null;end;
end $leak$;
reset role;
insert into auth.sessions(id,user_id) values
 ('c2222222-aaaa-4aaa-8aaa-222222222222','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
\echo 'RED REPRODUCED: PR126 deleted-session token still directly reads five existing operational tables; RPC denied'
