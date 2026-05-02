import { CLINIC_STATUS_LABEL, statusBadgeClass } from "@/lib/status-labels";

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex h-6 items-center rounded-full border px-2.5 text-xs font-semibold ${statusBadgeClass(status)}`}>
      {CLINIC_STATUS_LABEL[status] ?? status}
    </span>
  );
}
