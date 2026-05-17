"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  clinicId: string;
};

export function ClinicUserCreateForm({ clinicId }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [role, setRole] = useState("secretaria");
  const [message, setMessage] = useState<string | null>(null);

  const requiresDoctorData = role === "doctor" || role === "medico";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setPending(true);

    const formData = new FormData(event.currentTarget);
    const payload = {
      full_name: String(formData.get("full_name") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      password: String(formData.get("password") ?? ""),
      role,
      specialty: String(formData.get("specialty") ?? "").trim(),
      matricula: String(formData.get("matricula") ?? "").trim(),
      ai_tag: String(formData.get("ai_tag") ?? "").trim(),
    };

    try {
      const response = await fetch(`/api/super-admin/clinics/${clinicId}/users`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "No se pudo crear usuario");
      }

      event.currentTarget.reset();
      setRole("secretaria");
      setMessage("Usuario creado y habilitado para login.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear usuario");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-950">Alta de accesos por rol</h3>
          <p className="text-xs text-slate-600">
            Crear usuarios para panel de secretaria o panel de doctor en esta clinica.
          </p>
        </div>
        <Button type="submit" disabled={pending} className="gap-2">
          {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Crear acceso
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="full_name">Nombre completo</Label>
          <Input id="full_name" name="full_name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Contrasena inicial</Label>
          <Input id="password" name="password" type="password" minLength={8} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">Rol</Label>
          <select
            id="role"
            name="role"
            value={role}
            onChange={(event) => setRole(event.target.value)}
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
          >
            <option value="secretaria">Secretaria</option>
            <option value="receptionist">Recepcion</option>
            <option value="clinic_admin">Admin de clinica</option>
            <option value="doctor">Doctor</option>
          </select>
        </div>
      </div>

      {requiresDoctorData ? (
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="specialty">Especialidad</Label>
            <Input id="specialty" name="specialty" required={requiresDoctorData} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="matricula">Matricula</Label>
            <Input id="matricula" name="matricula" required={requiresDoctorData} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ai_tag">AI Tag (opcional)</Label>
            <Input id="ai_tag" name="ai_tag" />
          </div>
        </div>
      ) : null}

      {message ? (
        <p className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          {message}
        </p>
      ) : null}
    </form>
  );
}
