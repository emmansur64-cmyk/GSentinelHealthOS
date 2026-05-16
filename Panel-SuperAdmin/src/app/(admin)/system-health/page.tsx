'use client'

import { useQuery } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { SystemStatusCard } from '@/components/system-status-card'
import { StatusBadge } from '@/components/status-badge'
import type { SystemHealthReport } from '@/modules/system-health/health.types'

async function fetchHealth(): Promise<SystemHealthReport> {
  const res = await fetch('/api/system-health', { cache: 'no-store' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export default function SystemHealthPage() {
  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['system-health'],
    queryFn: fetchHealth,
    refetchInterval: 30_000,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">System Health</h2>
          <p className="mt-1 text-sm text-slate-500">
            Live status of all ecosystem services. Auto-refreshes every 30 seconds.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {data && <StatusBadge status={data.overallStatus} />}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load health status. Verify that the backend services are reachable from this host.
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.services.map((svc) => (
              <SystemStatusCard key={svc.name} service={svc} />
            ))}
          </div>

          {dataUpdatedAt > 0 && (
            <p className="text-xs text-slate-400">
              Last checked: {new Date(dataUpdatedAt).toLocaleTimeString()}
            </p>
          )}
        </>
      )}
    </div>
  )
}
