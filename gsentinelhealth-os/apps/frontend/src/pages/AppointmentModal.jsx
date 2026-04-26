import { useState } from "react";

function toDatetimeLocalValue(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";

  const timezoneOffsetMs = date.getTimezoneOffset() * 60_000;
  const localDate = new Date(date.getTime() - timezoneOffsetMs);
  return localDate.toISOString().slice(0, 16);
}

function formatHour(isoDatetime) {
  const date = new Date(isoDatetime);
  if (Number.isNaN(date.getTime())) return "--:--";

  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export default function AppointmentModal({
  appointment,
  onClose,
  onConfirm,
  onCancel,
  onReschedule,
  isPending,
  errorMessage,
  successMessage,
}) {
  const [datetime, setDatetime] = useState(() => toDatetimeLocalValue(appointment?.datetime));
  const [duration, setDuration] = useState(() => String(appointment?.duration || 30));
  const [reason, setReason] = useState(() => appointment?.reason || "");

  if (!appointment) return null;

  function handleReschedule(event) {
    event.preventDefault();

    const isoDatetime = new Date(datetime).toISOString();
    onReschedule({
      datetime: isoDatetime,
      duration: Number(duration),
      reason,
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 px-4 py-8">
      <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Gestionar turno</h2>
            <p className="mt-1 text-sm text-slate-500">Acciones de confirmacion, cancelacion y reprogramacion.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-600 transition hover:bg-slate-50"
            disabled={isPending}
          >
            Cerrar
          </button>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <p className="font-semibold">{appointment.patient?.name || "Paciente"}</p>
          <p className="mt-1">Dr/a. {appointment.doctor?.name || "Sin asignar"}</p>
          <p className="mt-1">Horario actual: {formatHour(appointment.datetime)} ({appointment.duration} min)</p>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-60"
          >
            {isPending ? "Procesando..." : "Confirmar turno"}
          </button>

          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800 transition hover:bg-rose-100 disabled:opacity-60"
          >
            {isPending ? "Procesando..." : "Cancelar turno"}
          </button>
        </div>

        <form onSubmit={handleReschedule} className="mt-5 space-y-3 border-t border-slate-200 pt-4">
          <p className="text-sm font-semibold text-slate-800">Reprogramar turno</p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Nueva fecha y hora</span>
              <input
                required
                type="datetime-local"
                value={datetime}
                onChange={(event) => setDatetime(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none ring-blue-500 transition focus:ring-2"
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Duracion (min)</span>
              <input
                required
                type="number"
                min={10}
                max={240}
                step={10}
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none ring-blue-500 transition focus:ring-2"
              />
            </label>
          </div>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Motivo</span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none ring-blue-500 transition focus:ring-2"
              placeholder="Detalle de la reprogramacion"
            />
          </label>

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {isPending ? "Guardando cambios..." : "Reprogramar turno"}
          </button>
        </form>

        {errorMessage ? (
          <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorMessage}</div>
        ) : null}

        {successMessage ? (
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{successMessage}</div>
        ) : null}
      </div>
    </div>
  );
}
