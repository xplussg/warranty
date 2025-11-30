import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SERVICE_ROLE_KEY')!
  )

  const { username } = await req.json()

  const { data } = await supabase
    .from('auth.users')
    .select('email')
    .ilike('user_metadata->>username', username)
    .single()

  if (!data) {
    return new Response(JSON.stringify({ error: 'not found' }), { status: 404 })
  }

  return new Response(JSON.stringify({ email: data.email }), { status: 200 })
})
