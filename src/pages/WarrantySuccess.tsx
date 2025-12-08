import { useLocation, Link } from 'react-router-dom'

export default function WarrantySuccess() {
  const { state } = useLocation() as any
  const emailSent = Boolean(state?.emailSent)
  const email = String(state?.email || '')
  return (
    <section className="container py-12">
      <div className="mx-auto max-w-xl">
        <h2 className="page-title mb-4">Registration Successful</h2>
        <div className="rounded-md border border-[#CDE7C1] bg-[#F3FAEE] text-[#1A4B1A] p-4">
          <div className="flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
            <div>
              <div>Your warranty registration is successful.</div>
              {emailSent && email && (<div>Confirmation sent to <strong>{email}</strong>.</div>)}
            </div>
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          <Link className="rounded-md border border-slate-300 px-4 py-2 inline-block" to="/warranty-register">Register another</Link>
          <Link className="rounded-md border border-slate-300 px-4 py-2 inline-block" to="/">Home</Link>
        </div>
      </div>
    </section>
  )
}
