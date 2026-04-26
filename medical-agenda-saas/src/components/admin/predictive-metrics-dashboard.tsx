"use client";

import { useEffect, useMemo, useState } from "react";

type DashboardPayload = {
  window_days: number;
  generated_at: string;
  strategy: {
    mode: "heuristic" | "shadow" | "python";
    abTrafficRatio: number;
    maxAllowedDelta: number;
    pythonEndpoint: string | null;
  };
  summary: {
    total_predictions: number;
    resolved_predictions: number;
    resolved_ratio_pct: number | null;
    avg_accuracy_pct: number | null;
    latest_brier_score: number | null;
    latest_no_show_rate_pct: number | null;
    latest_occupancy_rate_pct: number | null;
  };
  trend: Array<{
    date: string;
    total_predictions: number;
    resolved_predictions: number;
    accuracy_pct: number | null;
    brier_score: number | null;
    no_show_rate_pct: number | null;
    occupancy_rate_pct: number | null;
  }>;
  distributions: {
    risk_level: Array<{ key: string; total: number }>;
    model_version: Array<{ key: string; total: number }>;
  };
  top_doctors_low_no_show: Array<{
    doctor_id: string;
    doctor_name: string;
    specialty: string;
    no_show_rate: number;
    sample_size: number;
  }>;
};

function toDisplay(value: number | null | undefined, suffix = ""): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `${value}${suffix}`;
}

function fmtPct(value: number | null | undefined): string {
  return toDisplay(value, "%");
}

export function PredictiveMetricsDashboard() {
  const [days, setDays] = useState<number>(14);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardPayload | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/admin/predictions/dashboard?days=${days}`, {
          method: "GET",
          cache: "no-store",
        });

        const body = (await response.json()) as { ok: boolean; data?: DashboardPayload; error?: { message?: string } };

        if (!response.ok || !body.ok || !body.data) {
          throw new Error(body.error?.message || "No se pudo cargar dashboard");
        }

        if (!cancelled) {
          setData(body.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error inesperado");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [days]);

  const fromDate = useMemo(() => {
    const from = new Date();
    from.setDate(from.getDate() - days);
    return from.toISOString().slice(0, 10);
  }, [days]);

  const toDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Dashboard IA Predictiva</h1>
            <p className="mt-1 text-sm text-slate-500">Monitoreo operativo + exportador de dataset + estrategia Shadow A/B.</p>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="windowDays" className="text-sm font-medium text-slate-600">
              Ventana
            </label>
            <select
              id="windowDays"
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value={7}>7 dias</option>
              <option value={14}>14 dias</option>
              <option value={30}>30 dias</option>
              <option value={60}>60 dias</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <a
            href={`/api/admin/predictions/dataset/export?format=csv&from=${fromDate}&to=${toDate}&limit=50000`}
            className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100"
          >
            Exportar CSV
          </a>
          <a
            href={`/api/admin/predictions/dataset/export?format=parquet&from=${fromDate}&to=${toDate}&limit=50000`}
            className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100"
          >
            Exportar Parquet
          </a>
          <a
            href="/api/admin/predictions/migration-strategy"
            className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-700 hover:bg-emerald-100"
          >
            Ver estrategia Shadow A/B
          </a>
        </div>
      </header>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Cargando metricas predictivas...</div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{error}</div>
      ) : data ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Predicciones</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{data.summary.total_predictions}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Resolucion</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{fmtPct(data.summary.resolved_ratio_pct)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Accuracy promedio</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{fmtPct(data.summary.avg_accuracy_pct)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Brier score actual</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{toDisplay(data.summary.latest_brier_score)}</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">Distribucion de riesgo</h2>
              <div className="mt-3 space-y-2 text-sm">
                {data.distributions.risk_level.length === 0 ? (
                  <p className="text-slate-500">Sin observaciones para el rango seleccionado.</p>
                ) : (
                  data.distributions.risk_level.map((item) => (
                    <div key={item.key} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                      <span className="font-medium text-slate-700">{item.key}</span>
                      <span className="font-semibold text-slate-900">{item.total}</span>
                    </div>
                  ))
                )}
              </div>
            </article>

            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">Shadow mode / A-B</h2>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                <p>
                  <span className="font-medium">Modo activo:</span> {data.strategy.mode}
                </p>
                <p>
                  <span className="font-medium">Trafico candidato:</span> {Math.round(data.strategy.abTrafficRatio * 100)}%
                </p>
                <p>
                  <span className="font-medium">Delta max Brier:</span> {data.strategy.maxAllowedDelta}
                </p>
                <p>
                  <span className="font-medium">Endpoint Python:</span> {data.strategy.pythonEndpoint ?? "No configurado"}
                </p>
              </div>
            </article>
          </div>

          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Tendencia diaria</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Predicciones</th>
                    <th className="px-3 py-2">Resueltas</th>
                    <th className="px-3 py-2">Accuracy</th>
                    <th className="px-3 py-2">Brier</th>
                    <th className="px-3 py-2">No-show</th>
                    <th className="px-3 py-2">Ocupacion</th>
                  </tr>
                </thead>
                <tbody>
                  {data.trend.map((row) => (
                    <tr key={row.date} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-slate-700">{row.date}</td>
                      <td className="px-3 py-2 text-slate-900">{row.total_predictions}</td>
                      <td className="px-3 py-2 text-slate-900">{row.resolved_predictions}</td>
                      <td className="px-3 py-2 text-slate-900">{fmtPct(row.accuracy_pct)}</td>
                      <td className="px-3 py-2 text-slate-900">{toDisplay(row.brier_score)}</td>
                      <td className="px-3 py-2 text-slate-900">{fmtPct(row.no_show_rate_pct)}</td>
                      <td className="px-3 py-2 text-slate-900">{fmtPct(row.occupancy_rate_pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Top medicos con menor no-show</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Medico</th>
                    <th className="px-3 py-2">Especialidad</th>
                    <th className="px-3 py-2">No-show rate</th>
                    <th className="px-3 py-2">Muestra</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_doctors_low_no_show.map((doctor) => (
                    <tr key={doctor.doctor_id} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-slate-900">{doctor.doctor_name}</td>
                      <td className="px-3 py-2 text-slate-700">{doctor.specialty}</td>
                      <td className="px-3 py-2 text-slate-900">{Number((doctor.no_show_rate * 100).toFixed(2))}%</td>
                      <td className="px-3 py-2 text-slate-900">{doctor.sample_size}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </>
      ) : null}
    </section>
  );
}
