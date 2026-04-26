import type { Role } from "@prisma/client";

import { fail } from "@/lib/api-response";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";

export async function requireAuth(roles?: Role[]) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) {
    return { ok: false as const, response: fail("No autenticado", 401) };
  }

  if (roles && roles.length > 0 && !hasRole(authUser, roles)) {
    return { ok: false as const, response: fail("Sin permisos", 403) };
  }

  return { ok: true as const, authUser };
}
