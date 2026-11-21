-- Issue #58: ADDITIVE, SOURCE ONLY. Not installed on any Supabase project.
-- Depends on unchanged original 11 migrations, proposed #12 branch RLS, and
-- proposed #13 secure booking. No branch activation, grants, users or writes.
-- A branch's distinct "patients" count means pets with at least one visit
-- attributed to THAT branch. Historical NULL-branch visits are never guessed.
begin;
create function public.get_branch_dashboard_counts(p_branch uuid)
returns table(patients bigint, requested_appointments bigint, confirmed_appointments bigint)
language plpgsql stable security invoker set search_path=''
as $issue58$
begin
  -- A caller-selected branch ID is NOT an authorization claim. The existing
  -- function verifies active branch + matching active GLOBAL staff membership
  -- and live confirmed/unbanned/non-anonymous Auth state on every execution.
  perform public.assert_staff_branch(p_branch);
  return query
    select count(distinct a.pet_id)::bigint,
           count(*) filter(where a.status='requested')::bigint,
           count(*) filter(where a.status='confirmed')::bigint
      from public.appointments a
     where a.branch_id=p_branch;
  -- RLS on appointments still applies under SECURITY INVOKER. Do NOT make a
  -- SECURITY DEFINER count RPC or count all pets globally.
end;
$issue58$;
revoke all on function public.get_branch_dashboard_counts(uuid) from public,anon,authenticated;
grant execute on function public.get_branch_dashboard_counts(uuid) to authenticated;
commit;
