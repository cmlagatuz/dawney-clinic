import type {User} from '@supabase/supabase-js'
import {verifiedStaffSession} from '../lib/staff-clinic'
import {listOwnBranchMemberships,listClinicBranches,assertStaffBranch,listBranchQueueWindow} from '../lib/staff-branch'
import {deriveBranches,isBranchId} from '../ops/branch-model.mjs'
import {dayWindow,validateWindow} from '../ops/ops-model.mjs'
import type {OpsBranch} from '../ops/branch-model.mjs'
import type {OpsWindow} from '../ops/ops-model.mjs'

/**
 * Only already-reviewed active membership, server branch assertion and
 * branch-filtered appointment queue readers are wired. The legacy staff-wide
 * pets/clinical_records readers are deliberately NOT imported: neither
 * enforces an individual patient+branch binding.
 *
 * Clinical note/medication/vaccine persistence is NOT wired. No write method.
 */
const roleRank={receptionist:0,veterinarian:1,administrator:2} as const
export interface ClinicalReadPort {
  loadBranches():Promise<OpsBranch[]>
  readDay(branchId:string,clinicDay:string):Promise<OpsWindow>
}
export function createClinicalReadPort(user:User):ClinicalReadPort {
  const accountId=user.id
  return {
    async loadBranches(){
      const member=await verifiedStaffSession(user)
      if(!member||member.userId!==accountId||member.isActive!==true)throw Error('Clinic staff access is not approved')
      const [memberships,branches]=await Promise.all([listOwnBranchMemberships(user),listClinicBranches()])
      // A branch cannot escalate a less privileged global staff assignment.
      // This is presentation only; the backend must independently authorize writes.
      return deriveBranches(memberships,branches,accountId).branches.map(branch=>({
        ...branch,
        role:roleRank[branch.role]>roleRank[member.role]?member.role:branch.role
      }))
    },
    async readDay(branchId,clinicDay){
      if(!isBranchId(branchId))throw Object.assign(Error('Branch access not authorized'),{code:'42501'})
      await assertStaffBranch(user,branchId)
      const window=dayWindow(clinicDay)
      const rows=await listBranchQueueWindow(user,branchId,window.fromUtc,window.toUtc)
      return validateWindow(rows)
    }
  }
}
