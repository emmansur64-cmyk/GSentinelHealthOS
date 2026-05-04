import { NextRequest } from "next/server";
import { Role } from "@prisma/client";

import { fail, ok } from "@/lib/api-response";
import { hashPassword } from "@/lib/auth";
import { CLINIC_PANEL_ROLES, requireClinicApi, touchLastSeen } from "@/lib/clinic-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const ctx = await requireClinicApi(CLINIC_PANEL_ROLES);
  if (!ctx.ok) return ctx.response;
  await touchLastSeen(ctx.auth);

  const users = await prisma.$queryRaw`
    SELECT id, name AS full_name, email, role::text AS role, COALESCE(status, 'active') AS status,
           last_login_at, last_seen_at, created_at
    FROM users
    WHERE tenant_id = ${ctx.clinic.id}
    ORDER BY created_at DESC
  `;
  return ok(users);
}

export async function POST(request: NextRequest) {
  const ctx = await requireClinicApi(["clinic_owner", "clinic_admin", "admin"]);
  if (!ctx.ok) return ctx.response;

  const body = await request.json().catch(() => null);
  const fullName = String(body?.full_name ?? body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const role = String(body?.role ?? "receptionist");
  if (!fullName || !email || password.length < 8) return fail("Nombre, email y contrasena son requeridos", 422);
  if (!["clinic_admin", "receptionist", "doctor"].includes(role)) return fail("Rol invalido", 422);

  const existing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM users WHERE tenant_id = ${ctx.clinic.id} AND email = ${email} LIMIT 1
  `;
  if (existing[0]) return fail("El email ya existe en esta clinica", 409);

  const created = await prisma.user.create({
    data: {
      tenant_id: ctx.clinic.id,
      name: fullName,
      email,
      role: role as Role,
      password_hash: await hashPassword(password),
      auth_provider: "password",
      status: "active",
      active: true,
    },
    select: { id: true, name: true, email: true, role: true },
  });

  return ok(created, 201);
}
