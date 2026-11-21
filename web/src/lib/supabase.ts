import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

export const configured = Boolean(
  url && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url) &&
  key && key.startsWith('sb_publishable_')
)

// A null client allows the app to show a safe configuration error rather than
// silently connecting to the wrong project or exposing server credentials.
export const supabase = configured ? createClient(url!, key!, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storageKey: 'dawney.auth.v1',
  },
}) : null