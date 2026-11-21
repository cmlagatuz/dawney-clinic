/** Issue #58 pure RLS-backed branch read contract. NO UI wiring or writes. */
import {verifyStaffFromRls,validateClinicUtcWindow} from './staff-read-contract.mjs'
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ROLES=new Set(['receptionist','veterinarian','administrator'])
const STATUSES=new Set(['requested','confirmed','checked_in','completed','cancelled','no_show'])
const FIELD_NAMES='id,pet_id,owner_id,resource_id,branch_id,starts_at,ends_at,status,concern'
export const BRANCH_WINDOW_LIMIT=250
export function requireBranchId(id){
 if(typeof id!=='string'||!UUID.test(id))
   throw Object.assign(Error('Branch access not authorized'),{code:'42501'})
 return id
}
export async function queryOwnBranchMemberships(db,userId){
 await verifyStaffFromRls(db,userId)
 const {data,error}=await db.from('staff_branch_memberships')
   .select('user_id,branch_id,role,is_active').eq('user_id',userId)
 if(error)throw error
 if(!Array.isArray(data)||data.some(r=>!r||r.user_id!==userId||
  !UUID.test(r.branch_id)||!ROLES.has(r.role)||typeof r.is_active!=='boolean'))
   throw Error('Branch memberships could not be verified')
 return data
}
export async function queryClinicBranchCatalog(db){
 const {data,error}=await db.from('clinic_branches').select('id,slug,display_name')
   .order('slug',{ascending:true})
 if(error)throw error
 if(!Array.isArray(data)||data.some(r=>!r||typeof r.id!=='string'||
  !UUID.test(r.id)||typeof r.slug!=='string'||typeof r.display_name!=='string'))
   throw Error('Clinic branch list could not be verified')
 return data
}
/** Invokes the current PostgreSQL membership guard, never trusts user metadata. */
export async function assertBranchOnServer(db,branchId){
 const id=requireBranchId(branchId)
 const {data,error}=await db.rpc('assert_staff_branch',{p_branch:id})
 if(error)throw error
 if(data!==id)throw Object.assign(Error('Branch access not authorized'),{code:'42501'})
 return id
}
function verifiedRow(r,branchId){
 if(!r||r.branch_id!==branchId||!STATUSES.has(r.status))return false
 for(const k of ['id','pet_id','owner_id','resource_id']){
   if(typeof r[k]!=='string'||!UUID.test(r[k]))return false
 }
 if(typeof r.concern!=='string'||!r.concern.trim()||
  typeof r.starts_at!=='string'||typeof r.ends_at!=='string')return false
 const start=Date.parse(r.starts_at),end=Date.parse(r.ends_at)
 return Number.isFinite(start)&&Number.isFinite(end)&&end>start
}
/** One <=24h half-open Manila-derived UTC window; 251st row signals incomplete. */
export async function queryBranchQueueWindow(db,userId,branchId,fromUtc,toUtc){
 const id=requireBranchId(branchId)
 const bounds=validateClinicUtcWindow(fromUtc,toUtc)
 await verifyStaffFromRls(db,userId)
 await assertBranchOnServer(db,id)
 const {data,error}=await db.from('appointments').select(FIELD_NAMES)
   .eq('branch_id',id).gte('starts_at',bounds.from).lt('starts_at',bounds.to)
   .order('starts_at',{ascending:true}).order('id',{ascending:true})
   .limit(BRANCH_WINDOW_LIMIT+1)
 if(error)throw error
 if(!Array.isArray(data)||data.length>BRANCH_WINDOW_LIMIT+1||
    data.some(r=>!verifiedRow(r,id)))
    throw Error('Clinic branch queue response could not be verified')
 // Reject an account-switch or membership revocation during the in-flight read.
 await verifyStaffFromRls(db,userId)
 await assertBranchOnServer(db,id)
 return {
   items:data.slice(0,BRANCH_WINDOW_LIMIT).map(({branch_id,...r})=>r),
   hasMore:data.length>BRANCH_WINDOW_LIMIT
 }
}
/** Exact RLS/branch-asserted counts. Zero is valid ONLY on a successful RPC. */
export async function queryBranchDashboardCounts(db,userId,branchId){
 const id=requireBranchId(branchId)
 await verifyStaffFromRls(db,userId)
 const {data,error}=await db.rpc('get_branch_dashboard_counts',{p_branch:id})
 if(error)throw error
 const row=Array.isArray(data)&&data.length===1?data[0]:null
 if(!row||!['patients','requested_appointments','confirmed_appointments']
   .every(k=>Number.isSafeInteger(row[k])&&row[k]>=0))
   throw Error('Clinic branch counts could not be verified')
 await verifyStaffFromRls(db,userId)
 await assertBranchOnServer(db,id)
 return {patients:row.patients,requestedAppointments:row.requested_appointments,
   confirmedAppointments:row.confirmed_appointments}
}
