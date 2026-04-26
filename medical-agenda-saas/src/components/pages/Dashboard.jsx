"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, Clock3, UserRoundX, UsersRound } from "lucide-react";

import { DSButton } from "@/components/design-system";
import { EmptyStateIllustrated } from "@/components/ui/empty-state-illustrated";

async function fetchTodayStats() {
  const response = await fetch("/api/stats/today", {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const message = "No se pudieron cargar las metricas de hoy";
    throw new Error(message);
  }

  const payload = await response.json();
  return payload?.data ?? payload;
}

function MetricSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.08)]">
      <div className="mb-3 h-3 w-28 animate-pulse rounded bg-slate-200" />
      <div className="h-8 w-16 animate-pulse rounded bg-slate-200" />
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, tone }) {
  const toneStyles = {
    blue: {
      label: "text-blue-600",
      value: "text-blue-700",
      icon: "text-blue-500",
      border: "border-blue-100",
    },
    amber: {
      label: "text-amber-600",
      value: "text-amber-700",
      icon: "text-amber-500",
      border: "border-amber-100",
    },
    emerald: {
      label: "text-emerald-600",
      value: "text-emerald-700",
      icon: "text-emerald-500",
      border: "border-emerald-100",
    },
    rose: {
      label: "text-rose-600",
      value: "text-rose-700",
      icon: "text-rose-500",
      border: "border-rose-100",
    },
  };

  const styles = toneStyles[tone];

  return (
    <article
      className={`rounded-xl border bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_6px_14px_rgba(15,23,42,0.12)] ${styles.border}`}
    >
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wide ${styles.label}`}>{title}</p>
          <p className={`mt-2 text-3xl font-semibold leading-none ${styles.value}`}>{value}</p>
        </div>
        <Icon className={`h-6 w-6 ${styles.icon}`} />
      </div>
    </article>
  );
}

export default function Dashboard() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["dashboard", "stats-today"],
    queryFn: fetchTodayStats,
    staleTime: 30_000,
  });

  const metrics = {
    turnosHoy: data?.turnos_hoy ?? data?.turnosHoy ?? 0,
    pacientesEnEspera: data?.pacientes_en_espera ?? data?.pacientesEnEspera ?? 0,
    ocupacion: data?.ocupacion_pct ?? data?.ocupacion ?? 0,
    cancelaciones: data?.cancelaciones ?? 0,
  };

  const noActivity = !isLoading && !isError && metrics.turnosHoy === 0 && metrics.pacientesEnEspera === 0;

  return (
    <section className="space-y-5">
      <div className="surface-card overflow-hidden p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Overview</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">Panel operativo del dia</h2>
            <p className="mt-1 text-sm text-slate-500">Monitorea actividad, espera y ocupacion en tiempo real.</p>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 soft-pulse">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Datos actualizados
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <DSButton variant="secondary" onClick={() => refetch()} loading={isFetching}>
          Actualizar
        </DSButton>
      </div>

      {isError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
          <p className="text-sm font-semibold">No se pudo cargar el dashboard.</p>
          <p className="mt-1 text-sm">{error instanceof Error ? error.message : "Error desconocido"}</p>
          <DSButton type="button" onClick={() => refetch()} variant="danger" className="mt-3">
            Reintentar
          </DSButton>
        </div>
      ) : null}

      <div className="stagger-fade grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          <>
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
          </>
        ) : (
          <>
            <MetricCard title="Turnos Hoy" value={metrics.turnosHoy} icon={Activity} tone="blue" />
            <MetricCard title="Pacientes en espera" value={metrics.pacientesEnEspera} icon={Clock3} tone="amber" />
            <MetricCard title="Ocupacion %" value={`${metrics.ocupacion}%`} icon={UsersRound} tone="emerald" />
            <MetricCard title="Cancelaciones" value={metrics.cancelaciones} icon={UserRoundX} tone="rose" />
          </>
        )}
      </div>

      {noActivity ? (
        <div className="surface-card">
          <EmptyStateIllustrated
            icon={Activity}
            title="Sin actividad registrada por ahora"
            description="Cuando se creen turnos del dia, veras aqui los indicadores operativos en tiempo real."
            action={
              <DSButton variant="secondary" onClick={() => refetch()}>
                Actualizar panel
              </DSButton>
            }
          />
        </div>
      ) : null}
    </section>
  );
}
