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
      <h2 className="text-2xl font-semibold mb-6">Records</h2>
      <div className="flex items-center gap-3 mb-3">
        <input className="rounded-md border border-slate-300 px-3 py-2" placeholder="Enter name / email / phone" value={q} onChange={e => setQ(e.target.value)} />
        <button className="px-4 py-2 rounded-md border border-slate-300" onClick={() => onSearch()}>Search</button>
        <span className="text-sm text-slate-600">Show {pageSize} entries · Total {total}</span>
      </div>
      {items.length > 0 && (
      <table className="w-full text-sm border border-slate-200">
        <thead>
          <tr className="bg-slate-50">
            <th className="p-2 border">ID</th>
            <th className="p-2 border">Name</th>
            <th className="p-2 border">Email</th>
            <th className="p-2 border">Phone Model</th>
            <th className="p-2 border">Mobile</th>
            <th className="p-2 border">Product Type</th>
            <th className="p-2 border">Purchase Date</th>
            <th className="p-2 border">Expiry Date</th>
            <th className="p-2 border">Product Code</th>
            <th className="p-2 border">Date of Registration</th>
            <th className="p-2 border">Action</th>
            <th className="p-2 border">Claim Details</th>
          </tr>
        </thead>
        <tbody>
          {items.map((w) => (
            <tr key={w.id}>
              <td className="p-2 border">{w.id}</td>
              <td className="p-2 border">{w.name}</td>
              <td className="p-2 border">{w.email}</td>
              <td className="p-2 border">{w.phoneModel}</td>
              <td className="p-2 border">{w.mobile}</td>
              <td className="p-2 border">{w.productType}</td>
              <td className="p-2 border">{w.purchaseDate}</td>
              <td className="p-2 border">{w.expiryDate}</td>
              <td className="p-2 border">{w.productCode}</td>
              <td className="p-2 border">{w.createdAt}</td>
              <td className="p-2 border"><button className="px-2 py-1 border rounded" disabled={!withinExpiry(w)} onClick={() => onClaim(w.id)}>{w.status === 'Claimed' ? 'Claimed' : 'Claim'}</button></td>
              <td className="p-2 border">{w.claimedBy ? `${w.claimedBy}` : ''}</td>
              <td className="p-2 border">{w.claimedAt ? w.claimedAt : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      )}
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
