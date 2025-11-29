import { supabase } from './supabase'

export async function login(emailOrUsername: string, password: string) {
  let email = emailOrUsername
  if (!emailOrUsername.includes('@')) {
    try {
      const { data: result, error } = await supabase.functions.invoke('resolve-username', {
        body: { username: emailOrUsername }
      })
      if (error) throw error
      if (result?.email) email = result.email
    } catch (err) {
      throw new Error('Invalid username or email')
    }
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
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
