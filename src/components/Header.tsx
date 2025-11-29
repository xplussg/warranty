import { Link, NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { logout, me, getRole } from '../lib/auth'
import { supabase } from '../lib/supabase'

const nav = [
  { to: '/warranty-register', label: 'Warranty Registration' },
  { to: '/check-warranty', label: 'Check Warranty' },
  { to: '/support-location', label: 'Support Location' }
]

export default function Header() {
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => { const u = await me(); setUser(u?.session?.user || null); setRole(await getRole()) })()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user || null)
      setRole(await getRole())
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <header className="border-b border-slate-100 bg-white/80 backdrop-blur relative z-[1100]">
      <div className="container flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-3">
          <img src="/xplus.png" alt="XPLUS" className="h-12 w-auto" />
        </Link>
        <button aria-label="Toggle Menu" className="md:hidden p-2" onClick={() => setOpen(v => !v)}>
          <span className="i">☰</span>
        </button>
        <nav className={clsx('md:flex md:items-center md:gap-6 md:static md:w-auto md:bg-transparent md:p-0 md:border-0 md:shadow-none', open ? 'fixed top-16 left-0 right-0 flex flex-col gap-4 bg-white p-4 border-b border-slate-100 shadow-lg z-[1000]' : 'hidden')}>
          {nav.map(i => (
            <NavLink key={i.to} to={i.to} onClick={() => setOpen(false)} className={({ isActive }) => clsx('py-2 text-sm', isActive ? 'text-[#D32F2F]' : 'text-[#6B6B6B] hover:text-[#D32F2F]')}>
              {i.label}
            </NavLink>
          ))}
          {user ? (
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <NavLink to={role === 'partner' ? '/partner/dashboard' : '/owner/dashboard'} onClick={() => setOpen(false)} className={({ isActive }) => clsx('py-2 text-sm', isActive ? 'text-[#D32F2F]' : 'text-[#6B6B6B] hover:text-[#D32F2F]')}>Dashboard</NavLink>
              <span className="text-sm text-[#6B6B6B] py-2 md:py-0">{String(user.email)}</span>
              <button className="text-sm text-[#6B6B6B] hover:text-[#D32F2F] text-left md:text-center py-2 md:py-0" onClick={async () => { try { setOpen(false); await logout(); window.location.replace('/login') } catch { window.location.replace('/login') } }}>Logout</button>
            </div>
          ) : (
            <NavLink to="/login" onClick={() => setOpen(false)} className={({ isActive }) => clsx('py-2 text-sm', isActive ? 'text-[#D32F2F]' : 'text-[#6B6B6B] hover:text-[#D32F2F]')}>Login</NavLink>
          )}
        </nav>
      </div>
    </header>
  )
}
