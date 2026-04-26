import { useQuery } from "@tanstack/react-query";

import { api } from "../lib/api";

async function fetchTodayStats() {
  const response = await api.get("/stats/today");
  return response.data;
}

function MetricSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
      <div className="mt-3 h-8 w-16 animate-pulse rounded bg-slate-200" />
    </div>
  );
}

function MetricCard({ title, value, tone }) {
  const toneStyles = {
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
    rose: "border-rose-100 bg-rose-50 text-rose-700",
  };

  return (
    <article className={`rounded-xl border p-4 shadow-sm transition hover:-translate-y-0.5 ${toneStyles[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide">{title}</p>
      <p className="mt-2 text-3xl font-semibold leading-none">{value}</p>
    </article>
  );
}

export default function Dashboard() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["stats", "today"],
    queryFn: fetchTodayStats,
    staleTime: 30_000,
  });

  const metrics = {
    turnosHoy: data?.turnos_hoy ?? 0,
    pacientesEnEspera: data?.pacientes_en_espera ?? 0,
    ocupacion: data?.ocupacion_pct ?? 0,
    cancelaciones: data?.cancelaciones ?? 0,
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Resumen operativo de la jornada</p>
        </div>

        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
        >
          {isFetching ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      {isError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
          <p className="text-sm font-semibold">No se pudo cargar el dashboard.</p>
          <p className="mt-1 text-sm">{error instanceof Error ? error.message : "Error desconocido"}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          <>
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
          </>
        ) : (
          <>
            <MetricCard title="Turnos Hoy" value={metrics.turnosHoy} tone="blue" />
            <MetricCard title="Pacientes en espera" value={metrics.pacientesEnEspera} tone="amber" />
            <MetricCard title="Ocupacion" value={`${metrics.ocupacion}%`} tone="emerald" />
            <MetricCard title="Cancelaciones" value={metrics.cancelaciones} tone="rose" />
          </>
        )}
      </div>
    </section>
  );
}
