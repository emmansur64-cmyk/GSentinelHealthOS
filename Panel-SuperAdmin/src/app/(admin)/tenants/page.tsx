'use client'

import { useState } from 'react'
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

async function fetchTenants(): Promise<{ tenants: Tenant[] }> {
  const res = await fetch('/api/tenants')
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

export default function TenantsPage() {
  const [busyTenantId, setBusyTenantId] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['tenants'],
    queryFn: fetchTenants,
  })

  async function updateStatus(tenant: Tenant, status: 'active' | 'suspended' | 'disabled') {
    setLocalError(null)
    setBusyTenantId(tenant.id)
    try {
      const res = await fetch(`/api/tenants/${encodeURIComponent(tenant.id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`)
      window.location.reload()
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : 'No se pudo actualizar el cliente')
    } finally {
      setBusyTenantId(null)
    }
  }

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
          {error instanceof Error ? error.message : 'Failed to load tenants.'}
        </div>
      )}

      {localError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {localError}
        </div>
      )}

      {data && (
        <>
          {data.tenants.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
              <Building2 className="mb-3 h-10 w-10 text-slate-300" aria-hidden="true" />
              <p className="text-sm font-medium text-slate-500">No tenants available yet</p>
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
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
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
                      <td className="px-5 py-3 text-sm text-slate-500">
                        <div className="flex flex-wrap gap-2">
                          <button
                            disabled={busyTenantId === tenant.id || tenant.status === 'active'}
                            onClick={() => updateStatus(tenant, 'active')}
                            className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 disabled:opacity-50"
                          >
                            Activar
                          </button>
                          <button
                            disabled={busyTenantId === tenant.id || tenant.status === 'suspended'}
                            onClick={() => updateStatus(tenant, 'suspended')}
                            className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 disabled:opacity-50"
                          >
                            Suspender
                          </button>
                          <button
                            disabled={busyTenantId === tenant.id || tenant.status === 'disabled'}
                            onClick={() => updateStatus(tenant, 'disabled')}
                            className="rounded-md border border-red-300 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 disabled:opacity-50"
                          >
                            Dar de baja
                          </button>
                        </div>
                      </td>
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
