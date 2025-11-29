import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listCodes, deleteCode } from '../lib/api'
import { getRole } from '../lib/auth'

export default function AdminCodes() {
  
  const [q, setQ] = useState('')
  const [role, setRole] = useState<string|null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [items, setItems] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [message] = useState('')

  useEffect(() => { getRole().then(setRole) }, [])

  // upload hidden

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
  async function refresh() {
    const data: any = await listCodes(q, page, pageSize)
    setItems((data && data.items) || [])
    setTotal((data && data.total) || 0)
  }
  useEffect(() => { refresh() }, [q, page, pageSize])
  async function onDelete(id: number) { await deleteCode(id); await refresh() }
  return (
    <section className="container py-12">
      <div className="mx-auto">
      <h2 className="page-title mb-6">Product Codes</h2>
      
      <div className="mt-8">
        <div className="flex items-center gap-3 mb-3 justify-between">
          <input className="rounded-md border border-slate-300 px-3 py-2" placeholder="Search" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <table className="w-full text-sm border border-slate-200">
          <thead>
            <tr className="bg-slate-50">
              <th className="p-2 border sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-700">ID</th>
              <th className="p-2 border sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-700">Product Code</th>
              <th className="p-2 border sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-700">Added On</th>
              <th className="p-2 border sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-700">Action</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const term = q.trim().toLowerCase()
              function rowText(it: any) { return [it.code, fmtDateTimeLocal(it.createdAt)].map(v => String(v || '')).join(' ').toLowerCase() }
              const visible = term ? items.filter(it => rowText(it).includes(term)) : items
              return visible.map((it) => (
              <tr key={it.id}>
                <td className="p-2 border">{it.id}</td>
                <td className="p-2 border" style={{ fontFamily: 'Roboto Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}>{it.code}</td>
                <td className="p-2 border" style={{ fontFamily: 'Roboto Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}>{fmtDateTimeLocal(it.createdAt)}</td>
                <td className="p-2 border">
                  {role !== 'partner' && (
                    <span aria-label="Delete" title="Delete" onClick={() => onDelete(it.id)} className="hover:text-red-700 cursor-pointer">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
                    </span>
                  )}
                </td>
              </tr>
              ))
            })()}
          </tbody>
        </table>
        {message && <div className="mt-3 text-sm text-red-700">{message}</div>}
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
      </div>
      <div className="mt-8">
        {role === 'partner' ? (
          <Link className="rounded-md border border-slate-300 px-4 py-2 inline-block" to="/partner/dashboard">Return</Link>
        ) : (
          <Link className="rounded-md border border-slate-300 px-4 py-2 inline-block" to="/owner/dashboard">Return</Link>
        )}
      </div>
      </div>
    </section>
  )
}
