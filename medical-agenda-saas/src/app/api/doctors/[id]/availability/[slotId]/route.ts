import { fail, ok } from "@/lib/api-response";
import { logAudit, requestMeta } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/middleware/tenantMiddleware";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";

type Params = { params: Promise<{ id: string; slotId: string }> };

export async function DELETE(request: Request, context: Params) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  if (!hasRole(authUser, ["admin", "secretaria", "recepcionista"])) return fail("Sin permisos", 403);

  const tenant = await requireTenant(authUser);
  if (!tenant.ok) return tenant.response;

  const { id, slotId } = await context.params;

  try {
    const meta = requestMeta(request);
    const slot = await prisma.doctorAvailabilitySlot.findFirst({
      where: {
        id: slotId,
        tenant_id: tenant.tenant.id,
        doctor_id: id,
      },
      select: { id: true, availability_month_id: true },
    });

    if (!slot) return fail("Disponibilidad no encontrada", 404);

    await prisma.doctorAvailabilitySlot.deleteMany({
      where: {
        id: slotId,
        tenant_id: tenant.tenant.id,
        doctor_id: id,
      },
    });

    await logAudit({
      userId: authUser.userId,
      role: authUser.role,
      action: "doctor.availability_month.slot.delete",
      entity: "doctor_availability_slot",
      entityId: slotId,
      details: { doctor_id: id, availability_month_id: slot.availability_month_id },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return ok({ deleted: true });
  } catch (error) {
    return fail("No se pudo eliminar la disponibilidad", 500, error instanceof Error ? error.message : null);
  }
}