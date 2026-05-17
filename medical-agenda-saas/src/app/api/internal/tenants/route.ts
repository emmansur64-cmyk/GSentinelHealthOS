import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

function isAuthorizedInternalRequest(request: NextRequest): boolean {
  const received = request.headers.get("x-internal-key")?.trim();
  const expected =
    process.env.PANEL_ADMIN_API_KEY?.trim() ||
    process.env.ADMIN_API_INTERNAL_KEY?.trim() ||
    "";

  if (!expected) return false;
  return Boolean(received) && received === expected;
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedInternalRequest(request)) {
    return fail("Forbidden", 403);
  }

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      name: string;
      slug: string;
      status: string;
      created_at: Date;
      updated_at: Date;
      clinic_count: number;
      user_count: number;
    }>
  >`
    SELECT
      t.id,
      t.nombre AS name,
      t.slug,
      t.estado::text AS status,
      t.created_at,
      t.updated_at,
      1::int AS clinic_count,
      (
        SELECT COUNT(*)::int
        FROM users u
        WHERE u.tenant_id = t.id
      ) AS user_count
    FROM tenants t
    WHERE t.id <> 'default'
    ORDER BY t.created_at DESC
  `;

  const tenants = rows.map((item) => ({
    id: item.id,
    name: item.name,
    slug: item.slug,
    status: item.status,
    plan: "basico",
    clinicCount: item.clinic_count,
    userCount: item.user_count,
    createdAt: item.created_at.toISOString(),
    updatedAt: item.updated_at.toISOString(),
  }));

  return ok(tenants);
}

