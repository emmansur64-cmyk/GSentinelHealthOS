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
      setMessage("Clinica registrada. El usuario dueño ya puede iniciar sesion.");
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

      {message ? (
        <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {message}
        </p>
      ) : null}
    </form>
  );
}
