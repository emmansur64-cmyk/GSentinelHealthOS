import Link from "next/link";
import { AdminActionButton } from "@/components/admin/admin-action-button";
import { ClinicUserCreateForm } from "@/components/admin/clinic-user-create-form";
import { StatusPill } from "@/components/admin/status-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { getRecentAdminAudit } from "@/lib/super-admin";

export default async function AdminClinicDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [clinicRows, users, whatsapp, appointments, errors, notifications, audit] = await Promise.all([
    prisma.$queryRaw<Array<{
      id: string; name: string; legal_name: string | null; email: string | null; phone: string | null;
      status: string; maintenance_mode: boolean; created_at: Date; updated_at: Date;
    }>>`SELECT id, nombre AS name, legal_name, email, phone, estado::text AS status, maintenance_mode, created_at, updated_at FROM tenants WHERE id = ${id} LIMIT 1`,
    prisma.$queryRaw<Array<{ id: string; full_name: string; email: string; role: string; status: string; last_login_at: Date | null; last_seen_at: Date | null }>>`
      SELECT id, name AS full_name, email, role::text AS role, COALESCE(status, 'active') AS status, last_login_at, last_seen_at
      FROM users WHERE tenant_id = ${id} ORDER BY created_at DESC LIMIT 50
    `,
    prisma.$queryRaw<Array<{ status: string; phone_number_id: string | null; waba_id: string | null; display_phone_number: string | null; last_webhook_at: Date | null; last_error_at: Date | null; last_error_message: string | null }>>`
      SELECT status, phone_number_id, waba_id, display_phone_number, last_webhook_at, last_error_at, last_error_message
      FROM clinic_whatsapp_accounts WHERE tenant_id = ${id} ORDER BY created_at DESC LIMIT 5
    `,
    prisma.$queryRaw<Array<{ id: string; patient_name: string | null; status: string; start_time: Date }>>`
      SELECT a.id, p.name AS patient_name, a.status::text AS status, a.datetime AS start_time
      FROM appointments a LEFT JOIN patients p ON p.id = a.patient_id
      WHERE a.tenant_id = ${id} ORDER BY a.datetime DESC LIMIT 10
    `,
    prisma.$queryRaw<Array<{ id: string; error_message: string; status: string; created_at: Date }>>`
      SELECT id, error_message, status::text AS status, created_at
      FROM failed_messages WHERE tenant_id = ${id} ORDER BY created_at DESC LIMIT 10
    `,
    prisma.$queryRaw<Array<{ id: string; title: string; type: string; created_at: Date }>>`
      SELECT id, title, type, created_at FROM system_notifications
      WHERE clinic_id = ${id} OR clinic_id IS NULL
      ORDER BY created_at DESC LIMIT 10
    `,
    getRecentAdminAudit(20, id),
  ]);

  const clinic = clinicRows[0];
  if (!clinic) return <div className="rounded-lg border border-slate-200 bg-white p-6">Clinica no encontrada</div>;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold">{clinic.name}</h2>
            <p className="text-sm text-slate-500">{clinic.legal_name ?? "Sin razon social"} · {clinic.email ?? "Sin email"} · {clinic.phone ?? "Sin telefono"}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusPill status={clinic.status} />
              {clinic.maintenance_mode ? <StatusPill status="pending" /> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <AdminActionButton label="Suspender" endpoint={`/api/super-admin/clinics/${id}/status`} body={{ status: "suspended" }} />
            <AdminActionButton label="Reactivar" endpoint={`/api/super-admin/clinics/${id}/status`} body={{ status: "active" }} />
            <AdminActionButton label="Mantenimiento" endpoint={`/api/super-admin/clinics/${id}/maintenance`} body={{ maintenance_mode: !clinic.maintenance_mode }} />
            <AdminActionButton label="Desactivar" endpoint={`/api/super-admin/clinics/${id}/soft-delete`} method="DELETE" confirmText="DESACTIVAR" variant="destructive" />
            <Link
              href={`/admin/clinics/${id}/whatsapp`}
              className="inline-flex h-8 items-center rounded border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Configurar WhatsApp
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Panel title="Usuarios">
          <div className="mb-4">
            <ClinicUserCreateForm clinicId={id} />
          </div>
          <Table><TableHeader><TableRow><TableHead>Usuario</TableHead><TableHead>Rol</TableHead><TableHead>Estado</TableHead><TableHead>Ultima actividad</TableHead></TableRow></TableHeader>
            <TableBody>{users.map((user) => <TableRow key={user.id}><TableCell>{user.full_name}<p className="text-xs text-slate-500">{user.email}</p></TableCell><TableCell>{user.role}</TableCell><TableCell><StatusPill status={user.status} /></TableCell><TableCell>{user.last_seen_at ? new Date(user.last_seen_at).toLocaleString("es-AR") : "-"}</TableCell></TableRow>)}</TableBody></Table>
        </Panel>
        <Panel title="WhatsApp">
          <Table><TableHeader><TableRow><TableHead>Estado</TableHead><TableHead>Numero</TableHead><TableHead>WABA</TableHead><TableHead>Ultimo webhook</TableHead></TableRow></TableHeader>
            <TableBody>{whatsapp.map((row) => <TableRow key={row.phone_number_id ?? row.waba_id ?? row.status}><TableCell><StatusPill status={row.status} /></TableCell><TableCell>{row.display_phone_number ?? row.phone_number_id ?? "-"}</TableCell><TableCell>{row.waba_id ?? "-"}</TableCell><TableCell>{row.last_webhook_at ? new Date(row.last_webhook_at).toLocaleString("es-AR") : "-"}</TableCell></TableRow>)}</TableBody></Table>
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <Panel title="Turnos recientes">{appointments.map((item) => <Row key={item.id} title={item.patient_name ?? "Paciente"} detail={`${item.status} · ${new Date(item.start_time).toLocaleString("es-AR")}`} />)}</Panel>
        <Panel title="Errores recientes">{errors.map((item) => <Row key={item.id} title={item.error_message} detail={`${item.status} · ${new Date(item.created_at).toLocaleString("es-AR")}`} />)}</Panel>
        <Panel title="Notificaciones">{notifications.map((item) => <Row key={item.id} title={item.title} detail={`${item.type} · ${new Date(item.created_at).toLocaleString("es-AR")}`} />)}</Panel>
      </section>

      <Panel title="Auditoria">{audit.map((item) => <Row key={item.id} title={item.action} detail={`${item.actor_name ?? "Sistema"} · ${new Date(item.created_at).toLocaleString("es-AR")}`} />)}</Panel>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><h3 className="mb-3 text-base font-semibold">{title}</h3>{children}</div>;
}

function Row({ title, detail }: { title: string; detail: string }) {
  return <div className="border-b border-slate-100 py-2 last:border-0"><p className="text-sm font-medium text-slate-900">{title}</p><p className="text-xs text-slate-500">{detail}</p></div>;
}
