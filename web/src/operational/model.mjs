/** CLOUD source-aligned PR126 response guard; never trust arbitrary JSON from an RPC. */
export const RPC=Object.freeze({
 request:'request_staff_access',mine:'get_my_staff_access',
 list:'list_staff_access_requests',review:'review_staff_access',
 create:'create_branch_inventory_item',receive:'receive_branch_inventory_stock',
 edit:'edit_branch_inventory_item',balance:'get_branch_inventory_balance'
})
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const roles=new Set(['administrator','veterinarian','receptionist','accountant'])
const states=new Set(['pending','approved','rejected','inactive','revoked'])
const categories=new Set(['medicine','consumable','supply'])
const str=(x,max)=>typeof x==='string'&&x.length>0&&x.length<=max
const integer=(x,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(x)&&x>=0&&x<=max
const uniqueUuids=x=>Array.isArray(x)&&x.length<=32&&x.every(v=>uuid.test(v))&&new Set(x).size===x.length
const state=x=>states.has(x)
const role=x=>x===null||roles.has(x)
const date=x=>str(x,40)&&Number.isFinite(Date.parse(x))
const fail=()=>{throw Error('Operational RPC response could not be verified; no confirmed save can be displayed')}
export function verifyOperationalReply(kind,x,expected={}){
 if(!x||typeof x!=='object'||Array.isArray(x)||x.kind!==kind)fail()
 switch(kind){
 case 'staff_request':
  if(x.state!=='pending'||!uuid.test(x.branchId)||!integer(x.revision)||x.revision<1||expected.branchId&&x.branchId!==expected.branchId)fail()
  break
 case 'my_staff_access':
  if(!(x.state==='none'||state(x.state))||!role(x.role)||!uniqueUuids(x.branches)||((x.state!=='approved'&&x.state!=='none')||!x.role)&&x.branches.length>0)fail()
  break
 case 'staff_requests':
  if(!uuid.test(x.branchId)||expected.branchId&&x.branchId!==expected.branchId||
   !Array.isArray(x.items)||x.items.length>500||!x.items.every(q=>q&&uuid.test(q.userId)&&
    uuid.test(q.requestedBranchId)&&q.requestedBranchId===x.branchId&&state(q.state)&&
    integer(q.revision)&&q.revision>=1&&date(q.requestedAt)&&
    (q.reviewedAt===null||date(q.reviewedAt)))||
   new Set(x.items.map(q=>q.userId)).size!==x.items.length)fail()
  break
 case 'staff_review':
  if(!uuid.test(x.userId)||expected.userId&&x.userId!==expected.userId||
   !state(x.state)||!role(x.role)||!uniqueUuids(x.branches)||
   !integer(x.revision)||x.revision<1)fail()
  break
 case 'inventory_item':
  if(!uuid.test(x.itemId)||!uuid.test(x.branchId)||expected.branchId&&x.branchId!==expected.branchId||
   !str(x.productCode,40)||expected.productCode&&x.productCode!==expected.productCode||
   !categories.has(x.category)||!str(x.unit,30)||!integer(x.revision)||x.revision<1||
   !integer(x.onHandUnits,1000000000)||(x.batchId!==null&&!uuid.test(x.batchId)))fail()
  break
 case 'stock_received':
  if(!uuid.test(x.branchId)||expected.branchId&&x.branchId!==expected.branchId||
   !uuid.test(x.itemId)||expected.itemId&&x.itemId!==expected.itemId||
   !uuid.test(x.batchId)||!uuid.test(x.actorId)||expected.actorId&&x.actorId!==expected.actorId||
   !uuid.test(x.eventId)||!integer(x.receivedUnits,1000000000)||x.receivedUnits===0||
   expected.quantity&&x.receivedUnits!==expected.quantity||
   !integer(x.lotOnHandUnits,1000000000)||x.lotOnHandUnits<x.receivedUnits)fail()
  break
 case 'inventory_item_updated':
  if(!uuid.test(x.branchId)||expected.branchId&&x.branchId!==expected.branchId||
   !uuid.test(x.itemId)||expected.itemId&&x.itemId!==expected.itemId||
   !integer(x.revision)||x.revision<1||!str(x.name,160)||typeof x.description!=='string'||
   !integer(x.reorderPointUnits,1000000000)||![30,60,90].includes(x.expiryWarningDays))fail()
  break
 case 'inventory_balance':
  if(!uuid.test(x.branchId)||expected.branchId&&x.branchId!==expected.branchId||
   !uuid.test(x.itemId)||expected.itemId&&x.itemId!==expected.itemId||
   !str(x.productCode,40)||expected.productCode&&x.productCode!==expected.productCode||
   !integer(x.revision)||x.revision<1||
   !['onHandUnits','availableUnits','reservedUnits','quarantinedUnits'].every(k=>integer(x[k],1000000000))||
   x.availableUnits>x.onHandUnits||x.reservedUnits+x.quarantinedUnits>x.onHandUnits)fail()
  break
 default:fail()
 }
 return x
}
export function operationalError(error){
 const code=String(error?.code??'')
 const message=String(error?.message??'').toLowerCase()
 if(code==='42501'||['401','403','PGRST301'].includes(code)||
  /staff access is not approved|staff session required|no active staff branch|permission denied|not authori|jwt|forbidden|row-level security/.test(message))return {kind:'denied',text:'Staff session or branch permission denied. Recheck access; previous clinic details were cleared.'}
 if(code==='22023'||code==='23514')return {kind:'invalid',text:'The server rejected the supplied item, lot, quantity or requested state.'}
 if(code==='23505')return {kind:'conflict',text:'Item code or request ID conflicts with an existing saved action. Refresh before changing any request ID.'}
 if(code==='40001')return {kind:'stale',text:'Record revision changed. Refresh current data before a new action.'}
 if(['42883','42P01','PGRST202'].includes(code)||/does not exist|not installed|could not find the function/.test(message))
  return {kind:'unavailable',text:'The operational RPC has not been deployed or accepted.'}
 return {kind:'uncertain',text:'The result is uncertain. Do not submit with a new request ID; reconcile then retry the original request.'}
}
export function validateReviewInput(a,adminBranches,actorId){
 if(!uuid.test(a.p_target)||a.p_target===actorId||!Number.isInteger(a.p_expected_revision)||a.p_expected_revision<1||
   !uuid.test(a.p_request_id)||!['approve','reject','inactivate','revoke','role_change'].includes(a.p_action))
  return 'Choose a valid other staff request and revision.'
 const grant=a.p_action==='approve'||a.p_action==='role_change'
 if(grant){
  if(!roles.has(a.p_role)||!uniqueUuids(a.p_branches)||!a.p_branches.length||
    a.p_branches.some(b=>!adminBranches.includes(b)))return 'Select a permitted role and only your administrator branches.'
 }else if(a.p_role!==null||a.p_branches!==null&&a.p_branches.length!==0)
  return 'Non-grant decisions cannot contain a role or branch.'
 return null
}
