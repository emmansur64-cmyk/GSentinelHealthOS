"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, Clock3, MessageCircle, ShieldCheck, Unplug, UserRoundX, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";

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
    const payload = await response.json().catch(() => null);
    const message = payload?.error?.message ?? `No se pudieron cargar las metricas de hoy (HTTP ${response.status})`;
    throw new Error(message);
  }

  const payload = await response.json();
  return payload?.data ?? payload;
}

async function fetchWhatsappConfig() {
  const response = await fetch("/api/platform/whatsapp/config", {
    headers: { Accept: "application/json" },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error?.message ?? "No se pudo cargar la configuración de WhatsApp");
  }
  return payload.data;
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

const whatsappStatusLabels = {
  NOT_CONFIGURED: "No configurado",
  PENDING_AUTHORIZATION: "Pendiente de autorización",
  CONNECTED: "Conectado",
  AUTHORIZATION_ERROR: "Error de autorización",
  TOKEN_EXPIRED: "Token vencido / requiere reconexión",
  DISCONNECTED: "No configurado",
};

function maskDate(value) {
  return value ? new Date(value).toLocaleString() : "-";
}

function WhatsAppBusinessConfigCard() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["platform", "whatsapp-config"],
    queryFn: fetchWhatsappConfig,
    staleTime: 20_000,
  });
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (data?.whatsappPhoneNumber) setPhone(data.whatsappPhoneNumber);
  }, [data?.whatsappPhoneNumber]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const whatsapp = params.get("whatsapp");
    if (whatsapp === "connected") setMessage({ type: "success", text: "WhatsApp Business conectado correctamente." });
    if (whatsapp === "error") setMessage({ type: "error", text: "No se pudo autorizar la conexión con Meta." });
  }, []);

  async function postJson(url, body) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) throw new Error(payload.error?.message ?? "No se pudo completar la operación");
    return payload.data;
  }

  async function savePhone() {
    setSaving(true);
    setMessage(null);
    try {
      await postJson("/api/platform/whatsapp/register-number", { whatsappPhoneNumber: phone });
      setMessage({ type: "success", text: "Número guardado. Ahora podés autorizar la conexión con Meta." });
      await refetch();
    } catch (caught) {
      setMessage({ type: "error", text: caught instanceof Error ? caught.message : "No se pudo guardar el número" });
    } finally {
      setSaving(false);
    }
  }

  async function connectMeta() {
    setConnecting(true);
    setMessage(null);
    try {
      const result = await postJson("/api/platform/whatsapp/meta/oauth/start");
      if (!result?.url) throw new Error("Meta OAuth no devolvió URL de autorización");
      window.location.assign(result.url);
    } catch (caught) {
      setMessage({ type: "error", text: caught instanceof Error ? caught.message : "No se pudo iniciar la autorización" });
      setConnecting(false);
    }
  }

  async function disconnectWhatsapp() {
    if (!window.confirm("¿Desconectar WhatsApp Business de esta clínica?")) return;
    setDisconnecting(true);
    setMessage(null);
    try {
      await postJson("/api/platform/whatsapp/disconnect");
      setMessage({ type: "success", text: "WhatsApp Business desconectado." });
      await refetch();
    } catch (caught) {
      setMessage({ type: "error", text: caught instanceof Error ? caught.message : "No se pudo desconectar WhatsApp" });
    } finally {
      setDisconnecting(false);
    }
  }

  const status = data?.connectionStatus ?? "NOT_CONFIGURED";
  const statusTone = status === "CONNECTED" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : status === "AUTHORIZATION_ERROR" || status === "TOKEN_EXPIRED" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-700";

  return (
    <article className="surface-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            <MessageCircle className="h-4 w-4 text-emerald-600" />
            Configuración de WhatsApp Business
          </p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">Número oficial de la clínica</h3>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Conecte el número oficial de la clínica para que el sistema pueda operar con WhatsApp Cloud API autorizado por Meta.
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone}`}>
          {whatsappStatusLabels[status] ?? status}
        </span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-slate-700" htmlFor="whatsapp-phone">
            Número WhatsApp Business
          </label>
          <input
            id="whatsapp-phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+549261XXXXXXX"
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          />
          <div className="flex flex-wrap gap-2">
            <DSButton type="button" variant="secondary" onClick={savePhone} loading={saving}>
              Guardar número
            </DSButton>
            <DSButton type="button" onClick={connectMeta} loading={connecting}>
              <ShieldCheck className="h-4 w-4" />
              {status === "CONNECTED" || status === "TOKEN_EXPIRED" ? "Reautorizar conexión" : "Conectar con Meta"}
            </DSButton>
            <DSButton type="button" variant="danger" onClick={disconnectWhatsapp} loading={disconnecting}>
              <Unplug className="h-4 w-4" />
              Desconectar WhatsApp
            </DSButton>
          </div>
          {message ? (
            <p className={`text-sm font-medium ${message.type === "success" ? "text-emerald-700" : "text-rose-700"}`}>{message.text}</p>
          ) : null}
          {isError ? <p className="text-sm font-medium text-rose-700">{error instanceof Error ? error.message : "No se pudo cargar WhatsApp"}</p> : null}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          {isLoading ? (
            <p className="text-sm text-slate-500">Cargando configuración...</p>
          ) : (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Número registrado</dt>
                <dd className="mt-1 font-medium text-slate-900">{data?.whatsappPhoneNumber ?? "-"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estado</dt>
                <dd className="mt-1 font-medium text-slate-900">{whatsappStatusLabels[status] ?? status}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Última autorización</dt>
                <dd className="mt-1 font-medium text-slate-900">{maskDate(data?.lastAuthorizedAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Última verificación</dt>
                <dd className="mt-1 font-medium text-slate-900">{maskDate(data?.lastVerifiedAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Business Account ID</dt>
                <dd className="mt-1 font-medium text-slate-900">{data?.whatsappBusinessAccountIdMasked ?? "-"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone Number ID</dt>
                <dd className="mt-1 font-medium text-slate-900">{data?.whatsappPhoneNumberIdMasked ?? "-"}</dd>
              </div>
            </dl>
          )}
        </div>
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

      <WhatsAppBusinessConfigCard />

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
