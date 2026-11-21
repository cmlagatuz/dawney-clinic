export type ClinicRouteContract = Readonly<{
  id:string;path:string;surface:'public'|'owner'|'staff';title:string;
  role:string;scope:string;reads:readonly string[];writes:readonly string[];
  migration:readonly string[];flag:string;request:string;response:string;
  failure:string;persistence:'provider-unverified'|'no-frontend-write'|'missing-server-adapter';
  missing:string
}>
export type MissingOperation = Readonly<{id:string;ui:string;contract:string;acceptance:string}>
export type StaffReleaseModule = Readonly<{id:string;label:string;path:string;gate:string;state:string}>
export const CLINIC_ROUTE_CONTRACTS: readonly ClinicRouteContract[]
export const RELEASE_MISSING_OPERATIONS: readonly MissingOperation[]
export const STAFF_RELEASE_MODULES: readonly StaffReleaseModule[]
export function clinicModuleView(module:StaffReleaseModule, flags:Record<string,boolean>,staffAuthorized:boolean):
  Readonly<{kind:'denied'|'unavailable'|'off'|'preview';linked:boolean}>
export function routeContract(path:string):ClinicRouteContract|null
