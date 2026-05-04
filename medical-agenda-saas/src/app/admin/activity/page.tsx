import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/prisma";

export default async function AdminActivityPage() {
  const rows = await prisma.$queryRaw<Array<{
    id: string; clinic_name: string | null; user_name: string | null; role: string | null; action: string; entity: string; created_at: Date;
  }>>`
    SELECT al.id, t.nombre AS clinic_name, u.name AS user_name, al.role::text AS role, al.action, al.entity, al.created_at
    FROM activity_logs al
    LEFT JOIN tenants t ON t.id = al.tenant_id
    LEFT JOIN users u ON u.id = al.user_id
    ORDER BY al.created_at DESC
    LIMIT 300
  `;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">Actividad</h2>
      <Table><TableHeader><TableRow><TableHead>Usuario</TableHead><TableHead>Clinica</TableHead><TableHead>Rol</TableHead><TableHead>Accion</TableHead><TableHead>Entidad</TableHead><TableHead>Fecha</TableHead></TableRow></TableHeader>
        <TableBody>{rows.map((row) => <TableRow key={row.id}><TableCell>{row.user_name ?? "Sistema"}</TableCell><TableCell>{row.clinic_name ?? "Global"}</TableCell><TableCell>{row.role ?? "-"}</TableCell><TableCell>{row.action}</TableCell><TableCell>{row.entity}</TableCell><TableCell>{new Date(row.created_at).toLocaleString("es-AR")}</TableCell></TableRow>)}</TableBody></Table>
    </div>
  );
}
