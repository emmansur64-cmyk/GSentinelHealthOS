import { AdminActionButton } from "@/components/admin/admin-action-button";
import { StatusPill } from "@/components/admin/status-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/prisma";

export default async function AdminUsersPage() {
  const users = await prisma.$queryRaw<Array<{
    id: string; clinic_name: string | null; full_name: string; email: string; role: string; status: string;
    last_login_at: Date | null; last_seen_at: Date | null;
  }>>`
    SELECT u.id, t.nombre AS clinic_name, u.name AS full_name, u.email, u.role::text AS role,
           COALESCE(u.status, 'active') AS status, u.last_login_at, u.last_seen_at
    FROM users u
    LEFT JOIN tenants t ON t.id = u.tenant_id
    ORDER BY u.last_seen_at DESC NULLS LAST, u.created_at DESC
    LIMIT 300
  `;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">Usuarios</h2>
      <Table>
        <TableHeader><TableRow><TableHead>Usuario</TableHead><TableHead>Clinica</TableHead><TableHead>Rol</TableHead><TableHead>Estado</TableHead><TableHead>Ultimo login</TableHead><TableHead>Ultima actividad</TableHead><TableHead>Acciones</TableHead></TableRow></TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>{user.full_name}<p className="text-xs text-slate-500">{user.email}</p></TableCell>
              <TableCell>{user.clinic_name ?? "Global"}</TableCell>
              <TableCell>{user.role}</TableCell>
              <TableCell><StatusPill status={user.status} /></TableCell>
              <TableCell>{user.last_login_at ? new Date(user.last_login_at).toLocaleString("es-AR") : "-"}</TableCell>
              <TableCell>{user.last_seen_at ? new Date(user.last_seen_at).toLocaleString("es-AR") : "-"}</TableCell>
              <TableCell>
                {user.role === "super_admin" ? "-" : (
                  <div className="flex gap-2">
                    <AdminActionButton label="Suspender" endpoint={`/api/super-admin/users/${user.id}/status`} body={{ status: "suspended" }} />
                    <AdminActionButton label="Reactivar" endpoint={`/api/super-admin/users/${user.id}/status`} body={{ status: "active" }} />
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
