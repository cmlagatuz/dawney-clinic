export type BookingPolicyState='approved'|'unapproved'|'not_installed'
export type ServiceBookingPayload={
 petId:string;serviceId:string;resourceId:string;startsAtUtc:string;
 requestNonce:string;concern:string;details?:string|null
}
export type OwnerBookingTransitionRequest=
 |{kind:'legacy';details:unknown}
 |{kind:'service';booking:ServiceBookingPayload}
export function selectOwnerBookingPath(
 policyState:BookingPolicyState,request:OwnerBookingTransitionRequest
):'legacy'|'rpc'
export function submitOwnerBookingTransition<TLegacy,TService>(
 request:OwnerBookingTransitionRequest,
 adapters:{
  readPolicyState:()=>Promise<BookingPolicyState>
  submitLegacy:(details:unknown)=>Promise<TLegacy>
  submitService:(booking:ServiceBookingPayload)=>Promise<TService>
 }
):Promise<TLegacy|TService>
