import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPartner } from '../lib/api'
import { getRole } from '../lib/auth'

export default function AdminUsers() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null)
  const [createdUser, setCreatedUser] = useState<{ email: string, password: string } | null>(null)
  const [currentRole, setCurrentRole] = useState<string | null>(null)

  useEffect(() => {
    getRole().then(setCurrentRole)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    setCreatedUser(null)

    const res = await createPartner({ email, username })
    setLoading(false)

    if (res.error) {
      setMessage({ text: res.error, type: 'error' })
    } else {
      setMessage({ text: 'Partner account created successfully!', type: 'success' })
      setCreatedUser({ email: res.user.email, password: res.password })
      setEmail('')
      setUsername('')
    }
  }

  return (
    <section className="container py-12">
      <div className="mx-auto max-w-xl">
        <h2 className="text-2xl font-semibold mb-6">User Management</h2>
        
        {/* Debug Info */}
        <div className="mb-4 text-xs text-slate-500 font-mono">
          Your Role: {currentRole || 'loading...'}
        </div>

        <div className="rounded-md border border-slate-200 p-6 bg-white shadow-sm mb-8">
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

            {createdUser && (
              <div className="p-4 rounded bg-green-50 border border-green-200">
                <p className="font-medium text-green-800 mb-2">Account Created Details:</p>
                <div className="text-sm text-green-700 space-y-1">
                  <p><strong>Email:</strong> {createdUser.email}</p>
                  <p><strong>Password:</strong> <span className="font-mono bg-white px-1 rounded border border-green-200 select-all">{createdUser.password}</span></p>
                  <p className="text-xs mt-2 text-green-600">Please copy and send these credentials to the partner securely.</p>
                </div>
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-blue-600 text-white rounded-md py-2 hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Creating...' : 'Create Partner Account'}
            </button>
          </form>
        </div>

        <div className="rounded-md border border-slate-200 p-4 bg-slate-50">
          <p className="text-sm text-slate-700"><strong>Note:</strong> The legacy 'users' table in Supabase is redundant if you are using Supabase Authentication. User data is now stored in the `auth.users` table managed by Supabase.</p>
        </div>

        <div className="mt-8">
          <button className="rounded-md border border-slate-300 px-4 py-2 hover:bg-slate-50 transition-colors" onClick={() => navigate('/owner/dashboard')}>Return to Dashboard</button>
        </div>
      </div>
    </section>
  )
}
