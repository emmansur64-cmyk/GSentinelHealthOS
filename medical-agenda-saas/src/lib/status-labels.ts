export const CLINIC_STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  active: "Activa",
  suspended: "Suspendida",
  disabled: "Desactivada",
  trial: "Prueba",
  connected: "WhatsApp conectado",
  not_connected: "Sin numero conectado",
  disconnected: "Desconectado",
  error: "Con error",
  token_expired: "Token vencido",
  number_suspended: "Numero suspendido",
};

export function statusBadgeClass(status: string) {
  if (status === "active" || status === "connected") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "suspended" || status === "error") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "disabled" || status === "not_connected") return "border-slate-200 bg-slate-100 text-slate-600";
  return "border-amber-200 bg-amber-50 text-amber-700";
}
