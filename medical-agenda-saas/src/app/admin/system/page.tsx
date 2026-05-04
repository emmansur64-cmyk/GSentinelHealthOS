import { prisma } from "@/lib/prisma";

export default async function AdminSystemPage() {
  const [failedMessages, totals] = await Promise.all([
    prisma.$queryRaw<Array<{ id: string; clinic_id: string; error_message: string; status: string; created_at: Date }>>`
      SELECT id, tenant_id AS clinic_id, error_message, status::text AS status, created_at
      FROM failed_messages ORDER BY created_at DESC LIMIT 20
    `,
    prisma.$queryRaw<Array<{ clinics: number; users: number; appointments: number }>>`
      SELECT
        (SELECT COUNT(*)::int FROM tenants) AS clinics,
        (SELECT COUNT(*)::int FROM users) AS users,
        (SELECT COUNT(*)::int FROM appointments) AS appointments
    `,
  ]);

  const memory = process.memoryUsage();

  return (
    <div className="space-y-6">
      <section className="grid gap-3 md:grid-cols-3">
        <HealthCard label="API" value="ok" />
        <HealthCard label="Base de datos" value="ok" />
        <HealthCard label="Memoria RSS" value={`${Math.round(memory.rss / 1024 / 1024)} MB`} />
      </section>
      <section className="grid gap-3 md:grid-cols-3">
        <HealthCard label="Clinicas" value={String(totals[0]?.clinics ?? 0)} />
        <HealthCard label="Usuarios" value={String(totals[0]?.users ?? 0)} />
        <HealthCard label="Turnos" value={String(totals[0]?.appointments ?? 0)} />
      </section>
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Ultimas excepciones</h2>
        <div className="space-y-3">
          {failedMessages.map((row) => (
            <div key={row.id} className="border-b border-slate-100 pb-3 last:border-0">
              <p className="text-sm font-medium text-slate-900">{row.error_message}</p>
              <p className="text-xs text-slate-500">{row.status} · {row.clinic_id} · {new Date(row.created_at).toLocaleString("es-AR")}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HealthCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>;
}
