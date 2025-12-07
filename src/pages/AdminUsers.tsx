'use client'

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPartner, setUserRole } from '../lib/api'
import { getRole } from '../lib/auth'


export default function AdminUsers() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [currentRole, setCurrentRole] = useState<string | null>(null)
  const [ownerEmail, setOwnerEmail] = useState('')
  const [ownerUsername, setOwnerUsername] = useState('')

  useEffect(() => {
    ;(async () => { setCurrentRole(await getRole()) })()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const role = ((await getRole()) || '').toLowerCase()

    if (!['owner', 'admin'].includes(role)) {
      setMessage({ text: 'Only owners can create partners', type: 'error' })
      setLoading(false)
      return
    }

    const r = await createPartner({ email, username, password })

    setLoading(false)

    if ((r as any)?.error) {
      setMessage({ text: String((r as any).error), type: 'error' })
    } else {
      setMessage({ text: 'Partner created successfully!', type: 'success' })
      setEmail('')
      setPassword('')
      setUsername('')
    }
  }

  const handlePromoteOwner = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    const r = await setUserRole({ email: ownerEmail, role: 'owner', username: ownerUsername || undefined })
    setLoading(false)
    if ((r as any)?.error) {
      setMessage({ text: String((r as any).error), type: 'error' })
    } else {
      setMessage({ text: 'Owner role set successfully', type: 'success' })
      setOwnerEmail(''); setOwnerUsername('')
    }
  }

  return (
    <section className="container py-12">
      <div className="mx-auto max-w-xl">
        <h2 className="text-2xl font-semibold mb-6">User Management</h2>
        
        <div className="mb-4 text-xs text-slate-500 font-mono">
          Your Role: {currentRole || 'loading...'}
        </div>

        <div className="rounded-md border border-slate-200 p-6 bg-white shadow-sm">
          <h3 className="text-lg font-medium mb-4">Create Partner Account</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
              <input 
                type="email" 
                required
                className="form-input w-full" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="partner@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password (6+ chars)</label>
              <input 
                type="text"
                required
                minLength={6}
                className="form-input w-full" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="12345678"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Username (for reference)</label>
              <input 
                type="text" 
                required
                className="form-input w-full" 
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Partner Name"
              />
            </div>
            
            {message && (
              <div className={`p-3 rounded text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {message.text}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-blue-600 text-white rounded-md py-2 hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Partner Account'}
            </button>
          </form>
        </div>

        <div className="rounded-md border border-slate-200 p-6 bg-white shadow-sm mt-8">
          <h3 className="text-lg font-medium mb-4">Set Owner Role</h3>
          <form onSubmit={handlePromoteOwner} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Owner Email</label>
              <input type="email" required className="form-input w-full" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} placeholder="owner@example.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Username (optional)</label>
              <input type="text" className="form-input w-full" value={ownerUsername} onChange={e => setOwnerUsername(e.target.value)} placeholder="Owner Username" />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white rounded-md py-2 hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Updating...' : 'Set Owner Role'}
            </button>
          </form>
        </div>

        <div className="mt-8">
          <button 
            className="rounded-md border border-slate-300 px-4 py-2 hover:bg-slate-50"
            onClick={() => navigate('/owner/dashboard')}
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    </section>
  )
}
