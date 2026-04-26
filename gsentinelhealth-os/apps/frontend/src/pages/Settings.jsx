import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";

const WEEK_DAYS = [
  { value: "monday", label: "Lunes" },
  { value: "tuesday", label: "Martes" },
  { value: "wednesday", label: "Miercoles" },
  { value: "thursday", label: "Jueves" },
  { value: "friday", label: "Viernes" },
  { value: "saturday", label: "Sabado" },
  { value: "sunday", label: "Domingo" },
];

const DEFAULT_SETTINGS = {
  appointment_duration: 30,
  buffer_minutes: 10,
  start_time: "08:00",
  end_time: "18:00",
  working_days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
};

function getErrorMessage(error) {
  if (error?.response?.data?.message) return error.response.data.message;
  if (error instanceof Error) return error.message;
  return "Ocurrio un error inesperado";
}

function fetchSettings() {
  return api.get("/settings").then((response) => response.data);
}

export default function Settings() {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  const [formValues, setFormValues] = useState(DEFAULT_SETTINGS);
  const [isInitialized, setIsInitialized] = useState(false);

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
    staleTime: 30_000,
  });

  const updateMutation = useMutation({
    mutationFn: (payload) => api.post("/settings", payload).then((response) => response.data),
    onSuccess: async (data) => {
      queryClient.setQueryData(["settings"], data);
      await queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setFormValues(data);
      setIsInitialized(true);
      setFeedback({
        type: "success",
        message: "Configuracion guardada. Agenda actualizada automaticamente.",
      });
    },
    onError: (error) => {
      setFeedback({ type: "error", message: getErrorMessage(error) });
    },
  });

  useEffect(() => {
    if (settingsQuery.data && !isInitialized) {
      setFormValues(settingsQuery.data);
      setIsInitialized(true);
    }
  }, [settingsQuery.data, isInitialized]);

  const effectiveValues = isInitialized ? formValues : (settingsQuery.data || DEFAULT_SETTINGS);

  function updateField(field, value) {
    setFeedback({ type: "", message: "" });
    setFormValues((prev) => ({ ...prev, [field]: value }));
  }

  function toggleDay(day) {
    setFeedback({ type: "", message: "" });
    setFormValues((prev) => {
      const exists = prev.working_days.includes(day);
      if (exists) {
        return {
          ...prev,
          working_days: prev.working_days.filter((item) => item !== day),
        };
      }
      return {
        ...prev,
        working_days: [...prev.working_days, day],
      };
    });
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!effectiveValues.working_days.length) {
      setFeedback({ type: "error", message: "Selecciona al menos un dia laboral." });
      return;
    }

    const payload = {
      appointment_duration: Number(effectiveValues.appointment_duration),
      buffer_minutes: Number(effectiveValues.buffer_minutes),
      start_time: effectiveValues.start_time,
      end_time: effectiveValues.end_time,
      working_days: effectiveValues.working_days,
    };

    updateMutation.mutate(payload);
  }

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Configuracion</h1>
        <p className="mt-2 text-sm text-slate-500">Define duracion, buffer y horario operativo de la agenda.</p>
      </header>

      {settingsQuery.isError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Error cargando configuracion: {getErrorMessage(settingsQuery.error)}
        </div>
      ) : null}

      {feedback.message ? (
        <div
          className={`rounded-xl border p-4 text-sm ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Duracion de turno (min)</span>
            <input
              type="number"
              min={10}
              max={180}
              step={5}
              value={effectiveValues.appointment_duration}
              onChange={(event) => updateField("appointment_duration", event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none ring-blue-500 transition focus:ring-2"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Buffer (min)</span>
            <input
              type="number"
              min={0}
              max={120}
              step={5}
              value={effectiveValues.buffer_minutes}
              onChange={(event) => updateField("buffer_minutes", event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none ring-blue-500 transition focus:ring-2"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Inicio jornada</span>
            <input
              type="time"
              value={effectiveValues.start_time}
              onChange={(event) => updateField("start_time", event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none ring-blue-500 transition focus:ring-2"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Fin jornada</span>
            <input
              type="time"
              value={effectiveValues.end_time}
              onChange={(event) => updateField("end_time", event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none ring-blue-500 transition focus:ring-2"
            />
          </label>
        </div>

        <div className="mt-5 space-y-2">
          <p className="text-sm font-medium text-slate-700">Dias de trabajo</p>
          <div className="flex flex-wrap gap-2">
            {WEEK_DAYS.map((day) => {
              const isActive = effectiveValues.working_days.includes(day.value);
              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    isActive
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={settingsQuery.isLoading || updateMutation.isPending}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {updateMutation.isPending ? "Guardando..." : "Guardar configuracion"}
          </button>
        </div>
      </form>
    </section>
  );
}
