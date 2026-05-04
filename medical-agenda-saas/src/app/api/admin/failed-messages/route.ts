/**
 * API para gestión de mensajes fallidos (Dead Letter Queue).
 * Acceso: secretaria, admin
 */
import { fail, ok } from "@/lib/api-response";
import { requireTenant } from "@/middleware/tenantMiddleware";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";
import {
  listFailedMessages,
  getFailedMessageStats,
} from "@/lib/whatsapp/dead-letter";

// ── GET /api/admin/failed-messages ────────────────────────────────────────────
// Lista mensajes fallidos con paginación y filtros

export async function GET(request: Request) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  if (!hasRole(authUser, ["admin", "secretaria", "recepcionista"])) return fail("Sin permisos", 403);
  const tenant = await requireTenant(authUser);
  if (!tenant.ok) return tenant.response;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? undefined;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  try {
    const [messages, stats] = await Promise.all([
      listFailedMessages({ tenantId: tenant.tenant.id, status, limit, offset }),
      getFailedMessageStats(tenant.tenant.id),
    ]);

    return ok({
      ...messages,
      stats,
    });
  } catch (error) {
    return fail(
      "Error al obtener mensajes fallidos",
      500,
      error instanceof Error ? error.message : null,
    );
  }
}
