'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { FeatureFlag } from '@/modules/feature-flags/flags.types'

async function fetchFlags(): Promise<{ flags: FeatureFlag[] }> {
  const res = await fetch('/api/feature-flags')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function toggleFlag(key: string, enabled: boolean): Promise<{ flag: FeatureFlag }> {
  const res = await fetch('/api/feature-flags', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, enabled }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export default function FeatureFlagsPage() {
  const queryClient = useQueryClient()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['feature-flags'],
    queryFn: fetchFlags,
  })

  const mutation = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) => toggleFlag(key, enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feature-flags'] }),
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Feature Flags</h2>
        <p className="mt-1 text-sm text-slate-500">
          Enable or disable platform modules and behaviors at runtime.
        </p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
        <strong>Note:</strong> Flags are stored in-memory during bootstrap. Persistence to the
        database will be wired once the admin config schema is implemented.
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load feature flags.
        </div>
      )}

      {data && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Flag</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Module</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Scope</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Updated</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Enabled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.flags.map((flag) => (
                <tr key={flag.key} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium text-slate-900">{flag.label}</p>
                    <p className="text-xs text-slate-400 font-mono">{flag.key}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{flag.description}</p>
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-500">{flag.module}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                      flag.scope === 'global'
                        ? 'bg-indigo-50 text-indigo-700 ring-indigo-600/20'
                        : 'bg-slate-50 text-slate-600 ring-slate-600/20'
                    }`}>
                      {flag.scope}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-400">
                    {new Date(flag.updatedAt).toLocaleDateString()}
                    {flag.updatedBy && <span className="block">{flag.updatedBy}</span>}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      role="switch"
                      aria-checked={flag.enabled}
                      disabled={mutation.isPending}
                      onClick={() => mutation.mutate({ key: flag.key, enabled: !flag.enabled })}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 ${
                        flag.enabled ? 'bg-indigo-600' : 'bg-slate-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                          flag.enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
