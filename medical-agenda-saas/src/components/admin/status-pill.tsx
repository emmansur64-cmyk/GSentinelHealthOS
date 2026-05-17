type StatusPillProps = {
  status: string | null | undefined;
};

const STATUS_STYLES: Record<string, string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  trial: "border-sky-200 bg-sky-50 text-sky-700",
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  suspended: "border-red-200 bg-red-50 text-red-700",
  disabled: "border-slate-200 bg-slate-100 text-slate-600",
};

export function StatusPill({ status }: StatusPillProps) {
  const normalized = String(status ?? "pending").toLowerCase();
  const style = STATUS_STYLES[normalized] ?? STATUS_STYLES.pending;

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${style}`}>
      {normalized}
    </span>
  );
}

