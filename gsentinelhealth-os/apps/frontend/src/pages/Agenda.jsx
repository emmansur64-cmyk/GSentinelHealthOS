import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";
import { useAppointmentEvents } from "../hooks/useAppointmentEvents";
import AppointmentCard from "./AppointmentCard";
import AppointmentModal from "./AppointmentModal";

const DEFAULT_SETTINGS = {
  appointment_duration: 30,
  buffer_minutes: 10,
  start_time: "08:00",
  end_time: "18:00",
  working_days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
};

const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function timeToMinutes(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours * 60) + minutes;
}

function minutesToTime(value) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function buildSlotsFromSettings(settings) {
  const step = Math.max(10, Number(settings.appointment_duration) + Number(settings.buffer_minutes));
  const start = timeToMinutes(settings.start_time);
  const end = timeToMinutes(settings.end_time);

  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    return ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
  }

  const slots = [];
  for (let value = start; value < end; value += step) {
    slots.push(minutesToTime(value));
  }

  return slots.length ? slots : ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
}

function toInputDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function getErrorMessage(error) {
  if (error?.response?.data?.message) return error.response.data.message;
  if (error instanceof Error) return error.message;
  return "Ocurrio un error inesperado";
}

function fetchAppointments(date) {
  return api.get("/appointments", { params: { date } }).then((response) => response.data);
}

function fetchSettings() {
  return api.get("/settings").then((response) => response.data);
}

export default function Agenda() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(() => toInputDate(new Date()));
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [submitError, setSubmitError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const { connectionStatus } = useAppointmentEvents({
    onEvent: async () => {
      await queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
  });

  const appointmentsQuery = useQuery({
    queryKey: ["appointments", selectedDate],
    queryFn: () => fetchAppointments(selectedDate),
    staleTime: 20_000,
  });

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
    staleTime: 30_000,
  });

  const settings = settingsQuery.data || DEFAULT_SETTINGS;
  const selectedDayKey = DAY_KEYS[new Date(`${selectedDate}T00:00:00`).getDay()];
  const isWorkingDay = settings.working_days.includes(selectedDayKey);

  const timeSlots = useMemo(() => (isWorkingDay ? buildSlotsFromSettings(settings) : []), [settings, isWorkingDay]);

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => api.patch(`/appointments/${id}`, payload),
    onMutate: async ({ id, payload }) => {
      setSubmitError("");
      setSuccessMessage("");

      await queryClient.cancelQueries({ queryKey: ["appointments", selectedDate] });
      const previous = queryClient.getQueryData(["appointments", selectedDate]);

      queryClient.setQueryData(["appointments", selectedDate], (current) => {
        if (!Array.isArray(current)) return current;
        return current.map((item) => {
          if (item.id !== id) return item;
          return {
            ...item,
            ...payload,
          };
        });
      });

      return { previous };
    },
    onSuccess: async () => {
      setSuccessMessage("Turno actualizado en tiempo real.");
      await queryClient.invalidateQueries({ queryKey: ["appointments", selectedDate] });
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["appointments", selectedDate], context.previous);
      }
      setSubmitError(getErrorMessage(error));
    },
  });

  const appointmentsByHour = useMemo(() => {
    const rows = appointmentsQuery.data || [];
    const grouped = new Map();

    for (const hour of timeSlots) grouped.set(hour, []);

    rows.forEach((appointment) => {
      const date = new Date(appointment.datetime);
      if (Number.isNaN(date.getTime())) return;

      const key = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(appointment);
    });

    return grouped;
  }, [appointmentsQuery.data, timeSlots]);

  function openEditModal(appointment) {
    setSubmitError("");
    setSuccessMessage("");
    setSelectedAppointment(appointment);
  }

  function closeModal() {
    if (updateMutation.isPending) return;
    setSelectedAppointment(null);
    setSubmitError("");
    setSuccessMessage("");
  }

  function patchCurrentAppointment(payload) {
    if (!selectedAppointment?.id) return;
    updateMutation.mutate({ id: selectedAppointment.id, payload });
  }

  const isSaving = updateMutation.isPending;

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Agenda</h1>
          <p className="mt-1 text-sm text-slate-500">Gestion de turnos por franja horaria y estado</p>
          <p className="mt-1 text-xs text-slate-400">
            Slot: {settings.appointment_duration} min + buffer {settings.buffer_minutes} min | {settings.start_time} - {settings.end_time}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Actualizacion en vivo: {connectionStatus === "connected" ? "conectado" : connectionStatus}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-slate-600">
            Fecha
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="ml-2 rounded-md border border-slate-300 px-2 py-1 outline-none ring-blue-500 transition focus:ring-2"
            />
          </label>

          <button
            type="button"
            onClick={() => appointmentsQuery.refetch()}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Actualizar
          </button>
        </div>
      </header>

      {successMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{successMessage}</div>
      ) : null}

      {appointmentsQuery.isError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Error al cargar agenda: {getErrorMessage(appointmentsQuery.error)}
        </div>
      ) : null}

      {settingsQuery.isError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          No se pudo cargar la configuracion. Se aplico horario por defecto temporal.
        </div>
      ) : null}

      {!settingsQuery.isError && !isWorkingDay ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          Dia no laborable segun configuracion. No se muestran franjas horarias.
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-[88px_1fr] border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>Hora</span>
          <span>Turnos</span>
        </div>

        <div>
          {timeSlots.map((hour) => {
            const items = appointmentsByHour.get(hour) || [];

            return (
              <div key={hour} className="grid grid-cols-[88px_1fr] border-b border-slate-100 px-4 py-3 last:border-b-0">
                <div className="pt-1 text-sm font-semibold text-slate-600">{hour}</div>
                <div className="space-y-2">
                  {appointmentsQuery.isLoading ? (
                    <div className="h-16 animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
                  ) : items.length ? (
                    items.map((appointment) => (
                      <AppointmentCard
                        key={appointment.id}
                        appointment={appointment}
                        onClick={openEditModal}
                      />
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-sm text-slate-400">
                      Sin turnos en esta franja
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {!timeSlots.length ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">Sin franjas disponibles para la fecha seleccionada.</div>
          ) : null}
        </div>
      </div>

      {selectedAppointment ? (
        <AppointmentModal
          appointment={selectedAppointment}
          onClose={closeModal}
          onConfirm={() => patchCurrentAppointment({ status: "confirmed" })}
          onCancel={() => patchCurrentAppointment({ status: "cancelled" })}
          onReschedule={(payload) => patchCurrentAppointment(payload)}
          isPending={isSaving}
          errorMessage={submitError}
          successMessage={successMessage}
        />
      ) : null}
    </section>
  );
}
