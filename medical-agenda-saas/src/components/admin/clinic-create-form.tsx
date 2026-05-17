"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ClinicCreateForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setPending(true);

    const formData = new FormData(event.currentTarget);
    const payload = {
      name: String(formData.get("name") ?? "").trim(),
      legal_name: String(formData.get("legal_name") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim(),
      owner_full_name: String(formData.get("owner_full_name") ?? "").trim(),
      owner_email: String(formData.get("owner_email") ?? "").trim(),
      owner_password: String(formData.get("owner_password") ?? ""),
      secretary_full_name: String(formData.get("secretary_full_name") ?? "").trim(),
      secretary_email: String(formData.get("secretary_email") ?? "").trim(),
      secretary_password: String(formData.get("secretary_password") ?? ""),
      doctor_full_name: String(formData.get("doctor_full_name") ?? "").trim(),
      doctor_email: String(formData.get("doctor_email") ?? "").trim(),
      doctor_password: String(formData.get("doctor_password") ?? ""),
      doctor_specialty: String(formData.get("doctor_specialty") ?? "").trim(),
      doctor_matricula: String(formData.get("doctor_matricula") ?? "").trim(),
      doctor_ai_tag: String(formData.get("doctor_ai_tag") ?? "").trim(),
    };

    try {
      const response = await fetch("/api/super-admin/clinics", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "No se pudo registrar la clinica");
      }

      event.currentTarget.reset();
      setMessage("Clinica registrada. Accesos creados segun roles cargados.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo registrar la clinica");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Registrar cliente</h2>
          <p className="text-sm text-slate-500">Crea una clinica real y su usuario dueño para acceder al panel.</p>
        </div>
        <Button type="submit" disabled={pending} className="gap-2">
          {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Crear
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="name">Clinica</Label>
          <Input id="name" name="name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="legal_name">Razon social</Label>
          <Input id="legal_name" name="legal_name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email de la clinica</Label>
          <Input id="email" name="email" type="email" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Telefono</Label>
          <Input id="phone" name="phone" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="owner_full_name">Responsable</Label>
          <Input id="owner_full_name" name="owner_full_name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="owner_email">Email de acceso</Label>
          <Input id="owner_email" name="owner_email" type="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="owner_password">Contrasena inicial</Label>
          <Input id="owner_password" name="owner_password" type="password" required minLength={8} />
        </div>
      </div>

      <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-3">
        <h3 className="text-sm font-semibold text-slate-900">Acceso opcional para Secretaria</h3>
        <div className="mt-3 grid gap-4 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="secretary_full_name">Nombre secretaria</Label>
            <Input id="secretary_full_name" name="secretary_full_name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="secretary_email">Email secretaria</Label>
            <Input id="secretary_email" name="secretary_email" type="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="secretary_password">Contrasena secretaria</Label>
            <Input id="secretary_password" name="secretary_password" type="password" minLength={8} />
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
        <h3 className="text-sm font-semibold text-slate-900">Acceso opcional para Doctor</h3>
        <div className="mt-3 grid gap-4 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="doctor_full_name">Nombre doctor</Label>
            <Input id="doctor_full_name" name="doctor_full_name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="doctor_email">Email doctor</Label>
            <Input id="doctor_email" name="doctor_email" type="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="doctor_password">Contrasena doctor</Label>
            <Input id="doctor_password" name="doctor_password" type="password" minLength={8} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="doctor_specialty">Especialidad</Label>
            <Input id="doctor_specialty" name="doctor_specialty" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="doctor_matricula">Matricula</Label>
            <Input id="doctor_matricula" name="doctor_matricula" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="doctor_ai_tag">AI Tag (opcional)</Label>
            <Input id="doctor_ai_tag" name="doctor_ai_tag" />
          </div>
        </div>
      </div>

      {message ? (
        <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {message}
        </p>
      ) : null}
    </form>
  );
}
