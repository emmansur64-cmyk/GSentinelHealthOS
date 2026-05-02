"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarPlus, Plus, SearchX, Stethoscope, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { EmptyStateIllustrated } from "@/components/ui/empty-state-illustrated";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type AvailabilityRule = {
  id: string;
  doctor_id: string;
  day_of_week: number;
  specific_date?: string | null;
  start_time: string;
  end_time: string;
  slot_duration: number;
};

type Doctor = {
  user_id: string;
  specialty: string;
  matricula: string;
  ai_tag: string;
  user: { name: string; email: string };
  appointment_duration: number;
  buffer_minutes: number;
  start_time?: string;
  end_time?: string;
  working_days?: string[];
  availability_weekly?: AvailabilityRule[];
};

type ScheduleFormRow = {
  id?: string;
  day_of_week: string;
  specific_date: string;
  start_time: string;
  end_time: string;
  slot_duration: string;
};

type DoctorForm = {
  name: string;
  email: string;
  password: string;
  specialty: string;
  matricula: string;
  ai_tag: string;
  appointment_duration: string;
  buffer_minutes: string;
  start_time: string;
  end_time: string;
  working_days: string;
  schedule: ScheduleFormRow[];
};

const weekDays = [
  { label: "Domingo", value: "0" },
  { label: "Lunes", value: "1" },
  { label: "Martes", value: "2" },
  { label: "Miercoles", value: "3" },
  { label: "Jueves", value: "4" },
  { label: "Viernes", value: "5" },
  { label: "Sabado", value: "6" },
];

const emptyScheduleRow: ScheduleFormRow = {
  day_of_week: "1",
  specific_date: "",
  start_time: "08:00",
  end_time: "12:00",
  slot_duration: "30",
};

const emptyForm: DoctorForm = {
  name: "",
  email: "",
  password: "",
  specialty: "",
  matricula: "",
  ai_tag: "",
  appointment_duration: "30",
  buffer_minutes: "10",
  start_time: "08:00",
  end_time: "18:00",
  working_days: "monday,tuesday,wednesday,thursday,friday",
  schedule: [{ ...emptyScheduleRow }],
};

async function fetchDoctors(): Promise<Doctor[]> {
  const response = await fetch("/api/doctors", { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("No se pudo cargar profesionales");
  const payload = await response.json();
  return payload?.data ?? payload;
}

function dateInputValue(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function buildScheduleRows(doctor: Doctor): ScheduleFormRow[] {
  const rules = doctor.availability_weekly ?? [];
  if (rules.length === 0) {
    return [{
      ...emptyScheduleRow,
      start_time: doctor.start_time ?? "08:00",
      end_time: doctor.end_time ?? "12:00",
      slot_duration: String(doctor.appointment_duration ?? 30),
    }];
  }

  return rules.map((rule) => ({
    id: rule.id,
    day_of_week: String(rule.day_of_week),
    specific_date: dateInputValue(rule.specific_date),
    start_time: rule.start_time,
    end_time: rule.end_time,
    slot_duration: String(rule.slot_duration),
  }));
}

export default function DashboardProfesionalesPage() {
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletedScheduleIds, setDeletedScheduleIds] = useState<string[]>([]);
  const [form, setForm] = useState<DoctorForm>(emptyForm);

  const doctorsQuery = useQuery({
    queryKey: ["dashboard", "doctors"],
    queryFn: fetchDoctors,
    staleTime: 30_000,
  });

  const doctors = useMemo(() => {
    const input = Array.isArray(doctorsQuery.data) ? doctorsQuery.data : [];
    const q = search.trim().toLowerCase();
    if (!q) return input;
    return input.filter(
      (doctor) =>
        doctor.user?.name?.toLowerCase().includes(q) ||
        doctor.specialty?.toLowerCase().includes(q) ||
        doctor.matricula?.toLowerCase().includes(q),
    );
  }, [doctorsQuery.data, search]);

  const startCreate = () => {
    setEditingId(null);
    setDeletedScheduleIds([]);
    setForm(emptyForm);
    setCreating(true);
  };

  const startEdit = (doctor: Doctor) => {
    setCreating(true);
    setEditingId(doctor.user_id);
    setDeletedScheduleIds([]);
    setForm({
      name: doctor.user.name,
      email: doctor.user.email,
      password: "",
      specialty: doctor.specialty,
      matricula: doctor.matricula,
      ai_tag: doctor.ai_tag,
      appointment_duration: String(doctor.appointment_duration ?? 30),
      buffer_minutes: String(doctor.buffer_minutes ?? 10),
      start_time: doctor.start_time ?? "08:00",
      end_time: doctor.end_time ?? "18:00",
      working_days: (doctor.working_days ?? ["monday", "tuesday", "wednesday", "thursday", "friday"]).join(","),
      schedule: buildScheduleRows(doctor),
    });
  };

  const setScheduleRow = (index: number, patch: Partial<ScheduleFormRow>) => {
    setForm((prev) => ({
      ...prev,
      schedule: prev.schedule.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    }));
  };

  const addScheduleRow = () => {
    setForm((prev) => ({
      ...prev,
      schedule: [
        ...prev.schedule,
        {
          ...emptyScheduleRow,
          slot_duration: prev.appointment_duration || "30",
        },
      ],
    }));
  };

  const removeScheduleRow = (index: number) => {
    setForm((prev) => {
      const row = prev.schedule[index];
      if (row?.id) setDeletedScheduleIds((ids) => [...ids, row.id!]);
      const next = prev.schedule.filter((_, rowIndex) => rowIndex !== index);
      return { ...prev, schedule: next.length > 0 ? next : [{ ...emptyScheduleRow }] };
    });
  };

  const validateSchedule = () => {
    for (const row of form.schedule) {
      if (!row.start_time || !row.end_time || row.start_time >= row.end_time) {
        return "Cada disponibilidad debe tener hora inicio anterior a hora fin";
      }
      const duration = Number(row.slot_duration);
      if (!Number.isInteger(duration) || duration < 10 || duration > 180) {
        return "La duracion de turno debe estar entre 10 y 180 minutos";
      }
    }
    return null;
  };

  const syncSchedules = async (doctorId: string) => {
    for (const id of deletedScheduleIds) {
      const response = await fetch(`/api/schedules/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("No se pudo eliminar una disponibilidad anterior");
    }

    for (const row of form.schedule) {
      const payload = {
        doctor_id: doctorId,
        day_of_week: Number(row.day_of_week),
        specific_date: row.specific_date || null,
        start_time: row.start_time,
        end_time: row.end_time,
        slot_duration: Number(row.slot_duration),
      };
      const response = await fetch(row.id ? `/api/schedules/${row.id}` : "/api/schedules", {
        method: row.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(row.id ? {
          day_of_week: payload.day_of_week,
          specific_date: payload.specific_date,
          start_time: payload.start_time,
          end_time: payload.end_time,
          slot_duration: payload.slot_duration,
        } : payload),
      });
      if (!response.ok) {
        const payloadError = await response.json().catch(() => null);
        throw new Error(payloadError?.error?.message ?? "No se pudo guardar disponibilidad");
      }
    }
  };

  const submit = async () => {
    const scheduleError = validateSchedule();
    if (scheduleError) {
      toast.error(scheduleError);
      return;
    }

    setSaving(true);
    try {
      const isEdit = Boolean(editingId);
      const url = isEdit ? `/api/doctors/${editingId}` : "/api/doctors";
      const method = isEdit ? "PATCH" : "POST";
      const workingDays = form.working_days.split(",").map((day) => day.trim()).filter(Boolean);
      const body = isEdit
        ? {
            name: form.name,
            specialty: form.specialty,
            matricula: form.matricula,
            ai_tag: form.ai_tag,
            appointment_duration: Number(form.appointment_duration),
            buffer_minutes: Number(form.buffer_minutes),
            start_time: form.start_time,
            end_time: form.end_time,
            working_days: workingDays,
          }
        : {
            name: form.name,
            email: form.email,
            password: form.password,
            specialty: form.specialty,
            matricula: form.matricula,
            ai_tag: form.ai_tag,
            appointment_duration: Number(form.appointment_duration),
            buffer_minutes: Number(form.buffer_minutes),
            start_time: form.start_time,
            end_time: form.end_time,
            working_days: workingDays,
          };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error?.message ?? "No se pudo guardar profesional");
      }

      const payload = await response.json().catch(() => null);
      const doctorId = editingId ?? payload?.data?.id ?? payload?.id;
      if (!doctorId) throw new Error("No se pudo resolver el medico guardado");
      await syncSchedules(doctorId);

      toast.success(isEdit ? "Profesional y agenda actualizados" : "Profesional y agenda creados");
      setCreating(false);
      setEditingId(null);
      setDeletedScheduleIds([]);
      setForm(emptyForm);
      await doctorsQuery.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar profesional");
    } finally {
      setSaving(false);
    }
  };

  const removeDoctor = async (id: string) => {
    if (!window.confirm("Eliminar profesional y su configuración?")) return;
    try {
      const response = await fetch(`/api/doctors/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error?.message ?? "No se pudo eliminar profesional");
      }
      toast.success("Profesional eliminado");
      await doctorsQuery.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar profesional");
    }
  };

  return (
    <section className="space-y-5" suppressHydrationWarning>
      <div className="flex flex-wrap items-end justify-between gap-3" suppressHydrationWarning>
        <div suppressHydrationWarning>
          <h2 className="text-2xl font-semibold text-slate-900">Profesionales</h2>
          <p className="mt-1 text-sm text-slate-500">Alta, edición y disponibilidad de médicos.</p>
        </div>

        <div className="flex w-full max-w-xl gap-2" suppressHydrationWarning>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre, especialidad o matricula"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
          />
          <Button onClick={startCreate}>Nuevo</Button>
        </div>
      </div>

      {creating ? (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4" suppressHydrationWarning>
          <div className="grid gap-3 md:grid-cols-4">
            <Input placeholder="Nombre" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
            <Input placeholder="Email" value={form.email} disabled={Boolean(editingId)} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} />
            <Input placeholder="Password inicial (min 12)" type="password" value={form.password} onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))} disabled={Boolean(editingId)} />
            <Input placeholder="Especialidad" value={form.specialty} onChange={(event) => setForm((prev) => ({ ...prev, specialty: event.target.value }))} />
            <Input placeholder="Matricula" value={form.matricula} onChange={(event) => setForm((prev) => ({ ...prev, matricula: event.target.value }))} />
            <Input placeholder="AI tag" value={form.ai_tag} onChange={(event) => setForm((prev) => ({ ...prev, ai_tag: event.target.value }))} />
            <Input placeholder="Duracion turno" type="number" value={form.appointment_duration} onChange={(event) => setForm((prev) => ({ ...prev, appointment_duration: event.target.value }))} />
            <Input placeholder="Buffer" type="number" value={form.buffer_minutes} onChange={(event) => setForm((prev) => ({ ...prev, buffer_minutes: event.target.value }))} />
            <Input type="time" value={form.start_time} onChange={(event) => setForm((prev) => ({ ...prev, start_time: event.target.value }))} />
            <Input type="time" value={form.end_time} onChange={(event) => setForm((prev) => ({ ...prev, end_time: event.target.value }))} />
            <Input className="md:col-span-2" placeholder="Dias laborales: monday,tuesday,..." value={form.working_days} onChange={(event) => setForm((prev) => ({ ...prev, working_days: event.target.value }))} />
          </div>

          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">Disponibilidad de agenda</p>
                <p className="text-xs text-slate-500">Usa fecha especifica para cargar un dia del mes. Si queda vacia, la regla se repite semanalmente.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addScheduleRow}>
                <Plus className="mr-1 h-4 w-4" />
                Agregar horario
              </Button>
            </div>

            <div className="space-y-2">
              {form.schedule.map((row, index) => (
                <div key={`${row.id ?? "new"}-${index}`} className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto]">
                  <div className="space-y-1">
                    <Label>Dia</Label>
                    <Select value={row.day_of_week} onValueChange={(value) => setScheduleRow(index, { day_of_week: value ?? "1" })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {weekDays.map((day) => (
                          <SelectItem key={day.value} value={day.value}>
                            {day.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Fecha del mes</Label>
                    <Input type="date" value={row.specific_date} onChange={(event) => setScheduleRow(index, { specific_date: event.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Desde</Label>
                    <Input type="time" value={row.start_time} onChange={(event) => setScheduleRow(index, { start_time: event.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Hasta</Label>
                    <Input type="time" value={row.end_time} onChange={(event) => setScheduleRow(index, { end_time: event.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Duracion</Label>
                    <Input type="number" min={10} value={row.slot_duration} onChange={(event) => setScheduleRow(index, { slot_duration: event.target.value })} />
                  </div>
                  <div className="flex items-end">
                    <Button type="button" variant="outline" size="icon" title="Quitar horario" onClick={() => removeScheduleRow(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreating(false)}>Cancelar</Button>
            <Button disabled={saving} onClick={() => void submit()}>{saving ? "Guardando..." : "Guardar"}</Button>
          </div>
        </div>
      ) : null}

      <div className="rounded-3xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]" suppressHydrationWarning>
        <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr_1fr_1fr] border-b border-slate-100 px-5 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500" suppressHydrationWarning>
          <span>Profesional</span>
          <span>Especialidad</span>
          <span>Matricula</span>
          <span>Duracion</span>
          <span>Disponibilidad</span>
          <span>Acciones</span>
        </div>

        <div className="divide-y divide-slate-100" suppressHydrationWarning>
          {doctorsQuery.isLoading ? <p className="px-5 py-6 text-sm text-slate-500">Cargando profesionales...</p> : null}
          {doctorsQuery.isError ? <p className="px-5 py-6 text-sm text-rose-600">No se pudo cargar el directorio médico.</p> : null}

          {!doctorsQuery.isLoading && !doctorsQuery.isError && doctors.length === 0 ? (
            <EmptyStateIllustrated
              icon={search ? SearchX : Stethoscope}
              title={search ? "Sin resultados para tu busqueda" : "No hay medicos cargados"}
              description={search ? "Prueba con otro criterio." : "Carga profesionales para habilitar agenda clinica."}
            />
          ) : null}

          {doctors.map((doctor) => (
            <article key={doctor.user_id} className="grid grid-cols-[1.2fr_1fr_1fr_1fr_1fr_1fr] items-center gap-3 px-5 py-3">
              <div>
                <p className="font-medium text-slate-900">{doctor.user?.name}</p>
                <p className="text-sm text-slate-500">{doctor.user?.email}</p>
              </div>
              <p className="text-sm text-slate-700">{doctor.specialty}</p>
              <p className="text-sm text-slate-700">{doctor.matricula}</p>
              <p className="text-sm text-slate-700">{doctor.appointment_duration} min</p>
              <p className="flex items-center gap-1 text-sm text-slate-700">
                <CalendarPlus className="h-4 w-4 text-slate-500" />
                {doctor.availability_weekly?.length ?? 0} reglas
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => startEdit(doctor)}>Editar</Button>
                <Button size="sm" variant="destructive" onClick={() => void removeDoctor(doctor.user_id)}>Eliminar</Button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
