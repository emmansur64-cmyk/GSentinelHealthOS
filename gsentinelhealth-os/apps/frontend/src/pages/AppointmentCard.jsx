function formatHour(isoDatetime) {
  const date = new Date(isoDatetime);
  if (Number.isNaN(date.getTime())) return "--:--";

  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function computeEndHour(isoDatetime, duration) {
  const start = new Date(isoDatetime);
  if (Number.isNaN(start.getTime())) return "--:--";

  const end = new Date(start.getTime() + duration * 60_000);
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(end);
}

const statusStyles = {
  pending: "border-amber-200 bg-amber-50 text-amber-800",
  confirmed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  cancelled: "border-rose-200 bg-rose-50 text-rose-800",
};

const statusLabels = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  cancelled: "Cancelado",
};

export default function AppointmentCard({ appointment, onClick }) {
  const statusClass = statusStyles[appointment.status] || "border-slate-200 bg-slate-50 text-slate-700";
  const startHour = formatHour(appointment.datetime);
  const endHour = computeEndHour(appointment.datetime, appointment.duration);

  return (
    <button
      type="button"
      onClick={() => onClick(appointment)}
      className={`w-full rounded-lg border px-3 py-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow ${statusClass}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{appointment.patient?.name || "Paciente"}</p>
        <span className="rounded-full border border-current px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">
          {statusLabels[appointment.status] || appointment.status}
        </span>
      </div>

      <p className="mt-1 text-xs font-medium">
        {startHour} - {endHour}
      </p>

      <p className="mt-1 text-xs">Dr/a. {appointment.doctor?.name || "Sin asignar"}</p>

      {appointment.reason ? <p className="mt-1 line-clamp-2 text-xs opacity-90">{appointment.reason}</p> : null}
    </button>
  );
}
