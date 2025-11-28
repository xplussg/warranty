import { supabase } from './supabase'

export async function login(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function me() {
  const { data } = await supabase.auth.getSession()
  return data
}

export async function logout() {
  await supabase.auth.signOut()
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
  if (!r) return null
  return r === 'admin' ? 'owner' : r
}
