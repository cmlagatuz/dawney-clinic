import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
  const verification = useRef(0)
  const sessionAccount = useRef<string | null>(null)
  const refresh = useCallback(async () => {
    const attempt = ++verification.current
    if (!supabase) {
      setChecking(false)
      return
    }
    try {
      // getSession checks for presence only; authorization always uses GoTrue getUser.
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (attempt !== verification.current) return
      if (sessionError) throw sessionError
      sessionAccount.current = sessionData.session?.user.id ?? null
      if (!sessionData.session) { setUser(null); setError(null); return }
      const { data, error: authError } = await supabase.auth.getUser()
      if (attempt !== verification.current) return
      if (authError) {
        if (authError.status === 401 || authError.status === 403) { setUser(null); setError(null); return }
        throw authError
      }
      setUser(isVerifiedUser(data.user) && data.user.id === sessionAccount.current ? data.user : null)
      setError(null)
    } catch {
      if (attempt !== verification.current) return
      setUser(null)
      setError('Could not verify your account. Check your connection and try again.')
    } finally {
      if (attempt === verification.current) setChecking(false)
    }
  }, [])
  useEffect(() => {
    if (!supabase) return
    let alive = true
    void refresh()
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (!alive) return
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      if (event === 'SIGNED_OUT') {
        ++verification.current
        sessionAccount.current = null
        setUser(null)
        setError(null)
        setRecovery(false)
        setChecking(false)
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        const nextAccount = session?.user.id ?? null
        if (nextAccount !== sessionAccount.current) {
          // Hide the previous account before the new session can read branch booking data.
          ++verification.current
          sessionAccount.current = nextAccount
          setUser(null)
          setError(null)
          setChecking(true)
        }
        // Deliberately schedule a separate task; calling await getUser from this handler can deadlock.
        setTimeout(() => { if (alive) void refresh() }, 0)
      }
    })
    return () => { alive = false; ++verification.current; subscription.subscription.unsubscribe() }
  }, [refresh])
  const value = useMemo(() => ({ user, checking, error, recovery, refresh }), [user, checking, error, recovery, refresh])
  return <context.Provider value={value}>{children}</context.Provider>
}
export function useAuth() {
  const value = useContext(context)
  if (!value) throw new Error('useAuth must be used within AuthProvider')
  return value
}