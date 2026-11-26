import type {User} from '@supabase/supabase-js'
import type {ChartRequest,DraftSaveRequest} from './chart-model.mjs'
import {validateChartPage} from './chart-model.mjs'
import {readStaffPatientChart,saveStaffEncounterDraft,reconcileStaffClinicalDraft,type ReceiptQuery,type ReceiptObservation} from '../lib/clinical-chart'
import type {OpsRole} from '../ops/ops-model.mjs'
/** Separate default-OFF gate; workspace preview remains unchanged. */
export const CLINICAL_PERSISTENCE_ENABLED=import.meta.env.VITE_CLINICAL_DRAFT_PERSISTENCE_UI==='true'
export interface ClinicalChartPort{
 read(request:ChartRequest,signal?:AbortSignal):Promise<unknown>
 saveDraft?(request:DraftSaveRequest,signal?:AbortSignal):Promise<unknown>
 reconcile?(request:ReceiptQuery,signal?:AbortSignal):Promise<ReceiptObservation>
}
export const unconnectedClinicalPort:ClinicalChartPort={async read(){return {kind:'unavailable'}}}
export function createPersistentChartPort(user:User,branchId:string,role:OpsRole):ClinicalChartPort{
 return {
  async read(request,signal){
   if(signal?.aborted)throw new DOMException('Cancelled','AbortError')
   if(request.accountId!==user.id||request.branchId!==branchId||
      (role==='receptionist'&&request.section!=='appointments'))return {kind:'denied'}
   const result=await readStaffPatientChart(user,branchId,request.petId,request.section,request.cursor,request.limit,signal)
   if(signal?.aborted)throw new DOMException('Cancelled','AbortError')
   return validateChartPage(result,request)
  },
  ...(role==='veterinarian'?{async saveDraft(request:DraftSaveRequest,signal?:AbortSignal){
   if(signal?.aborted)throw new DOMException('Cancelled','AbortError')
   if(request.branchId!==branchId)return {kind:'denied'}
   return saveStaffEncounterDraft(user,request,signal)
  },async reconcile(request:ReceiptQuery,signal?:AbortSignal){
   if(request.accountId!==user.id||request.branchId!==branchId)throw Object.assign(Error('Receipt scope denied'),{code:'42501'})
   return reconcileStaffClinicalDraft(user,request,signal)
  }}:{})
 }
}
