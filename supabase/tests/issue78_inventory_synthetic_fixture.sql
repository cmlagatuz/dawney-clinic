-- ISSUE #78 DISPOSABLE PG17 SYNTHETIC FIXTURE ONLY. Not migrated.
-- Depends on original 11 + unchanged proposed #12/#13/#14 + new #15.
-- No real medicine name, lot, supplier, stock or clinical procurement record.
\set ON_ERROR_STOP on
begin;
-- CI-only staff grants: Naga veterinarian D; Cavite administrator E.
update public.staff_branch_memberships set is_active=true
 where user_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
 and branch_id='11111111-0000-4000-8000-000000000077';
insert into public.medicine_catalog
 (id,product_code,generic_name,formulation,strength,stock_unit,minimum_shelf_life_days,is_active)
values
 ('a0000078-0000-4000-8000-000000000001','QA78-A','Synthetic QA medicine A','synthetic vial','1 unit','vial',0,true),
 ('a0000078-0000-4000-8000-000000000002','QA78-B','Synthetic QA medicine B','synthetic tablet','1 unit','tablet',0,true),
 ('a0000078-0000-4000-8000-000000000003','QA78-C','Synthetic QA medicine C','synthetic packet','1 unit','packet',0,true),
 ('a0000078-0000-4000-8000-000000000004','QA78-D','Synthetic QA medicine D','synthetic pack','1 unit','pack',0,true);
insert into public.branch_medicine_rules(branch_id,medicine_id,reorder_point_units,expiry_warning_days)
values
 ('11111111-0000-4000-8000-000000000077','a0000078-0000-4000-8000-000000000001',25,30),
 ('11111111-0000-4000-8000-000000000077','a0000078-0000-4000-8000-000000000002',5,60),
 ('11111111-0000-4000-8000-000000000077','a0000078-0000-4000-8000-000000000003',2,90),
 ('11111111-0000-4000-8000-000000000077','a0000078-0000-4000-8000-000000000004',10,30),
 ('22222222-0000-4000-8000-000000000077','a0000078-0000-4000-8000-000000000001',2,30);
insert into public.branch_stock_batches
 (id,branch_id,medicine_id,lot_number,received_on,expiry_date,
  disposition,on_hand_units,reserved_units,quarantined_units,unit_cost_minor,currency_code)
values
 ('b0000078-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000077','a0000078-0000-4000-8000-000000000001','N-A-20',current_date-30,current_date+20,'released',7,2,1,100,'PHP'),
 ('b0000078-0000-4000-8000-000000000002','11111111-0000-4000-8000-000000000077','a0000078-0000-4000-8000-000000000001','N-A-40',current_date-20,current_date+40,'released',20,0,0,200,'PHP'),
 ('b0000078-0000-4000-8000-000000000003','11111111-0000-4000-8000-000000000077','a0000078-0000-4000-8000-000000000001','N-A-EXP',current_date-100,current_date-5,'released',9,0,0,200,'PHP'),
 ('b0000078-0000-4000-8000-000000000004','11111111-0000-4000-8000-000000000077','a0000078-0000-4000-8000-000000000001','N-A-Q',current_date-10,current_date+10,'quarantined',30,0,0,200,'PHP'),
 ('b0000078-0000-4000-8000-000000000005','11111111-0000-4000-8000-000000000077','a0000078-0000-4000-8000-000000000001','N-A-RECALL',current_date-10,current_date+12,'recalled',5,0,0,200,'PHP'),
 ('b0000078-0000-4000-8000-000000000006','11111111-0000-4000-8000-000000000077','a0000078-0000-4000-8000-000000000001','N-A-RES',current_date-10,current_date+25,'released',4,3,1,200,'PHP'),
 ('b0000078-0000-4000-8000-000000000007','11111111-0000-4000-8000-000000000077','a0000078-0000-4000-8000-000000000002','N-B-45',current_date-10,current_date+45,'released',4,0,0,100,'PHP'),
 ('b0000078-0000-4000-8000-000000000008','11111111-0000-4000-8000-000000000077','a0000078-0000-4000-8000-000000000003','N-C-75',current_date-10,current_date+75,'released',1,0,0,100,'PHP'),
 ('b0000078-0000-4000-8000-000000000009','22222222-0000-4000-8000-000000000077','a0000078-0000-4000-8000-000000000001','C-A-5',current_date-10,current_date+5,'released',3,0,0,999,'PHP');
insert into public.stock_movements
 (id,branch_id,medicine_id,batch_id,event_id,event_type,delta_on_hand,
  delta_reserved,delta_quarantined,after_on_hand,after_reserved,after_quarantined,reason_code,recorded_by)
values
 ('d0000078-0000-4000-8000-000000000001',
  '11111111-0000-4000-8000-000000000077',
  'a0000078-0000-4000-8000-000000000001',
  'b0000078-0000-4000-8000-000000000001',
  'e0000078-0000-4000-8000-000000000001','opening',7,2,1,7,2,1,'synthetic_opening',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
 ('d0000078-0000-4000-8000-000000000002',
  '22222222-0000-4000-8000-000000000077',
  'a0000078-0000-4000-8000-000000000001',
  'b0000078-0000-4000-8000-000000000009',
  'e0000078-0000-4000-8000-000000000002','opening',3,0,0,3,0,0,'synthetic_opening',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
commit;
\echo 'PASS: ISSUE78 fake Naga/Cavite catalog, branch batches and isolated opening audit rows committed in disposable PG17 only'
