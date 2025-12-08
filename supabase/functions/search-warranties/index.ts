// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

export default async function handler(req: Request): Promise<Response> {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: cors })
    const url = Deno.env.get('PROJECT_URL') || Deno.env.get('SUPABASE_URL')
    const key = Deno.env.get('SERVICE_ROLE_KEY')
    if (!url || !key) return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500, headers: cors })
    const supabase = createClient(url, key)
    const body = await req.json()
    const email = String(body?.email || '').trim()
    if (!email) return new Response(JSON.stringify({ error: 'Missing email' }), { status: 400, headers: cors })
    const pattern = `%${email}%`
    const { data, error } = await supabase
      .from('warranty_registrations')
      .select('id,name,email,phone_model,mobile,country,product_type,purchase_date,expiry_date,product_code,status,created_at,claimed_at,claimed_by')
      .ilike('email', pattern)
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors })
    const items = (data || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      phoneModel: r.phone_model,
      mobile: r.mobile,
      country: r.country,
      productType: r.product_type,
      purchaseDate: r.purchase_date,
      expiryDate: r.expiry_date,
      productCode: r.product_code,
      status: r.status,
      createdAt: r.created_at,
      claimedAt: r.claimed_at,
      claimedBy: r.claimed_by,
    }))
    return new Response(JSON.stringify({ items, count: items.length }), { status: 200, headers: cors })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: String(err?.message || err) }), { status: 500, headers: cors })
  }
}

// deno-lint-ignore no-unused-vars
export const serve = handler
