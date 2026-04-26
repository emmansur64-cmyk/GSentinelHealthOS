"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SearchX, Stethoscope } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyStateIllustrated } from "@/components/ui/empty-state-illustrated";

type Doctor = {
  user_id: string;
  specialty: string;
  matricula: string;
  ai_tag: string;
  user: { name: string; email: string };
  appointment_duration: number;
  buffer_minutes: number;
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
};

async function fetchDoctors(): Promise<Doctor[]> {
  const response = await fetch("/api/doctors", { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("No se pudo cargar profesionales");
  const payload = await response.json();
  return payload?.data ?? payload;
}

export default function DashboardProfesionalesPage() {
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
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
    setForm(emptyForm);
    setCreating(true);
  };

  const startEdit = (doctor: Doctor) => {
    setCreating(true);
    setEditingId(doctor.user_id);
    setForm({
      name: doctor.user.name,
      email: doctor.user.email,
      password: "",
      specialty: doctor.specialty,
      matricula: doctor.matricula,
      ai_tag: doctor.ai_tag,
      appointment_duration: String(doctor.appointment_duration ?? 30),
      buffer_minutes: String(doctor.buffer_minutes ?? 10),
    });
  };

  const submit = async () => {
    try {
      const isEdit = Boolean(editingId);
      const url = isEdit ? `/api/doctors/${editingId}` : "/api/doctors";
      const method = isEdit ? "PATCH" : "POST";
      const body = isEdit
        ? {
            name: form.name,
            specialty: form.specialty,
            matricula: form.matricula,
            ai_tag: form.ai_tag,
            appointment_duration: Number(form.appointment_duration),
            buffer_minutes: Number(form.buffer_minutes),
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

      toast.success(isEdit ? "Profesional actualizado" : "Profesional creado");
      setCreating(false);
      setEditingId(null);
      setForm(emptyForm);
      await doctorsQuery.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar profesional");
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
          <p className="mt-1 text-sm text-slate-500">CRUD operativo de médicos con configuración de agenda.</p>
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
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-4" suppressHydrationWarning>
          <Input placeholder="Nombre" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          <Input placeholder="Email" value={form.email} disabled={Boolean(editingId)} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
          <Input placeholder="Password inicial (min 12)" type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} disabled={Boolean(editingId)} />
          <Input placeholder="Especialidad" value={form.specialty} onChange={(e) => setForm((p) => ({ ...p, specialty: e.target.value }))} />
          <Input placeholder="Matrícula" value={form.matricula} onChange={(e) => setForm((p) => ({ ...p, matricula: e.target.value }))} />
          <Input placeholder="AI tag" value={form.ai_tag} onChange={(e) => setForm((p) => ({ ...p, ai_tag: e.target.value }))} />
          <Input placeholder="Duración" type="number" value={form.appointment_duration} onChange={(e) => setForm((p) => ({ ...p, appointment_duration: e.target.value }))} />
          <Input placeholder="Buffer" type="number" value={form.buffer_minutes} onChange={(e) => setForm((p) => ({ ...p, buffer_minutes: e.target.value }))} />
          <div className="md:col-span-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreating(false)}>Cancelar</Button>
            <Button onClick={() => void submit()}>Guardar</Button>
          </div>
        </div>
      ) : null}

      <div className="rounded-3xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]" suppressHydrationWarning>
        <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr_1fr] border-b border-slate-100 px-5 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500" suppressHydrationWarning>
          <span>Profesional</span>
          <span>Especialidad</span>
          <span>Matrícula</span>
          <span>Duración</span>
          <span>Acciones</span>
        </div>

        <div className="divide-y divide-slate-100" suppressHydrationWarning>
          {doctorsQuery.isLoading ? <p className="px-5 py-6 text-sm text-slate-500">Cargando profesionales...</p> : null}
          {doctorsQuery.isError ? <p className="px-5 py-6 text-sm text-rose-600">No se pudo cargar el directorio médico.</p> : null}

          {!doctorsQuery.isLoading && !doctorsQuery.isError && doctors.length === 0 ? (
            <EmptyStateIllustrated
              icon={search ? SearchX : Stethoscope}
              title={search ? "Sin resultados para tu búsqueda" : "No hay médicos cargados"}
              description={search ? "Prueba con otro criterio." : "Carga profesionales para habilitar agenda clínica."}
            />
          ) : null}

          {doctors.map((doctor) => (
            <article key={doctor.user_id} className="grid grid-cols-[1.2fr_1fr_1fr_1fr_1fr] items-center gap-3 px-5 py-3">
              <div>
                <p className="font-medium text-slate-900">{doctor.user?.name}</p>
                <p className="text-sm text-slate-500">{doctor.user?.email}</p>
              </div>
              <p className="text-sm text-slate-700">{doctor.specialty}</p>
              <p className="text-sm text-slate-700">{doctor.matricula}</p>
              <p className="text-sm text-slate-700">{doctor.appointment_duration} min</p>
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
