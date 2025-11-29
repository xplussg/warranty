'use client

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useNavigate } from 'react-router-dom'

export default function AdminLogin() {
  const [identifier, setIdentifier] = useState('') // ← username OR email
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const navigate = useNavigate()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    let emailToUse = identifier.trim().toLowerCase()

    // If it doesn't look like an email → try to resolve username
    if (!emailToUse.includes('@')) {
      const { data, error } = await supabase
        .from('auth.users')
        .select('email')
        .eq('user_metadata->>username', identifier.trim())
        .single()

      if (!data) {
        setMessage('Username not found')
        setLoading(false)
        return
      }
      emailToUse = data.email
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: emailToUse,
      password,
    })

    if (error) {
      setMessage('Invalid credentials')
    } else {
      navigate('/owner/dashboard')
    }
    setLoading(false)
  }

  return (
    <div style={{ fontFamily: 'Montserrat, sans-serif', background: 'linear-gradient(135deg, #fffcfc 0%, #FFEBEE 100%)', color: '#4A0A0E', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600&display=swap');
        :root { --red-primary:#D32F2F; --red-deep:#8A151B; --red-darkest:#4A0A0E; --red-light:#FFEBEE; --red-border:#FFCDD2; --white:#FFFFFF; --shadow:0 20px 60px rgba(138,21,27,0.15); --radius-outer:24px; --radius-inner:12px; --transition:all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1); }
        .login-container { max-width:900px; width:100%; background:var(--white); border-radius:var(--radius-outer); box-shadow:var(--shadow); overflow:hidden; display:grid; grid-template-columns:40% 60%; }
        .info-panel { background:linear-gradient(160deg, var(--red-primary) 0%, var(--red-deep) 100%); padding:48px 36px; color:var(--white); position:relative; display:flex; flex-direction:column; justify-content:center; }
        .info-panel h1 { font-size:2rem; line-height:1.2; margin-bottom:16px; }
        .info-panel p { font-size:0.95rem; line-height:1.8; opacity:0.9; }
        .form-panel { padding:48px; }
        .form-header { margin-bottom:24px; }
        .form-header h2 { color:var(--red-primary); font-size:1.8rem; }
        .form-group { margin-bottom:20px; }
        .form-label { display:block; font-size:0.75rem; text-transform:uppercase; letter-spacing:1px; color:var(--red-deep); margin-bottom:8px; font-weight:600; }
        .form-input { width:100%; padding:14px; border:1px solid var(--red-border); border-radius:var(--radius-inner); color:var(--red-darkest); background:var(--white); transition:var(--transition); outline:none; font-size:0.95rem; }
        .form-input:focus { border-color:var(--red-primary); box-shadow:0 0 0 4px var(--red-light); transform:translateY(-2px); }
        .input-with-toggle { position:relative; }
        .toggle-btn { position:absolute; right:12px; top:50%; transform:translateY(-50%); background:transparent; border:none; outline:none; padding:0; color:var(--red-primary); cursor:pointer; }
        .btn-submit { width:100%; padding:14px; background:var(--red-primary); color:#fff; border:none; border-radius:var(--radius-inner); font-size:0.95rem; font-weight:600; cursor:pointer; transition:var(--transition); }
        .btn-submit:hover { background:var(--red-deep); transform:translateY(-2px); }
        @media (max-width: 900px) { .login-container { grid-template-columns:1fr; border-radius:0; } .form-panel { padding:32px 20px; } .info-panel { padding:32px 20px; } }
      `}</style>
      <div className="login-container">
        <div className="info-panel">
          <h1>Welcome back</h1>
          <p>Sign in with your <strong>username</strong> or email address.</p>
        </div>
        <div className="form-panel">
          <div className="form-header"><h2>Login</h2></div>
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label" htmlFor="identifier">Username or Email</label>
              <input 
                id="identifier"
                type="text" 
                required
                className="form-input" 
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                placeholder="rabbit or xplus@rabbit.com.sg"
              />
            </div>
            <div className="form-group input-with-toggle">
              <label className="form-label" htmlFor="password">Password</label>
              <input 
                id="password" 
                type={showPassword ? 'text' : 'password'} 
                className="form-input" 
                value={password} 
                onChange={e => setPassword(e.target.value)}
                required
              />
              <button 
                type="button" 
                className="toggle-btn" 
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <button className="btn-submit" type="submit" disabled={loading}>
              {loading ? 'Logging in...' : 'Sign in'}
            </button>
            {message && <div style={{ marginTop: 10, color: message.includes('success') ? 'green' : 'red' }}>{message}</div>}
          </form>
        </div>
      </div>
    </div>
  )
}