import { redirect } from "next/navigation";

import { fail } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, hasRole, type AuthenticatedUser, type RoleLike } from "@/lib/server-auth";
import { requireTenant } from "@/middleware/tenantMiddleware";

export const CLINIC_PANEL_ROLES: RoleLike[] = [
  "clinic_owner",
  "clinic_admin",
  "admin",
  "receptionist",
  "recepcionista",
  "secretaria",
];

export const CLINIC_OPERATOR_ROLES: RoleLike[] = [
  ...CLINIC_PANEL_ROLES,
  "doctor",
  "medico",
];

export async function requireClinicPage(roles: RoleLike[] = CLINIC_PANEL_ROLES) {
  const auth = await getAuthenticatedUser();
  if (!auth) redirect("/login");
  if (!hasRole(auth, roles)) redirect("/dashboard");
  const tenant = await requireTenant(auth);
  if (!tenant.ok) redirect("/login");
  return { auth, clinic: tenant.tenant };
}

export async function requireClinicApi(roles: RoleLike[] = CLINIC_OPERATOR_ROLES) {
  const auth = await getAuthenticatedUser();
  if (!auth) return { ok: false as const, response: fail("No autenticado", 401) };
  if (!hasRole(auth, roles)) return { ok: false as const, response: fail("Sin permisos", 403) };
  const tenant = await requireTenant(auth);
  if (!tenant.ok) return { ok: false as const, response: tenant.response };
  return { ok: true as const, auth, clinic: tenant.tenant };
}

export async function touchLastSeen(user: AuthenticatedUser) {
  await prisma.$executeRaw`
    UPDATE users SET last_seen_at = NOW()
    WHERE id = ${user.userId}
  `;
}
