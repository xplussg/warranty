import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const url = Deno.env.get('PROJECT_URL') || Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SERVICE_ROLE_KEY')
  const supabase = createClient(url!, key!)

  const { username } = await req.json()
  const u = String(username || '').trim()

  const { data, error } = await supabase.from('usernames').select('email').ilike('username', u).maybeSingle()
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders })
  if (data?.email) return new Response(JSON.stringify({ email: data.email }), { status: 200, headers: corsHeaders })

  const { data: meta, error: e2 } = await supabase
    .from('auth.users')
    .select('email')
    .ilike('user_metadata->>username', u)
    .maybeSingle()
  if (e2) return new Response(JSON.stringify({ error: e2.message }), { status: 400, headers: corsHeaders })
  if (!meta?.email) return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: corsHeaders })
  return new Response(JSON.stringify({ email: meta.email }), { status: 200, headers: corsHeaders })
})
