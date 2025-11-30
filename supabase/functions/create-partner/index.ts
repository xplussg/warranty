import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SERVICE_ROLE_KEY')!)
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    const { data: { user } } = await supabase.auth.getUser(token)

    const role = (user?.user_metadata?.role || '').toString().toLowerCase()
    if (!['owner', 'admin'].includes(role)) {
      return new Response(JSON.stringify({ error: 'Forbidden — only owner or admin' }), { status: 403, headers: corsHeaders })
    }

    const { email, password, username } = await req.json()
    const { error } = await supabase.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { username, role: 'partner' }
    })

    if (error) throw error
    await supabase.from('usernames').upsert({ username, email })
    return new Response(JSON.stringify({ message: 'Partner created!' }), { status: 200, headers: corsHeaders })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Unknown error' }), { status: 500, headers: corsHeaders })
  }
})
