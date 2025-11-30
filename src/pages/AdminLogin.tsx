'use client'

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, me } from '../lib/auth'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [show, setShow] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    ;(async () => {
      const info = await me()
      const session = info?.session
      if (session) navigate('/owner/dashboard')
    })()
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await login(email, password)
      const info = await me()
      if (info?.session) navigate('/owner/dashboard')
      else setMessage('Logged in')
    } catch (err: any) {
      setMessage(String(err?.message || 'Invalid credentials'))
    }
  }

  return (
    <div style={{ fontFamily: 'Montserrat, sans-serif', background: 'linear-gradient(135deg, #fffcfc 0%, #FFEBEE 100%)', color: '#4A0A0E', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600&display=swap');
        :root { --red-primary:#D32F2F; --red-deep:#8A151B; --red-darkest:#4A0A0E; --red-light:#FFEBEE; --red-border:#FFCDD2; --white:#FFFFFF; --shadow:0 20px 60px rgba(138,21,27,0.15); --radius-outer:24px; --radius-inner:12px; --transition:all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1); }
        .login-container { max-width:900px; width:100%; background:var(--white); border-radius:var(--radius-outer); box-shadow:var(--shadow); overflow:hidden; display:grid; grid-template-columns:40% 60%; }
        .info-panel { background:linear-gradient(160deg, var(--red-primary) 0%, var(--red-deep) 100%); padding:48px 36px; color:var(--white); }
        .info-panel h1 { font-size:2rem; line-height:1.2; margin-bottom:16px; }
        .info-panel p { font-size:0.95rem; line-height:1.8; opacity:0.9; }
        .form-panel { padding:48px; }
        .form-header { margin-bottom:24px; }
        .form-header h2 { color:var(--red-primary); font-size:1.8rem; }
        .form-group { margin-bottom:20px; }
        .form-label { display:block; font-size:0.75rem; text-transform:uppercase; letter-spacing:1px; color:var(--red-deep); margin-bottom:8px; font-weight:600; }
        .form-input { width:100%; padding:14px; border:1px solid var(--red-border); border-radius:var(--radius-inner); color:var(--red-darkest); background:var(--white); transition:var(--transition); }
        .form-input:focus { border-color:var(--red-primary); box-shadow:0 0 0 4px var(--red-light); }
        .input-with-toggle { position:relative; }
        .toggle-btn { position:absolute; right:12px; top:50%; transform:translateY(-50%); background:transparent; border:none; color:var(--red-primary); cursor:pointer; }
        .btn-submit { width:100%; padding:14px; background:var(--red-primary); color:#fff; border:none; border-radius:var(--radius-inner); font-size:0.95rem; font-weight:600; cursor:pointer; transition:var(--transition); }
        .btn-submit:hover { background:var(--red-deep); transform:translateY(-2px); }
        @media (max-width: 900px) { .login-container { grid-template-columns:1fr; } }
      `}</style>
      <div className="login-container">
        <div className="info-panel">
          <h1>Welcome back</h1>
          <p>Sign in to manage product codes and warranty registrations.</p>
        </div>
        <div className="form-panel">
          <div className="form-header"><h2>Login</h2></div>
          <form onSubmit={onSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email</label>
              <input id="email" type="email" className="form-input" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="form-group input-with-toggle">
              <label className="form-label" htmlFor="password">Password</label>
              <input id="password" type={show ? 'text' : 'password'} className="form-input" value={password} onChange={e => setPassword(e.target.value)} />
              <button type="button" className="toggle-btn" onClick={() => setShow(s => !s)}>
                {show ? 'Hide' : 'Show'}
              </button>
            </div>
            <button className="btn-submit" type="submit">Sign in</button>
            {message && <div style={{ marginTop: 10, fontSize: 14 }}>{message}</div>}
          </form>
        </div>
      </div>
    </div>
  )
}