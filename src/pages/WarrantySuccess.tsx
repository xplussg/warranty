import { useLocation, Link } from 'react-router-dom'

export default function WarrantySuccess() {
  const location = useLocation() as any
  const email = String(location?.state?.email || '').trim()
  const emailSent = Boolean(location?.state?.emailSent)
  return (
    <div style={{ fontFamily: 'Montserrat, sans-serif', background: 'linear-gradient(135deg, #fffcfc 0%, #FFEBEE 100%)', color: '#4A0A0E', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600&display=swap" />
      <div style={{ maxWidth: 720, width: '100%', background: '#FFFFFF', borderRadius: 16, boxShadow: '0 20px 60px rgba(138,21,27,0.15)', border: '1px solid #FFCDD2', padding: 28, textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.8rem', color: '#D32F2F', marginBottom: 10 }}>Warranty Registration Successful</h1>
        <p style={{ fontSize: '0.95rem', lineHeight: 1.8, color: '#6B6B6B' }}>Your XPLUS warranty has been activated.</p>
        <p style={{ fontSize: '0.9rem', marginTop: 10, color: '#6B6B6B' }}>{emailSent && email ? `A confirmation email was sent to ${email}.` : `Keep this page for your records.`}</p>
        <div style={{ marginTop: 22 }}>
          <Link to="/" style={{ display: 'inline-block', padding: '12px 18px', background: '#D32F2F', color: '#FFFFFF', borderRadius: 10, textDecoration: 'none', letterSpacing: 1, textTransform: 'uppercase', fontSize: '0.85rem' }}>Back to Warranty Register</Link>
        </div>
      </div>
    </div>
  )
}
