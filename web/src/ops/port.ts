import type {OpsReadPortFactory} from './read-port'

/** Default wiring while PR #59 is not integrated: no port, so no staff data is ever requested. */
export const createOpsReadPort: OpsReadPortFactory = () => null
