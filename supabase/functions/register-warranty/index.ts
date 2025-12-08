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
    const cleanCode = String(body.productCode || body.product_code || '').toUpperCase().replace(/\s+/g, '')
    const row = {
      name: String(body.name || ''),
      email: String(body.email || ''),
      phone_model: String(body.phoneModel || body.phone_model || ''),
      mobile: String(body.mobile || ''),
      country: String(body.country || ''),
      product_type: String(body.productType || body.product_type || ''),
      purchase_date: String(body.purchaseDate || body.purchase_date || ''),
      expiry_date: String(body.expiryDate || body.expiry_date || ''),
      product_code: cleanCode,
      status: 'Active',
      created_at: new Date().toISOString()
    }

    const r1 = await supabase
      .from('product_codes')
      .select('id')
      .eq('code', cleanCode)
      .maybeSingle()
    if (r1.error || !r1.data) return new Response(JSON.stringify({ error: 'Invalid product code' }), { status: 400, headers: cors })

    const r2 = await supabase
      .from('warranty_registrations')
      .select('id')
      .eq('product_code', cleanCode)
      .maybeSingle()
    if (r2.data) return new Response(JSON.stringify({ error: 'Product code already registered' }), { status: 409, headers: cors })

    const r3 = await supabase
      .from('warranty_registrations')
      .insert([row])
    if (r3.error) return new Response(JSON.stringify({ error: r3.error.message }), { status: 500, headers: cors })

    let emailSent = false
    try {
      const fr = await fetch(`${url}/functions/v1/warranty-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': key },
        body: JSON.stringify({ to: row.email, details: row })
      })
      if (fr.ok) {
        const j = await fr.json().catch(() => ({}))
        if (!j.skipped) emailSent = true
      }
    } catch {}

    return new Response(JSON.stringify({ ok: true, emailSent }), { status: 200, headers: cors })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: String(err?.message || err) }), { status: 500, headers: cors })
  }
}

// deno-lint-ignore no-unused-vars
export const serve = handler
