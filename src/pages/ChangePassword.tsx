import { useState } from 'react'

export default function ChangePassword() {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [message, setMessage] = useState('')
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    try {
      setMessage('Password is managed via Supabase Auth')
    } catch {
      setMessage('Unable to change password')
    }
  }
  return (
    <section className="container py-12">
      <div className="mx-auto max-w-sm">
      <h2 className="text-2xl font-semibold mb-6">Change Password</h2>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="old" className="block text-sm font-medium">Current Password</label>
          <div className="mt-2 relative">
            <input id="old" type={showOld ? 'text' : 'password'} className="w-full rounded-md border border-slate-300 px-3 py-2 pr-10" value={oldPassword} onChange={e => setOldPassword(e.target.value)} />
            <button type="button" aria-label={showOld ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 -translate-y-1/2 text-brand" onClick={() => setShowOld(s => !s)}>
              {showOld ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-10-8-10-8a21.77 21.77 0 0 1 5.06-6.06"/><path d="M1 1l22 22"/><path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 10 8 10 8a21.77 21.77 0 0 1-3.35 4.88"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s3-8 11-8 11 8 11 8-3 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              )}
            </button>
          </div>
        </div>
        <div>
          <label htmlFor="new" className="block text-sm font-medium">New Password</label>
          <div className="mt-2 relative">
            <input id="new" type={showNew ? 'text' : 'password'} className="w-full rounded-md border border-slate-300 px-3 py-2 pr-10" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            <button type="button" aria-label={showNew ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 -translate-y-1/2 text-brand" onClick={() => setShowNew(s => !s)}>
              {showNew ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-10-8-10-8a21.77 21.77 0 0 1 5.06-6.06"/><path d="M1 1l22 22"/><path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 10 8 10 8a21.77 21.77 0 0 1-3.35 4.88"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s3-8 11-8 11 8 11 8-3 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              )}
            </button>
          </div>
        </div>
        <button className="rounded-md bg-brand px-4 py-2 text-white" type="submit">Update</button>
        {message && <div className="text-sm mt-2">{message}</div>}
      </form>
      </div>
      <div className="mt-8">
        <a className="rounded-md border border-slate-300 px-4 py-2 inline-block" href="/admin/dashboard">Return</a>
      </div>
    </section>
  )
}
