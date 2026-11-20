import type {ChartRequest,DraftSaveRequest} from './chart-model.mjs'
/**
 * Unaccepted PR109 backend adapter intentionally NOT imported. Production
 * clinical reads/writes stay unavailable; synthetic fixture may inject a
 * strict port, but a passed browser fixture never enables a hosted endpoint.
 */
export interface ClinicalChartPort{
  read(request:ChartRequest,signal?:AbortSignal):Promise<unknown>
  saveDraft?(request:DraftSaveRequest,signal?:AbortSignal):Promise<unknown>
}
export const unconnectedClinicalPort:ClinicalChartPort={
  async read(){return {kind:'unavailable'}}
}
