import type {User} from '@supabase/supabase-js'
import {supabase} from '../lib/supabase'
import {assertStaffBranch} from '../lib/staff-branch'
import {RPC,verifyOperationalReply} from './model.mjs'
import type {MyStaffAccess,StaffRequest,StaffRequestList,StaffReview,ItemResult,ReceiptResult,EditResult,Balance,ReviewArgs,ItemArgs,ReceiptArgs,EditArgs} from './contract'

/**
 * Frontend HTTP binding only. Exact published #126 RPC signatures; no privileged
 * credential or SQL implementation. In RC0 use ASTRA's canonical types at
 * web/src/lib/operational-rpcs.ts and delete local type aliases after review.
 */
export const operationalFlags={
 staff:import.meta.env.VITE_STAFF_APPROVAL_WRITES_ENABLED==='true',
 inventory:import.meta.env.VITE_INVENTORY_WRITES_ENABLED==='true'
} as const
export type RpcTransport=(name:string,args?:Record<string,unknown>)=>Promise<{data:unknown;error:{code?:string;message:string}|null}>
export type BranchProfile={name:string|null;description:string;reorderPointUnits:number;expiryWarningDays:30|60|90;revision:number}
export interface OperationalPort {
 my():Promise<MyStaffAccess>
 request(branchId:string,note:string|null):Promise<StaffRequest>
 list(branchId:string):Promise<StaffRequestList>
 review(args:ReviewArgs):Promise<StaffReview>
 create(args:ItemArgs):Promise<ItemResult>
 receive(args:ReceiptArgs):Promise<ReceiptResult>
 edit(args:EditArgs):Promise<EditResult>
 balance(branchId:string,itemId:string,productCode?:string):Promise<Balance>
 profile(branchId:string,itemId:string):Promise<BranchProfile>
 movement(branchId:string,itemId:string,eventId:string,batchId:string,received:number,lotBalance:number):Promise<boolean>
}
const denied=()=>Object.assign(Error('Current staff permission required'),{code:'42501'})
const unavailable=()=>Object.assign(Error('Operational RPC is not enabled'),{code:'PGRST202'})
export function createOperationalPort(user:User,transport?:RpcTransport):OperationalPort{
 const rpc:RpcTransport=transport??(async(name,args)=>{
  if(!supabase)throw unavailable()
  const {data,error}=await supabase.rpc(name,args)
  return {data,error}
 })
 const call=async<T>(flag:'staff'|'inventory',name:string,args:Record<string,unknown>|undefined,kind:string,expected?:{branchId?:string;itemId?:string;userId?:string;actorId?:string;productCode?:string;quantity?:number}):Promise<T>=>{
  if(!operationalFlags[flag])throw unavailable()
  const {data,error}=await rpc(name,args)
  if(error)throw error
  return verifyOperationalReply<T>(kind,data,expected)
 }
 return {
  my:()=>call<MyStaffAccess>('staff',RPC.mine,undefined,'my_staff_access'),
  request:(branchId,note)=>call<StaffRequest>('staff',RPC.request,{p_branch:branchId,p_note:note},'staff_request',{branchId}),
  list:branchId=>call<StaffRequestList>('staff',RPC.list,{p_branch:branchId},'staff_requests',{branchId}),
  review:args=>call<StaffReview>('staff',RPC.review,args,'staff_review',{userId:args.p_target}),
  create:args=>call<ItemResult>('inventory',RPC.create,args,'inventory_item',{branchId:args.p_branch,productCode:args.p_product_code}),
  receive:args=>call<ReceiptResult>('inventory',RPC.receive,args,'stock_received',{branchId:args.p_branch,itemId:args.p_medicine,actorId:user.id,quantity:args.p_quantity}),
  edit:args=>call<EditResult>('inventory',RPC.edit,args,'inventory_item_updated',{branchId:args.p_branch,itemId:args.p_medicine}),
  balance:(branchId,itemId,productCode)=>call<Balance>('inventory',RPC.balance,{p_branch:branchId,p_medicine:itemId},'inventory_balance',{branchId,itemId,productCode}),
  async profile(branchId,itemId){
   if(!operationalFlags.inventory||!supabase)throw unavailable()
   await assertStaffBranch(user,branchId)
   const {data,error}=await supabase.from('branch_medicine_rules')
    .select('branch_id,medicine_id,branch_display_name,branch_description,profile_revision,reorder_point_units,expiry_warning_days')
    .eq('branch_id',branchId).eq('medicine_id',itemId).maybeSingle()
   if(error)throw error
   if(!data||data.branch_id!==branchId||data.medicine_id!==itemId||
      (data.branch_display_name!==null&&(typeof data.branch_display_name!=='string'||data.branch_display_name.length<2||data.branch_display_name.length>160))||
      (data.branch_description!==null&&(typeof data.branch_description!=='string'||data.branch_description.length>2000))||
      !Number.isSafeInteger(data.profile_revision)||data.profile_revision<1||
      !Number.isSafeInteger(data.reorder_point_units)||data.reorder_point_units<0||
      data.reorder_point_units>1000000000||![30,60,90].includes(data.expiry_warning_days))
    throw Error('Branch inventory profile response could not be verified')
   await assertStaffBranch(user,branchId)
   return {name:data.branch_display_name,description:data.branch_description??'',
    reorderPointUnits:data.reorder_point_units,
    expiryWarningDays:data.expiry_warning_days as 30|60|90,revision:data.profile_revision}
  },
  async movement(branchId,itemId,eventId,batchId,received,lotBalance){
   if(!operationalFlags.inventory||!supabase)throw unavailable()
   // Recheck staff branch before AND after reading exact immutable stock event.
   await assertStaffBranch(user,branchId)
   const {data,error}=await supabase.from('stock_movements')
    .select('id,branch_id,medicine_id,batch_id,event_id,event_type,delta_on_hand,after_on_hand')
    .eq('branch_id',branchId).eq('medicine_id',itemId).eq('event_id',eventId).limit(2)
   if(error)throw error
   if(!Array.isArray(data)||data.length!==1||data[0]?.branch_id!==branchId||
      data[0]?.medicine_id!==itemId||data[0]?.batch_id!==batchId||
      data[0]?.event_id!==eventId||data[0]?.event_type!=='receipt'||
      data[0]?.delta_on_hand!==received||data[0]?.after_on_hand!==lotBalance)
    throw Error('Stock receipt movement has not been verified')
   await assertStaffBranch(user,branchId)
   return true
  }
 }
}
