import { supabase } from './supabase'

export async function login(emailOrUsername: string, password: string) {
  const input = String(emailOrUsername || '').trim()
  let email = input
  if (!input.includes('@')) {
    const { data, error } = await supabase
      .from('usernames')
      .select('email')
      .ilike('username', input)
      .maybeSingle()
    if (!error && data?.email) {
      email = String(data.email)
    } else {
      const env = (import.meta as any).env || {}
      const anon = env.VITE_SUPABASE_ANON_KEY
      const { data: result } = await (supabase as any).functions.invoke('resolve-username', {
        headers: { Authorization: `Bearer ${anon}`, apikey: anon },
        body: { username: input }
      })
      if (result?.email) {
        email = String(result.email)
      } else {
        const base = env.VITE_SUPABASE_URL
        const res = await fetch(`${base}/functions/v1/resolve-username`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anon}`, 'apikey': anon },
          body: JSON.stringify({ username: input })
        })
        if (!res.ok) throw new Error('Invalid username or email')
        const j = await res.json()
        if (!j?.email) throw new Error('Invalid username or email')
        email = String(j.email)
      }
    }
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    const env = (import.meta as any).env || {}
    const anon = env.VITE_SUPABASE_ANON_KEY
    const { data: migrated } = await (supabase as any).functions.invoke('resolve-legacy-login', {
      headers: { Authorization: `Bearer ${anon}`, apikey: anon },
      body: { identifier: input, password }
    })
    if (!migrated?.email) throw error
    const { data: data2, error: e2 } = await supabase.auth.signInWithPassword({ email: String(migrated.email), password })
    if (e2) throw e2
    return data2
  }
  return data
}

export async function me() {
  const { data } = await supabase.auth.getSession()
  return data
}

export async function logout() {
  await supabase.auth.signOut({ scope: 'global' } as any)
}

export async function getSessionToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || null
}

export async function getRole() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return null
  // Check user_metadata first
  const meta = session.user.user_metadata
  const r = meta && meta.role ? String(meta.role) : null
  if (!r) return 'owner'
  return r === 'admin' ? 'owner' : r
}
