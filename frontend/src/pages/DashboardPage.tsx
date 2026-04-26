import AppointmentsTodayCard from '../components/AppointmentsTodayCard'
import HealthStatusCard from '../components/HealthStatusCard'
import MetricsChart from '../components/MetricsChart'
import { useDashboard } from '../hooks/useDashboard'

export default function DashboardPage() {
  const { stats, history, loading, error } = useDashboard()

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar */}
      <header className="border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">GSentinelHealthOS</h1>
            <p className="text-xs text-slate-500">Dashboard de Control — Fase 5</p>
          </div>
          <StatusPill loading={loading} error={error} />
        </div>
      </header>

      {/* Contenido */}
      <main className="mx-auto max-w-6xl px-6 py-8">
        {error && !stats && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            No se pudo conectar con el API: <strong>{error}</strong>. Revisa que el backend
            esté corriendo en <code>http://localhost:8000</code>.
          </div>
        )}

        {loading && !stats ? (
          <Skeleton />
        ) : stats ? (
          <>
            {/* Fila superior: Health + Citas */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="md:col-span-2">
                <HealthStatusCard stats={stats} />
              </div>
              <div>
                <AppointmentsTodayCard
                  count={stats.appointments_today}
                  timestamp={stats.timestamp}
                />
              </div>
            </div>

            {/* Fila inferior: Gráfico de ratios */}
            <div className="mt-6">
              <MetricsChart history={history} />
            </div>

            {/* Pie con metadata */}
            <p className="mt-4 text-center text-xs text-slate-400">
              Actualización automática cada 15 s · Máx. 20 puntos históricos ·&nbsp;
              <a
                href="/api/v1/dashboard/stats"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-brand-500"
              >
                Ver JSON crudo
              </a>
            </p>
          </>
        ) : null}
      </main>
    </div>
  )
}

function StatusPill({ loading, error }: { loading: boolean; error: string | null }) {
  if (loading)
    return (
      <span className="animate-pulse rounded-full bg-slate-200 px-3 py-1 text-xs text-slate-500">
        Cargando…
      </span>
    )
  if (error)
    return (
      <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
        Sin conexión
      </span>
    )
  return (
    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
      ● En vivo
    </span>
  )
}

function Skeleton() {
  return (
    <div className="grid animate-pulse grid-cols-1 gap-6 md:grid-cols-3">
      <div className="h-56 rounded-2xl bg-slate-200 md:col-span-2" />
      <div className="h-56 rounded-2xl bg-slate-200" />
      <div className="col-span-full h-40 rounded-2xl bg-slate-200" />
    </div>
  )
}
