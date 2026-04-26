import type { DashboardStats } from '../types/api'
import AlertBadge from './AlertBadge'

interface Props {
  stats: DashboardStats
}

export default function HealthStatusCard({ stats }: Props) {
  const { bot_health, queue_health, alerts, redis_connected } = stats

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Estado del Bot</h2>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
            redis_connected
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-amber-100 text-amber-700'
          }`}
        >
          Redis {redis_connected ? 'conectado' : 'desconectado'}
        </span>
      </div>

      <dl className="grid grid-cols-3 gap-4">
        <Metric label="Mensajes" value={bot_health.messages_processed} />
        <Metric label="Reinicios" value={bot_health.resets} highlight={alerts.system_reset_ratio_high} />
        <Metric label="Contentions" value={bot_health.contention} highlight={alerts.lock_contention_high} />
      </dl>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <RatioBar label="Reset ratio" ratio={bot_health.reset_ratio} alert={alerts.system_reset_ratio_high} />
        <RatioBar label="Contention ratio" ratio={bot_health.contention_ratio} alert={alerts.lock_contention_high} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <AlertBadge label="Backlog" active={alerts.queue_backlog_high} />
        <AlertBadge label="Resets" active={alerts.system_reset_ratio_high} />
        <AlertBadge label="Contención" active={alerts.lock_contention_high} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm text-slate-600">
        <QueueDepth label="↓ Incoming" value={queue_health.incoming} />
        <QueueDepth label="↑ Outgoing" value={queue_health.outgoing} />
      </div>
    </div>
  )
}

function Metric({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: number
  highlight?: boolean
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 text-center">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${highlight ? 'text-red-600' : 'text-slate-800'}`}>
        {value.toLocaleString()}
      </p>
    </div>
  )
}

function RatioBar({ label, ratio, alert }: { label: string; ratio: number; alert: boolean }) {
  const pct = Math.min(ratio * 100, 100)
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span className={alert ? 'font-bold text-red-600' : ''}>{(ratio * 100).toFixed(1)}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            alert ? 'bg-red-500' : 'bg-brand-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function QueueDepth({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="font-semibold text-slate-700">
        {value !== null ? value.toLocaleString() : '—'}
      </span>
    </div>
  )
}
