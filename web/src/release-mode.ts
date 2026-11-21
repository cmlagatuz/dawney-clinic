import { configured } from './lib/supabase'
import { releaseCapabilities } from './release-profile.mjs'

/** Safe build-time capabilities. Never selected by hostname, preview domain, URL or storage. */
export const release = releaseCapabilities(import.meta.env.VITE_RELEASE_PROFILE, configured)
