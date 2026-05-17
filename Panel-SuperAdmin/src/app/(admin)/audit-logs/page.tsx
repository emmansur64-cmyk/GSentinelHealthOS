'use client'

import { useQuery } from '@tanstack/react-query'
import { ScrollText } from 'lucide-react'
import type { AuditLogEntry } from '@/modules/audit/audit.types'

async function fetchAuditLogs(page = 1): Promise<{
  logs: AuditLogEntry[]
  total: number
  page: number
  limit: number
}> {
  const res = await fetch(`/api/audit-logs?page=${page}&limit=50`)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

export default function AuditLogsPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['audit-logs', 1],
    queryFn: () => fetchAuditLogs(1),
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Audit Logs</h2>
        <p className="mt-1 text-sm text-slate-500">
          All administrative actions performed in this panel.
        </p>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error instanceof Error ? error.message : 'Failed to load audit logs.'}
        </div>
      )}

      {data && data.logs.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <ScrollText className="mb-3 h-10 w-10 text-slate-300" aria-hidden="true" />
          <p className="text-sm font-medium text-slate-500">No audit events yet</p>
          <p className="mt-1 text-xs text-slate-400">
            Events will appear here as administrative actions are performed.
          </p>
        </div>
      )}

      {data && data.logs.length > 0 && (
        <>
          <p className="text-xs text-slate-400">{data.total} total events</p>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Timestamp</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Action</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Actor</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Target</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Request ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.logs.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 text-xs text-slate-500 font-mono whitespace-nowrap">
                      {new Date(entry.timestamp).toLocaleString()}
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-600/20 font-mono">
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-xs text-slate-900">{entry.actor.email}</p>
                      <p className="text-xs text-slate-400">{entry.actor.role}</p>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {entry.target ? `${entry.target.type}:${entry.target.name ?? entry.target.id}` : '—'}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-400 font-mono">{entry.requestId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
