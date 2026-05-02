import { fail, ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/server-auth";

export async function GET() {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);

  let rows: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    tenant_id: string;
    user_status: string;
    active: boolean;
    clinic_name: string | null;
    clinic_status: string | null;
  }> = [];

  try {
    rows = await prisma.$queryRaw`
      SELECT u.id, u.name, u.email, u.role::text AS role, u.tenant_id,
             COALESCE(u.status, 'active') AS user_status, u.active,
             t.nombre AS clinic_name, t.estado::text AS clinic_status
      FROM users u
      LEFT JOIN tenants t ON t.id = u.tenant_id
      WHERE u.id = ${authUser.userId}
      LIMIT 1
    `;
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (!message.includes("42703") && !message.includes("active") && !message.includes("status")) {
      throw error;
    }

    rows = await prisma.$queryRaw`
      SELECT u.id, u.name, u.email, u.role::text AS role, u.tenant_id,
             'active' AS user_status, true AS active,
             t.nombre AS clinic_name, t.estado::text AS clinic_status
      FROM users u
      LEFT JOIN tenants t ON t.id = u.tenant_id
      WHERE u.id = ${authUser.userId}
      LIMIT 1
    `;
  }

  const user = rows[0];
  if (!user) return fail("Usuario no encontrado", 404);
  if (!user.active || user.user_status !== "active") return fail("Usuario inactivo o suspendido", 403);

  return ok({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    clinic_id: authUser.tenantId,
    tenant_id: authUser.tenantId,
    clinic_name: user.clinic_name,
    clinic_status: user.clinic_status,
  });
}
