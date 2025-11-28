import { useEffect, useState } from 'react'
import { searchWarranties, deleteWarranty, claimWarranty, unclaimWarranty, uploadWarranties } from '../lib/api'
import { getRole } from '../lib/auth'

export default function AdminWarranties() {
  const [q, setQ] = useState('')
  const [role, setRole] = useState<string|null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [items, setItems] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [message, setMessage] = useState('')

  useEffect(() => { getRole().then(setRole) }, [])

  async function onUpload(e: any) {
    const file = e.target.files?.[0]
    if (!file) return
    setMessage('Uploading...')
    const res: any = await uploadWarranties(file)
    if (res?.error) setMessage(res.error)
    else { setMessage(`Uploaded ${res.count} rows`); await refresh() }
  }
  

  async function refresh() {
    const j: any = await searchWarranties(q, page, pageSize)
    if (j && j.error) { setItems([]); setTotal(0); return }
    setItems(j.items || [])
    setTotal(j.total || 0)
  }

  useEffect(() => { refresh() }, [q, page, pageSize])
  

  async function onDelete(id: number) {
    if (!confirm('Are you sure you want to delete this warranty?')) return
    const j: any = await deleteWarranty(id)
    if (j?.error) { setMessage(String(j.error)); return }
    await refresh()
  }
  async function onClaim(id: number) {
    const j: any = await claimWarranty(id)
    if (j?.error) { setMessage(String(j.error)); return }
    await refresh()
  }
  async function onUnclaim(id: number) {
    const j: any = await unclaimWarranty(id)
    if (j?.error) { setMessage(String(j.error)); return }
    await refresh()
  }
  async function onToggleClaim(w: any) {
    setMessage('')
    if (isClaimed(w)) await onUnclaim(w.id)
    else await onClaim(w.id)
  }
  
  // Toggle visibility handled by server authorization; always show toggle in UI

  function fmtDateOnly(v: any) {
    const t = String(v || '').trim()
    if (!t) return ''
    const m = t.match(/^(\d{4}-\d{2}-\d{2})/)
    if (m) return m[1]
    return t
  }

  function fmtDateTimeLocal(v: any) {
    const t = String(v || '').trim()
    if (!t) return ''
    const d = new Date(t)
    if (isNaN(d.getTime())) return t
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Singapore',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).formatToParts(d)
    function part(type: string) { return parts.find(p => p.type === type)?.value || '' }
    return `${part('year')}-${part('month')}-${part('day')}, ${part('hour')}:${part('minute')}:${part('second')}`
  }
  // fmtDateTimeLocal used instead
  function show(v: any) {
    const t = String(v || '').trim()
    return t ? t : '—'
  }

  return (
    <section className="container py-12">
      <h2 className="page-title mb-6">Warranty Registrations</h2>
      
      <div className="flex items-center gap-3 mb-3 justify-between">
        <input className="rounded-md border border-slate-300 px-3 py-2" placeholder="Search" value={q} onChange={e => setQ(e.target.value)} />
        {role !== 'partner' && (
          <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-md border border-slate-300 text-sm">
            Upload CSV
            <input type="file" className="hidden" accept=".csv" onChange={onUpload} />
          </label>
        )}
      </div>
      
      
      {total === 0 && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          {role === 'partner' && !q ? 'Enter a search term to view warranties.' : 'No records returned. If you have just uploaded warranties: 1) click Refresh; 2) Clear search so product code filter is empty; 3) Hard reload the page.'}
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
          {(() => {
            const term = q.trim().toLowerCase()
            function rowText(w: any) {
              return [w.id, w.name, w.email, w.mobile, w.phoneModel, w.country, w.productType, w.productCode, w.createdAt, w.purchaseDate, w.expiryDate, w.status, w.claimedBy]
                .map(v => String(v || '')).join(' ').toLowerCase()
            }
            const visible = term ? items.filter(w => rowText(w).includes(term)) : items
            return visible.map((w) => (
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
                  <div className={`text-xs ${isActive(w) ? 'text-emerald-700' : 'text-red-700'}`}>{fmtDateOnly(w.expiryDate)}</div>
                </div>
              </td>
              <td className="p-2 border" style={{ fontFamily: 'Roboto Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}>{show(w.productCode)}</td>
              <td className="p-2 border" style={{ fontFamily: 'Roboto Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}>{fmtDateTimeLocal(w.createdAt)}</td>
              <td className="p-2 border">
                <div className="flex items-center gap-3">
                  {(!isClaimed(w) || role !== 'partner') && (
                    <span
                      aria-label={isClaimed(w) ? 'Unclaim' : 'Claim'}
                      title={isClaimed(w) ? 'Unclaim' : 'Claim'}
                      onClick={() => onToggleClaim(w)}
                      className="hover:text-emerald-700 cursor-pointer"
                      >
                      {isClaimed(w) ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9"/><polyline points="21 3 21 12 12"/></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                      )}
                    </span>
                  )}
                  {role !== 'partner' && (
                    <span
                      aria-label="Delete"
                      title="Delete"
                      onClick={() => onDelete(w.id)}
                      className="hover:text-red-700 cursor-pointer"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
                    </span>
                  )}
                </div>
              </td>
              <td className="p-2 border" style={{ fontFamily: 'Roboto Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}>
                <div className="leading-tight">
                  <div className="text-xs">{show(w.claimedBy) || '—'}</div>
                  <div className="text-xs">{fmtDateTimeLocal(w.claimedAt) || '—'}</div>
                </div>
              </td>
            </tr>
            ))
          })()}
        </tbody>
      </table>
      <div className="mt-3 flex items-center justify-between">
        {(() => {
          const totalPages = Math.max(1, Math.ceil(total / pageSize))
          const nextPages: number[] = []
          for (let i = page + 1; i <= Math.min(totalPages, page + 4); i++) nextPages.push(i)
          const [jump, setJump] = useState(String(page))
          useEffect(() => { setJump(String(page)) }, [page])
          const onEnter = (e: any) => {
            if (e.key === 'Enter') {
              const n = Number(String(jump).trim())
              if (Number.isFinite(n) && n >= 1 && n <= totalPages) setPage(n)
            }
          }
          return (
            <div className="flex items-center gap-2">
              <button className="h-9 px-3 rounded-md border border-slate-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed" disabled={page<=1} onClick={() => setPage(1)}>First</button>
              <button className="h-9 px-3 rounded-md border border-slate-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed" disabled={page<=1} onClick={() => setPage(p => Math.max(1, p-1))}>Prev</button>
              <span className="text-sm">Page</span>
              <input className="h-9 w-16 rounded-md border border-slate-300 px-2 text-sm text-center" value={jump} onChange={e => setJump(e.target.value)} onKeyDown={onEnter} />
              {nextPages.map(n => (
                <button key={n} className="h-9 px-3 rounded-md border border-slate-300 text-sm" onClick={() => setPage(n)}>{n}</button>
              ))}
              <button className="h-9 px-3 rounded-md border border-slate-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed" disabled={page>=totalPages} onClick={() => setPage(p => Math.min(totalPages, p+1))}>Next</button>
              <button className="h-9 px-3 rounded-md border border-slate-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed" disabled={page>=totalPages} onClick={() => setPage(totalPages)}>Last</button>
              <select className="h-10 w-32 rounded-md border border-slate-300 px-3 pr-8 text-base leading-6" value={pageSize} onChange={e => { setPage(1); setPageSize(Number(e.target.value)) }}>
                <option value={20}>20 rows</option>
                <option value={50}>50 rows</option>
                <option value={100}>100 rows</option>
                <option value={200}>200 rows</option>
              </select>
            </div>
          )
        })()}
        {(() => {
          const start = (page - 1) * pageSize + 1
          const end = Math.min(total, start + items.length - 1)
          return <span className="text-sm text-slate-600">Showing {total === 0 ? 0 : start}-{end} of {total.toLocaleString()}</span>
        })()}
      </div>
      <div className="mt-8">
        <a className="rounded-md border border-slate-300 px-4 py-2 inline-block" href="/owner/dashboard">Return</a>
      </div>
      
      {message && <div className="mt-3 text-sm text-red-700">{message}</div>}
    </section>
  )
}
  function parseYmd(s: string) {
    const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
  }
  function computeExpiry(w: any) {
    const e = parseYmd(w.expiryDate)
    if (e) return e
    const p = parseYmd(w.purchaseDate)
    if (!p) return null
    const d = new Date(p)
    d.setDate(d.getDate() + 180)
    return d
  }
  function isActive(w: any) {
    const e = computeExpiry(w)
    if (!e) return false
    const now = new Date()
    const n = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const ed = new Date(e.getFullYear(), e.getMonth(), e.getDate())
    return n <= ed
  }
  function isClaimed(w: any) {
    return String(w.status || '').trim().toLowerCase() === 'claimed'
  }
