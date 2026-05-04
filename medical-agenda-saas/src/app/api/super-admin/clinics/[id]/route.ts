import { ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminApi } from "@/lib/super-admin";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const rows = await prisma.$queryRaw`
    SELECT id, nombre AS name, legal_name, email, phone, estado::text AS status,
           maintenance_mode, created_at, updated_at
    FROM tenants
    WHERE id = ${id}
    LIMIT 1
  `;
  return ok(Array.isArray(rows) ? rows[0] ?? null : null);
}
