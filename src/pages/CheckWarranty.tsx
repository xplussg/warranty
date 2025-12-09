import { useState } from 'react'
import { searchWarrantiesByEmail } from '../lib/api'

export default function CheckWarranty() {
  const [email, setEmail] = useState('')
  const [items, setItems] = useState<any[]>([])
  const [message, setMessage] = useState('')

  function fmtDateOnly(v: any) {
    const t = String(v || '').trim()
    if (!t) return ''
    const m = t.match(/^(\d{4}-\d{2}-\d{2})/)
    return m ? m[1] : t
  }
  function show(v: any) {
    const t = String(v || '').trim()
    return t ? t : '—'
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    const v = email.trim()
    if (!v || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { setMessage('Enter a valid email'); return }
    try {
      const res = await searchWarrantiesByEmail(v)
      const list = res.items || []
      setItems(list)
      if (list.length === 0) setMessage('No records found for this email')
    } catch (err) {
      setItems([])
      setMessage('Unable to search warranties. Please try again later.')
    }
  }

  return (
    <section className="container py-12">
      <h2 className="page-title mb-6">Check Warranty by Email</h2>

      <form onSubmit={onSubmit} className="flex items-center gap-3 mb-3">
        <input id="email_user" className="rounded-md border border-slate-300 px-3 py-2" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter email" style={{ width: '50%', minWidth: 280 }} />
        <button className="px-4 py-2 rounded-md border border-slate-300" type="submit">Search</button>
      </form>
      {message && <div className="text-sm mt-2 text-red-600">{message}</div>}

      {items.length > 0 && (
        <table className="w-full text-xs border border-slate-200 text-[#6B6B6B] mt-6">
          <thead>
            <tr className="bg-slate-50">
              <th className="p-2 border sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-700">Phone Model</th>
              <th className="p-2 border sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-700">Product Type</th>
              <th className="p-2 border sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-700">Product Code</th>
              <th className="p-2 border sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-700">Coverage BUY/EXP</th>
              <th className="p-2 border sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-700">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((w) => (
              <tr key={w.id}>
                <td className="p-2 border">{show(w.phoneModel)}</td>
                <td className="p-2 border">{show(w.productType)}</td>
                <td className="p-2 border" style={{ fontFamily: 'Roboto Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}>{show(w.productCode)}</td>
                <td className="p-2 border" style={{ fontFamily: 'Roboto Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}>
                  <div className="leading-tight">
                    <div className="text-xs">{fmtDateOnly(w.purchaseDate)}</div>
                    <div className="text-xs">{fmtDateOnly(w.expiryDate)}</div>
                  </div>
                </td>
                <td className="p-2 border">{show(w.status || 'Not claimed')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
