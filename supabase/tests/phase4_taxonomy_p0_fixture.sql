-- Additional synthetic patients exist ONLY in the disposable PG17 CI service.
-- The first record matches the verified real-world Dog / Chow Chow label pair.
-- Do not use real patient identifiers or names in test fixtures.
insert into public.pets (id,owner_id,name,species,breed) values
 ('66666666-6666-4666-8666-666666666666','11111111-1111-4111-8111-111111111111',
  'CI Exact Chow','Dog','Chow Chow'),
 ('77777777-7777-4777-8777-777777777777','11111111-1111-4111-8111-111111111111',
  'CI Case Variant',' dog  ',' chOW cHoW  ');
-- Minimal appointment relation used only for migration row-preservation checks.
create table public.appointments(
 id uuid primary key,
 pet_id uuid not null references public.pets(id) on delete restrict,
 status text not null
);
insert into public.appointments(id,pet_id,status)
values('88888888-8888-4888-8888-888888888888',
       '66666666-6666-4666-8666-666666666666','requested');
