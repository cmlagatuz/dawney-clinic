-- Synthetic records only, inserted AFTER all six real Phase2/3 migrations.
-- photo_sha/card_sha and sizes supplied from actual generated binary files.
insert into auth.users(id,email,email_confirmed_at,is_anonymous) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','owner-a@example.invalid',now(),false),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','owner-b@example.invalid',now(),false),
('cccccccc-cccc-4ccc-8ccc-cccccccccccc','active-staff@example.invalid',now(),false),
('dddddddd-dddd-4ddd-8ddd-dddddddddddd','revoked-staff@example.invalid',now(),false),
('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','anonymous@example.invalid',now(),true);
insert into auth.identities(id,user_id,provider,provider_id) values
('11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','email','owner-a@example.invalid'),
('22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','email','owner-b@example.invalid'),
('33333333-cccc-4ccc-8ccc-cccccccccccc','cccccccc-cccc-4ccc-8ccc-cccccccccccc','email','active-staff@example.invalid'),
('44444444-dddd-4ddd-8ddd-dddddddddddd','dddddddd-dddd-4ddd-8ddd-dddddddddddd','email','revoked-staff@example.invalid'),
('55555555-eeee-4eee-8eee-eeeeeeeeeeee','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','email','anonymous@example.invalid');

insert into public.owners(id,user_id,first_name,last_name) values
('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Synthetic','Owner A'),
('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Synthetic','Owner B');
insert into public.pets(id,owner_id,name,species,breed) values
('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','Synthetic Chow','Dog','Chow Chow'),
('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222','Synthetic Cat','Cat',null);
-- The first real Phase2 migration itself seeds the general resource.
insert into public.appointments(
 id,owner_id,pet_id,resource_id,starts_at,ends_at,status,concern,created_by
) select
 '55555555-5555-4555-8555-555555555555',
 '11111111-1111-4111-8111-111111111111',
 '33333333-3333-4333-8333-333333333333',
 r.id,now()+interval '15 days',now()+interval '15 days 30 minutes',
 'requested','Synthetic Chow historic appointment',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
from public.appointment_resources r where r.name='General appointments';
insert into public.staff_memberships(user_id,role,is_active,assigned_by) values
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','receptionist',true,null),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','veterinarian',false,null);

-- Synthetic private Storage metadata: bytes live in a separate encrypted
-- object archive and are checked independently, not supplied by the database.
insert into storage.buckets(id,public) values('clinical-attachments',false);
insert into storage.objects(id,bucket_id,name,metadata) values
('66666666-6666-4666-8666-666666666666','clinical-attachments',
 'pets/33333333-3333-4333-8333-333333333333/owners/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/88888888-8888-4888-8888-888888888888.png',
 jsonb_build_object('mimetype','image/png','sha256',:'photo_sha','size',:photo_size)),
('77777777-7777-4777-8777-777777777777','clinical-attachments',
 'pets/44444444-4444-4444-8444-444444444444/owners/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/99999999-9999-4999-8999-999999999999.pdf',
 jsonb_build_object('mimetype','application/pdf','sha256',:'card_sha','size',:card_size));
