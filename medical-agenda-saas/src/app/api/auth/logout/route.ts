import { cookies } from "next/headers";

import { revokeSessionById } from "@/lib/auth";
import { fail, ok } from "@/lib/api-response";
import { logAudit, requestMeta } from "@/lib/audit";
import { getAuthenticatedUser } from "@/lib/server-auth";

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    const meta = requestMeta(request);
    if (user) {
      await revokeSessionById(user.sessionId);
      await logAudit({
        userId: user.userId,
        role: user.role,
        action: "auth.logout",
        entity: "session",
        entityId: user.sessionId,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
    }

    const cookieStore = await cookies();
    cookieStore.delete("auth_token");
    cookieStore.delete("tenant_id");

    return ok({ loggedOut: true });
  } catch (error) {
    return fail("No se pudo cerrar sesion", 500, error instanceof Error ? error.message : null);
  }
}