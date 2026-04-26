import { Badge } from "@/components/ui/badge";

type StatusMeta = {
  label: string;
  className: string;
};

const STATUS_META: Record<string, StatusMeta> = {
  scheduled: {
    label: "Pendiente",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  pending: {
    label: "Pendiente",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  confirmed: {
    label: "Confirmado",
    className: "border-sky-200 bg-sky-50 text-sky-700",
  },
  completed: {
    label: "Atendido",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  cancelled: {
    label: "Cancelado",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
  no_show: {
    label: "Ausente",
    className: "border-slate-300 bg-slate-100 text-slate-700",
  },
};

const FALLBACK_META: StatusMeta = {
  label: "En curso",
  className: "border-slate-300 bg-slate-100 text-slate-700",
};

export function getStatusMeta(status?: string): StatusMeta {
  const key = String(status ?? "").trim().toLowerCase();
  return STATUS_META[key] ?? FALLBACK_META;
}

export function StatusBadge({ status, className = "" }: { status?: string; className?: string }) {
  const meta = getStatusMeta(status);
  return <Badge className={`${meta.className} ${className}`.trim()}>{meta.label}</Badge>;
}
