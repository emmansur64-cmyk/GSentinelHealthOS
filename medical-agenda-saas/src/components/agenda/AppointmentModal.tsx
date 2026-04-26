"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Appointment, AppointmentMutationPayload, AppointmentStatus, Doctor, Patient } from "@/components/agenda/types";

type AppointmentModalProps = {
  open: boolean;
  mode: "create" | "edit";
  doctors: Doctor[];
  patients: Patient[];
  selectedDoctorId: string;
  initialDateTime?: string;
  initialDuration?: number;
  appointment?: Appointment | null;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: AppointmentMutationPayload) => Promise<void>;
};

type AppointmentForm = {
  patient_id: string;
  doctor_id: string;
  datetime: string;
  duration: string;
  status: AppointmentStatus;
  source: "manual" | "web" | "whatsapp" | "phone";
  notes: string;
};

const emptyForm: AppointmentForm = {
  patient_id: "",
  doctor_id: "",
  datetime: "",
  duration: "30",
  status: "scheduled",
  source: "manual",
  notes: "",
};

const statusLabels: Record<AppointmentStatus, string> = {
  scheduled: "pendiente",
  confirmed: "confirmado",
  cancelled: "cancelado",
  completed: "atendido",
  no_show: "ausente",
};

function toDateTimeLocalValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const tzOffsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - tzOffsetMs).toISOString().slice(0, 16);
}

function toIsoDateTime(value: string): string {
  return new Date(value).toISOString();
}

export function AppointmentModal({
  open,
  mode,
  doctors,
  patients,
  selectedDoctorId,
  initialDateTime,
  initialDuration,
  appointment,
  submitting,
  onOpenChange,
  onSubmit,
}: AppointmentModalProps) {
  const [form, setForm] = useState<AppointmentForm>(emptyForm);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setSubmitError(null);

    if (mode === "edit" && appointment) {
      setForm({
        patient_id: appointment.patient_id,
        doctor_id: appointment.doctor_id,
        datetime: toDateTimeLocalValue(appointment.datetime),
        duration: String(appointment.duration),
        status: appointment.status,
        source: appointment.source,
        notes: appointment.notes ?? "",
      });
      return;
    }

    setForm((prev) => ({
      ...emptyForm,
      doctor_id: selectedDoctorId !== "all" ? selectedDoctorId : doctors[0]?.user_id ?? "",
      patient_id: patients[0]?.id ?? "",
      datetime: toDateTimeLocalValue(initialDateTime || prev.datetime || new Date().toISOString()),
      duration: String(initialDuration ?? Number(prev.duration || "30")),
    }));
  }, [open, mode, appointment, selectedDoctorId, doctors, patients, initialDateTime, initialDuration]);

  const title = mode === "create" ? "Nuevo turno" : "Editar turno";

  const canSubmit = useMemo(() => {
    return Boolean(
      form.patient_id &&
        form.doctor_id &&
        form.datetime &&
        Number(form.duration) >= 10 &&
        Number(form.duration) <= 240,
    );
  }, [form]);

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSubmitError(null);

    try {
      await onSubmit({
        patient_id: form.patient_id,
        doctor_id: form.doctor_id,
        datetime: toIsoDateTime(form.datetime),
        duration: Number(form.duration),
        status: form.status,
        source: form.source,
        notes: form.notes.trim() || undefined,
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "No se pudo guardar el turno");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase text-slate-500">Paciente</p>
            <Select
              value={form.patient_id}
              onValueChange={(value) => setForm((p) => ({ ...p, patient_id: value ?? "" }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar paciente" />
              </SelectTrigger>
              <SelectContent>
                {patients.map((patient) => (
                  <SelectItem key={patient.id} value={patient.id}>
                    {patient.name} - {patient.document}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase text-slate-500">Medico</p>
            <Select
              value={form.doctor_id}
              onValueChange={(value) => setForm((p) => ({ ...p, doctor_id: value ?? "" }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar medico" />
              </SelectTrigger>
              <SelectContent>
                {doctors.map((doctor) => (
                  <SelectItem key={doctor.user_id} value={doctor.user_id}>
                    {doctor.user.name} - {doctor.specialty}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase text-slate-500">Fecha y hora</p>
            <Input
              type="datetime-local"
              value={form.datetime}
              onChange={(event) => setForm((p) => ({ ...p, datetime: event.target.value }))}
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase text-slate-500">Duracion (min)</p>
            <Input
              type="number"
              min={10}
              max={240}
              value={form.duration}
              onChange={(event) => setForm((p) => ({ ...p, duration: event.target.value }))}
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase text-slate-500">Estado</p>
            <Select value={form.status} onValueChange={(value) => setForm((p) => ({ ...p, status: value as AppointmentStatus }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(statusLabels) as AppointmentStatus[]).map((status) => (
                  <SelectItem key={status} value={status}>
                    {statusLabels[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase text-slate-500">Origen</p>
            <Select
              value={form.source}
              onValueChange={(value) =>
                setForm((p) => ({ ...p, source: value as "manual" | "web" | "whatsapp" | "phone" }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">manual</SelectItem>
                <SelectItem value="web">web</SelectItem>
                <SelectItem value="whatsapp">whatsapp</SelectItem>
                <SelectItem value="phone">phone</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1 md:col-span-2">
            <p className="text-xs font-semibold uppercase text-slate-500">Notas</p>
            <Textarea value={form.notes} onChange={(event) => setForm((p) => ({ ...p, notes: event.target.value }))} />
          </div>
        </div>

        {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={!canSubmit || submitting}>
            {submitting ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
