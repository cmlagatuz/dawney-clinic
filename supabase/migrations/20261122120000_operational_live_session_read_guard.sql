-- DAWNEY #20 — SOL PR126 P2: direct-table operational reads fail on deleted sessions.
-- SOURCE ONLY. Applies AFTER immutable migrations #1-#19, never autonomously hosted.
-- Do not remove existing role, branch, owner, column or write RLS policies.
begin;
set local search_path=pg_catalog;

-- SELECT/RLS cannot take a FOR SHARE lock from a STABLE predicate. Unlike the
-- VOLATILE write gate in #18, this STABLE read predicate checks the live
-- Supabase auth.sessions identity under the statement's MVCC snapshot.
-- No user_metadata, client active-branch flag or stale local session is trusted.
create function clinic_private.operational_read_session_live()
returns boolean language plpgsql stable security definer set search_path='' as $session$
declare
 v_actor uuid := (select auth.uid());
 v_claims jsonb := (select auth.jwt());
 v_sid text;
begin
 if v_actor is null
  or v_claims->>'role' is distinct from 'authenticated'
  or coalesce((v_claims->>'is_anonymous')::boolean,false)
  or not clinic_private.is_permanent_user()
  or v_claims->>'exp' is null
  or pg_catalog.to_timestamp((v_claims->>'exp')::bigint) <= pg_catalog.now()
 then return false; end if;
 v_sid := v_claims->>'session_id';
 if v_sid is null or v_sid !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 then return false; end if;
 return exists(
  select 1 from auth.sessions s
  where s.id=v_sid::uuid and s.user_id=v_actor
 );
exception
 when invalid_text_representation or numeric_value_out_of_range
   or datetime_field_overflow then
  return false;
end;
$session$;
revoke all on function clinic_private.operational_read_session_live()
 from public,anon,authenticated;
-- SECURITY DEFINER reads auth.sessions without granting browser users direct
-- access to the provider's Auth tables. clinic_private schema stays unexposed.
grant execute on function clinic_private.operational_read_session_live()
 to authenticated;

-- RESTRICTIVE AND existing permissive owner/branch policies, never replace
-- their scope. Metadata columns added in #19 inherit these RLS predicates.
create policy operational_live_session_staff_requests
 on public.staff_access_requests as restrictive for select to authenticated
 using ((select clinic_private.operational_read_session_live()));
create policy operational_live_session_catalog
 on public.medicine_catalog as restrictive for select to authenticated
 using ((select clinic_private.operational_read_session_live()));
create policy operational_live_session_branch_rules
 on public.branch_medicine_rules as restrictive for select to authenticated
 using ((select clinic_private.operational_read_session_live()));
create policy operational_live_session_stock_batches
 on public.branch_stock_batches as restrictive for select to authenticated
 using ((select clinic_private.operational_read_session_live()));
create policy operational_live_session_movements
 on public.stock_movements as restrictive for select to authenticated
 using ((select clinic_private.operational_read_session_live()));

-- Protect against silent future policy removal during migration development.
do $invariants$
declare v_count integer;
begin
 select count(*) into v_count from pg_catalog.pg_policies
 where schemaname='public' and permissive='RESTRICTIVE'
   and cmd='SELECT' and roles @> array['authenticated']::name[]
   and policyname like 'operational_live_session_%'
   and tablename = any(array[
     'staff_access_requests','medicine_catalog','branch_medicine_rules',
     'branch_stock_batches','stock_movements']);
 if v_count<>5 then
  raise exception 'Operational live-session restrictive policies incomplete'
   using errcode='42501';
 end if;
end;
$invariants$;
commit;
