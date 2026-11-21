import {OPS_ROLES} from './ops-model.mjs'

/**
 * Pure branch-scope model for the (flag-OFF) staff Operations UI, written against the PROPOSED
 * Issue #77 / PR #80 contracts: `staff_branch_memberships` (self-only SELECT), public `clinic_branches`,
 * and `assert_staff_branch(uuid)` (42501 when not authorized). Nothing here grants access:
 * it only DERIVES what to offer from server rows; every selection must still be authorized by the
 * server (assert_staff_branch) and every read is scoped + RLS-checked server-side.
 * Never reads JWT or user metadata, the URL, or any other browser-held state.
 */
export const BRANCH_DENIED_MESSAGE = 'Branch access not authorized'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const isBranchId = v => typeof v === 'string' && UUID.test(v)
export function branchDenied() { return Object.assign(Error(BRANCH_DENIED_MESSAGE), {code: '42501'}) }

function cleanCatalog(rows) {
  if (!Array.isArray(rows)) throw Error('Clinic branch list could not be verified')
  const out = new Map()
  for (const r of rows) {
    if (!r || typeof r !== 'object' || !isBranchId(r.id) || out.has(r.id)) continue
    const name = typeof r.display_name === 'string' ? r.display_name.trim() : ''
    const slug = typeof r.slug === 'string' ? r.slug : ''
    if (!name || !/^[a-z][a-z0-9-]{1,39}$/.test(slug)) continue
    out.set(r.id, {id: r.id, slug, name})
  }
  return out
}

/**
 * Branches to OFFER: the caller's OWN active memberships that also exist in the public branch list.
 * Rows for another user, inactive, with an unknown role, a malformed/unknown/duplicate branch id
 * are dropped (counted, never shown). Result order follows the server catalog order.
 */
export function deriveBranches(membershipRows, catalogRows, uid) {
  if (!Array.isArray(membershipRows)) throw Error('Branch memberships could not be verified')
  const catalog = cleanCatalog(catalogRows)
  const seen = new Map(); const bad = new Set()
  let dropped = 0
  for (const m of membershipRows) {
    if (!m || typeof m !== 'object' || typeof uid !== 'string' || !uid || m.user_id !== uid || m.is_active !== true ||
        !OPS_ROLES.includes(m.role) || !isBranchId(m.branch_id) || !catalog.has(m.branch_id)) { dropped++; continue }
    if (seen.has(m.branch_id)) { bad.add(m.branch_id); dropped++; continue }
    seen.set(m.branch_id, m.role)
  }
  for (const id of bad) { seen.delete(id); dropped++ }
  const branches = [...catalog.values()].filter(b => seen.has(b.id)).map(b => ({...b, role: seen.get(b.id)}))
  return {branches, dropped}
}
/** A selection is only acceptable if it is one of the DERIVED branches (forged ids never reach the server read). */
export const isOfferedBranch = (branches, id) => isBranchId(id) && branches.some(b => b.id === id)
/** Single branch → auto-select (still server-asserted); several → the user must choose; none → denied. */
export function initialSelection(branches) { return branches.length === 1 ? branches[0].id : null }
