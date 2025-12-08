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
    .map(([k, v]) => `<tr><td style="padding:10px;border:1px solid #f1d5d7;background:#fee8ea;font-weight:600;color:#4a0a0e">${escapeHtml(k)}</td><td style="padding:10px;border:1px solid #f1d5d7">${escapeHtml(v)}</td></tr>`) 
    .join('')
  const logo = 'https://www.xplus.com.sg/xplus.png'
  return `<!doctype html>
  <html>
  <body style="margin:0;background:#f8f9fb;font-family:system-ui,-apple-system,Segoe UI,Roboto;color:#111">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8f9fb;padding:24px 0">
      <tr><td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid #f1d5d7;border-radius:12px;overflow:hidden;box-shadow:0 20px 60px rgba(138,21,27,0.08)">
          <tr>
            <td style="background:#d51015;color:#ffffff;padding:16px 20px">
              <table width="100%" cellspacing="0" cellpadding="0"><tr>
                <td style="vertical-align:middle"><img src="${logo}" alt="XPLUS" width="120" style="display:block" /></td>
                <td align="right" style="vertical-align:middle;font-size:18px;font-weight:600">Warranty Confirmation</td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 20px">
              <h2 style="margin:0 0 10px;color:#a10e11;font-size:22px">Thank you for registering</h2>
              <p style="margin:0 0 16px;color:#333">Your XPLUS warranty has been successfully activated. Keep this email for your records.</p>
              <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #f1d5d7">${rows}</table>
              <div style="margin-top:16px;padding:12px;border:1px solid #f1d5d7;border-radius:8px;background:#fff7f7;color:#4a0a0e">
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
