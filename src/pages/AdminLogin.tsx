import { useEffect, useState } from 'react'
import { login, me } from '../lib/auth'
import { useNavigate } from 'react-router-dom'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [show, setShow] = useState(false)
  useEffect(() => {
    ;(async () => {
      const info = await me()
      const session = info?.session
      if (session) navigate('/owner/dashboard')
    })()
  }, [])
  const navigate = useNavigate()
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await login(email, password)
      const info = await me()
      if (info?.session) navigate('/owner/dashboard')
      else setMessage('Logged in')
    } catch (err: any) { setMessage(String(err?.message || 'Invalid credentials')) }
  }
  return (
    <section className="container py-12">
      <div className="mx-auto max-w-sm">
      <h2 className="text-2xl font-semibold mb-6">Login</h2>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium">Email</label>
          <input id="email" type="email" className="mt-2 w-full h-12 rounded-md px-3" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium">Password</label>
          <div className="mt-2 relative">
            <input id="password" type={show ? 'text' : 'password'} className="w-full h-12 rounded-md px-3 pr-10" value={password} onChange={e => setPassword(e.target.value)} />
            <button type="button" aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 -translate-y-1/2 text-brand" onClick={() => setShow(s => !s)}>
              {show ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4c-7 0-11 8-11 8s4 8 11 8 11-8 11-8-4-8-11-8zm0 13a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4c-7 0-11 8-11 8s4 8 11 8 11-8 11-8-4-8-11-8zm0 13a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"/></svg>
              )}
            </button>
          </div>
        </div>
        <button className="rounded-md bg-brand px-4 py-2 text-white" type="submit">Login</button>
        {message && <div className="text-sm mt-2">{message}</div>}
      </form>
      </div>
    </section>
  )
}
