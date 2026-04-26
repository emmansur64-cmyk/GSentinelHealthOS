"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app.error]", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center">
      <h1 className="text-xl font-semibold text-slate-900">Ocurrio un error inesperado</h1>
      <p className="max-w-md text-sm text-slate-600">Intenta nuevamente en unos segundos. Si el problema persiste, contacta soporte.</p>
      <Button onClick={reset}>Reintentar</Button>
    </div>
  );
}
