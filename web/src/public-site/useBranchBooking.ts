import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../hooks/AuthProvider'
import { readApprovedBranchBookingConfig, type BranchBookingReadStatus } from '../lib/branch-public-booking'
import { supabase } from '../lib/supabase'
import { queryClinicBranchCatalog } from '../staff-branch-read-contract.mjs'
import { DEFAULT_BRANCH_ID } from './clinic-info.mjs'

export type BranchBookingOptions = BranchBookingReadStatus
  | { kind: 'loading' }
  | { kind: 'missing_branch_mapping' }
  | { kind: 'contact_only' }

const loading = { kind: 'loading' } as const
const contactOnly = { kind: 'contact_only' } as const
const backendError = { kind: 'backend_error' } as const

async function discoverNagaBooking(isCurrent: () => boolean): Promise<BranchBookingOptions> {
  if (!supabase) return backendError
  try {
    // The public directory slug is for lookup only. The typed backend directory
    // validates UUIDs; the booking reader checks approval using the returned ID.
    const branches = await queryClinicBranchCatalog(supabase)
    const matches = branches.filter(branch => branch.slug === DEFAULT_BRANCH_ID)
    if (matches.length !== 1 || !matches[0]) return { kind: 'missing_branch_mapping' }
    if (!isCurrent()) return loading
    const branchId = matches[0].id.toLowerCase()
    const result = await readApprovedBranchBookingConfig(branchId)
    return result.kind === 'ready' && result.branchId !== branchId ? backendError : result
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && 'message' in error &&
        (error.code === 'PGRST205' || error.code === '42P01' ||
         error.code === 'PGRST204' || error.code === '42703') &&
        typeof error.message === 'string' && /\bclinic_branches\b/.test(error.message)) {
      return { kind: 'missing_contract', table: 'clinic_branches' }
    }
    return backendError
  }
}

export function useBranchBooking(branchSlug: string = DEFAULT_BRANCH_ID) {
  const { user, checking, error: authError, refresh } = useAuth()
  const accountId = user?.id ?? null
  const [attempt, setAttempt] = useState(0)
  const scope = useMemo(() => ({ branchSlug, accountId, checking, authError, attempt }), [branchSlug, accountId, checking, authError, attempt])
  const [settled, setSettled] = useState<{ scope: typeof scope; options: BranchBookingOptions } | null>(null)

  useEffect(() => {
    if (scope.checking || scope.authError || scope.branchSlug !== DEFAULT_BRANCH_ID) return
    let current = true
    void discoverNagaBooking(() => current).then(options => {
      if (current) setSettled({ scope, options })
    })
    return () => { current = false }
  }, [scope])

  // Never render a previous account, branch or retry result during an effect transition.
  if (branchSlug !== DEFAULT_BRANCH_ID) return { options: contactOnly, reload: () => {} }
  if (authError) return { options: backendError, reload: () => void refresh() }
  return { options: settled?.scope === scope ? settled.options : loading, reload: () => setAttempt(n => n + 1) }
}
