import { StatusPill } from "@/components/admin/status-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireClinicPage } from "@/lib/clinic-auth";
import { prisma } from "@/lib/prisma";

export default async function ClinicUsersPage() {
  const { clinic } = await requireClinicPage(["clinic_owner", "clinic_admin", "admin"]);
  const users = await prisma.$queryRaw<Array<{
    id: string;
    full_name: string;
    email: string;
    role: string;
    status: string;
    last_login_at: Date | null;
  }>>`
    SELECT id, name AS full_name, email, role::text AS role, COALESCE(status, 'active') AS status, last_login_at
    FROM users
    WHERE tenant_id = ${clinic.id}
    ORDER BY created_at DESC
  `;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Usuarios de la clinica</h2>
        <p className="text-sm text-slate-500">La lista se filtra por clinic_id de la sesion actual.</p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Usuario</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Ultimo login</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>{user.full_name}<p className="text-xs text-slate-500">{user.email}</p></TableCell>
              <TableCell>{user.role}</TableCell>
              <TableCell><StatusPill status={user.status} /></TableCell>
              <TableCell>{user.last_login_at ? new Date(user.last_login_at).toLocaleString("es-AR") : "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
