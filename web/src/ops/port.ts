import type {OpsReadPortFactory} from './read-port'
import {createReadPortFor} from './port-adapter.mjs'
import {getClinicDashboardCounts, listClinicQueueWindow, verifiedStaffSession} from '../lib/staff-clinic'

/**
 * Read-only staff wiring (PR #59 contracts). This is the ONLY ops file that imports `lib/`.
 * Window form only (never the truncated array `listClinicQueue`); no writes, no patients or
 * clinical-record reads, no fallback data. The page stays behind VITE_PHASE5A_OPS_UI (OFF).
 */
const deps = {verifiedStaffSession, listClinicQueueWindow, getClinicDashboardCounts}
export const createOpsReadPort: OpsReadPortFactory = user => createReadPortFor(deps, user)
