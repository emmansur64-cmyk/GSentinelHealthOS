import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

const ALLOWED_STATUSES = new Set(["active", "suspended", "disabled"]);

function isAuthorizedInternalRequest(request: NextRequest): boolean {
  const received = request.headers.get("x-internal-key")?.trim();
  const expected =
    process.env.PANEL_ADMIN_API_KEY?.trim() ||
    process.env.ADMIN_API_INTERNAL_KEY?.trim() ||
    "";

  if (!expected) return false;
  return Boolean(received) && received === expected;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAuthorizedInternalRequest(request)) {
    return fail("Forbidden", 403);
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const status = String(body?.status ?? "").trim().toLowerCase();

  if (!ALLOWED_STATUSES.has(status)) {
    return fail("Estado invalido", 422);
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id },
    select: { id: true, estado: true },
  });
  if (!tenant || tenant.id === "default") return fail("Tenant no encontrado", 404);

  await prisma.$transaction(async (tx) => {
    await tx.tenant.update({
      where: { id },
      data: { estado: status as "active" | "suspended" | "disabled" },
    });

    if (status === "active") {
      await tx.$executeRaw`
        UPDATE users
        SET active = TRUE, status = 'active'
        WHERE tenant_id = ${id}
      `;
    } else {
      await tx.$executeRaw`
        UPDATE users
        SET active = FALSE, status = ${status}
        WHERE tenant_id = ${id}
      `;
    }
  });

  return ok({ id, status });
}

