import { cn } from '@/lib/utils'
import type { ServiceStatus } from '@/modules/system-health/health.types'

const STATUS_CONFIG: Record<ServiceStatus, { label: string; classes: string; dot: string }> = {
  UP: {
    label: 'UP',
    classes: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    dot: 'bg-emerald-500 status-pulse',
  },
  DEGRADED: {
    label: 'DEGRADED',
    classes: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    dot: 'bg-amber-500',
  },
  DOWN: {
    label: 'DOWN',
    classes: 'bg-red-50 text-red-700 ring-red-600/20',
    dot: 'bg-red-500',
  },
  UNKNOWN: {
    label: 'UNKNOWN',
    classes: 'bg-slate-50 text-slate-600 ring-slate-600/20',
    dot: 'bg-slate-400',
  },
}

interface StatusBadgeProps {
  status: ServiceStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
        config.classes,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dot)} />
      {config.label}
    </span>
  )
}
