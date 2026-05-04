import { ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminApi } from "@/lib/super-admin";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const users = await prisma.$queryRaw`
    SELECT id, name AS full_name, email, role::text AS role, COALESCE(status, 'active') AS status,
           active, last_login_at, last_seen_at, created_at
    FROM users
    WHERE tenant_id = ${id}
    ORDER BY created_at DESC
  `;

  return ok(users);
}
