import { fail, ok } from "@/lib/api-response";
import { logAudit, requestMeta } from "@/lib/audit";
import { requireTenant } from "@/middleware/tenantMiddleware";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";
import { availabilityRuleUpdateSchema } from "@/lib/validators";

type Params = { params: Promise<{ id: string }> };

// ── GET /api/schedules/:id ────────────────────────────────────────────────────

export async function GET(_request: Request, context: Params) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  const tenant = await requireTenant(authUser);
  if (!tenant.ok) return tenant.response;

  const { id } = await context.params;

  const rule = await prisma.availabilityRule.findFirst({ where: { id, tenant_id: tenant.tenant.id } });
  if (!rule) return fail("Regla de agenda no encontrada", 404);
  return ok(rule);
}

// ── PUT /api/schedules/:id ────────────────────────────────────────────────────

async function handleUpdate(request: Request, context: Params) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  if (!hasRole(authUser, ["secretaria", "recepcionista", "admin"])) return fail("Sin permisos", 403);
  const tenant = await requireTenant(authUser);
  if (!tenant.ok) return tenant.response;

  const { id } = await context.params;

  try {
    const parsed = availabilityRuleUpdateSchema.safeParse(await request.json());
    const meta = requestMeta(request);
    if (!parsed.success) return fail("Payload invalido", 422, parsed.error.flatten());

    const existing = await prisma.availabilityRule.findFirst({
      where: { id, tenant_id: tenant.tenant.id },
      select: { id: true, start_time: true, end_time: true },
    });
    if (!existing) return fail("Regla de agenda no encontrada", 404);

    // Coherencia de horario: validar con los nuevos valores combinados con los existentes
    const startTime = parsed.data.start_time ?? existing.start_time;
    const endTime   = parsed.data.end_time   ?? existing.end_time;
    if (startTime >= endTime) {
      return fail("start_time debe ser anterior a end_time", 422);
    }

    await prisma.availabilityRule.updateMany({
      where: { id, tenant_id: tenant.tenant.id },
      data: {
        day_of_week:   parsed.data.day_of_week,
        specific_date:
          parsed.data.specific_date === undefined
            ? undefined
            : parsed.data.specific_date === null
              ? null
              : new Date(`${parsed.data.specific_date}T00:00:00.000Z`),
        start_time:    parsed.data.start_time,
        end_time:      parsed.data.end_time,
        slot_duration: parsed.data.slot_duration,
      },
    });

    const updated = await prisma.availabilityRule.findFirst({ where: { id, tenant_id: tenant.tenant.id } });
    if (!updated) return fail("Regla de agenda no encontrada", 404);

    await logAudit({
      userId: authUser.userId,
      role: authUser.role,
      action: "schedule.update",
      entity: "availability_rule",
      entityId: updated.id,
      details: parsed.data,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return ok(updated);
  } catch (error) {
    return fail("No se pudo actualizar regla de agenda", 500, error instanceof Error ? error.message : null);
  }
}

export const PUT   = handleUpdate;
export const PATCH = handleUpdate;

// ── DELETE /api/schedules/:id ─────────────────────────────────────────────────

export async function DELETE(request: Request, context: Params) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  if (!hasRole(authUser, ["secretaria", "recepcionista", "admin"])) return fail("Sin permisos", 403);
  const tenant = await requireTenant(authUser);
  if (!tenant.ok) return tenant.response;

  const { id } = await context.params;

  try {
    const meta = requestMeta(request);
    const existing = await prisma.availabilityRule.findFirst({ where: { id, tenant_id: tenant.tenant.id }, select: { id: true } });
    if (!existing) return fail("Regla de agenda no encontrada", 404);

    await prisma.availabilityRule.deleteMany({ where: { id, tenant_id: tenant.tenant.id } });

    await logAudit({
      userId: authUser.userId,
      role: authUser.role,
      action: "schedule.delete",
      entity: "availability_rule",
      entityId: id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return ok({ deleted: true });
  } catch (error) {
    return fail("No se pudo eliminar regla de agenda", 500, error instanceof Error ? error.message : null);
  }
}
