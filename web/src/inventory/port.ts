import type {User} from '@supabase/supabase-js'
import {supabase} from '../lib/supabase'
import {verifiedStaffSession} from '../lib/staff-clinic'
import {assertStaffBranch} from '../lib/staff-branch'
import {createClinicalReadPort} from '../clinical/port'
import {isInventoryId,branchDay,INVENTORY_LIMITS,validateInventoryRows} from './model.mjs'
import type {Snapshot,Detail} from './model.mjs'
import type {OpsBranch} from '../ops/branch-model.mjs'

/**
 * CLOUD: frontend-only READ adapter over existing reviewed Issue78 migration #15
 * and established staff branch readers. SQL migration is NOT deployed; flag OFF.
 *
 * SELECTs are explicitly column-allowlisted; cost fields are never requested.
 * The two SQL RPCs are stable SECURITY INVOKER read functions (POST transport
 * is NOT a stock mutation). Never query unscoped batches/movements.
 * No INSERT/UPDATE/DELETE, no transaction interface, no stock writes.
 */
export interface PharmacyPort {
  branches():Promise<OpsBranch[]>
  overview(branchId:string):Promise<Snapshot>
  medicine(branchId:string,medicineId:string):Promise<Detail>
}
const CATALOG='id,product_code,generic_name,formulation,strength,stock_unit,minimum_shelf_life_days,requires_refrigeration,is_controlled,is_active'
const RULES='branch_id,medicine_id,reorder_point_units,expiry_warning_days'
const BATCHES='id,branch_id,medicine_id,lot_number,received_on,expiry_date,disposition,on_hand_units,reserved_units,quarantined_units'
const MOVEMENTS='id,branch_id,medicine_id,batch_id,event_id,event_type,delta_on_hand,delta_reserved,delta_quarantined,after_on_hand,after_reserved,after_quarantined,reason_code,recorded_by,recorded_at'

function client(){
  if(!supabase)throw Error('Inventory read service not configured')
  return supabase
}
function denied():Error{
  return Object.assign(Error('Branch access not authorized'),{code:'42501'})
}
function checked<T>({data,error}:{data:T|null;error:unknown}):T{
  if(error)throw error
  if(data===null)throw Error('Inventory read did not return a verified result')
  return data
}
export function createPharmacyPort(user:User):PharmacyPort {
  const uid=user.id
  const chartPort=createClinicalReadPort(user)
  /** This is an authorization check, not a source of entitlement from a route parameter. */
  async function authorize(branchId:string){
    if(!isInventoryId(branchId))throw denied()
    const branches=await chartPort.loadBranches()
    if(!branches.some(b=>b.id===branchId))throw denied()
    await assertStaffBranch(user,branchId)
  }
  /** Detect revocation between the first SQL read and rendering the collected data. */
  async function afterRead(branchId:string){
    const session=await verifiedStaffSession(user)
    if(session.userId!==uid||!session.isActive)throw denied()
    await authorize(branchId)
  }
  return {
    branches:()=>chartPort.loadBranches(),
    async overview(branchId){
      await authorize(branchId)
      const db=client()
      // Limit every collection; never present a truncated set as the full stock ledger.
      const [zoneResult,catalogResult,rulesResult,alertsResult]=await Promise.all([
        db.from('clinic_branches').select('id,timezone').eq('id',branchId).maybeSingle(),
        db.from('medicine_catalog').select(CATALOG).order('product_code',{ascending:true})
          .limit(INVENTORY_LIMITS.catalog+1),
        db.from('branch_medicine_rules').select(RULES).eq('branch_id',branchId)
          .order('medicine_id',{ascending:true}).limit(INVENTORY_LIMITS.rules+1),
        db.rpc('list_branch_medicine_alerts',{p_branch:branchId})
          .limit(INVENTORY_LIMITS.alerts+1)
      ])
      const row=checked(zoneResult)
      if(!row||row.id!==branchId||typeof row.timezone!=='string')throw denied()
      const today=branchDay(new Date(),row.timezone)
      const catalog=validateInventoryRows('catalog',checked(catalogResult))
      const rules=validateInventoryRows('rules',checked(rulesResult),{branchId})
      const alerts=validateInventoryRows('alerts',checked(alertsResult))
      const named=new Map(catalog.items.map(m=>[m.id,m]))
      const mapped=new Map(rules.items.map(x=>[x.medicine_id,x]))
      for(const a of alerts.items){
        const rule=mapped.get(a.medicine_id)
        if(rule&&(a.reorder_point_units!==rule.reorder_point_units||
          a.expiry_warning_days!==rule.expiry_warning_days))
          throw Error('Inconsistent inventory branch configuration')
        const medicine=named.get(a.medicine_id)
        if(medicine&&a.product_code!==medicine.product_code)
          throw Error('Inventory medicine identity mismatch')
      }
      await afterRead(branchId)
      return {catalog,rules,alerts,timezone:row.timezone,today}
    },
    async medicine(branchId,medicineId){
      if(!isInventoryId(medicineId))throw denied()
      await authorize(branchId)
      const db=client()
      const [batchesResult,fefoResult,movementsResult]=await Promise.all([
        db.from('branch_stock_batches').select(BATCHES).eq('branch_id',branchId)
          .eq('medicine_id',medicineId).order('expiry_date',{ascending:true})
          .order('received_on',{ascending:true}).order('lot_number',{ascending:true})
          .order('id',{ascending:true}).limit(INVENTORY_LIMITS.batches+1),
        db.rpc('list_branch_medicine_fefo',{p_branch:branchId,p_medicine:medicineId})
          .limit(INVENTORY_LIMITS.fefo+1),
        db.from('stock_movements').select(MOVEMENTS).eq('branch_id',branchId)
          .eq('medicine_id',medicineId).order('recorded_at',{ascending:false})
          .order('id',{ascending:false}).limit(INVENTORY_LIMITS.movements+1)
      ])
      const batches=validateInventoryRows('batches',checked(batchesResult),{branchId,medicineId})
      const fefo=validateInventoryRows('fefo',checked(fefoResult))
      const movements=validateInventoryRows('movements',checked(movementsResult),{branchId,medicineId})
      const batchMap=new Map(batches.items.map(x=>[x.id,x]))
      for(const candidate of fefo.items){
        const batch=batchMap.get(candidate.batch_id)
        // If a detail page is truncated, a candidate may be outside the first page.
        if(batch&&(batch.lot_number!==candidate.lot_number||
          batch.expiry_date!==candidate.expiry_date||
          batch.received_on!==candidate.received_on||
          batch.on_hand_units-batch.reserved_units-batch.quarantined_units!==candidate.available_units))
          throw Error('Inventory FEFO candidate mismatch')
      }
      await afterRead(branchId)
      return {batches,fefo,movements}
    }
  }
}
