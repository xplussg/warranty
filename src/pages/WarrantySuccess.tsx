import { useLocation, Link } from 'react-router-dom'

export default function WarrantySuccess() {
  const location = useLocation() as any
  const email = String(location?.state?.email || '').trim()
  const emailSent = Boolean(location?.state?.emailSent)
  const details = (location?.state?.details || {}) as any
  function fmt(v: any) { return String(v ?? '').trim() }
  function onPrint() { try { window.print() } catch {} }
  return (
    <div style={{ fontFamily: 'Montserrat, sans-serif', background: 'linear-gradient(135deg, #fffcfc 0%, #FFEBEE 100%)', color: '#4A0A0E', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600&display=swap" />
      <style>{`@media print { a,button { display:none !important } body { background:#fff } }`}</style>
      <div style={{ maxWidth: 820, width: '100%', background: '#FFFFFF', borderRadius: 16, boxShadow: '0 20px 60px rgba(138,21,27,0.15)', border: '1px solid #FFCDD2', padding: 28 }}>
        <h1 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.8rem', color: '#D32F2F', marginBottom: 10 }}>Warranty Registration Successful</h1>
        <p style={{ fontSize: '0.95rem', lineHeight: 1.8, color: '#6B6B6B' }}>Your XPLUS warranty has been activated. {emailSent && email ? `A confirmation email was sent to ${email}.` : 'Keep this page for your records.'}</p>
        <div style={{ marginTop: 16, border: '1px solid #FFCDD2', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ background:'#D32F2F', color:'#fff', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <strong>Registration Details</strong>
            <img src="/xplus.png" alt="XPLUS" style={{ height: 24 }} />
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <tbody>
              {[
                ['Name', fmt(details.name)],
                ['Email', fmt(details.email)],
                ['Mobile', fmt(details.mobile)],
                ['Phone Model', fmt(details.phoneModel)],
                ['Country', fmt(details.country)],
                ['Product Type', fmt(details.productType)],
                ['Purchase Date', fmt(details.purchaseDate)],
                ['Expiry Date', fmt(details.expiryDate)],
                ['Product Code', fmt(details.productCode)]
              ].filter(([_, v]) => v.length).map(([k,v]) => (
                <tr key={String(k)}>
                  <td style={{ width:'30%', padding:12, borderTop:'1px solid #FFCDD2', background:'#FFEBEE', fontWeight:600, color:'#4A0A0E' }}>{k as string}</td>
                  <td style={{ padding:12, borderTop:'1px solid #FFCDD2' }}>{v as string}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 16, padding:12, border:'1px solid #FFCDD2', borderRadius: 10, background:'#FFF7F7', color:'#4A0A0E' }}>
          <div style={{ fontWeight:600, marginBottom:6 }}>X-Plus Promise</div>
          <div style={{ fontSize:14 }}>100% Genuine • Exceptional Client Care • 180-Day 1-to-1 Exchange</div>
        </div>
        <div style={{ display:'flex', gap:12, marginTop: 22 }}>
          <button onClick={onPrint} style={{ padding:'12px 18px', background:'#FFF8E1', color:'#7A5D00', border:'1px solid #E0C166', borderRadius:10, letterSpacing:1, textTransform:'uppercase', fontSize:'0.85rem' }}>Save as PDF</button>
          <Link to="/" style={{ display: 'inline-block', padding: '12px 18px', background: '#D32F2F', color: '#FFFFFF', borderRadius: 10, textDecoration: 'none', letterSpacing: 1, textTransform: 'uppercase', fontSize: '0.85rem' }}>Back to Warranty Register</Link>
        </div>
      </div>
    </div>
  )
}
