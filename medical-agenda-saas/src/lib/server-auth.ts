import { Role } from "@prisma/client";
import { cookies } from "next/headers";

import { verifyToken } from "@/lib/auth";
import { setTenantContext } from "@/lib/tenant-context";
import { normalizeRole } from "@/middleware/roleMiddleware";

export type AuthenticatedUser = {
  userId: string;
  tenantId: string;
  role: Role;
  sessionId: string;
};

export type RoleLike = Role | "medico" | "recepcionista";

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  setTenantContext({
    tenantId: payload.tenantId,
    userId: payload.sub,
    role: payload.role,
  });

  return {
    userId: payload.sub,
    tenantId: payload.tenantId,
    role: payload.role,
    sessionId: payload.sessionId,
  };
}

export function hasRole(user: AuthenticatedUser, roles: RoleLike[]) {
  const current = normalizeRole(user.role);
  return roles.some((role) => normalizeRole(role) === current);
}