import { useMemo, useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { registerWarranty, checkCode } from '../lib/api'
 

function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function fmt(d: Date) {
  return d.toISOString().slice(0, 10)
}

export default function WarrantyRegister() {
  const [productCode, setProductCode] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const expiryDate = useMemo(() => {
    if (!purchaseDate) return ''
    return fmt(addDays(new Date(purchaseDate), 180))
  }, [purchaseDate])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [country, setCountry] = useState('')
  const [phoneModel, setPhoneModel] = useState('')
  const [mobile, setMobile] = useState('')
  const [productCategory, setProductCategory] = useState('')
  const [productType, setProductType] = useState('')
  const [agree, setAgree] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const submitTimerRef = useRef<any>(null)
  const [toastVisible, setToastVisible] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [overlayVisible, setOverlayVisible] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPdpa, setShowPdpa] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [codeError, setCodeError] = useState('')
  const [codeInfo, setCodeInfo] = useState('')
  const codeTimerRef = useRef<any>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isSubmitting) return
    const errs: Record<string, string> = {}
    const codeDigits = productCode.replace(/\s|-/g, '')
    function isEmail(v: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) }
    if (!name.trim()) errs.name = 'Enter your full name'
    if (!isEmail(email)) errs.email = 'Enter a valid email'
    if (!phoneModel.trim()) errs.phoneModel = 'Enter your phone model'
    if (!mobile.trim()) errs.mobile = 'Enter a contact number'
    else if (!/^\d+$/.test(mobile)) errs.mobile = 'Enter digits only'
    if (!productCategory.trim()) errs.productCategory = 'Select a category'
    if (!productType.trim()) errs.productType = 'Select a product type'
    if (!country.trim()) errs.country = 'Select a country'
    if (!purchaseDate) errs.purchaseDate = 'Select purchase date'
    if (!agree) errs.agree = 'Acceptance required'
    if (codeDigits.length === 0) errs.productCode = 'Enter a 16 or 20-digit code'
    if (Object.keys(errs).length) { setErrors(errs); return }
    try {
      const r = await checkCode(codeDigits)
      if (!r.exists) { setErrors({ ...errs, productCode: 'Invalid code' }); return }
      if (productType === 'Dream Case' && !codeDigits.startsWith('8899')) { setErrors({ ...errs, productCode: 'Not valid for Dream Case product' }); return }
      if (productType !== 'Dream Case' && codeDigits.startsWith('8899')) { setErrors({ ...errs, productCode: 'Valid only with Dream Case product' }); return }
    } catch {
      setErrors({ ...errs, productCode: 'Invalid code' }); return
    }
    setErrors({})
    setIsSubmitting(true)
    const r = await registerWarranty({ productCode: codeDigits, purchaseDate, expiryDate, name, email, country, phoneModel, mobile, productType, agree })
    setEmailSent(!!(r as any)?.emailSent)
    setSubmitted(true)
    setToastVisible(true)
    try { alert(`Your warranty registration is successful${(r as any)?.emailSent ? ` — confirmation sent to ${email}` : ''}`) } catch {}
    setOverlayVisible(true)
    setTimeout(() => setOverlayVisible(false), 1200)
    try { window.scrollTo({ top: 0, behavior: 'smooth' }) } catch {}
    if (submitTimerRef.current) { clearTimeout(submitTimerRef.current); submitTimerRef.current = null }
    submitTimerRef.current = setTimeout(() => { setToastVisible(false); setOverlayVisible(false); setIsSubmitting(false) }, 8000)
  }

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showSerialHelp, setShowSerialHelp] = useState(false)

  const productOptions: Record<string, string[]> = {
    'DIY X-Buffer': [
      'DIY Armorvisor',
      'DIY Extreme 9H',
      'DIY Extreme 7H',
      'DIY Extreme AR',
      'DIY Extreme Matte',
      'DIY Privacy Clear',
      'DIY Privacy Matte',
      'DIY Eyesafe'
    ],
    'DIY X-Plus': [
      'UV Nano AF Clear',
      'UV Nano Matte',
      'UV Privacy Matte',
      'Anti-Shock Gold',
      'X-Fold',
      'X-Tablet',
      'X-Paper'
    ],
    'X-Plus X-Buffer': [
      'X-Buffer Clear',
      'X-Buffer Matte',
      'X-Buffer Pro Armorvisor',
      'X-Buffer 180 Privacy',
      'X-Buffer 360 Privacy',
      'X-Buffer Eyesafe'
    ],
    'X-Plus Casing': [
      'Buffer Case',
      'Buffer Case MagSafe',
      'uCase MagSafe',
      'Dream Case'
    ],
    'X-Plus Accessories': [
      'X-Lens'
    ]
  }
  const availableProducts = productCategory ? (productOptions[productCategory] || []) : []

  useEffect(() => {
    const digits = productCode.replace(/\s|-/g, '')
    if (codeTimerRef.current) { clearTimeout(codeTimerRef.current); codeTimerRef.current = null }
    setCodeError('')
    setCodeInfo('')
    if (!digits) return
    if (productType === 'Dream Case' && !digits.startsWith('8899')) {
      setCodeInfo('Not valid for Dream Case product')
    } else if (productType && productType !== 'Dream Case' && digits.startsWith('8899')) {
      setCodeInfo('Valid only with Dream Case product')
    }
    codeTimerRef.current = setTimeout(async () => {
      try {
        const r = await checkCode(digits)
        if (!r.exists) setCodeError('Invalid code')
        else setCodeError('')
      } catch { setCodeError('Invalid code') }
    }, 300)
  }, [productCode, productType])

  

  return (
    <div style={{ fontFamily: 'Montserrat, sans-serif', background: 'linear-gradient(135deg, #fffcfc 0%, #FFEBEE 100%)', color: '#4A0A0E', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600&display=swap');
        :root { --red-primary:#D32F2F; --red-deep:#8A151B; --red-darkest:#4A0A0E; --red-light:#FFEBEE; --red-border:#FFCDD2; --white:#FFFFFF; --shadow:0 20px 60px rgba(138,21,27,0.15); --radius-outer:24px; --radius-inner:12px; --transition:all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1); --gold-bg:#FFF8E1; --gold-border:#E0C166; --gold-text:#7A5D00; --gold-badge:#F3E2A2; }
        .warranty-container { max-width:1100px; width:100%; background:var(--white); border-radius:var(--radius-outer); box-shadow:var(--shadow); overflow:hidden; display:grid; grid-template-columns:35% 65%; border:1px solid rgba(255,255,255,0.5); }
        .info-panel { background:linear-gradient(160deg, var(--red-primary) 0%, var(--red-deep) 100%); padding:60px 40px; color:var(--white); position:relative; display:flex; flex-direction:column; justify-content:center; overflow:hidden; }
        .decor-circle { position:absolute; border-radius:50%; background:rgba(255,255,255,0.06); z-index:1; pointer-events:none; }
        .c1 { width:300px; height:300px; top:-100px; left:-100px; }
        .c2 { width:400px; height:400px; bottom:-150px; right:-150px; }
        .info-content { position:relative; z-index:2; }
        .info-panel h1 { font-family:'Montserrat', sans-serif; font-size:2.8rem; line-height:1.1; margin-bottom:25px; }
        .info-panel p { font-size:0.95rem; line-height:1.8; margin-bottom:40px; opacity:0.9; font-weight:300; }
        .terms-preview { border-top:1px solid rgba(255,255,255,0.2); padding-top:30px; }
        .terms-item { display:flex; align-items:center; gap:15px; margin-bottom:15px; font-size:0.85rem; }
        .terms-item i { background:rgba(255,255,255,0.2); width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.7rem; }
        .form-panel { padding:60px; background:var(--white); }
        .form-header { margin-bottom:30px; }
        .form-header h2 { font-family:'Montserrat', sans-serif; color:var(--red-primary); font-size:1.8rem; }
        .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:25px; }
        .success-banner { margin-bottom:16px; padding:12px 14px; border:1px solid #CDE7C1; background:#F3FAEE; color:#1A4B1A; border-radius:10px; display:flex; align-items:center; gap:10px; }
        .success-banner .icon { display:inline-flex; width:20px; height:20px; align-items:center; justify-content:center; }
        .success-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; z-index:10000; pointer-events:none; }
        .success-card { background:#fff; border:1px solid #CDE7C1; border-radius:12px; padding:16px 20px; color:#1A4B1A; box-shadow:0 20px 60px rgba(0,0,0,0.2); }
        .blocking-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.25); display:flex; align-items:center; justify-content:center; z-index:9998; }
        .blocking-card { background:#fff; border:1px solid #FFCDD2; border-radius:12px; padding:12px 16px; color:#4A0A0E; box-shadow:0 10px 30px rgba(0,0,0,0.15); font-size:0.95rem; }
        .btn-submit[disabled] { opacity:0.6; cursor:not-allowed; }
        .full-width { grid-column:1 / -1; }
        .form-group { margin-bottom:25px; }
        .form-label { display:block; font-size:0.75rem; text-transform:uppercase; letter-spacing:1px; color:var(--red-deep); margin-bottom:8px; font-weight:600; }
        .form-input, .form-select { width:100%; padding:14px; border:1px solid var(--red-border); border-radius:var(--radius-inner); font-family:'Montserrat', sans-serif; color:var(--red-darkest); background:var(--white); transition:var(--transition); outline:none; font-size:0.95rem; }
        .form-input:focus, .form-select:focus { border-color:var(--red-primary); box-shadow:0 0 0 4px var(--red-light); transform:translateY(-2px); }
        .form-input::placeholder { color:#ccb0b0; }
        .helper-text { display:block; margin-top:8px; font-size:0.75rem; color:var(--red-primary); text-decoration:none; font-weight:500; transition:0.3s; }
        .helper-text:hover { color:var(--red-deep); text-decoration:underline; }
        .checkbox-wrapper { display:flex; align-items:flex-start; gap:12px; margin-top:10px; margin-bottom:30px; }
        .custom-checkbox { appearance:none; -webkit-appearance:none; min-width:20px; height:20px; border:1px solid var(--red-primary); border-radius:6px; cursor:pointer; display:grid; place-content:center; margin-top:2px; transition:var(--transition); }
        .custom-checkbox::before { content:'\u2713'; color:white; font-size:12px; transform:scale(0); transition:0.2s; }
        .custom-checkbox:checked { background:var(--red-primary); box-shadow:0 4px 10px rgba(211,47,47,0.3); }
        .custom-checkbox:checked::before { transform:scale(1); }
        .legal-text { font-size:0.8rem; line-height:1.6; color:#666; }
        .legal-text a { color:var(--red-primary); text-decoration:none; border-bottom:1px dotted var(--red-primary); }
        .error-text { margin-top:8px; font-size:0.75rem; color:#b91c1c; }
        .input-with-icon { position:relative; }
        .input-with-icon .fa-calendar-alt { position:absolute; right:14px; top:50%; transform:translateY(-50%); color:#ccb0b0; opacity:0.9; pointer-events:none; }
        .input-with-icon input.form-input { padding-right:42px; }
        .btn-submit { width:100%; padding:18px; background:var(--red-primary); color:var(--white); border:none; border-radius:var(--radius-inner); font-size:0.9rem; text-transform:uppercase; letter-spacing:2px; font-weight:600; cursor:pointer; transition:var(--transition); box-shadow:0 10px 20px rgba(211,47,47,0.2); }
        .btn-submit:hover { background:var(--red-deep); transform:translateY(-3px); box-shadow:0 15px 30px rgba(138,21,27,0.3); }
        .toast { position:fixed; left:50%; bottom:24px; transform:translate(-50%, 8px); background:var(--gold-bg); color:var(--gold-text); border:1px solid var(--gold-border); border-radius:10px; box-shadow:0 10px 20px rgba(0,0,0,0.12); padding:10px 12px; display:flex; align-items:center; gap:10px; min-width:260px; max-width:90vw; font-size:0.9rem; z-index:10001; pointer-events:none; }
        .toast-badge { background:var(--gold-badge); color:var(--gold-text); border:1px solid var(--gold-border); border-radius:6px; padding:2px 6px; font-size:0.75rem; }
        .toast-close { margin-left:auto; background:transparent; border:none; color:var(--gold-text); font-size:18px; cursor:pointer; line-height:1; }
        .drawer-backdrop { position:fixed; inset:0; background:rgba(0,0,0,0.4); display:flex; align-items:stretch; justify-content:flex-end; z-index:50; }
        .drawer { width:min(560px, 90vw); height:100vh; background:#fff; box-shadow:-12px 0 28px rgba(0,0,0,0.12); padding:32px; display:flex; flex-direction:column; }
        .drawer-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:24px; }
        .drawer-title { font-family:'Montserrat', sans-serif; color:var(--red-primary); font-size:1.8rem; font-weight:400; }
        .drawer-body { overflow:auto; }
        .drawer-body p, .drawer-body li { font-family:'Montserrat', sans-serif; font-size:0.95rem; line-height:1.8; color:#6B6B6B; margin-bottom:16px; }
        .drawer-body ul, .drawer-body ol { padding-left:1.25rem; margin-bottom:16px; }
        .drawer-body ul { list-style: disc; list-style-position: outside; }
        .drawer-body ol { list-style: none; counter-reset: item; padding-left:0; }
        .drawer-body ol > li { counter-increment: item; position:relative; padding-left:2rem; }
        .drawer-body ol > li::before { content: counter(item) '. '; position:absolute; left:0; width:1.6rem; text-align:right; color:#6B6B6B; }
        .privacy-content h1, .privacy-content h2 { display:none; }
        .icon-close { color:#333; cursor:pointer; }
        @media (max-width: 900px) { .warranty-container { grid-template-columns:1fr; border-radius:0; } .info-panel { padding:40px 30px; } .form-panel { padding:40px 20px; } .grid-2 { grid-template-columns:1fr; gap:0; } }
      `}</style>
      <div className="warranty-container">
        <div className="info-panel">
          <div className="decor-circle c1"></div>
          <div className="decor-circle c2"></div>
          <div className="info-content">
            <h1>The X-Plus <br/>Promise</h1>
            <p>You have chosen the finest protection for your device. Register your product now to activate your warranty and join our exclusive circle of care.</p>
            <div className="terms-preview">
              <div className="terms-item">
                <i className="fas fa-certificate"></i>
                <span>100% Genuine</span>
              </div>
              <div className="terms-item">
                <i className="fas fa-headset"></i>
                <span>Exceptional Client Care</span>
              </div>
              <div className="terms-item">
                <i className="fas fa-sync-alt"></i>
                <span>180-Day 1-to-1 Exchange</span>
              </div>
            </div>
          </div>
        </div>
        <div className="form-panel">
          {submitted && (
            <div className="success-banner">
              <span className="icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
              </span>
              <span>Your warranty registration is successful{emailSent ? ` — confirmation sent to ${email}` : ''}</span>
            </div>
          )}
          <div className="form-header"><h2>Product Details</h2></div>
          {submitted ? (
            <div className="success-card" style={{ marginBottom: 20 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span className="icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
                </span>
                <span>Your warranty registration is successful{emailSent ? ` — confirmation sent to ${email}` : ''}</span>
              </div>
            </div>
          ) : null}
          {!submitted && (
          <form onSubmit={onSubmit}>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label" htmlFor="name">Name</label>
                <input id="name" type="text" className="form-input h-12" placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} />
                {errors.name && <div className="error-text">{errors.name}</div>}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="email">Email</label>
                <input id="email" type="email" className="form-input h-12" placeholder="name@email.com" value={email} onChange={e => setEmail(e.target.value)} />
                {errors.email && <div className="error-text">{errors.email}</div>}
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label" htmlFor="phone_model">Phone Model</label>
                <input id="phone_model" type="text" className="form-input h-12" placeholder="e.g. iPhone 15 Pro" value={phoneModel} onChange={e => setPhoneModel(e.target.value)} />
                {errors.phoneModel && <div className="error-text">{errors.phoneModel}</div>}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="mobile">Contact</label>
                <input id="mobile" type="tel" inputMode="numeric" className="form-input h-12" placeholder="Contact number" value={mobile} onChange={e => setMobile(e.target.value.replace(/[^\d]/g, ''))} />
                {errors.mobile && <div className="error-text">{errors.mobile}</div>}
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label" htmlFor="product_category">Product Category</label>
                <select id="product_category" className="form-select h-12" value={productCategory} onChange={e => { setProductCategory(e.target.value); setProductType('') }}>
                  <option value="" disabled>Select Category</option>
                  {Object.keys(productOptions).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                {errors.productCategory && <div className="error-text">{errors.productCategory}</div>}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="product_type">Product Type</label>
                <select id="product_type" className="form-select h-12" value={productType} onChange={e => setProductType(e.target.value)} disabled={!productCategory}>
                  <option value="" disabled>{productCategory ? 'Select Product' : 'Select a category first'}</option>
                  {availableProducts.map(p => (<option key={p}>{p}</option>))}
                </select>
                {errors.productType && <div className="error-text">{errors.productType}</div>}
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label" htmlFor="country">Country</label>
                <select id="country" className="form-select h-12" value={country} onChange={e => setCountry(e.target.value)}>
                  <option value="">Select Country</option>
                  <option>Singapore</option>
                  <option>Thailand</option>
                </select>
                {errors.country && <div className="error-text">{errors.country}</div>}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="product_code">Product Code (16 or 20 digits)</label>
                <input id="product_code" type="text" className="form-input h-12" placeholder="XXXX-XXXX-XXXX-XXXX" maxLength={24} value={productCode} onChange={e => setProductCode(e.target.value.replace(/[^\dA-Z]/g, '').replace(/(.{4})/g, '$1 ').trim())} />
                {errors.productCode && <div className="error-text">{errors.productCode}</div>}
                {codeError && !errors.productCode && <div className="error-text">{codeError}</div>}
                {codeInfo && !errors.productCode && <div className="error-text">{codeInfo}</div>}
                <a href="#" className="helper-text" onClick={(e) => { e.preventDefault(); setShowSerialHelp(true) }}><i className="far fa-question-circle" style={{ marginRight: 6 }}></i>Need help finding your serial number?</a>
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label" htmlFor="purchase_date">Date of Purchase</label>
                <input id="purchase_date" type="date" className="form-input h-12" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
                {errors.purchaseDate && <div className="error-text">{errors.purchaseDate}</div>}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="expiry_date">Date of Expiry</label>
                <input id="expiry_date" type="date" className="form-input h-12" value={expiryDate} onChange={() => {}} />
              </div>
      {showSerialHelp && (
        <div className="drawer-backdrop" onClick={() => setShowSerialHelp(false)}>
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <div className="drawer-title">Serial Number Guide</div>
              <svg className="icon-close" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" onClick={() => setShowSerialHelp(false)}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </div>
            <img src="/instruction.jpg" alt="How to find your serial number" style={{ width:'100%', height:'auto', borderRadius:12 }} />
          </div>
        </div>
      )}
      </div>
            <div className="form-group">
              <div className="checkbox-wrapper">
                <input id="pdpa" type="checkbox" className="custom-checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />
                <label htmlFor="pdpa" className="legal-text">
                  I have read and agreed with the <a href="#" onClick={(e) => { e.preventDefault(); setShowPdpa(true) }}>PDPA Consent Clause</a>, <a href="#" onClick={(e) => { e.preventDefault(); setShowPrivacy(true) }}>Privacy Policy</a>, and <a href="#" onClick={(e) => { e.preventDefault(); setShowTerms(true) }}>Terms and Conditions</a>.
                </label>
              </div>
              {errors.agree && <div className="error-text">{errors.agree}</div>}
            </div>
            <button type="submit" className="btn-submit" disabled={isSubmitting}>{isSubmitting ? 'Submitting…' : 'Submit Registration'}</button>
          </form>
          )}
          {submitted && createPortal((
            <div className="toast" style={{ opacity: toastVisible ? 1 : 0, visibility: toastVisible ? 'visible' : 'hidden' }}>
              <span className="toast-badge">Success</span>
              <span>Your warranty registration is successful{emailSent ? ` — confirmation sent to ${email}` : ''}</span>
            </div>
          ), document.body)}
          {overlayVisible && (
            <div className="success-overlay">
              <div className="success-card">
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span className="icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
                  </span>
                  <span>Your warranty registration is successful{emailSent ? ` — confirmation sent to ${email}` : ''}</span>
                </div>
              </div>
            </div>
          )}
          {isSubmitting && !submitted && (
            <div className="blocking-overlay">
              <div className="blocking-card">Submitting… Please wait</div>
            </div>
          )}
      {showPdpa && (
        <div className="drawer-backdrop" onClick={() => setShowPdpa(false)}>
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <div className="drawer-title">PDPA Consent Clause</div>
              <svg className="icon-close" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" onClick={() => setShowPdpa(false)}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </div>
            <div className="drawer-body">
              <p>By submitting this Form, you hereby agree that XPLUS SG may collect, obtain, store and process the personal data that you provide in this form for the purpose of receiving updates, news, promotional and marketing mail or materials from XPLUS SG.</p>
              <p>You hereby give your consent to XPLUS SG to:-</p>
              <ul style={{ paddingLeft:'1.25rem' }}>
                <li>Store and process your Personal Data</li>
                <li>Disclose your Personal Data to relevant governmental authorities or third parties where required by law or for legal purposes</li>
                <li>
                  Contact you with updates, news, promotional and marketing materials via:
                  <ul style={{ paddingLeft:'1.25rem' }}>
                    <li>Postal mail to your address(es)</li>
                    <li>Electronic transmission to your email address(es)</li>
                    <li>Your Singapore telephone number(s) provided to XPLUS SG</li>
                  </ul>
                </li>
              </ul>
              <p>In addition, your personal data may be transferred to any company within the XPLUS SG which may involve sending your data to a location outside Singapore. For the purpose of updating or correcting such data, you may at any time apply to XPLUS SG to have access to your personal data which are stored by XPLUS SG.</p>
              <p>You hereby confirm that you are the user and/or subscriber of the telephone number(s) that you have provided or may provide to XPLUS SG.</p>
              <p>For the avoidance of doubt, Personal Data includes all data defined within the Singapore Personal Data Protection Act 2012 including all data you had disclosed to XPLUS SG in this Form.</p>
            </div>
          </div>
        </div>
      )}
      {showPrivacy && (
        <div className="drawer-backdrop" onClick={() => setShowPrivacy(false)}>
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <div className="drawer-title">Privacy Policy</div>
              <svg className="icon-close" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" onClick={() => setShowPrivacy(false)}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </div>
            <div className="drawer-body privacy-content">
              <p>At XPLUS SG, accessible from xplus.com.sg, one of our main priorities is the privacy of our visitors. This Privacy Policy document contains types of information that is collected and recorded by XPLUS SG and how we use it.</p>
              <p>If you have additional questions or require more information about our Privacy Policy, do not hesitate to contact us.</p>
              <p>This Privacy Policy applies only to our online activities and is valid for visitors to our website with regard to the information that they shared and/or collect in XPLUS SG. This policy is not applicable to any information collected offline or via channels other than this website.</p>
              <p><strong>Consent</strong></p>
              <p>By using our website, you hereby consent to our Privacy Policy and agree to its terms.</p>
              <p><strong>Information we collect</strong></p>
              <p>The personal information that you are asked to provide, and the reasons why you are asked to provide it, will be made clear to you at the point we ask you to provide your personal information.</p>
              <p>If you contact us directly, we may receive additional information about you such as your name, email address, phone number, the contents of the message and/or attachments you may send us, and any other information you may choose to provide.</p>
              <p>When you register for an Account, we may ask for your contact information, including items such as name, company name, address, email address, and telephone number.</p>
              <p><strong>How we use your information</strong></p>
              <ul style={{ paddingLeft:'1.25rem' }}>
                <li>Provide, operate, and maintain our website</li>
                <li>Improve, personalise, and expand our website</li>
                <li>Understand and analyse how you use our website</li>
                <li>Develop new products, services, features, and functionality</li>
                <li>Communicate with you, either directly or through one of our partners, including for customer service, to provide you with updates and other information relating to the website, and for marketing and promotional purposes</li>
                <li>Send you emails</li>
                <li>Find and prevent fraud</li>
              </ul>
              <p><strong>Log Files</strong></p>
              <p>XPLUS SG follows a standard procedure of using log files. These files log visitors when they visit websites. All hosting companies do this and a part of hosting services’ analytics. The information collected by log files include internet protocol (IP) addresses, browser type, Internet Service Provider (ISP), date and time stamp, referring/exit pages, and possibly the number of clicks. These are not linked to any information that is personally identifiable. The purpose of the information is for analysing trends, administering the site, tracking users’ movement on the website, and gathering demographic information.</p>
              <p><strong>Advertising Partners Privacy Policies</strong></p>
              <p>You may consult this list to find the Privacy Policy for each of the advertising partners of XPLUS SG.</p>
              <p>Third-party ad servers or ad networks uses technologies like cookies, JavaScript, or Web Beacons that are used in their respective advertisements and links that appear on XPLUS SG, which are sent directly to users’ browser. They automatically receive your IP address when this occurs. These technologies are used to measure the effectiveness of their advertising campaigns and/or to personalise the advertising content that you see on websites that you visit.</p>
              <p>Note that XPLUS SG has no access to or control over these cookies that are used by third-party advertisers.</p>
              <p><strong>Third Party Privacy Policies</strong></p>
              <p>XPLUS SG’s Privacy Policy does not apply to other advertisers or websites. Thus, we are advising you to consult the respective Privacy Policies of these third-party ad servers for more detailed information. It may include their practices and instructions about how to opt-out of certain options.</p>
              <p>You can choose to disable cookies through your individual browser options. To know more detailed information about cookie management with specific web browsers, it can be found at the browsers’ respective websites.</p>
              <p><strong>CCPA Privacy Rights (Do Not Sell My Personal Information)</strong></p>
              <p>Under the CCPA, among other rights, California consumers have the right to:</p>
              <ul style={{ paddingLeft:'1.25rem' }}>
                <li>Request that a business that collects a consumer’s personal data disclose the categories and specific pieces of personal data that a business has collected about consumers</li>
                <li>Request that a business delete any personal data about the consumer that a business has collected</li>
                <li>Request that a business that sells a consumer’s personal data, not sell the consumer’s personal data</li>
              </ul>
              <p>If you make a request, we have one month to respond to you. If you would like to exercise any of these rights, please contact us.</p>
              <p><strong>GDPR Data Protection Rights</strong></p>
              <p>We would like to make sure you are fully aware of all of your data protection rights. Every user is entitled to the following:</p>
              <ul style={{ paddingLeft:'1.25rem' }}>
                <li>The right to access – You have the right to request copies of your personal data. We may charge you a small fee for this service.</li>
                <li>The right to rectification – You have the right to request that we correct any information you believe is inaccurate. You also have the right to request that we complete the information you believe is incomplete.</li>
                <li>The right to erasure – You have the right to request that we erase your personal data, under certain conditions.</li>
                <li>The right to restrict processing – You have the right to request that we restrict the processing of your personal data, under certain conditions.</li>
                <li>The right to object to processing – You have the right to object to our processing of your personal data, under certain conditions.</li>
                <li>The right to data portability – You have the right to request that we transfer the data that we have collected to another organization, or directly to you, under certain conditions.</li>
              </ul>
              <p>If you make a request, we have one month to respond to you. If you would like to exercise any of these rights, please contact us.</p>
              <p><strong>Children’s Information</strong></p>
              <p>Another part of our priority is adding protection for children while using the internet. We encourage parents and guardians to observe, participate in, and/or monitor and guide their online activity.</p>
              <p>XPLUS SG does not knowingly collect any Personal Identifiable Information from children under the age of 13. If you think that your child provided this kind of information on our website, we strongly encourage you to contact us immediately and we will do our best efforts to promptly remove such information from our records.</p>
              <p><strong>Changes to This Privacy Policy</strong></p>
              <p>We may update our Privacy Policy from time to time. Thus, we advise you to review this page periodically for any changes. We will notify you of any changes by posting the new Privacy Policy on this page. These changes are effective immediately, after they are posted on this page.</p>
              <p><strong>Contact Us</strong></p>
              <p>If you have any questions or suggestions about our Privacy Policy, do not hesitate to contact us.</p>
            </div>
          </div>
        </div>
      )}
      {showTerms && (
        <div className="drawer-backdrop" onClick={() => setShowTerms(false)}>
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <div className="drawer-title">Terms and Conditions</div>
              <svg className="icon-close" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" onClick={() => setShowTerms(false)}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </div>
            <div className="drawer-body">
              <ol style={{ paddingLeft:'1.25rem' }}>
                <li>Warranty claim must be made through the authorised dealer.</li>
                <li>Warranty only valid for one-time exchange. Once claimed, the warranty period will be void.</li>
                <li>Warranty is only applicable to the same owner of the same phone during purchase and activation process within 7 days.</li>
                <li>XPLUS SG reserves the right to replace to other protector series of the same value if the product is discontinued.</li>
                <li>Product warranty is deemed invalid if it is not activated through www.xplus.com.sg.</li>
                <li>XPLUS SG cannot provide any replacement or warranty in an event of screen breakage or damage. Our screen protector works as a sacrificial protection barrier to your devices.</li>
                <li>The warranty covers protector cracks, scratches, lift-ups, and bubbles (for screen protectors).</li>
                <li>The warranty covers anti-aging, if turned yellowish (for phone casing).</li>
                <li>The warranty does not cover wear and tear.</li>
                <li>Purchased product must be presented for 1-to-1 exchange & claim purposes.</li>
              </ol>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  )
}
