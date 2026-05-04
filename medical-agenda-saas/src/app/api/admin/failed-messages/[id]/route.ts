/**
 * API para gestión de un mensaje fallido específico.
 * Acceso: secretaria, admin
 */
import { fail, ok } from "@/lib/api-response";
import { logAudit, requestMeta } from "@/lib/audit";
import { requireTenant } from "@/middleware/tenantMiddleware";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";
import {
  getFailedMessageDetail,
  retryFailedMessage,
  resolveFailedMessage,
  discardFailedMessage,
} from "@/lib/whatsapp/dead-letter";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

// ── GET /api/admin/failed-messages/:id ────────────────────────────────────────
// Obtiene detalles completos de un mensaje fallido

export async function GET(_request: Request, context: Params) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  if (!hasRole(authUser, ["admin", "secretaria", "recepcionista"])) return fail("Sin permisos", 403);
  const tenant = await requireTenant(authUser);
  if (!tenant.ok) return tenant.response;

  const { id } = await context.params;

  const detail = await getFailedMessageDetail(id, tenant.tenant.id);
  if (!detail) {
    return fail("Mensaje no encontrado", 404);
  }

  return ok(detail);
}

// ── POST /api/admin/failed-messages/:id ───────────────────────────────────────
// Acciones sobre un mensaje fallido: retry, resolve, discard

const actionSchema = z.object({
  action: z.enum(["retry", "resolve", "discard"]),
  reason: z.string().optional(),
});

export async function POST(request: Request, context: Params) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  if (!hasRole(authUser, ["admin", "secretaria", "recepcionista"])) return fail("Sin permisos", 403);
  const tenant = await requireTenant(authUser);
  if (!tenant.ok) return tenant.response;

  const { id } = await context.params;

  try {
    const body = await request.json();
    const parsed = actionSchema.safeParse(body);

    if (!parsed.success) {
      return fail("Payload inválido", 422, parsed.error.flatten());
    }

    const { action, reason } = parsed.data;
    const meta = requestMeta(request);

    switch (action) {
      case "retry": {
        const result = await retryFailedMessage(id, tenant.tenant.id, authUser.userId);

        await logAudit({
          userId: authUser.userId,
          role: authUser.role,
          action: "failed_message.retry",
          entity: "failed_message",
          entityId: id,
          details: { result },
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        });

        if (!result.success) {
          return fail(result.message, 400);
        }

        return ok(result);
      }

      case "resolve": {
        await resolveFailedMessage(id, tenant.tenant.id, authUser.userId, reason);

        await logAudit({
          userId: authUser.userId,
          role: authUser.role,
          action: "failed_message.resolve",
          entity: "failed_message",
          entityId: id,
          details: { reason },
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        });

        return ok({ success: true, message: "Mensaje marcado como resuelto" });
      }

      case "discard": {
        if (!reason) {
          return fail("Se requiere una razón para descartar", 400);
        }

        await discardFailedMessage(id, tenant.tenant.id, authUser.userId, reason);

        await logAudit({
          userId: authUser.userId,
          role: authUser.role,
          action: "failed_message.discard",
          entity: "failed_message",
          entityId: id,
          details: { reason },
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        });

        return ok({ success: true, message: "Mensaje descartado" });
      }

      default:
        return fail("Acción no válida", 400);
    }
  } catch (error) {
    return fail(
      "Error al procesar acción",
      500,
      error instanceof Error ? error.message : null,
    );
  }
}
