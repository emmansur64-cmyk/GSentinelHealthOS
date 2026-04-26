"use client";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  console.error("[app.global-error]", {
    message: error.message,
    digest: error.digest,
  });

  return (
    <html lang="es">
      <body className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="rounded-lg border bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Error critico de aplicacion</h1>
          <p className="mt-2 text-sm text-slate-600">Recarga la pagina para recuperar la sesion.</p>
        </div>
      </body>
    </html>
  );
}
