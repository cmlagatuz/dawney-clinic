import type {User} from '@supabase/supabase-js'
import {verifiedStaffSession} from '../lib/staff-clinic'
import {assertStaffBranch} from '../lib/staff-branch'
import {createClinicalReadPort} from '../clinical/port'
import {isBillingId} from './model.mjs'
import type {OpsBranch} from '../ops/branch-model.mjs'

/**
 * Source audit 2026-11-20: no approved invoices, invoice-lines, payment or receipt
 * reader exists in the inherited React/Supabase contracts. Explicitly refuse every
 * financial read, even when the caller has a legitimate branch membership.
 *
 * A replacement may be connected only after ASTRA ships audited JWT/RLS readers
 * matching ASTRA_CONTRACT.md. No invoice SELECT, service-role key, SQL, price math
 * or payment mutation originates in this frontend adapter.
 */
export interface BillingReadPort {
  branches():Promise<OpsBranch[]>
  invoices(branchId:string):Promise<unknown>
  detail(branchId:string,invoiceId:string):Promise<unknown>
}
function denied():Error {
  return Object.assign(new Error('Branch access not authorized'),{code:'42501'})
}
function unavailable():Error {
  return Object.assign(new Error('Billing reader not integrated'),{code:'BILLING_READER_NOT_INTEGRATED'})
}
export function createBillingPort(user:User):BillingReadPort {
  const userId=user.id
  const staff=createClinicalReadPort(user)
  async function verify(branchId:string){
    if(!isBillingId(branchId))throw denied()
    const offered=await staff.loadBranches()
    if(!offered.some(b=>b.id===branchId))throw denied()
    const member=await verifiedStaffSession(user)
    if(member.userId!==userId||member.isActive!==true)throw denied()
    const actual=await assertStaffBranch(user,branchId)
    if(actual!==branchId)throw denied()
  }
  return {
    branches:()=>staff.loadBranches(),
    async invoices(branchId) {
      await verify(branchId)
      throw unavailable()
    },
    async detail(branchId,invoiceId){
      if(!isBillingId(invoiceId))throw denied()
      await verify(branchId)
      throw unavailable()
    }
  }
}
