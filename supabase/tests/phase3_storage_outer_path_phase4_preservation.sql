-- After exact reviewed four Phase4 migrations (and before/after the new
-- correction), ensure Dog/Chow Chow and historical appointment survive.
do $phase4_chain$
begin
 if (select count(*) from public.pets
     where id='33333333-3333-4333-8333-333333333333'
       and species='Dog' and breed='Chow Chow'
       and species_id='dog' and breed_id='dog-chow-chow'
       and taxonomy_review_needed=false)<>1 then
  raise exception 'Reviewed Phase4 did not preserve Chow Chow text and normalized breed';
 end if;
 if (select count(*) from public.appointments
      where id='55555555-5555-4555-8555-555555555555'
       and status='requested' and service_id is null
       and request_nonce is null)<>1 then
  raise exception 'Reviewed Phase4 did not preserve historical requested appointment';
 end if;
 if (select count(*) from pg_trigger
   where tgrelid='public.pets'::regclass
    and tgfoid='clinic_private.resolve_pet_taxonomy()'::regprocedure
    and tgenabled in ('A','O') and not tgisinternal)<>1 then
  raise exception 'Exactly one active Phase4 pet taxonomy trigger required';
 end if;
 if (select count(*) from public.clinic_services)<>0
    or (select count(*) from public.species_catalog where clinic_supported)<>0 then
  raise exception 'Synthetic test must not approve public services or clinic support';
 end if;
end $phase4_chain$;
