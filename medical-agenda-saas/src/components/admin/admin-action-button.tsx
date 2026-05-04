"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function AdminActionButton({
  label,
  endpoint,
  method = "PATCH",
  body,
  confirmText,
  variant = "outline",
}: {
  label: string;
  endpoint: string;
  method?: "PATCH" | "DELETE" | "POST";
  body?: Record<string, unknown>;
  confirmText?: string;
  variant?: "default" | "outline" | "destructive";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function run() {
    let finalBody = body ?? {};
    if (confirmText) {
      const value = window.prompt(`Escribi ${confirmText} para confirmar`);
      if (value !== confirmText) return;
      finalBody = { ...finalBody, confirmation: confirmText };
    }

    setPending(true);
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(finalBody),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error?.message ?? "No se pudo completar la accion");
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button size="sm" variant={variant} disabled={pending} onClick={run}>
      {pending ? "Procesando" : label}
    </Button>
  );
}
