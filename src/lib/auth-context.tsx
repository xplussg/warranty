import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

// Mirrors getRole() in auth.ts: missing role defaults to owner, admin maps to owner.
function deriveRole(session: Session | null): string | null {
  if (!session?.user) return null
  const meta: any = session.user.user_metadata
  const r = meta && meta.role ? String(meta.role) : null
  if (!r) return 'owner'
  return r === 'admin' ? 'owner' : r
}

type AuthState = {
  session: Session | null
  role: string | null
  // true only until the initial session lookup completes
  initializing: boolean
}

const AuthContext = createContext<AuthState>({ session: null, role: null, initializing: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    let mounted = true
    // getSession() resolving is the point at which the client has fully
    // hydrated (and refreshed, if needed) the stored session, so its token
    // will be attached to subsequent queries. Gate readiness on THAT only.
    // onAuthStateChange is used purely to keep state in sync afterwards
    // (login / logout / token refresh) — it must not flip `initializing`,
    // since it can fire before hydration completes and release the guard early.
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setInitializing(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return
      setSession(s)
    })
    return () => { mounted = false; subscription.unsubscribe() }
  }, [])

  const role = deriveRole(session)
  return (
    <AuthContext.Provider value={{ session, role, initializing }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
