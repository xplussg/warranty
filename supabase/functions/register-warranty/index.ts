// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

export default async function handler(req: Request): Promise<Response> {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  }
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: cors })
    if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: cors })

    const body = await req.json()
    const name = String(body?.name || '').trim()
    const email = String(body?.email || '').trim()
    const phoneModel = String(body?.phoneModel || '').trim()
    const mobile = String(body?.mobile || '').trim()
    const country = String(body?.country || '').trim()
    const productType = String(body?.productType || '').trim()
    const purchaseDate = String(body?.purchaseDate || '').trim()
    const expiryDate = String(body?.expiryDate || '').trim()
    const rawCode = String(body?.productCode || '').toUpperCase().trim()
    const cleanDigits = rawCode.replace(/\s|-/g, '')
    if (!name || !email || !phoneModel || !mobile || !country || !productType || !purchaseDate || !expiryDate || !cleanDigits) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400, headers: cors })
    }

    const url = Deno.env.get('PROJECT_URL') || Deno.env.get('SUPABASE_URL')
    const key = Deno.env.get('SERVICE_ROLE_KEY')
    if (!url || !key) return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500, headers: cors })
    const supabase = createClient(url!, key!)

    // Validate product code exists (support common storage variants)
    const variants = [
      cleanDigits,
      cleanDigits.replace(/(.{4})/g, '$1 ').trim(),
      cleanDigits.replace(/(.{4})/g, '$1-').replace(/-$/, '')
    ]
    let codeRow: any = null
    for (const v of variants) {
      const { data, error } = await supabase.from('product_codes').select('id, code, product_type').eq('code', v).limit(1)
      if (error) break
      if (data && data.length) { codeRow = data[0]; break }
    }
    if (!codeRow) return new Response(JSON.stringify({ error: 'Invalid product code' }), { status: 400, headers: cors })
    if (cleanDigits.startsWith('8899') && productType !== 'Dream Case') {
      return new Response(JSON.stringify({ error: 'Valid only with Dream Case product' }), { status: 400, headers: cors })
    }
    if (!cleanDigits.startsWith('8899') && productType === 'Dream Case') {
      return new Response(JSON.stringify({ error: 'Not valid for Dream Case product' }), { status: 400, headers: cors })
    }

    // Prevent duplicate registrations across variants
    const { data: existing } = await supabase
      .from('warranty_registrations')
      .select('id')
      .in('product_code', variants)
      .limit(1)
    if (existing && existing.length) {
      return new Response(JSON.stringify({ error: 'Product code already registered' }), { status: 409, headers: cors })
    }

    const row = {
      name,
      email,
      phone_model: phoneModel,
      mobile,
      country,
      product_type: productType,
      purchase_date: purchaseDate,
      expiry_date: expiryDate,
      product_code: cleanDigits,
      status: 'Active',
      created_at: new Date().toISOString()
    }
    const ins = await supabase.from('warranty_registrations').insert([row])
    if (ins.error) return new Response(JSON.stringify({ error: ins.error.message }), { status: 500, headers: cors })

    const details = {
      name,
      email,
      mobile,
      phoneModel,
      country,
      productType,
      purchaseDate,
      expiryDate,
      productCode: cleanDigits
    }

    const apiKey = Deno.env.get('RESEND_API_KEY') || ''
    let emailSent = false
    if (apiKey) {
      const html = renderHtml(details)
      const subject = 'XPLUS Warranty Registration Confirmation'
      async function send(from: string) {
        return await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from, to: [email], subject, html })
        })
      }
      const preferredFrom = 'XPLUS <no-reply@xplus.com.sg>'
      const fallbacks = ['XPLUS <onboarding@resend.dev>']
      const attempts: string[] = [preferredFrom, ...fallbacks]
      for (let i = 0; i < attempts.length && !emailSent; i++) {
        const r = await send(attempts[i])
        if (r.ok) { emailSent = true; break }
        await new Promise(res => setTimeout(res, 500 * (i + 1)))
      }
      if (!emailSent) {
        const r = await send(preferredFrom)
        if (r.ok) emailSent = true
      }
    }

    return new Response(JSON.stringify({ ok: true, emailSent }), { status: 200, headers: cors })
  } catch (err: any) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    }
    return new Response(JSON.stringify({ error: String(err?.message || err) }), { status: 500, headers: cors })
  }
}

function renderHtml(d: any): string {
  const fmt = (v: any) => String(v ?? '').trim()
  const items: [string, string][] = [
    ['Name', fmt(d.name)],
    ['Email', fmt(d.email)],
    ['Mobile', fmt(d.mobile)],
    ['Phone Model', fmt(d.phoneModel)],
    ['Country', fmt(d.country)],
    ['Product Type', fmt(d.productType)],
    ['Purchase Date', fmt(d.purchaseDate)],
    ['Expiry Date', fmt(d.expiryDate)],
    ['Product Code', fmt(d.productCode)],
  ]
  const rows = items
    .filter(([_, v]) => v.length > 0)
    .map(([k, v]) => `<tr><td style="width:30%;padding:12px;border-top:1px solid #FFCDD2;background:#FFEBEE;font-weight:600;color:#4A0A0E">${escapeHtml(k)}</td><td style="padding:12px;border-top:1px solid #FFCDD2">${escapeHtml(v)}</td></tr>`)
    .join('')
  const logo = 'https://www.xplus.com.sg/xplus.png'
  return `<!doctype html>
  <html>
  <body style="margin:0;background:linear-gradient(135deg, #fffcfc 0%, #FFEBEE 100%);font-family:Montserrat,system-ui,-apple-system,Segoe UI,Roboto;color:#4A0A0E">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 0">
      <tr><td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#FFFFFF;border:1px solid #FFCDD2;border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(138,21,27,0.15)">
          <tr>
            <td style="background:#D32F2F;color:#FFFFFF;padding:12px 16px">
              <table width="100%" cellspacing="0" cellpadding="0"><tr>
                <td style="vertical-align:middle"><img src="${logo}" alt="XPLUS" width="120" style="display:block" /></td>
                <td align="right" style="vertical-align:middle;font-size:16px;font-weight:600">Registration Details</td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 20px">
              <h2 style="margin:0 0 10px;color:#D32F2F;font-size:22px">Warranty Registration Successful</h2>
              <p style="margin:0 0 16px;color:#6B6B6B;font-size:15px;line-height:1.8">Your XPLUS warranty has been activated. Keep this email for your records.</p>
              <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">${rows}</table>
              <div style="margin-top:16px;padding:12px;border:1px solid #FFCDD2;border-radius:10px;background:#FFF7F7;color:#4A0A0E">
                <div style="font-weight:600;margin-bottom:6px">X-Plus Promise</div>
                <div style="font-size:14px;line-height:1.5">100% Genuine • Exceptional Client Care • 180-Day 1-to-1 Exchange</div>
              </div>
              <p style="margin-top:16px;font-size:13px;color:#555">If anything looks incorrect, reply to this email and our team will assist you.</p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
  </html>`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[c] as string))
}

// Ensure default export is picked by Supabase Edge runtime
// deno-lint-ignore no-unused-vars
export const serve = handler
