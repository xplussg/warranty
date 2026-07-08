// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

async function handler(req: Request): Promise<Response> {
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
    const subject = 'XPLUS Warranty Registration Confirmation'
    const html = renderHtml(details)

    const apiKey = Deno.env.get('RESEND_API_KEY') || ''
    if (!apiKey) {
      console.log('RESEND_API_KEY missing; email skipped. Details:', { to, details })
      return new Response(JSON.stringify({ skipped: true }), { status: 200, headers: cors })
    }

    async function send(from: string) {
      const bcc = (Deno.env.get('WARRANTY_NOTIFY_EMAIL') || '').trim()
      const body: Record<string, unknown> = { from, to: [to], subject, html }
      if (bcc) body.bcc = [bcc]
      return await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
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
  const fmt = (v: any) => String(v ?? '').trim()
  // Format a YYYY-MM-DD (or ISO) value as e.g. "6 July 2026". Parses the
  // date parts directly to avoid timezone shifts from new Date(). Falls back
  // to the original string if it isn't a recognisable date.
  const fmtDate = (v: any) => {
    const s = fmt(v)
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (!m) return s
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const mi = parseInt(m[2], 10) - 1
    if (mi < 0 || mi > 11) return s
    return `${parseInt(m[3], 10)} ${months[mi]} ${m[1]}`
  }
  const items: [string, string][] = [
    ['Name', fmt(d.name)],
    ['Email', fmt(d.email)],
    ['Mobile', fmt(d.mobile)],
    ['Phone Model', fmt(d.phone_model ?? d.phoneModel)],
    ['Country', fmt(d.country)],
    ['Product Type', fmt(d.product_type ?? d.productType)],
    ['Purchase Date', fmtDate(d.purchase_date ?? d.purchaseDate)],
    ['Expiry Date', fmtDate(d.expiry_date ?? d.expiryDate)],
    ['Product Code', fmt(d.product_code ?? d.productCode)],
  ]
  const year = new Date().getFullYear()
  const rows = items
    .filter(([_, v]) => v.length > 0)
    .map(([k, v]) => `<tr><td style="padding:10px 0;border-top:1px solid #EEEEEE;color:#6B7280;font-size:13px;width:40%;vertical-align:top">${escapeHtml(k)}</td><td style="padding:10px 0;border-top:1px solid #EEEEEE;color:#1F2937;font-size:14px;font-weight:500;text-align:right;vertical-align:top;word-break:break-word">${escapeHtml(v)}</td></tr>`)
    .join('')
  const logo = 'https://www.xplus.com.sg/xplus.png'
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<style>
  @media only screen and (max-width:600px){
    .xp-container{width:100% !important}
    .xp-pad{padding:20px !important}
  }
</style>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:'Montserrat',system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1F2937">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">Your X-PLUS warranty is now active — here are your registration details.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F3F4F6">
    <tr><td align="center" style="padding:24px 12px">
      <table role="presentation" class="xp-container" width="600" cellspacing="0" cellpadding="0" style="width:600px;max-width:600px;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:12px;overflow:hidden">
        <tr><td style="background:#FFFFFF;padding:20px 24px 16px"><img src="${logo}" alt="X-PLUS" width="130" style="display:block;border:0;height:auto" /></td></tr>
        <tr><td style="height:4px;line-height:4px;font-size:0;background:#D32F2F">&nbsp;</td></tr>
        <tr><td class="xp-pad" style="padding:24px">
          <h1 style="margin:0 0 8px;color:#D32F2F;font-size:20px;font-weight:600">Warranty Registration Successful</h1>
          <p style="margin:0 0 20px;color:#6B7280;font-size:14px;line-height:1.6">Your X-PLUS warranty has been activated. Please keep this email for your records.</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">${rows}</table>
          <div style="margin-top:20px;padding:14px 16px;border:1px solid #E5E7EB;border-radius:8px;background:#F9FAFB">
            <div style="font-weight:600;color:#D32F2F;font-size:14px;margin-bottom:4px">The X-PLUS Promise</div>
            <div style="font-size:13px;line-height:1.6;color:#4B5563">100% Genuine &middot; Exceptional Client Care &middot; 180-Day 1-to-1 Exchange</div>
          </div>
        </td></tr>
        <tr><td style="padding:16px 24px 24px;border-top:1px solid #EEEEEE">
          <p style="margin:0;color:#9CA3AF;font-size:12px;line-height:1.6">&copy; ${year} X-PLUS SG &middot; <a href="https://www.xplus.com.sg" style="color:#9CA3AF">xplus.com.sg</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[c] as string))
}

Deno.serve(handler)
