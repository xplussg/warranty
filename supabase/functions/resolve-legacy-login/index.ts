import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { compare } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts"

const itoa64 = ".\/0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
async function md5Raw(data: Uint8Array) {
  const buf = await crypto.subtle.digest("MD5", data)
  return new Uint8Array(buf)
}
function toUint8(str: string) { return new TextEncoder().encode(str) }
function encode64(input: Uint8Array, count: number) {
  let output = ''
  let i = 0
  while (i < count) {
    let value = input[i++]
    output += itoa64[value & 0x3f]
    if (i < count) value |= input[i] << 8
    output += itoa64[(value >> 6) & 0x3f]
    if (++i >= count) break
    if (i < count) value |= input[i] << 16
    output += itoa64[(value >> 12) & 0x3f]
    if (++i >= count) break
    output += itoa64[(value >> 18) & 0x3f]
  }
  return output
}
async function phpassCheck(pass: string, hash: string) {
  if (!hash.startsWith("$P$")) return false
  const countLog2 = itoa64.indexOf(hash[3])
  const count = 1 << countLog2
  const salt = hash.substring(4, 12)
  let h = await md5Raw(toUint8(salt + pass))
  for (let i = 0; i < count; i++) {
    const combined = new Uint8Array(h.length + toUint8(pass).length)
    combined.set(h, 0)
    combined.set(toUint8(pass), h.length)
    h = await md5Raw(combined)
  }
  const output = "$P$" + hash[3] + salt + encode64(h, 16)
  return output === hash
}

serve(async (req) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const url = Deno.env.get('PROJECT_URL') || Deno.env.get('SUPABASE_URL')
    const key = Deno.env.get('SERVICE_ROLE_KEY')
    const supabase = createClient(url!, key!)

    const body = await req.json()
    const identifier = String(body.identifier || '').trim()
    const password = String(body.password || '')

    if (!identifier || !password) return new Response(JSON.stringify({ error: 'invalid' }), { status: 400, headers: cors })

    const { data: row, error } = await supabase
      .from('legacy_users')
      .select('username, email, password_hash, hash_type')
      .or(`username.ilike.${identifier},email.ilike.${identifier}`)
      .maybeSingle()
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: cors })
    if (!row) return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: cors })

    const ht = String(row.hash_type || '')
    const hh = String(row.password_hash || '')
    let ok = false
    if (ht === 'bcrypt') {
      const h = hh.replace('$wp$2y$', '$2y$').replace('$2b$', '$2y$').replace('$2a$', '$2y$')
      ok = await compare(password, h)
    } else if (ht === 'phpass') {
      ok = await phpassCheck(password, hh)
    }
    if (!ok) return new Response(JSON.stringify({ error: 'invalid credentials' }), { status: 401, headers: cors })

    const email = String(row.email)
    const username = String(row.username)
    const { error: e2 } = await supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username, role: 'partner' } })
    if (e2) return new Response(JSON.stringify({ error: e2.message }), { status: 500, headers: cors })

    await supabase.from('usernames').upsert({ username, email }, { onConflict: 'username' })
    await supabase.from('legacy_users').update({ migrated_at: new Date().toISOString() }).or(`username.eq.${username},email.eq.${email}`)

    return new Response(JSON.stringify({ email }), { status: 200, headers: cors })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Unknown' }), { status: 500, headers: cors })
  }
})
