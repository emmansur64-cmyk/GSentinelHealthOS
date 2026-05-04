import { NotificationForm } from "@/components/admin/notification-form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/prisma";

export default async function AdminNotificationsPage() {
  const [clinics, notifications] = await Promise.all([
    prisma.$queryRaw<Array<{ id: string; name: string }>>`SELECT id, nombre AS name FROM tenants WHERE estado <> 'disabled' ORDER BY nombre ASC`,
    prisma.$queryRaw<Array<{ id: string; clinic_name: string | null; title: string; message: string; type: string; channel: string; created_at: Date }>>`
      SELECT sn.id, t.nombre AS clinic_name, sn.title, sn.message, sn.type, sn.channel, sn.created_at
      FROM system_notifications sn
      LEFT JOIN tenants t ON t.id = sn.clinic_id
      ORDER BY sn.created_at DESC
      LIMIT 100
    `,
  ]);

  return (
    <div className="space-y-6">
      <NotificationForm clinics={clinics} />
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Notificaciones enviadas</h2>
        <Table><TableHeader><TableRow><TableHead>Destino</TableHead><TableHead>Titulo</TableHead><TableHead>Tipo</TableHead><TableHead>Canal</TableHead><TableHead>Fecha</TableHead></TableRow></TableHeader>
          <TableBody>{notifications.map((row) => <TableRow key={row.id}><TableCell>{row.clinic_name ?? "Todas"}</TableCell><TableCell>{row.title}<p className="text-xs text-slate-500">{row.message}</p></TableCell><TableCell>{row.type}</TableCell><TableCell>{row.channel}</TableCell><TableCell>{new Date(row.created_at).toLocaleString("es-AR")}</TableCell></TableRow>)}</TableBody></Table>
      </div>
    </div>
  );
}
