// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

export default async function handler(req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
    const payload = await req.json()
    const to = String(payload?.to || '').trim()
    if (!to) return new Response(JSON.stringify({ error: 'Missing recipient' }), { status: 400 })
    const details = payload?.details || {}
    const subject = 'XPLUS Warranty Registration Confirmation'
    const html = renderHtml(details)

    const apiKey = Deno.env.get('RESEND_API_KEY') || ''
    if (!apiKey) {
      console.log('RESEND_API_KEY missing; email skipped. Details:', { to, details })
      return new Response(JSON.stringify({ skipped: true }), { status: 200 })
    }

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'XPLUS <no-reply@xplus.com.sg>',
        to: [to],
        subject,
        html
      })
    })
    if (!r.ok) {
      const text = await r.text()
      return new Response(JSON.stringify({ error: `Email send failed: ${text}` }), { status: 500 })
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: String(err?.message || err) }), { status: 500 })
  }
}

function renderHtml(d: any): string {
  const fmt = (v: any) => String(v ?? '').trim()
  const items: [string, string][] = [
    ['Name', fmt(d.name)],
    ['Email', fmt(d.email)],
    ['Mobile', fmt(d.mobile)],
    ['Phone Model', fmt(d.phone_model ?? d.phoneModel)],
    ['Country', fmt(d.country)],
    ['Product Type', fmt(d.product_type ?? d.productType)],
    ['Purchase Date', fmt(d.purchase_date ?? d.purchaseDate)],
    ['Expiry Date', fmt(d.expiry_date ?? d.expiryDate)],
    ['Product Code', fmt(d.product_code ?? d.productCode)],
  ]
  const rows = items
    .filter(([_, v]) => v.length > 0)
    .map(([k, v]) => `<tr><td style="padding:8px;border:1px solid #eee;font-weight:600">${escapeHtml(k)}</td><td style="padding:8px;border:1px solid #eee">${escapeHtml(v)}</td></tr>`) 
    .join('')
  return `<!doctype html><html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto; color:#111">
    <h2 style="color:#d51015;margin:0 0 12px">XPLUS Warranty Registration</h2>
    <p>Thank you for registering your warranty. Here are your details:</p>
    <table style="border-collapse:collapse;border:1px solid #eee">${rows}</table>
    <p style="margin-top:12px">If anything looks wrong, reply to this email and our team will help.</p>
  </body></html>`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[c] as string))
}

// Ensure default export is picked by Supabase Edge runtime
// deno-lint-ignore no-unused-vars
export const serve = handler

