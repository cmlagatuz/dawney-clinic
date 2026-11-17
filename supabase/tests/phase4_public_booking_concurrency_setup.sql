-- Disposable PostgreSQL 17 ONLY. Deliberately fake service and Manila hours.
-- Execute only AFTER isolated bootstrap + booking migration in an empty PG17 DB.
insert into public.clinic_services(id,slug,display_name,duration_minutes,is_active,owner_approved_at,owner_approved_by,published_at)
values('88888888-8888-4888-8888-888888888888','race-ci-service','SYNTHETIC RACE SERVICE',30,true,now(),
'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',now());
insert into public.clinic_service_species(service_id,species_id)
values('88888888-8888-4888-8888-888888888888','dog');
insert into public.clinic_service_resources(service_id,resource_id,capacity)
values('88888888-8888-4888-8888-888888888888','55555555-5555-4555-8555-555555555555',1);
update public.species_catalog set clinic_supported=true where id='dog';
update public.clinic_booking_policy set weekly_hours=
'{"sun":[],"mon":[{"open":"09:00","close":"17:00"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[]}'::jsonb,
lead_minutes=0,max_advance_days=30,slot_step_minutes=30,
approved_at=now(),approved_by='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
is_approved=true,revision=2 where policy_id=1;
