import { Link } from 'react-router-dom'

export default function AdminDashboard() {
  return (
    <section className="container py-12">
      <h2 className="text-2xl font-semibold mb-6">Dashboard</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link to="/owner/users" className="rounded-md border border-slate-200 p-4 hover:border-brand">
          <div className="font-semibold">Users</div>
          <div className="text-sm text-slate-600">Create Partner accounts</div>
        </Link>
        <Link to="/owner/codes" className="rounded-md border border-slate-200 p-4 hover:border-brand">
          <div className="font-semibold">Product Codes</div>
          <div className="text-sm text-slate-600">Upload and delete codes</div>
        </Link>
        <Link to="/owner/warranties" className="rounded-md border border-slate-200 p-4 hover:border-brand">
          <div className="font-semibold">Warranties</div>
          <div className="text-sm text-slate-600">View records</div>
        </Link>
      </div>
    </section>
  )
}
