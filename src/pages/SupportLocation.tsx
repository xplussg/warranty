import { useMemo, useState } from 'react'

type LocationItem = { name: string; address: string; hours?: string; phone?: string; note?: string }
type Area = { name: string; items: LocationItem[] }

const areas: Area[] = [
  {
    name: 'West Area',
    items: [
      { name: 'Lite Mobile', address: 'Blk 135 Jurong Getway Road, 01-329, (Opp Jurong East MRT) Singapore 600135' },
      { name: 'Dee Mobile', address: 'Blk 372 Bukit Batok St 331 01-360 Singapore 650372 (Opp Gombak MRT)', hours: 'Daily 10:30am – 5:00pm' }
    ]
  },
  {
    name: 'East Area',
    items: [
      { name: 'Symbian', address: 'Block 87 #01-501A Marine Parade Central Singapore 440087', hours: 'Mon – Sun: 10:00am – 9:30pm (Including PH)' },
      { name: 'Explore Mobile', address: '210 New Upper Changi Road #01-731 Singapore 460210 (Bedok Central)', hours: 'Daily 10:00am – 9:00pm' }
    ]
  },
  {
    name: 'North & Central Area',
    items: [
      { name: 'Mobile Bash', address: '810 Geylang Road, City Plaza #01-07/#01-12/#01-25, Singapore 409286', hours: 'Mon – Sat: 11:00am – 8:00pm · Sun: 9:30am – 7:00pm · PH timings may vary' },
      { name: 'Mobile Fashion', address: '9 Bishan Place, Junction 8 Shopping Centre Level 2, Singapore 579837 (Near OCBC Bank)', hours: 'Mon – Sun: 11:30am – 9:30pm' },
      { name: 'One2Free Mobile (24 Hours)', address: '382 Geylang Road Singapore 389384' },
      { name: '66 Connexions Mobile', address: '190 Toa Payoh Central #01-558 Singapore 310190' },
      { name: 'Mc Concept', address: '25 Bendemeer Road #01-603 Singapore 330025', phone: '9125 8688' },
      { name: '99 Connection', address: '184 Toa Payoh Central #01-350 Singapore 310184' }
    ]
  },
  {
    name: 'Northeast',
    items: [
      { name: 'Save&Save Pte Ltd', address: 'Serangoon Bus Interchange, 20 Serangoon Ave 2 Booth B, Singapore 556138' },
      { name: 'Benoi Accessories', address: '23 Serangoon Central, NEX Shopping Mall Level 4 #K19/20, Singapore 556083', hours: 'Mon – Sun: 11:00am – 9:00pm', phone: '9838 9377' }
    ]
  }
]

export default function SupportLocation() {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(areas.map(a => [a.name, a.name === 'West Area'])))

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return areas
    return areas
      .map(a => ({
        name: a.name,
        items: a.items.filter(i => [i.name, i.address, i.hours, i.phone].filter(Boolean).join(' ').toLowerCase().includes(term))
      }))
      .filter(a => a.items.length > 0)
  }, [q])

  return (
    <div style={{ fontFamily: 'Montserrat, sans-serif', background: 'linear-gradient(135deg, #fffcfc 0%, #FFEBEE 100%)', color: '#4A0A0E', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600&display=swap');
        :root { --red-primary:#D32F2F; --red-deep:#8A151B; --red-darkest:#4A0A0E; --red-light:#FFEBEE; --red-border:#FFCDD2; --white:#FFFFFF; --shadow:0 20px 60px rgba(138,21,27,0.15); --radius-outer:24px; --radius-inner:12px; --transition:all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1); }
        .support-container { max-width:1100px; width:100%; background:var(--white); border-radius:var(--radius-outer); box-shadow:var(--shadow); overflow:hidden; display:grid; grid-template-columns:35% 65%; border:1px solid rgba(255,255,255,0.5); }
        .info-panel { background:linear-gradient(160deg, var(--red-primary) 0%, var(--red-deep) 100%); padding:60px 40px; color:var(--white); position:relative; display:flex; flex-direction:column; justify-content:center; overflow:hidden; }
        .decor-circle { position:absolute; border-radius:50%; background:rgba(255,255,255,0.06); z-index:1; pointer-events:none; }
        .c1 { width:300px; height:300px; top:-100px; left:-100px; }
        .c2 { width:400px; height:400px; bottom:-150px; right:-150px; }
        .info-content { position:relative; z-index:2; }
        .info-panel h1 { font-family:'Montserrat', sans-serif; font-size:2.6rem; line-height:1.1; margin-bottom:25px; }
        .info-panel p { font-size:0.95rem; line-height:1.8; margin-bottom:24px; opacity:0.9; font-weight:300; }
        .list-panel { padding:60px; background:var(--white); }
        .panel-header { margin-bottom:24px; }
        .panel-header h2 { font-family:'Montserrat', sans-serif; color:var(--red-primary); font-size:1.8rem; }
        .search { display:flex; gap:12px; margin-bottom:24px; }
        .form-input { width:100%; padding:14px; border:1px solid var(--red-border); border-radius:var(--radius-inner); font-family:'Montserrat', sans-serif; color:var(--red-darkest); background:var(--white); transition:var(--transition); outline:none; font-size:0.95rem; }
        .form-input:focus { border-color:var(--red-primary); box-shadow:0 0 0 4px var(--red-light); transform:translateY(-2px); }
        .area { border:1px solid var(--red-border); border-radius:14px; overflow:hidden; margin-bottom:20px; }
        .area-header { display:flex; align-items:center; justify-content:space-between; padding:16px 18px; background:#fff; cursor:pointer; }
        .area-title { font-family:'Montserrat', sans-serif; color:var(--red-primary); font-size:1.1rem; font-weight:500; }
        .area-body { padding:16px 18px; background:#fff; }
        .loc-grid { display:grid; grid-template-columns:1fr; gap:14px; }
        .loc-card { border:1px solid var(--red-border); border-radius:12px; padding:14px; display:flex; flex-direction:column; gap:6px; box-shadow:0 6px 16px rgba(0,0,0,0.06); }
        .loc-name { font-weight:600; color:var(--red-darkest); }
        .loc-detail { font-size:0.9rem; color:#6B6B6B; }
        .badge { display:inline-block; font-size:0.75rem; color:#6B6B6B; padding:2px 8px; border:1px solid var(--red-border); border-radius:999px; margin-left:8px; }
        @media (max-width: 900px) { .support-container { grid-template-columns:1fr; border-radius:0; } .info-panel { padding:40px 30px; } .list-panel { padding:40px 20px; } }
      `}</style>
      <div className="support-container">
        <div className="info-panel">
          <div className="decor-circle c1"></div>
          <div className="decor-circle c2"></div>
          <div className="info-content">
            <h1>Support Locations</h1>
            <p>Find our authorised partners for exchanges and support. Search by area or name, then visit the location that suits you.</p>
          </div>
        </div>
        <div className="list-panel">
          <div className="panel-header"><h2>Locate a Partner</h2></div>
          <div className="search">
            <input className="form-input" placeholder="Search name, address, operating hours…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          {(filtered.length === 0) && (
            <div className="loc-detail">No matching locations</div>
          )}
          {filtered.map(a => (
            <div key={a.name} className="area">
              <div className="area-header" onClick={() => setOpen(prev => ({ ...prev, [a.name]: !prev[a.name] }))}>
                <div className="area-title">{a.name}</div>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open[a.name] ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}><polyline points="6 9 12 15 18 9"/></svg>
              </div>
              {open[a.name] && (
                <div className="area-body">
                  <div className="loc-grid">
                    {a.items.map((i, idx) => (
                      <div key={idx} className="loc-card">
                        <div className="loc-name">
                          {i.name}
                          {i.name.includes('24 Hours') && <span className="badge">24 Hours</span>}
                        </div>
                        <div className="loc-detail">{i.address}</div>
                        {i.hours && <div className="loc-detail">{i.hours}</div>}
                        {i.phone && <div className="loc-detail">HP: {i.phone}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
