import type { BranchBookingOptions } from '../public-site/useBranchBooking'
import { Spinner } from './ui'

type UnavailableOptions = Exclude<BranchBookingOptions, { kind: 'ready' }>

export function BranchBookingAvailability({ options, onRetry }: {
  options: UnavailableOptions
  onRetry: () => void
}) {
  if (options.kind === 'loading') {
    return <p role="status" className="field-help"><Spinner /> Checking clinic booking options…</p>
  }
  if (options.kind === 'backend_error' || options.kind === 'missing_branch_mapping') {
    return <p role="alert" className="alert alert-error">
      We could not verify booking options for Naga. <button type="button" className="button button-quiet" onClick={onRetry}>Try again</button>
    </p>
  }

  const message = options.kind === 'missing_contract'
    ? 'Online booking is still being set up for Naga.'
    : options.kind === 'contact_only'
      ? 'Please contact this branch to arrange a visit.'
      : options.kind === 'unapproved_branch'
        ? 'Online booking is not open yet for Naga.'
        : 'Online requests are currently unavailable for Naga.'
  return <p role="status" className="alert alert-info">{message}</p>
}
