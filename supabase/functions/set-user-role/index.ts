import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const url = Deno.env.get('PROJECT_URL') || Deno.env.get('SUPABASE_URL')
    const key = Deno.env.get('SERVICE_ROLE_KEY')
    const supabase = createClient(url!, key!)

    const headerKey = (req.headers.get('apikey') || '').trim()
    const authHeader = (req.headers.get('Authorization') || '').trim()
    const bearer = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : authHeader
    let canAdmin = headerKey && key && headerKey === key || (bearer && key && bearer === key)

    if (!canAdmin) {
      const token = req.headers.get('Authorization')?.replace('Bearer ', '')
      const { data: { user } } = await supabase.auth.getUser(token)
      const role = (user?.user_metadata?.role || '').toString().toLowerCase()
      canAdmin = ['owner', 'admin'].includes(role)
    }

    if (!canAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden — only owner/admin or service role' }), { status: 403, headers: corsHeaders })
    }

    const body = await req.json()
    const targetEmail = String(body?.email || '').trim().toLowerCase()
    const setRole = String(body?.role || 'owner').toLowerCase()
    const username = body?.username ? String(body.username).trim() : undefined

    if (!targetEmail || !['owner','partner','admin'].includes(setRole)) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400, headers: corsHeaders })
    }

    const { data: users, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 })
    if (listErr) throw listErr
    const target = users.users.find(u => u.email?.toLowerCase() === targetEmail)
    if (!target) {
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers: corsHeaders })
    }

    const newMeta: Record<string, any> = { ...(target.user_metadata || {}), role: setRole }
    if (username) newMeta.username = username

    const { error: updErr } = await supabase.auth.admin.updateUserById(target.id, { user_metadata: newMeta })
    if (updErr) throw updErr

    if (username) {
      await supabase.from('usernames').upsert({ username, email: targetEmail }, { onConflict: 'username' })
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Unknown error' }), { status: 500, headers: corsHeaders })
  }
})
