"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function NotificationForm({ clinics }: { clinics: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const clinicId = String(formData.get("clinic_id") ?? "");
    setPending(true);
    try {
      const response = await fetch("/api/super-admin/notifications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clinic_id: clinicId === "all" ? null : clinicId,
          title: formData.get("title"),
          message: formData.get("message"),
          type: formData.get("type"),
          channel: "panel",
        }),
      });
      if (!response.ok) throw new Error("No se pudo enviar");
      event.currentTarget.reset();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-2">
      <label className="space-y-1 text-sm font-medium">
        Destinatario
        <select name="clinic_id" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm">
          <option value="all">Todas las clinicas</option>
          {clinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.name}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-sm font-medium">
        Tipo
        <select name="type" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" defaultValue="general">
          <option value="general">General</option>
          <option value="maintenance">Mantenimiento</option>
          <option value="update">Actualizacion</option>
          <option value="billing">Facturacion</option>
          <option value="warning">Advertencia</option>
        </select>
      </label>
      <label className="space-y-1 text-sm font-medium lg:col-span-2">
        Titulo
        <input name="title" required className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" />
      </label>
      <label className="space-y-1 text-sm font-medium lg:col-span-2">
        Mensaje
        <textarea name="message" required rows={4} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </label>
      <div className="lg:col-span-2">
        <Button type="submit" disabled={pending}>{pending ? "Enviando" : "Enviar notificacion"}</Button>
      </div>
    </form>
  );
}
