export const RPC:Readonly<{request:'request_staff_access';mine:'get_my_staff_access';list:'list_staff_access_requests';review:'review_staff_access';create:'create_branch_inventory_item';receive:'receive_branch_inventory_stock';edit:'edit_branch_inventory_item';balance:'get_branch_inventory_balance'}>
export function verifyOperationalReply<T=unknown>(kind:string,reply:unknown,expected?:{branchId?:string;itemId?:string;userId?:string;actorId?:string;productCode?:string;quantity?:number}):T
export function operationalError(error:unknown):{kind:'denied'|'invalid'|'conflict'|'stale'|'unavailable'|'uncertain';text:string}
export function validateReviewInput(args:import('./contract').ReviewArgs,adminBranches:ReadonlyArray<string>,actorId:string):string|null
