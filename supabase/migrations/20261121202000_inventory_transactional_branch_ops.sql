-- DAWNEY #19 — audited branch inventory creation/receiving; SOURCE ONLY.
-- Requires original #1-#17 plus staff approval #18, existing FEFO #15 untouched.
-- No seed stock, authorized real medicines or provider SQL. Finance/dispense OFF.
begin;
set local search_path=public,pg_catalog;

-- Extend existing catalog instead of replacing medicine_id, batch IDs or FEFO views.
alter table public.medicine_catalog
 add column category text not null default 'medicine'
   check(category in ('medicine','consumable','supply')),
 add column description text not null default ''
   check(length(description)<=2000);
alter table public.branch_medicine_rules
 add column branch_display_name text
   check(branch_display_name is null or length(btrim(branch_display_name)) between 2 and 160),
 add column branch_description text
   check(branch_description is null or length(branch_description)<=2000),
 add column profile_revision integer not null default 1
   check(profile_revision>0);
alter table public.branch_stock_batches
 add column supplier_name text
   check(supplier_name is null or length(btrim(supplier_name)) between 2 and 120);
grant select(category,description) on public.medicine_catalog to authenticated;
grant select(branch_display_name,branch_description,profile_revision)
 on public.branch_medicine_rules to authenticated;
grant select(supplier_name) on public.branch_stock_batches to authenticated;

create table clinic_private.inventory_write_receipts(
 actor_id uuid not null references auth.users(id) on delete restrict,
 nonce uuid not null,
 branch_id uuid not null references public.clinic_branches(id) on delete restrict,
 kind text not null check(kind in ('create','receive')),
 request_payload jsonb not null,
 response jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(actor_id,nonce),
 constraint inventory_request_unique_per_branch unique(branch_id,nonce)
);
alter table clinic_private.inventory_write_receipts enable row level security;
revoke all on clinic_private.inventory_write_receipts from public,anon,authenticated;
create trigger inventory_receipt_never_rewrite
 before update or delete on clinic_private.inventory_write_receipts
 for each row execute function clinic_private.block_inventory_ledger_rewrite();
create trigger inventory_receipt_never_truncate
 before truncate on clinic_private.inventory_write_receipts
 for each statement execute function clinic_private.block_inventory_ledger_rewrite();

-- Holds live Auth, session and BOTH role grants under row locks to prevent
-- concurrent staff revoke or branch reassignment during a stock transaction.
create function clinic_private.require_inventory_writer(p_branch uuid)
returns uuid language plpgsql volatile security definer set search_path='' as $inventory_actor$
declare v_actor uuid; v_granted uuid;
begin
 v_actor:=clinic_private.require_operational_actor();
 select bm.user_id into v_granted
 from public.staff_branch_memberships bm
 join public.staff_memberships sm on sm.user_id=bm.user_id
 join auth.users u on u.id=sm.user_id
 where bm.user_id=v_actor and bm.branch_id=p_branch and bm.is_active
   and bm.role in ('administrator','receptionist')
   and sm.role=bm.role and sm.is_active
   and u.email_confirmed_at is not null and not u.is_anonymous
   and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())
 for share of bm,sm,u;
 if v_granted is null then
  raise exception 'Active branch inventory writer required' using errcode='42501'; end if;
 return v_actor;
end;
$inventory_actor$;
revoke all on function clinic_private.require_inventory_writer(uuid)
 from public,anon,authenticated;

create function public.create_branch_inventory_item(
 p_branch uuid,p_request_id uuid,p_product_code text,p_name text,
 p_description text,p_category text,p_unit text,p_formulation text,
 p_strength text,p_reorder_point bigint,p_lot text,p_expiry date,
 p_supplier text,p_opening_units bigint)
returns jsonb language plpgsql volatile security definer set search_path='' as $create_item$
declare v_actor uuid; v_code text; v_date date; v_payload jsonb;
 v_prior clinic_private.inventory_write_receipts%rowtype;
 v_medicine uuid; v_batch uuid; v_response jsonb;
begin
 v_actor:=clinic_private.require_inventory_writer(p_branch);
 v_code:=upper(btrim(p_product_code));
 if p_request_id is null or p_product_code is null
  or v_code !~ '^[A-Z0-9][A-Z0-9._-]{1,39}$'
  or p_product_code<>v_code
  or p_name is null or length(btrim(p_name)) not between 2 and 160
  or p_description is null or length(p_description)>2000
  or p_category is null or p_category not in ('medicine','consumable','supply')
  or p_unit is null or p_unit !~ '^[a-z][a-z0-9_-]{1,29}$'
  or p_reorder_point is null or p_reorder_point not between 0 and 1000000000
  or p_opening_units is null or p_opening_units not between 0 and 1000000000
  or p_supplier is not null and length(btrim(p_supplier)) not between 2 and 120
  or p_category='medicine' and (p_formulation is null or
      length(btrim(p_formulation)) not between 2 and 80
      or p_strength is null or length(btrim(p_strength)) not between 1 and 80)
  or p_category<>'medicine' and (p_formulation is not null
     and length(p_formulation)>80 or p_strength is not null and length(p_strength)>80)
  or p_opening_units>0 and (p_lot is null or
      length(btrim(p_lot)) not between 1 and 80 or p_expiry is null)
 then raise exception 'Invalid product, unit, category, lot or quantity' using errcode='22023'; end if;
 select (clock_timestamp() at time zone b.timezone)::date into v_date
 from public.clinic_branches b where b.id=p_branch;
 if v_date is null or (p_opening_units>0 and p_expiry<=v_date) then
  raise exception 'Expired or invalid opening lot' using errcode='23514'; end if;
 v_payload:=pg_catalog.jsonb_build_object('branch',p_branch,'code',v_code,
  'name',btrim(p_name),'description',p_description,'category',p_category,
  'unit',p_unit,'formulation',p_formulation,'strength',p_strength,
  'reorder',p_reorder_point,'lot',p_lot,'expiry',p_expiry,
  'supplier',p_supplier,'opening',p_opening_units);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  'dawney-inventory-code:'||v_code,0));
 select * into v_prior from clinic_private.inventory_write_receipts
  where actor_id=v_actor and nonce=p_request_id;
 if found then
  if v_prior.kind<>'create' or v_prior.request_payload is distinct from v_payload
   then raise exception 'Inventory nonce reused with changed payload' using errcode='23505'; end if;
  return v_prior.response;
 end if;
 if exists(select 1 from public.medicine_catalog where product_code=v_code) then
  raise exception 'Product code already registered' using errcode='23505'; end if;
 insert into public.medicine_catalog
  (product_code,generic_name,formulation,strength,stock_unit,
   category,description,is_active,is_controlled)
 values (v_code,btrim(p_name),
  case when p_category='medicine' then btrim(p_formulation) else 'Not applicable' end,
  case when p_category='medicine' then btrim(p_strength) else 'N/A' end,
  p_unit,p_category,p_description,true,false) returning id into v_medicine;
 insert into public.branch_medicine_rules
  (branch_id,medicine_id,reorder_point_units,expiry_warning_days,
   branch_display_name,branch_description)
 values(p_branch,v_medicine,p_reorder_point,30,btrim(p_name),p_description);
 if p_opening_units>0 then
  insert into public.branch_stock_batches
   (branch_id,medicine_id,lot_number,supplier_reference,supplier_name,
    received_on,expiry_date,disposition,on_hand_units)
  values(p_branch,v_medicine,btrim(p_lot),p_supplier,p_supplier,
   v_date,p_expiry,'released',p_opening_units)
  returning id into v_batch;
  insert into public.stock_movements
   (branch_id,medicine_id,batch_id,event_id,event_type,
    delta_on_hand,after_on_hand,after_reserved,after_quarantined,reason_code,recorded_by)
  values(p_branch,v_medicine,v_batch,p_request_id,'opening',
   p_opening_units,p_opening_units,0,0,'opening_balance',v_actor);
 end if;
 v_response:=pg_catalog.jsonb_build_object('kind','inventory_item',
  'itemId',v_medicine,'branchId',p_branch,'productCode',v_code,
  'category',p_category,'unit',p_unit,'revision',1,
  'onHandUnits',p_opening_units,'batchId',v_batch);
 insert into clinic_private.inventory_write_receipts
  (actor_id,nonce,branch_id,kind,request_payload,response)
 values(v_actor,p_request_id,p_branch,'create',v_payload,v_response);
 return v_response;
end;
$create_item$;

create function public.receive_branch_inventory_stock(
 p_branch uuid,p_medicine uuid,p_request_id uuid,p_lot text,
 p_expiry date,p_supplier text,p_quantity bigint)
returns jsonb language plpgsql volatile security definer set search_path='' as $receive$
declare v_actor uuid; v_date date; v_payload jsonb;
 v_prior clinic_private.inventory_write_receipts%rowtype;
 v_item public.medicine_catalog%rowtype; v_batch uuid;
 v_onhand bigint; v_reserved bigint; v_quarantined bigint; v_response jsonb;
begin
 v_actor:=clinic_private.require_inventory_writer(p_branch);
 if p_medicine is null or p_request_id is null or p_lot is null
  or length(btrim(p_lot)) not between 1 and 80
  or p_quantity is null or p_quantity not between 1 and 1000000000
  or p_expiry is null
  or p_supplier is not null and length(btrim(p_supplier)) not between 2 and 120
 then raise exception 'Invalid inventory receipt fields' using errcode='22023'; end if;
 select (clock_timestamp() at time zone b.timezone)::date into v_date
 from public.clinic_branches b where b.id=p_branch;
 if v_date is null or p_expiry<=v_date then
  raise exception 'Expired receipt lot' using errcode='23514'; end if;
 v_payload:=pg_catalog.jsonb_build_object('branch',p_branch,'item',p_medicine,
  'lot',btrim(p_lot),'expiry',p_expiry,'supplier',p_supplier,'quantity',p_quantity);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  'dawney-inventory-lot:'||p_branch::text||':'||p_medicine::text||':'||
  btrim(p_lot)||':'||p_expiry::text,0));
 select * into v_prior from clinic_private.inventory_write_receipts
  where actor_id=v_actor and nonce=p_request_id;
 if found then
  if v_prior.kind<>'receive' or v_prior.request_payload is distinct from v_payload
   then raise exception 'Inventory nonce reused with changed payload' using errcode='23505'; end if;
  return v_prior.response;
 end if;
 select m.* into v_item from public.medicine_catalog m
  join public.branch_medicine_rules r on r.medicine_id=m.id and r.branch_id=p_branch
  where m.id=p_medicine for share of m,r;
 if not found or not v_item.is_active or v_item.is_controlled then
  raise exception 'Unapproved, controlled or non-branch stock item' using errcode='42501'; end if;
 -- One conflict target per branch/product/lot/expiry, serialized above.
 insert into public.branch_stock_batches
   (branch_id,medicine_id,lot_number,supplier_reference,supplier_name,
    received_on,expiry_date,disposition,on_hand_units)
 values(p_branch,p_medicine,btrim(p_lot),p_supplier,p_supplier,
    v_date,p_expiry,'released',p_quantity)
 on conflict(branch_id,medicine_id,lot_number,expiry_date)
 do update set on_hand_units=public.branch_stock_batches.on_hand_units+excluded.on_hand_units
 where public.branch_stock_batches.disposition='released'
  and public.branch_stock_batches.supplier_reference is not distinct from excluded.supplier_reference
  and public.branch_stock_batches.on_hand_units<=1000000000-excluded.on_hand_units
 returning id,on_hand_units,reserved_units,quarantined_units
 into v_batch,v_onhand,v_reserved,v_quarantined;
 if v_batch is null then
  raise exception 'Lot quarantined, supplier conflict, or stock ceiling exceeded' using errcode='23514';
 end if;
 insert into public.stock_movements
  (branch_id,medicine_id,batch_id,event_id,event_type,delta_on_hand,
   after_on_hand,after_reserved,after_quarantined,reason_code,recorded_by)
 values(p_branch,p_medicine,v_batch,p_request_id,'receipt',p_quantity,
  v_onhand,v_reserved,v_quarantined,'supplier_receipt',v_actor);
 v_response:=pg_catalog.jsonb_build_object('kind','stock_received',
  'branchId',p_branch,'itemId',p_medicine,'batchId',v_batch,
  'receivedUnits',p_quantity,'lotOnHandUnits',v_onhand,
  'actorId',v_actor,'eventId',p_request_id);
 insert into clinic_private.inventory_write_receipts
  (actor_id,nonce,branch_id,kind,request_payload,response)
 values(v_actor,p_request_id,p_branch,'receive',v_payload,v_response);
 return v_response;
end;
$receive$;

create function public.edit_branch_inventory_item(
 p_branch uuid,p_medicine uuid,p_expected_revision integer,
 p_name text,p_description text,p_reorder_point bigint,p_expiry_warning_days integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $edit_item$
declare v_actor uuid; v_current integer; v_response jsonb;
begin
 v_actor:=clinic_private.require_inventory_writer(p_branch);
 if p_medicine is null or p_expected_revision is null or p_expected_revision<1
  or p_name is null or length(btrim(p_name)) not between 2 and 160
  or p_description is null or length(p_description)>2000
  or p_reorder_point is null or p_reorder_point not between 0 and 1000000000
  or p_expiry_warning_days is null or p_expiry_warning_days not in (30,60,90) then
  raise exception 'Invalid branch product edits' using errcode='22023'; end if;
 select r.profile_revision into v_current from public.branch_medicine_rules r
 join public.medicine_catalog m on m.id=r.medicine_id
 where r.branch_id=p_branch and r.medicine_id=p_medicine
   and m.is_active and not m.is_controlled for update of r;
 if not found then raise exception 'Branch item unavailable' using errcode='42501'; end if;
 if v_current<>p_expected_revision then
  raise exception 'Stale product revision' using errcode='40001'; end if;
 update public.branch_medicine_rules set branch_display_name=btrim(p_name),
   branch_description=p_description,reorder_point_units=p_reorder_point,
   expiry_warning_days=p_expiry_warning_days,profile_revision=profile_revision+1
 where branch_id=p_branch and medicine_id=p_medicine
 returning profile_revision into v_current;
 v_response:=pg_catalog.jsonb_build_object('kind','inventory_item_updated',
  'itemId',p_medicine,'branchId',p_branch,'revision',v_current,
  'name',btrim(p_name),'description',p_description,
  'reorderPointUnits',p_reorder_point,'expiryWarningDays',p_expiry_warning_days);
 return v_response;
end;
$edit_item$;

create function public.get_branch_inventory_balance(p_branch uuid,p_medicine uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $balance$
declare v_actor uuid; v_today date; v_onhand bigint; v_available bigint;
 v_reserved bigint; v_quarantined bigint; v_code text; v_revision integer;
begin
 v_actor:=clinic_private.require_operational_actor();
 if p_branch is null or p_medicine is null
   or not clinic_private.has_branch_role(p_branch,
     array['administrator','receptionist','veterinarian']) then
  raise exception 'Branch inventory read denied' using errcode='42501'; end if;
 select m.product_code,r.profile_revision,
   (clock_timestamp() at time zone cb.timezone)::date
 into v_code,v_revision,v_today
 from public.branch_medicine_rules r join public.medicine_catalog m
  on m.id=r.medicine_id join public.clinic_branches cb on cb.id=r.branch_id
 where r.branch_id=p_branch and r.medicine_id=p_medicine;
 if not found then raise exception 'Branch item unavailable' using errcode='42501'; end if;
 select coalesce(sum(b.on_hand_units),0)::bigint,
  coalesce(sum(case when b.disposition='released' and b.expiry_date>v_today
    and b.expiry_date>v_today+m.minimum_shelf_life_days
    then b.on_hand_units-b.reserved_units-b.quarantined_units else 0 end),0)::bigint,
  coalesce(sum(b.reserved_units),0)::bigint,
  coalesce(sum(b.quarantined_units),0)::bigint
 into v_onhand,v_available,v_reserved,v_quarantined
 from public.branch_stock_batches b join public.medicine_catalog m on m.id=b.medicine_id
 where b.branch_id=p_branch and b.medicine_id=p_medicine;
 return pg_catalog.jsonb_build_object('kind','inventory_balance',
   'branchId',p_branch,'itemId',p_medicine,'productCode',v_code,
   'revision',v_revision,'onHandUnits',v_onhand,'availableUnits',v_available,
   'reservedUnits',v_reserved,'quarantinedUnits',v_quarantined);
end;
$balance$;

revoke all on function public.create_branch_inventory_item(
 uuid,uuid,text,text,text,text,text,text,text,bigint,text,date,text,bigint),
 public.receive_branch_inventory_stock(uuid,uuid,uuid,text,date,text,bigint),
 public.edit_branch_inventory_item(uuid,uuid,integer,text,text,bigint,integer),
 public.get_branch_inventory_balance(uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.create_branch_inventory_item(
 uuid,uuid,text,text,text,text,text,text,text,bigint,text,date,text,bigint),
 public.receive_branch_inventory_stock(uuid,uuid,uuid,text,date,text,bigint),
 public.edit_branch_inventory_item(uuid,uuid,integer,text,text,bigint,integer),
 public.get_branch_inventory_balance(uuid,uuid)
 to authenticated;
commit;
