import { useState } from 'react'
import { searchWarrantiesByEmail } from '../lib/api'

export default function CheckWarranty() {
  const [email, setEmail] = useState('')
  const [items, setItems] = useState<any[]>([])
  const [message, setMessage] = useState('')
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
      <h2 className="text-2xl font-semibold mb-6">Check Warranty by Email</h2>
      <form onSubmit={onSubmit} className="space-y-4 max-w-xl">
        <div>
          <label htmlFor="email_user" className="block text-sm font-medium">Email</label>
          <input id="email_user" className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter email" />
        </div>
        <button className="rounded-md bg-brand px-4 py-2 text-white" type="submit">Search</button>
        {message && <div className="text-sm mt-2 text-red-600">{message}</div>}
      </form>

      {items.length > 0 && (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full text-sm border border-slate-200">
            <thead>
              <tr className="bg-slate-50">
                <th className="p-2 border">Phone Model</th>
                <th className="p-2 border">Product Type</th>
                <th className="p-2 border">Product Code</th>
                <th className="p-2 border">Purchase Date</th>
                <th className="p-2 border">Expiry Date</th>
                <th className="p-2 border">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((w) => (
                <tr key={w.id}>
                  <td className="p-2 border">{w.phoneModel}</td>
                  <td className="p-2 border">{w.productType}</td>
                  <td className="p-2 border">{w.productCode}</td>
                  <td className="p-2 border">{w.purchaseDate}</td>
                  <td className="p-2 border">{w.expiryDate}</td>
                  <td className="p-2 border">{w.status || 'Not claimed'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
