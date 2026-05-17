import Link from "next/link";

import { StatusPill } from "@/components/admin/status-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAdminClinics, getRecentAdminAudit, getSuperAdminDashboard } from "@/lib/super-admin";

const metricLabels = [
  ["active_clinics", "Clinicas activas"],
  ["suspended_clinics", "Clinicas suspendidas"],
  ["active_users", "Usuarios activos"],
  ["logins_24h", "Logins ultimas 24 hs"],
  ["whatsapp_connected", "WhatsApp conectados"],
  ["whatsapp_error", "WhatsApp con error"],
  ["appointments_today", "Turnos del dia"],
  ["recent_errors", "Errores recientes"],
] as const;

export default async function AdminDashboardPage() {
  const [metrics, clinics, audit] = await Promise.all([
    getSuperAdminDashboard(),
    getAdminClinics(8),
    getRecentAdminAudit(8),
  ]);

  return (
    <div className="space-y-6">
      {metrics.super_admin_count !== 1 ? (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-sm">
          <p className="text-sm font-semibold">Alerta de administracion global</p>
          <p className="mt-1 text-sm">
            Se detectaron {metrics.super_admin_count} cuentas activas con rol super_admin. El objetivo operativo es mantener una sola cuenta administradora global.
          </p>
        </section>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metricLabels.map(([key, label]) => (
          <div key={key} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{metrics[key]}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Clinicas recientes</h2>
            <Link href="/admin/clinics" className="text-sm font-semibold text-slate-700 hover:text-slate-950">
              Ver todas
            </Link>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Clinica</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Alta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clinics.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-sm text-slate-500">
                    No hay clinicas registradas.
                  </TableCell>
                </TableRow>
              ) : clinics.map((clinic) => (
                <TableRow key={clinic.id}>
                  <TableCell>
                    <Link href={`/admin/clinics/${clinic.id}`} className="font-medium text-slate-950 hover:underline">
                      {clinic.name}
                    </Link>
                    <p className="text-xs text-slate-500">{clinic.email ?? "Sin email"}</p>
                  </TableCell>
                  <TableCell><StatusPill status={clinic.status} /></TableCell>
                  <TableCell><StatusPill status={clinic.whatsapp_status} /></TableCell>
                  <TableCell>{new Date(clinic.created_at).toLocaleDateString("es-AR")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-base font-semibold">Auditoria reciente</h2>
          <div className="space-y-3">
            {audit.length === 0 ? (
              <p className="text-sm text-slate-500">Sin eventos registrados.</p>
            ) : audit.map((item) => (
              <div key={item.id} className="border-b border-slate-100 pb-3 last:border-0">
                <p className="text-sm font-semibold text-slate-900">{item.action}</p>
                <p className="text-xs text-slate-500">{item.clinic_name ?? "Sistema"} · {new Date(item.created_at).toLocaleString("es-AR")}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
