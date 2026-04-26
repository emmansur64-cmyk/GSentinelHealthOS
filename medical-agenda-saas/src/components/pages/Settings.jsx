"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { DSButton, DSCard, DSCardContent, DSCardDescription, DSCardHeader, DSCardTitle, DSInput } from "@/components/design-system";

const WEEK_DAYS = [
  { value: "monday", label: "Lunes" },
  { value: "tuesday", label: "Martes" },
  { value: "wednesday", label: "Miercoles" },
  { value: "thursday", label: "Jueves" },
  { value: "friday", label: "Viernes" },
  { value: "saturday", label: "Sabado" },
  { value: "sunday", label: "Domingo" },
];

const DEFAULT_FORM = {
  appointmentDuration: "30",
  bufferMinutes: "10",
  startTime: "08:00",
  endTime: "18:00",
  workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
};

function minutesFromTime(time) {
  const [h, m] = String(time).split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  return h * 60 + m;
}

function normalizeSettings(data) {
  if (!data || typeof data !== "object") return DEFAULT_FORM;

  const workingDays = Array.isArray(data.working_days)
    ? data.working_days
    : Array.isArray(data.workingDays)
      ? data.workingDays
      : DEFAULT_FORM.workingDays;

  return {
    appointmentDuration: String(data.appointment_duration ?? data.appointmentDuration ?? DEFAULT_FORM.appointmentDuration),
    bufferMinutes: String(data.buffer_minutes ?? data.bufferMinutes ?? DEFAULT_FORM.bufferMinutes),
    startTime: String(data.start_time ?? data.startTime ?? DEFAULT_FORM.startTime),
    endTime: String(data.end_time ?? data.endTime ?? DEFAULT_FORM.endTime),
    workingDays,
  };
}

function validateForm(form) {
  const errors = {};

  const appointmentDuration = Number(form.appointmentDuration);
  const bufferMinutes = Number(form.bufferMinutes);
  const startMinutes = minutesFromTime(form.startTime);
  const endMinutes = minutesFromTime(form.endTime);

  if (!Number.isFinite(appointmentDuration) || appointmentDuration < 10 || appointmentDuration > 180) {
    errors.appointmentDuration = "La duracion debe estar entre 10 y 180 minutos.";
  }

  if (!Number.isFinite(bufferMinutes) || bufferMinutes < 0 || bufferMinutes > 120) {
    errors.bufferMinutes = "El buffer debe estar entre 0 y 120 minutos.";
  }

  if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) {
    errors.timeRange = "El horario ingresado no es valido.";
  } else if (startMinutes >= endMinutes) {
    errors.timeRange = "La hora de inicio debe ser menor a la hora de fin.";
  }

  if (!Array.isArray(form.workingDays) || form.workingDays.length === 0) {
    errors.workingDays = "Selecciona al menos un dia laboral.";
  }

  return errors;
}

async function fetchSettings() {
  const response = await fetch("/api/settings", {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error("No se pudo cargar la configuracion");
  }

  const payload = await response.json();
  return payload?.data ?? payload;
}

async function saveSettings(payload) {
  const response = await fetch("/api/settings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("No se pudo guardar la configuracion");
  }

  const payloadData = await response.json().catch(() => ({}));
  return payloadData?.data ?? payloadData;
}

function SettingsSkeleton() {
  return (
    <DSCard>
      <DSCardContent className="space-y-3">
        <div className="h-9 animate-pulse rounded bg-slate-100" />
        <div className="h-9 animate-pulse rounded bg-slate-100" />
        <div className="h-9 animate-pulse rounded bg-slate-100" />
        <div className="h-9 animate-pulse rounded bg-slate-100" />
      </DSCardContent>
    </DSCard>
  );
}

export default function Settings() {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [errors, setErrors] = useState({});
  const [isDirty, setIsDirty] = useState(false);

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!settingsQuery.data) return;
    const normalized = normalizeSettings(settingsQuery.data);
    setForm(normalized);
    setErrors({});
    setIsDirty(false);
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: saveSettings,
    onSuccess: (saved) => {
      const normalized = normalizeSettings(saved);
      setForm(normalized);
      setErrors({});
      setIsDirty(false);
      toast.success("Configuracion guardada correctamente");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la configuracion");
    },
  });

  const statusMessage = useMemo(() => {
    if (saveMutation.isPending) return "Guardando cambios...";
    if (saveMutation.isSuccess) return "Cambios guardados.";
    if (saveMutation.isError) return "No se pudo guardar. Revisa el formulario e intenta nuevamente.";
    return null;
  }, [saveMutation.isError, saveMutation.isPending, saveMutation.isSuccess]);

  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const toggleWorkingDay = (day) => {
    setForm((prev) => {
      const exists = prev.workingDays.includes(day);
      const nextDays = exists ? prev.workingDays.filter((item) => item !== day) : [...prev.workingDays, day];
      return { ...prev, workingDays: nextDays };
    });
    setIsDirty(true);
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const payload = {
      appointment_duration: Number(form.appointmentDuration),
      buffer_minutes: Number(form.bufferMinutes),
      start_time: form.startTime,
      end_time: form.endTime,
      working_days: form.workingDays,
    };

    saveMutation.mutate(payload);
  };

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Configuracion de Agenda</h1>
        <p className="text-sm text-slate-500">Define reglas base para turnos y disponibilidad laboral</p>
      </div>

      {settingsQuery.isLoading ? <SettingsSkeleton /> : null}

      {settingsQuery.isError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <p className="font-semibold">No se pudo cargar la configuracion.</p>
          <p className="mt-1">{settingsQuery.error instanceof Error ? settingsQuery.error.message : "Error desconocido"}</p>
          <DSButton className="mt-3" variant="danger" size="sm" onClick={() => settingsQuery.refetch()}>
            Reintentar
          </DSButton>
        </div>
      ) : null}

      {!settingsQuery.isLoading ? (
        <DSCard>
          <DSCardHeader>
            <DSCardTitle>Ajustes operativos</DSCardTitle>
            <DSCardDescription>Define reglas base de agenda para toda la operacion</DSCardDescription>
          </DSCardHeader>

          <DSCardContent>
            <form className="space-y-4" onSubmit={handleSubmit} noValidate>
              <div className="grid gap-4 md:grid-cols-2">
                <DSInput
                  type="number"
                  min={10}
                  max={180}
                  label="Duracion turno (min)"
                  value={form.appointmentDuration}
                  error={errors.appointmentDuration}
                  onChange={(event) => setField("appointmentDuration", event.target.value)}
                />

                <DSInput
                  type="number"
                  min={0}
                  max={120}
                  label="Buffer entre pacientes (min)"
                  value={form.bufferMinutes}
                  error={errors.bufferMinutes}
                  onChange={(event) => setField("bufferMinutes", event.target.value)}
                />

                <DSInput
                  type="time"
                  label="Horario inicio"
                  value={form.startTime}
                  onChange={(event) => setField("startTime", event.target.value)}
                />

                <DSInput
                  type="time"
                  label="Horario fin"
                  value={form.endTime}
                  onChange={(event) => setField("endTime", event.target.value)}
                />
              </div>

              {errors.timeRange ? (
                <p className="text-sm text-rose-600">{errors.timeRange}</p>
              ) : null}

              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">Dias laborales</p>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {WEEK_DAYS.map((day) => {
                    const checked = form.workingDays.includes(day.value);
                    return (
                      <label
                        key={day.value}
                        className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${
                          checked
                            ? "border-[#2563EB] bg-blue-50 text-blue-700"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleWorkingDay(day.value)}
                          className="h-4 w-4 rounded border-slate-300 text-[#2563EB]"
                        />
                        <span>{day.label}</span>
                      </label>
                    );
                  })}
                </div>
                {errors.workingDays ? <p className="text-sm text-rose-600">{errors.workingDays}</p> : null}
              </div>

              {statusMessage ? (
                <p
                  className={`text-sm ${
                    saveMutation.isError
                      ? "text-rose-600"
                      : saveMutation.isPending
                        ? "text-slate-600"
                        : "text-emerald-600"
                  }`}
                >
                  {statusMessage}
                </p>
              ) : null}

              <div className="flex justify-end gap-2">
                <DSButton
                  type="button"
                  variant="secondary"
                  disabled={!isDirty || saveMutation.isPending}
                  onClick={() => {
                    if (!settingsQuery.data) return;
                    setForm(normalizeSettings(settingsQuery.data));
                    setErrors({});
                    setIsDirty(false);
                  }}
                >
                  Restablecer
                </DSButton>
                <DSButton type="submit" loading={saveMutation.isPending} disabled={!isDirty}>
                  Guardar configuracion
                </DSButton>
              </div>
            </form>
          </DSCardContent>
        </DSCard>
      ) : null}
    </section>
  );
}
