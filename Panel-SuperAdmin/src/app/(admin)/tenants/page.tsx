'use client'

import { useQuery } from '@tanstack/react-query'
import { Building2 } from 'lucide-react'
import type { Tenant } from '@/modules/tenants/tenant.types'

const STATUS_BADGE_CLASSES: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  trial: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  suspended: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  pending: 'bg-slate-50 text-slate-600 ring-slate-600/20',
  disabled: 'bg-red-50 text-red-700 ring-red-600/20',
}

async function fetchTenants(): Promise<{ tenants: Tenant[]; _note?: string }> {
  const res = await fetch('/api/tenants')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export default function TenantsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['tenants'],
    queryFn: fetchTenants,
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Tenant Management</h2>
        <p className="mt-1 text-sm text-slate-500">
          All tenants registered in the GSentinelHealthOS platform.
        </p>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load tenants.
        </div>
      )}

      {data && (
        <>
          {data._note && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
              <strong>Backend pending:</strong> The <code>/admin/tenants</code> endpoint is not yet
              implemented in the FastAPI service. Tenant data will appear here once wired.
            </div>
          )}

          {data.tenants.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
              <Building2 className="mb-3 h-10 w-10 text-slate-300" aria-hidden="true" />
              <p className="text-sm font-medium text-slate-500">No tenants available yet</p>
              <p className="mt-1 text-xs text-slate-400">
                Tenant data will populate once the admin API endpoint is implemented.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-slate-200">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Name</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Slug</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Plan</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Clinics</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.tenants.map((tenant) => (
                    <tr key={tenant.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 text-sm font-medium text-slate-900">{tenant.name}</td>
                      <td className="px-5 py-3 text-sm text-slate-500 font-mono">{tenant.slug}</td>
                      <td className="px-5 py-3 text-sm text-slate-500 capitalize">{tenant.plan}</td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${STATUS_BADGE_CLASSES[tenant.status] ?? STATUS_BADGE_CLASSES.pending}`}
                        >
                          {tenant.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-500">{tenant.clinicCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
