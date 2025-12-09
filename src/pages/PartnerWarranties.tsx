import { useState } from 'react'
import { claimWarranty, searchWarranties } from '../lib/api'

export default function PartnerWarranties() {
  const [q, setQ] = useState('')
  const [items, setItems] = useState<any[]>([])
  const [message, setMessage] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [total, setTotal] = useState(0)

  async function onSearch(nextPage?: number) {
    const query = q.trim()
    if (!query) { setItems([]); setTotal(0); setMessage('Enter name / email / phone'); return }
    setMessage('')
    const res = await searchWarranties(query, typeof nextPage === 'number' ? nextPage : page, pageSize)
    const list = res.items || []
    setItems(list)
    setTotal(res.total || 0)
    if (list.length === 0) setMessage('No matching records')
  }

  async function onClaim(id: number) {
    await claimWarranty(id)
    await onSearch()
  }

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
  function withinExpiry(w: any) {
    const t = String(w.status || '').toLowerCase()
    if (t.includes('claim')) return false
    const m = String(w.expiryDate || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (m) {
      const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
      return new Date() <= d
    }
    const pm = String(w.purchaseDate || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (pm) {
      const d = new Date(Number(pm[1]), Number(pm[2]) - 1, Number(pm[3]))
      d.setDate(d.getDate() + 180)
      return new Date() <= d
    }
    return false
  }

  return (
    <section className="container py-12">
      <h2 className="page-title mb-6">Warranty Registrations</h2>

      <form onSubmit={(e) => { e.preventDefault(); onSearch() }} className="flex items-center gap-3 mb-3">
        <input className="rounded-md border border-slate-300 px-3 py-2" placeholder="Enter name / email / phone" value={q} onChange={e => setQ(e.target.value)} style={{ width: '50%', minWidth: 280 }} />
        <button type="submit" className="px-4 py-2 rounded-md border border-slate-300">Search</button>
      </form>

      {total === 0 && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Enter a search term to view warranties.
        </div>
      )}

      <table className="w-full text-xs border border-slate-200 text-[#6B6B6B]">
        <thead>
          <tr className="bg-slate-50">
            <th className="p-2 border sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-700">ID</th>
            <th className="p-2 border sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-700">Customer</th>
            <th className="p-2 border sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-700">Phone Model</th>
            <th className="p-2 border sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-700">Country</th>
            <th className="p-2 border sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-700">Product Type</th>
            <th className="p-2 border sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-700">Coverage BUY/EXP</th>
            <th className="p-2 border sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-700">Product Code</th>
            <th className="p-2 border sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-700">Date of Registration</th>
            <th className="p-2 border sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-700">Action</th>
            <th className="p-2 border sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-700">Claim By/On</th>
          </tr>
        </thead>
        <tbody>
          {items.map((w) => (
            <tr key={w.id}>
              <td className="p-2 border">{w.id}</td>
              <td className="p-2 border">
                <div className="leading-tight">
                  <div className="font-medium">{show(w.name)}</div>
                  <div className="text-xs">{show(w.email)}</div>
                  <div className="text-xs">{show(w.mobile)}</div>
                </div>
              </td>
              <td className="p-2 border">{show(w.phoneModel)}</td>
              <td className="p-2 border">{show(w.country)}</td>
              <td className="p-2 border">{show(w.productType)}</td>
              <td className="p-2 border" style={{ fontFamily: 'Roboto Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}>
                <div className="leading-tight">
                  <div className="text-xs">{fmtDateOnly(w.purchaseDate)}</div>
                  <div className={`text-xs ${withinExpiry(w) ? 'text-emerald-700' : 'text-red-700'}`}>{fmtDateOnly(w.expiryDate)}</div>
                </div>
              </td>
              <td className="p-2 border" style={{ fontFamily: 'Roboto Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}>{show(w.productCode)}</td>
              <td className="p-2 border">{show(w.createdAt)}</td>
              <td className="p-2 border">
                <button
                  className="px-2 py-1 border rounded"
                  disabled={w.status === 'Claimed' || !withinExpiry(w)}
                  style={w.status === 'Claimed' || !withinExpiry(w) ? { background:'#F5F5F5', color:'#9AA0A6', borderColor:'#E0E0E0', cursor:'default', pointerEvents:'none' } : {}}
                  onClick={() => onClaim(w.id)}
                >
                  {w.status === 'Claimed' ? 'Claimed' : 'Claim'}
                </button>
              </td>
              <td className="p-2 border">{w.claimedBy ? `${w.claimedBy}` : ''}{w.claimedAt ? ` / ${w.claimedAt}` : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 flex items-center gap-3">
        <button className="px-2 py-1 border rounded" disabled={page<=1} onClick={() => {
          setPage(p => {
            const np = Math.max(1, p-1)
            setTimeout(() => { onSearch(np) }, 0)
            return np
          })
        }}>Prev</button>
        <span>Page {page}</span>
        <button className="px-2 py-1 border rounded" disabled={(page*pageSize)>=total} onClick={() => {
          setPage(p => {
            const np = p + 1
            setTimeout(() => { onSearch(np) }, 0)
            return np
          })
        }}>Next</button>
      </div>

      {message && <div className="mt-3 text-sm text-slate-600">{message}</div>}
      <div className="mt-8">
        <a className="rounded-md border border-slate-300 px-4 py-2 inline-block" href="/partner/dashboard">Return</a>
      </div>
    </section>
  )
}
