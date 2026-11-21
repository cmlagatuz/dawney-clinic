import type {OpsRole} from './ops-model.mjs'
export type OpsBranch = {id: string; slug: string; name: string; role: OpsRole}
export const BRANCH_DENIED_MESSAGE: string
export function isBranchId(v: unknown): v is string
export function branchDenied(): Error
export function deriveBranches(membershipRows: unknown, catalogRows: unknown, uid: string): {branches: OpsBranch[]; dropped: number}
export function isOfferedBranch(branches: readonly OpsBranch[], id: unknown): boolean
export function initialSelection(branches: readonly OpsBranch[]): string | null
