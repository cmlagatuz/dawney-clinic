-- Synthetic identities + patient/appointment/storage metadata ONLY.
-- Insert as postgres AFTER six real Phase2/3 migrations, before the fix.
insert into auth.users(id,email,email_confirmed_at,is_anonymous) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','owner-a@example.invalid',now(),false),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','owner-b@example.invalid',now(),false),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','receptionist@example.invalid',now(),false),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','veterinarian@example.invalid',now(),false),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','administrator@example.invalid',now(),false),
 ('ffffffff-ffff-4fff-8fff-ffffffffffff','revoked-vet@example.invalid',now(),false),
 ('11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa','anonymous@example.invalid',null,true),
 ('22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb','unconfirmed@example.invalid',null,false);
insert into auth.identities(id,user_id,provider,provider_id)
select gen_random_uuid(),id,'email',email from auth.users;
insert into public.owners(id,user_id,first_name,last_name) values
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Synthetic','A'),
 ('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Synthetic','B');
insert into public.pets(id,owner_id,name,species,breed) values
 ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','Synthetic Chow','Dog','Chow Chow'),
 ('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222','Synthetic Cat','Cat',null);
insert into public.appointments(id,owner_id,pet_id,resource_id,starts_at,ends_at,status,concern,created_by)
select '55555555-5555-4555-8555-555555555555',
 '11111111-1111-4111-8111-111111111111',
 '33333333-3333-4333-8333-333333333333',r.id,
 now()+interval '15 days',now()+interval '15 days 30 minutes','requested',
 'Synthetic historic appointment','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
from public.appointment_resources r where r.name='General appointments';
insert into public.staff_memberships(user_id,role,is_active) values
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','receptionist',true),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','veterinarian',true),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','administrator',true),
 ('ffffffff-ffff-4fff-8fff-ffffffffffff','veterinarian',false);

-- The private bucket and bytes here are synthetic metadata; NOT Storage API.
insert into storage.buckets(id,public) values
 ('clinical-attachments',false),('other-private',false);
insert into storage.objects(bucket_id,name,metadata) values
 ('clinical-attachments','pets/33333333-3333-4333-8333-333333333333/owners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/88888888-8888-4888-8888-888888888888.png','{"mimetype":"image/png"}'),
 ('clinical-attachments','pets/44444444-4444-4444-8444-444444444444/owners/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/99999999-9999-4999-8999-999999999999.pdf','{"mimetype":"application/pdf"}'),
 ('clinical-attachments','pets/33333333-3333-4333-8333-333333333333/clinic/cccccccc-cccc-4ccc-8ccc-cccccccccccc.png','{"mimetype":"image/png"}'),
 ('clinical-attachments','pets/44444444-4444-4444-8444-444444444444/clinic/dddddddd-dddd-4ddd-8ddd-dddddddddddd.pdf','{"mimetype":"application/pdf"}'),
 ('other-private','pets/33333333-3333-4333-8333-333333333333/owners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/77777777-7777-4777-8777-777777777777.png','{"mimetype":"image/png"}'),
 ('clinical-attachments','pets/33333333-3333-4333-8333-333333333333/owners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/invalid.txt','{"mimetype":"text/plain"}');
