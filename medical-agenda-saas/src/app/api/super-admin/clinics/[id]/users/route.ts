import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { getRequestIp, requireSuperAdminApi, writeAdminAudit } from "@/lib/super-admin";
import {
  provisionTenantUser,
  TenantUserProvisioningConflictError,
  TenantUserProvisioningValidationError,
} from "@/lib/tenant-user-provisioning";

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

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const fullName = String(body?.full_name ?? body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const role = String(body?.role ?? "secretaria").trim();
  const specialty = String(body?.specialty ?? "").trim();
  const matricula = String(body?.matricula ?? "").trim();
  const aiTag = String(body?.ai_tag ?? "").trim();

  if (!fullName || !email || password.length < 8) {
    return fail("Nombre, email y contrasena son requeridos", 422);
  }

  const clinic = await prisma.tenant.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!clinic) return fail("Clinica no encontrada", 404);

  try {
    const created = await prisma.$transaction(async (tx) => {
      return provisionTenantUser(tx, {
        tenantId: id,
        fullName,
        email,
        password,
        role,
        specialty: specialty || null,
        matricula: matricula || null,
        aiTag: aiTag || null,
      });
    });

    await writeAdminAudit({
      actorUserId: auth.user.userId,
      action: "clinic_user_created",
      targetType: "user",
      targetId: created.id,
      clinicId: id,
      metadata: { role: created.role, email: created.email },
      ipAddress: getRequestIp(request),
    });

    return ok(created, 201);
  } catch (error) {
    if (error instanceof TenantUserProvisioningValidationError) {
      return fail(error.message, 422, error.details);
    }
    if (error instanceof TenantUserProvisioningConflictError) {
      return fail(error.message, 409);
    }
    return fail("No se pudo crear usuario para la clinica", 500, error instanceof Error ? error.message : null);
  }
}
