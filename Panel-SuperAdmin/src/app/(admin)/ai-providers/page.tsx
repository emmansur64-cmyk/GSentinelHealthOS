'use client'

import { useQuery } from '@tanstack/react-query'
import { Zap } from 'lucide-react'
import type { AIProvider } from '@/modules/ai-providers/provider.types'

const PROVIDER_STATUS_CLASSES: Record<string, string> = {
  configured: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  unconfigured: 'bg-slate-50 text-slate-500 ring-slate-600/20',
  error: 'bg-red-50 text-red-700 ring-red-600/20',
  degraded: 'bg-amber-50 text-amber-700 ring-amber-600/20',
}

async function fetchProviders(): Promise<{ providers: AIProvider[] }> {
  const res = await fetch('/api/ai-providers')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export default function AIProvidersPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['ai-providers'],
    queryFn: fetchProviders,
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">AI Providers</h2>
        <p className="mt-1 text-sm text-slate-500">
          Configuration status for all AI provider integrations.
        </p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
        <strong>Note:</strong> Provider configuration is currently read from environment variables.
        Per-tenant configuration persistence will be wired once the admin DB schema is implemented.
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load provider status.
        </div>
      )}

      {data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.providers.map((provider) => (
            <div
              key={provider.name}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50">
                    <Zap className="h-4 w-4 text-indigo-600" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{provider.label}</p>
                    <p className="text-xs text-slate-400 capitalize">{provider.name}</p>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${PROVIDER_STATUS_CLASSES[provider.status]}`}
                >
                  {provider.status}
                </span>
              </div>

              <dl className="mt-4 space-y-1.5 text-xs text-slate-500">
                {provider.model && (
                  <div className="flex justify-between">
                    <dt>Model</dt>
                    <dd className="font-mono text-slate-700">{provider.model}</dd>
                  </div>
                )}
                {provider.timeoutMs && (
                  <div className="flex justify-between">
                    <dt>Timeout</dt>
                    <dd>{provider.timeoutMs / 1000}s</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt>Fallback</dt>
                  <dd>{provider.hasFallback ? 'Yes' : 'No'}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
