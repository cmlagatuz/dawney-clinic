import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { isVerifiedUser } from '../domain.mjs'

type AuthState = {
  user: User | null
  checking: boolean
  error: string | null
  recovery: boolean
  refresh: () => Promise<void>
}
const context = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recovery, setRecovery] = useState(false)
  const refresh = useCallback(async () => {
    if (!supabase) {
      setChecking(false)
      return
    }
    try {
      // getSession checks for presence only; authorization always uses GoTrue getUser.
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      if (!sessionData.session) { setUser(null); setError(null); return }
      const { data, error: authError } = await supabase.auth.getUser()
      if (authError) {
        if (authError.status === 401 || authError.status === 403) { setUser(null); setError(null); return }
        throw authError
      }
      setUser(isVerifiedUser(data.user) ? data.user : null)
      setError(null)
    } catch {
      setUser(null)
      setError('Could not verify your account. Check your connection and try again.')
    } finally {
      setChecking(false)
    }
  }, [])
  useEffect(() => {
    if (!supabase) return
    let alive = true
    void refresh()
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (!alive) return
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setRecovery(false)
        setChecking(false)
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        // Deliberately schedule a separate task; calling await getUser from this handler can deadlock.
        setTimeout(() => { if (alive) void refresh() }, 0)
      }
    })
    return () => { alive = false; subscription.subscription.unsubscribe() }
  }, [refresh])
  const value = useMemo(() => ({ user, checking, error, recovery, refresh }), [user, checking, error, recovery, refresh])
  return <context.Provider value={value}>{children}</context.Provider>
}
export function useAuth() {
  const value = useContext(context)
  if (!value) throw new Error('useAuth must be used within AuthProvider')
  return value
}