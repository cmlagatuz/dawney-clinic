import type {User} from '@supabase/supabase-js'
import type {OpsBranch} from '../ops/branch-model.mjs'
import {createClinicalReadPort} from '../clinical/port'
import {assertStaffBranch} from '../lib/staff-branch'

/**
 * Frontend navigation is not a privilege source. Positive membership rows
 * alone are insufficient if ASTRA's server-side branch guard has since revoked
 * this staff member. Fail closed if ANY displayed branch cannot be asserted.
 * The destination pages repeat authorization with each actual data read.
 */
export async function verifiedStaffNavigationBranches(user:User):Promise<OpsBranch[]>{
  const id=user.id
  if(typeof id!=='string'||!id)throw Object.assign(Error('Staff authentication required'),{code:'42501'})
  const branches=await createClinicalReadPort(user).loadBranches()
  if(!branches.length)throw Object.assign(Error('No active staff branch'),{code:'42501'})
  const expected=new Set<string>()
  for(const branch of branches){
    if(expected.has(branch.id))throw Error('Duplicate staff branch returned')
    expected.add(branch.id)
  }
  const asserted=await Promise.all(branches.map(b=>assertStaffBranch(user,b.id)))
  if(asserted.some((response,i)=>response!==branches[i]?.id))
    throw Object.assign(Error('Staff branch scope changed'),{code:'42501'})
  return branches
}
