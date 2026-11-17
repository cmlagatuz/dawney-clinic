-- One disposable database, after PR59 booking/queue transaction rollbacks
-- and PR62 Storage matrix rollback. Structural + final patient preservation gate.
do $combined$
begin
 if (select count(*) from auth.users)<>8
    or (select count(*) from auth.identities)<>8
    or (select count(*) from public.owners)<>2
    or (select count(*) from public.pets)<>2
    or (select count(*) from public.appointments)<>1
    or (select count(*) from storage.objects)<>6 then
  raise exception 'Combined integration changed original PR62 fixtures';
 end if;
 if (select count(*) from public.pets where id='33333333-3333-4333-8333-333333333333'
     and species='Dog' and breed='Chow Chow'
     and species_id='dog' and breed_id='dog-chow-chow'
     and taxonomy_review_needed=false)<>1
    or (select count(*) from public.appointments where id='55555555-5555-4555-8555-555555555555'
      and pet_id='33333333-3333-4333-8333-333333333333'
      and status='requested' and service_id is null)<>1
    or (select count(*) from public.clinic_services)<>0
    or (select count(*) from public.clinic_booking_policy where is_approved)<>0 then
  raise exception 'Chow Chow history or zero-default service approvals altered';
 end if;
 if (select count(*) from pg_policies where schemaname='storage'
      and tablename='objects' and roles=array['authenticated'::name]
      and ((policyname='clinical_attachments_read_scoped' and cmd='SELECT')
        or (policyname='clinical_attachments_insert_scoped' and cmd='INSERT')))<>2
    or not (select relrowsecurity from pg_class
      where oid='storage.objects'::regclass) then
  raise exception 'Additive Storage policy missing or privilege widened';
 end if;
end $combined$;
select 'PASS: same PG17 database, original six + four + additive policy, PR59 staff and booking tests, PR62 Storage tests, preserved Chow Chow appointment' as verdict;
