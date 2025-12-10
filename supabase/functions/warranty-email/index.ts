// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

export default async function handler(req: Request): Promise<Response> {
  try {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    }
    if (req.method === 'OPTIONS') {
      return new Response('ok', { status: 200, headers: cors })
    }
    if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: cors })
    const payload = await req.json()
    const to = String(payload?.to || '').trim()
    if (!to) return new Response(JSON.stringify({ error: 'Missing recipient' }), { status: 400 })
    const details = payload?.details || {}
    const subject = 'XPLUS Warranty Registration Successful'
    const html = renderHtml(details)

    const apiKey = Deno.env.get('RESEND_API_KEY') || ''
    if (!apiKey) {
      console.log('RESEND_API_KEY missing; email skipped. Details:', { to, details })
      return new Response(JSON.stringify({ skipped: true }), { status: 200, headers: cors })
    }

    async function send(from: string) {
      return await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ from, to: [to], subject, html })
      })
    }
    const preferredFrom = 'XPLUS <no-reply@xplus.com.sg>'
    let r = await send(preferredFrom)
    if (!r.ok) {
      r = await send('XPLUS <onboarding@resend.dev>')
    }
    if (!r.ok) {
      const text = await r.text()
      return new Response(JSON.stringify({ error: `Email send failed: ${text}` }), { status: 500, headers: cors })
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: cors })
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
  const get = (a: any, b: any) => String((a ?? b) ?? '').trim()
  const brandCss = 'font-family:Montserrat,sans-serif;color:#4A0A0E;background:#fff;'
  const cardCss = 'max-width:720px;margin:0 auto;background:#FFFFFF;border-radius:16px;border:1px solid #FFCDD2;padding:24px;'
  const headCss = 'font-family:Montserrat,sans-serif;font-size:22px;color:#D32F2F;margin:0 0 8px 0;'
  const subCss = 'font-size:14px;line-height:1.8;color:#6B6B6B;margin:0 0 16px 0;'
  const barCss = 'background:#D32F2F;color:#fff;padding:12px 16px;border-radius:10px 10px 0 0;display:flex;justify-content:space-between;align-items:center;'
  const rowLabel = 'width:30%;padding:12px;border-top:1px solid #FFCDD2;background:#FFEBEE;font-weight:600;color:#4A0A0E;'
  const rowValue = 'padding:12px;border-top:1px solid #FFCDD2;'
  const promiseCss = 'margin-top:16px;padding:12px;border:1px solid #FFCDD2;border-radius:10px;background:#FFF7F7;color:#4A0A0E;font-size:14px;'
  const rows = [
    ['Name', get(d.name, d.name)],
    ['Email', get(d.email, d.email)],
    ['Mobile', get(d.mobile, d.mobile)],
    ['Phone Model', get(d.phoneModel, d.phone_model)],
    ['Country', get(d.country, d.country)],
    ['Product Type', get(d.productType, d.product_type)],
    ['Purchase Date', get(d.purchaseDate, d.purchase_date)],
    ['Expiry Date', get(d.expiryDate, d.expiry_date)],
    ['Product Code', get(d.productCode, d.product_code)],
  ]
    .filter(([, v]) => v.length > 0)
    .map(([k, v]) => `<tr><td style="${rowLabel}">${escapeHtml(String(k))}</td><td style="${rowValue}">${escapeHtml(String(v))}</td></tr>`)
    .join('')
  const html = '<div style="'+brandCss+'">\n  <div style="'+cardCss+'">\n    <h1 style="'+headCss+'">Warranty Registration Successful</h1>\n    <p style="'+subCss+'">Your XPLUS warranty has been activated.</p>\n    <div style="'+barCss+'"><strong>Registration Details</strong><span style="font-weight:600">XPLUS</span></div>\n    <table style="width:100%;border-collapse:collapse;border:1px solid #FFCDD2;border-radius:0 0 12px 12px;overflow:hidden"><tbody>'+rows+'</tbody></table>\n    <div style="'+promiseCss+'"><div style="font-weight:600;margin-bottom:6px">X-Plus Promise</div>100% Genuine • Exceptional Client Care • 180-Day 1-to-1 Exchange</div>\n  </div>\n</div>'
  return '<!doctype html><html><body style="margin:0;padding:0;background:#fff">'+html+'</body></html>'
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[c] as string))
}

// Ensure default export is picked by Supabase Edge runtime
// deno-lint-ignore no-unused-vars
export const serve = handler
