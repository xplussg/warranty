import { Route, Routes, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Header from './components/Header'
import Footer from './components/Footer'
import CheckWarranty from './pages/CheckWarranty'
import WarrantyRegister from './pages/WarrantyRegister'
import SupportLocation from './pages/SupportLocation'
import AdminCodes from './pages/AdminCodes'
import AdminLogin from './pages/AdminLogin'
import AdminUsers from './pages/AdminUsers'
import AdminWarranties from './pages/AdminWarranties'
import AdminDashboard from './pages/AdminDashboard'
import PartnerDashboard from './pages/PartnerDashboard'
import ChangePassword from './pages/ChangePassword'
// Removed policy pages in favor of inline drawers on WarrantyRegister
import { me, getRole } from './lib/auth'

function PrivateRoute({ children }: { children: JSX.Element }) {
  const [ready, setReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  useEffect(() => {
    ;(async () => {
      try {
        const info = await me();
        setSignedIn(Boolean(info?.session))
      } catch {
        setSignedIn(false)
      } finally {
        setReady(true)
      }
    })()
  }, [])
  if (!ready) return <div className="container py-12 text-center text-sm text-slate-600">Loading…</div>
  if (!signedIn) return <Navigate to="/login" replace />
  return children
}

function OwnerRoute({ children }: { children: JSX.Element }) {
  const [ready, setReady] = useState(false)
  const [role, setRole] = useState<string | null>(null)
  useEffect(() => {
    ;(async () => {
      try {
        setRole(await getRole())
      } catch {
        setRole(null)
      } finally {
        setReady(true)
      }
    })()
  }, [])
  if (!ready) return <div className="container py-12 text-center text-sm text-slate-600">Loading…</div>
  if (role === null) return <Navigate to="/login" replace />
  if (role !== 'owner') return <Navigate to="/partner/dashboard" replace />
  return children
}

function PartnerRoute({ children }: { children: JSX.Element }) {
  const [ready, setReady] = useState(false)
  const [role, setRole] = useState<string | null>(null)
  useEffect(() => {
    ;(async () => {
      try {
        setRole(await getRole())
      } catch {
        setRole(null)
      } finally {
        setReady(true)
      }
    })()
  }, [])
  if (!ready) return <div className="container py-12 text-center text-sm text-slate-600">Loading…</div>
  if (role === null) return <Navigate to="/login" replace />
  if (role !== 'partner') return <Navigate to="/owner/dashboard" replace />
  return children
}

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-white app-theme">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600&display=swap" />
      <style>{`
        :root { --red-primary:#D32F2F; --red-deep:#8A151B; --red-darkest:#4A0A0E; --red-light:#FFEBEE; --white:#FFFFFF; }
        .app-theme { font-family: 'Montserrat', sans-serif; color: var(--red-darkest); }
        .app-theme .text-slate-900, .app-theme .text-slate-700, .app-theme .text-slate-600 { color: var(--red-darkest) !important; }
        .app-theme a { color: #6B6B6B; }
        .app-theme a:hover { color: var(--red-primary); }
        .page-title { font-family:'Montserrat', sans-serif; color: var(--red-primary); font-size:1.8rem; font-weight:400; }
        .section-title { font-family:'Montserrat', sans-serif; color: var(--red-primary); font-size:1.4rem; font-weight:400; }
        .section-body { font-family:'Montserrat', sans-serif; font-size:0.95rem; line-height:1.8; color:#6B6B6B; }
        .app-theme input[type="text"],
        .app-theme input[type="email"],
        .app-theme input[type="tel"],
        .app-theme input[type="date"],
        .app-theme select,
        .app-theme textarea {
          width: 100%;
          padding: 14px;
          border: 1px solid #FFCDD2;
          border-radius: 12px;
          font-family: 'Montserrat', sans-serif;
          color: var(--red-darkest);
          background: #FFFFFF;
          outline: none;
        }
        .app-theme input[type="text"]:focus,
        .app-theme input[type="email"]:focus,
        .app-theme input[type="tel"]:focus,
        .app-theme input[type="date"]:focus,
        .app-theme select:focus,
        .app-theme textarea:focus {
          border-color: var(--red-primary);
          box-shadow: 0 0 0 4px var(--red-light);
        }
        .app-theme button:not(.btn-submit):not(.toggle-btn) {
          background: #FFFFFF;
          color: var(--red-darkest);
          border: 1px solid #FFCDD2;
          border-radius: 8px;
          padding: 8px 12px;
          box-shadow: none;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .app-theme button:hover:not(.btn-submit):not(.toggle-btn) { background: var(--red-light); border-color: var(--red-primary); }
      `}</style>
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<WarrantyRegister />} />
          <Route path="/check-warranty" element={<CheckWarranty />} />
          <Route path="/warranty-register" element={<WarrantyRegister />} />
          <Route path="/support-location" element={<SupportLocation />} />
          {/* Policy pages removed; see drawers in WarrantyRegister */}
          <Route path="/owner/codes" element={<PrivateRoute><OwnerRoute><AdminCodes /></OwnerRoute></PrivateRoute>} />
          <Route path="/login" element={<AdminLogin />} />
          <Route path="/owner/users" element={<PrivateRoute><OwnerRoute><AdminUsers /></OwnerRoute></PrivateRoute>} />
          <Route path="/owner/warranties" element={<PrivateRoute><OwnerRoute><AdminWarranties /></OwnerRoute></PrivateRoute>} />
          <Route path="/partner/warranties" element={<PrivateRoute><PartnerRoute><AdminWarranties /></PartnerRoute></PrivateRoute>} />
          <Route path="/owner/dashboard" element={<PrivateRoute><OwnerRoute><AdminDashboard /></OwnerRoute></PrivateRoute>} />
          <Route path="/partner/dashboard" element={<PrivateRoute><PartnerRoute><PartnerDashboard /></PartnerRoute></PrivateRoute>} />
          <Route path="/change-password" element={<PrivateRoute><OwnerRoute><ChangePassword /></OwnerRoute></PrivateRoute>} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}
