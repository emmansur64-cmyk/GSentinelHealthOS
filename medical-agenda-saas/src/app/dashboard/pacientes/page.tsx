"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SearchX, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyStateIllustrated } from "@/components/ui/empty-state-illustrated";

type Patient = {
  id: string;
  name: string;
  document: string;
  contact: string;
  notes?: string | null;
};

type PatientForm = {
  name: string;
  document: string;
  contact: string;
  notes: string;
};

const emptyForm: PatientForm = {
  name: "",
  document: "",
  contact: "",
  notes: "",
};

async function fetchPatients(): Promise<Patient[]> {
  const response = await fetch("/api/patients", { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("No se pudo cargar pacientes");
  const payload = await response.json();
  return payload?.data ?? payload;
}

export default function DashboardPacientesPage() {
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PatientForm>(emptyForm);

  const patientsQuery = useQuery({
    queryKey: ["dashboard", "patients"],
    queryFn: fetchPatients,
    staleTime: 30_000,
  });

  const patients = useMemo(() => {
    const input = Array.isArray(patientsQuery.data) ? patientsQuery.data : [];
    const q = search.trim().toLowerCase();
    if (!q) return input;
    return input.filter(
      (patient) =>
        patient.name.toLowerCase().includes(q) ||
        patient.contact.toLowerCase().includes(q) ||
        patient.document.toLowerCase().includes(q),
    );
  }, [patientsQuery.data, search]);

  const startCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setCreating(true);
  };

  const startEdit = (patient: Patient) => {
    setEditingId(patient.id);
    setForm({
      name: patient.name,
      document: patient.document,
      contact: patient.contact,
      notes: patient.notes ?? "",
    });
    setCreating(true);
  };

  const submit = async () => {
    try {
      const isEdit = Boolean(editingId);
      const url = isEdit ? `/api/patients/${editingId}` : "/api/patients";
      const method = isEdit ? "PUT" : "POST";
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name: form.name,
          document: form.document,
          contact: form.contact,
          notes: form.notes || undefined,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error?.message ?? "No se pudo guardar paciente");
      }

      toast.success(isEdit ? "Paciente actualizado" : "Paciente creado");
      setCreating(false);
      setEditingId(null);
      setForm(emptyForm);
      await patientsQuery.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar paciente");
    }
  };

  const removePatient = async (id: string) => {
    if (!window.confirm("Eliminar paciente?")) return;
    try {
      const response = await fetch(`/api/patients/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error?.message ?? "No se pudo eliminar paciente");
      }
      toast.success("Paciente eliminado");
      await patientsQuery.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar paciente");
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Pacientes</h2>
          <p className="mt-1 text-sm text-slate-500">CRUD clínico de pacientes con documento y contacto.</p>
        </div>

        <div className="flex w-full max-w-xl gap-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre, documento o contacto"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
          />
          <Button onClick={startCreate}>Nuevo</Button>
        </div>
      </div>

      {creating ? (
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-4">
          <Input placeholder="Nombre" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          <Input placeholder="Documento" value={form.document} onChange={(e) => setForm((p) => ({ ...p, document: e.target.value }))} />
          <Input placeholder="Contacto" value={form.contact} onChange={(e) => setForm((p) => ({ ...p, contact: e.target.value }))} />
          <Input placeholder="Notas" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
          <div className="md:col-span-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreating(false)}>Cancelar</Button>
            <Button onClick={() => void submit()}>Guardar</Button>
          </div>
        </div>
      ) : null}

      <div className="rounded-3xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
        <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] border-b border-slate-100 px-5 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
          <span>Paciente</span>
          <span>Documento</span>
          <span>Contacto</span>
          <span>Acciones</span>
        </div>

        <div className="divide-y divide-slate-100">
          {patientsQuery.isLoading ? <p className="px-5 py-6 text-sm text-slate-500">Cargando pacientes...</p> : null}
          {patientsQuery.isError ? <p className="px-5 py-6 text-sm text-rose-600">No se pudo cargar la lista de pacientes.</p> : null}

          {!patientsQuery.isLoading && !patientsQuery.isError && patients.length === 0 ? (
            <EmptyStateIllustrated
              icon={search ? SearchX : Users}
              title={search ? "Sin resultados para tu búsqueda" : "No hay pacientes cargados"}
              description={search ? "Prueba con otro criterio." : "Carga pacientes para operar turnos reales."}
            />
          ) : null}

          {patients.map((patient) => (
            <article key={patient.id} className="grid grid-cols-[1.4fr_1fr_1fr_1fr] items-center gap-3 px-5 py-3">
              <div>
                <p className="font-medium text-slate-900">{patient.name}</p>
                <p className="text-sm text-slate-500">{patient.notes || ""}</p>
              </div>
              <p className="text-sm text-slate-700">{patient.document}</p>
              <p className="text-sm text-slate-700">{patient.contact}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => startEdit(patient)}>Editar</Button>
                <Button size="sm" variant="destructive" onClick={() => void removePatient(patient.id)}>Eliminar</Button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
