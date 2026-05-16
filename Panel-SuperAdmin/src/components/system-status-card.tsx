import { StatusBadge } from '@/components/status-badge'
import { cn } from '@/lib/utils'
import type { ServiceHealth } from '@/modules/system-health/health.types'

interface SystemStatusCardProps {
  service: ServiceHealth
  className?: string
}

export function SystemStatusCard({ service, className }: SystemStatusCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200 bg-white p-4 shadow-sm',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{service.name}</p>
          {service.version && (
            <p className="mt-0.5 text-xs text-slate-400">v{service.version}</p>
          )}
        </div>
        <StatusBadge status={service.status} />
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
        {service.latencyMs !== undefined && (
          <span>{service.latencyMs}ms</span>
        )}
        {service.error && (
          <span className="text-red-500 truncate">{service.error}</span>
        )}
        <span className="ml-auto">
          {new Date(service.checkedAt).toLocaleTimeString()}
        </span>
      </div>
    </div>
  )
}
