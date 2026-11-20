export type InventoryKind='catalog'|'rules'|'alerts'|'batches'|'fefo'|'movements'
export type InventoryFilter='all'|'low'|'out'|'near'|'expired'|'quarantined'|'unconfigured'
export type InventorySort='name'|'code'|'available'|'alert'
export type InventoryFailure='denied'|'unavailable'|'network'|'error'
export type Catalog={id:string;product_code:string;generic_name:string;formulation:string;strength:string;stock_unit:string;
  minimum_shelf_life_days:number;requires_refrigeration:boolean;is_controlled:boolean;is_active:boolean}
export type Rule={branch_id:string;medicine_id:string;reorder_point_units:number;expiry_warning_days:30|60|90}
export type Alert={medicine_id:string;product_code:string;available_units:number;reorder_point_units:number;
  out_of_stock:boolean;low_stock:boolean;expiry_warning_days:30|60|90;
  near_expiry_batches:number;expired_batches:number;quarantined_batches:number}
export type Batch={id:string;branch_id:string;medicine_id:string;lot_number:string;received_on:string;expiry_date:string;
  disposition:'released'|'quarantined'|'recalled';on_hand_units:number;reserved_units:number;quarantined_units:number}
export type Fefo={batch_id:string;lot_number:string;expiry_date:string;available_units:number;received_on:string}
export type Movement={id:string;branch_id:string;medicine_id:string;batch_id:string;event_id:string;
  event_type:'opening'|'receipt'|'dispense'|'adjustment'|'quarantine'|'expiry'|'transfer_send'|'transfer_receive';
  delta_on_hand:number;delta_reserved:number;delta_quarantined:number;after_on_hand:number;after_reserved:number;
  after_quarantined:number;reason_code:string;recorded_by:string;recorded_at:string}
export type Window<T>={items:T[];hasMore:boolean}
export type Snapshot={catalog:Window<Catalog>;rules:Window<Rule>;alerts:Window<Alert>;timezone:string;today:string}
export type Detail={batches:Window<Batch>;fefo:Window<Fefo>;movements:Window<Movement>}
export type MedicineCard={medicine:Catalog;rule:Rule|null;alert:Alert|null}
export const INVENTORY_LIMITS:Readonly<Record<InventoryKind,number>>
export const INVENTORY_FILTERS:readonly {id:InventoryFilter;label:string}[]
export const INVENTORY_SORTS:readonly {id:InventorySort;label:string}[]
export function isInventoryId(v:unknown):v is string
export function isInventoryDate(v:unknown):v is string
export function branchDay(now:Date,timezone:string):string
export function dayPlus(date:string,n:number):string
export function validateInventoryRows(kind:'catalog',rows:unknown,scope?:object):Window<Catalog>
export function validateInventoryRows(kind:'rules',rows:unknown,scope:{branchId:string}):Window<Rule>
export function validateInventoryRows(kind:'alerts',rows:unknown,scope?:object):Window<Alert>
export function validateInventoryRows(kind:'batches',rows:unknown,scope:{branchId:string;medicineId:string}):Window<Batch>
export function validateInventoryRows(kind:'fefo',rows:unknown,scope?:object):Window<Fefo>
export function validateInventoryRows(kind:'movements',rows:unknown,scope:{branchId:string;medicineId:string}):Window<Movement>
export function medicineCards(snapshot:Snapshot,options?:{search?:string;filter?:InventoryFilter;sort?:InventorySort}):MedicineCard[]
export function batchDisplayState(batch:Batch,branchDate:string,warningDays:30|60|90,eligibleIds:ReadonlySet<string>):{kind:string;label:string}
export function inventoryError(error:unknown):InventoryFailure
