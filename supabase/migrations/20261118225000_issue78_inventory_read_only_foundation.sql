-- Issue #78: FUTURE-ORDERED, SOURCE-ONLY 15th migration. NOT APPLIED.
-- Requires EXACT 11 original + proposed 12th, 13th and 14th. No clinic
-- inventory activation, medicine seed, purchases, patients or stock writes.
-- Initial scope is deliberately READ ONLY: all stock mutations FAIL CLOSED.
begin;
set local search_path=public,extensions,pg_catalog;

create table public.medicine_catalog (
 id uuid primary key default gen_random_uuid(),
 product_code text not null unique
   check (product_code ~ '^[A-Z0-9][A-Z0-9._-]{1,39}$'),
 generic_name text not null check (length(trim(generic_name)) between 2 and 160),
 formulation text not null check (length(trim(formulation)) between 2 and 80),
 strength text not null check (length(trim(strength)) between 1 and 80),
 stock_unit text not null check (stock_unit ~ '^[a-z][a-z0-9_-]{1,29}$'),
 minimum_shelf_life_days integer not null default 0
   check (minimum_shelf_life_days between 0 and 365),
 requires_refrigeration boolean not null default false,
 is_controlled boolean not null default false,
 is_active boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.branch_medicine_rules (
 branch_id uuid not null references public.clinic_branches(id) on delete restrict,
 medicine_id uuid not null references public.medicine_catalog(id) on delete restrict,
 reorder_point_units bigint not null default 0 check (reorder_point_units between 0 and 1000000000),
 expiry_warning_days integer not null default 30
   check (expiry_warning_days in (30,60,90)),
 primary key(branch_id,medicine_id)
);
create table public.branch_stock_batches (
 id uuid primary key default gen_random_uuid(),
 branch_id uuid not null references public.clinic_branches(id) on delete restrict,
 medicine_id uuid not null references public.medicine_catalog(id) on delete restrict,
 lot_number text not null check(length(trim(lot_number)) between 1 and 80),
 supplier_reference text check(supplier_reference is null or length(trim(supplier_reference)) between 1 and 120),
 received_on date not null,
 expiry_date date not null,
 disposition text not null default 'quarantined'
   check(disposition in ('released','quarantined','recalled')),
 on_hand_units bigint not null default 0 check(on_hand_units between 0 and 1000000000),
 reserved_units bigint not null default 0 check(reserved_units between 0 and 1000000000),
 quarantined_units bigint not null default 0 check(quarantined_units between 0 and 1000000000),
 unit_cost_minor bigint check(unit_cost_minor is null or unit_cost_minor >= 0),
 currency_code text check(currency_code is null or currency_code ~ '^[A-Z]{3}$'),
 created_at timestamptz not null default now(),
 constraint inventory_batch_available_nonnegative
   check(reserved_units+quarantined_units<=on_hand_units),
 constraint inventory_batch_valid_dates check(expiry_date>=received_on),
 constraint inventory_batch_identity unique(id,branch_id,medicine_id),
 constraint inventory_lot_per_branch unique(branch_id,medicine_id,lot_number,expiry_date)
);
create index inventory_fefo_lookup on public.branch_stock_batches
 (branch_id,medicine_id,expiry_date,received_on,id)
 where disposition='released';
create table public.stock_movements (
 id uuid primary key default gen_random_uuid(),
 branch_id uuid not null,
 medicine_id uuid not null,
 batch_id uuid not null,
 event_id uuid not null,
 event_type text not null check(event_type in
   ('opening','receipt','dispense','adjustment','quarantine','expiry','transfer_send','transfer_receive')),
 delta_on_hand bigint not null default 0,
 delta_reserved bigint not null default 0,
 delta_quarantined bigint not null default 0,
 after_on_hand bigint not null check(after_on_hand>=0),
 after_reserved bigint not null check(after_reserved>=0),
 after_quarantined bigint not null check(after_quarantined>=0),
 reason_code text not null check(reason_code ~ '^[a-z][a-z0-9_]{1,39}$'),
 recorded_by uuid not null references auth.users(id) on delete restrict,
 recorded_at timestamptz not null default now(),
 constraint inventory_movement_not_empty
   check(delta_on_hand<>0 or delta_reserved<>0 or delta_quarantined<>0),
 constraint inventory_movement_nonnegative
   check(after_reserved+after_quarantined<=after_on_hand),
 constraint inventory_movement_batch_consistent
   foreign key(batch_id,branch_id,medicine_id)
   references public.branch_stock_batches(id,branch_id,medicine_id) on delete restrict,
 constraint inventory_event_once_per_branch unique(branch_id,event_id)
);
create index inventory_movement_timeline
 on public.stock_movements(branch_id,medicine_id,batch_id,recorded_at,id);

-- Structural immutability remains valid even for non-browser privileged writes.
-- A future authorized transactional mutation must append a NEW ledger row.
create function clinic_private.block_inventory_ledger_rewrite()
returns trigger language plpgsql security invoker set search_path='' as $imm$
begin
 raise exception 'Stock movement ledger is append-only'
  using errcode='42501';
end;
$imm$;
revoke all on function clinic_private.block_inventory_ledger_rewrite()
 from public,anon,authenticated;
create trigger inventory_ledger_never_update_delete
 before update or delete on public.stock_movements for each row
 execute function clinic_private.block_inventory_ledger_rewrite();
create trigger inventory_ledger_never_truncate
 before truncate on public.stock_movements for each statement
 execute function clinic_private.block_inventory_ledger_rewrite();

-- Every exposed table has RLS, with zero authenticated INSERT/UPDATE/DELETE
-- grants and zero write policies. Synthetic CI inserts run as PG superuser only.
alter table public.medicine_catalog enable row level security;
alter table public.branch_medicine_rules enable row level security;
alter table public.branch_stock_batches enable row level security;
alter table public.stock_movements enable row level security;
revoke all on public.medicine_catalog,public.branch_medicine_rules,
 public.branch_stock_batches,public.stock_movements from public,anon,authenticated;
-- Never grant unit_cost_minor or currency_code to browser staff.
grant select(id,product_code,generic_name,formulation,strength,stock_unit,
 minimum_shelf_life_days,requires_refrigeration,is_controlled,is_active)
 on public.medicine_catalog to authenticated;
grant select(branch_id,medicine_id,reorder_point_units,expiry_warning_days)
 on public.branch_medicine_rules to authenticated;
grant select(id,branch_id,medicine_id,lot_number,supplier_reference,received_on,
 expiry_date,disposition,on_hand_units,reserved_units,quarantined_units)
 on public.branch_stock_batches to authenticated;
grant select(id,branch_id,medicine_id,batch_id,event_id,event_type,delta_on_hand,
 delta_reserved,delta_quarantined,after_on_hand,after_reserved,after_quarantined,
 reason_code,recorded_by,recorded_at)
 on public.stock_movements to authenticated;

-- Shared catalog: any CURRENT real staff membership at an authorized branch.
-- No anonymous/owner-only visibility and no user_metadata/JWT branch shortcuts.
create policy inventory_catalog_authorized_staff_read on public.medicine_catalog
 for select to authenticated using (
  exists(select 1 from public.staff_branch_memberships bm
    where bm.user_id=(select auth.uid())
    and clinic_private.has_branch_role(bm.branch_id,
       array['administrator','veterinarian','receptionist']))
 );
create policy inventory_rule_branch_read on public.branch_medicine_rules
 for select to authenticated using (
  clinic_private.has_branch_role(branch_id,
    array['administrator','veterinarian','receptionist'])
 );
create policy inventory_batch_branch_read on public.branch_stock_batches
 for select to authenticated using (
  clinic_private.has_branch_role(branch_id,
    array['administrator','veterinarian','receptionist'])
 );
create policy inventory_movement_branch_read on public.stock_movements
 for select to authenticated using (
  clinic_private.has_branch_role(branch_id,
    array['administrator','veterinarian','receptionist'])
 );

-- FEFO: only actively released, unexpired, unreserved/unquarantined units,
-- with minimum remaining shelf life. Never assume expiring stock is safe.
create function public.list_branch_medicine_fefo(p_branch uuid,p_medicine uuid)
returns table(batch_id uuid,lot_number text,expiry_date date,
 available_units bigint,received_on date)
language plpgsql stable security invoker set search_path='' as $fefo$
declare
 -- Stable instant across statements within the current transaction.
 -- The PostgreSQL session/request timezone NEVER determines inventory date.
 v_inventory_instant timestamptz := pg_catalog.transaction_timestamp();
 v_inventory_date date;
begin
 perform public.assert_staff_branch(p_branch);
 -- Only an authenticated branch-authorized caller may compute stock eligibility.
 select (v_inventory_instant at time zone cb.timezone)::date
  into v_inventory_date
 from public.clinic_branches cb where cb.id=p_branch;
 if v_inventory_date is null then
  raise exception 'Inventory branch timezone unavailable' using errcode='42501';
 end if;
 return query
  select b.id,b.lot_number,b.expiry_date,
     (b.on_hand_units-b.reserved_units-b.quarantined_units),b.received_on
  from public.branch_stock_batches b
  join public.medicine_catalog m on m.id=b.medicine_id
  where b.branch_id=p_branch and b.medicine_id=p_medicine
    and m.is_active and b.disposition='released'
    and b.expiry_date>v_inventory_date+m.minimum_shelf_life_days
    and (b.on_hand_units-b.reserved_units-b.quarantined_units)>0
  order by b.expiry_date,b.received_on,b.lot_number,b.id;
end;
$fefo$;
revoke all on function public.list_branch_medicine_fefo(uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.list_branch_medicine_fefo(uuid,uuid)
 to authenticated;

-- Dashboard indicators are computed on READ, not cron or messages.
-- Expired and quarantined lots are separately visible as warnings.
-- Available totals exclude expired, quarantined, recalled and reserved units.
create function public.list_branch_medicine_alerts(p_branch uuid)
returns table(medicine_id uuid,product_code text,available_units bigint,
 reorder_point_units bigint,out_of_stock boolean,low_stock boolean,
 expiry_warning_days integer,near_expiry_batches bigint,
 expired_batches bigint,quarantined_batches bigint)
language plpgsql stable security invoker set search_path='' as $alerts$
declare
 -- Stable instant across statements within the current transaction.
 -- The PostgreSQL session/request timezone NEVER determines inventory date.
 v_inventory_instant timestamptz := pg_catalog.transaction_timestamp();
 v_inventory_date date;
begin
 perform public.assert_staff_branch(p_branch);
 -- Only an authenticated branch-authorized caller may compute stock eligibility.
 select (v_inventory_instant at time zone cb.timezone)::date
  into v_inventory_date
 from public.clinic_branches cb where cb.id=p_branch;
 if v_inventory_date is null then
  raise exception 'Inventory branch timezone unavailable' using errcode='42501';
 end if;
 return query
 select r.medicine_id,m.product_code,coalesce(x.available,0)::bigint,
        r.reorder_point_units,(coalesce(x.available,0)=0),
        (coalesce(x.available,0)<=r.reorder_point_units),
        r.expiry_warning_days,coalesce(x.near_expiry,0)::bigint,
        coalesce(x.expired,0)::bigint,coalesce(x.quarantined,0)::bigint
 from public.branch_medicine_rules r
 join public.medicine_catalog m on m.id=r.medicine_id
 left join lateral (
  select
   sum(b.on_hand_units-b.reserved_units-b.quarantined_units)
     filter(where b.disposition='released' and b.expiry_date>v_inventory_date
       and b.expiry_date>v_inventory_date+m.minimum_shelf_life_days) as available,
   count(*) filter(where b.disposition='released'
     and b.on_hand_units>0 and b.expiry_date>v_inventory_date
     and b.expiry_date<=v_inventory_date+r.expiry_warning_days) as near_expiry,
   count(*) filter(where b.on_hand_units>0 and b.expiry_date<=v_inventory_date) as expired,
   count(*) filter(where b.on_hand_units>0
     and (b.disposition='quarantined' or b.disposition='recalled'
          or b.quarantined_units>0)) as quarantined
  from public.branch_stock_batches b
  where b.branch_id=r.branch_id and b.medicine_id=r.medicine_id
 ) x on true
 where r.branch_id=p_branch
 order by m.product_code,r.medicine_id;
end;
$alerts$;
revoke all on function public.list_branch_medicine_alerts(uuid)
 from public,anon,authenticated;
grant execute on function public.list_branch_medicine_alerts(uuid)
 to authenticated;
commit;
