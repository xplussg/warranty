import { Link } from 'react-router-dom'

export default function PartnerDashboard() {
  return (
    <section className="container py-12">
      <h2 className="text-2xl font-semibold mb-6">Dashboard</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        <Link to="/partner/warranties" className="rounded-md border border-slate-200 p-4 hover:border-brand">
          <div className="font-semibold">Warranties</div>
          <div className="text-sm text-slate-600">Search by name, email or phone and claim</div>
        </Link>
        <Link to="/change-password" className="rounded-md border border-slate-200 p-4 hover:border-brand">
          <div className="font-semibold">Change Password</div>
          <div className="text-sm text-slate-600">Update your account password</div>
        </Link>
      </div>
    </section>
  )
}
