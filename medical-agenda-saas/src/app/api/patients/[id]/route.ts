import { fail, ok } from "@/lib/api-response";
import { logAudit, requestMeta } from "@/lib/audit";
import { requireTenant } from "@/middleware/tenantMiddleware";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";
import { patientUpdateSchema } from "@/lib/validators";
import type { Prisma } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

// ── GET /api/patients/:id ─────────────────────────────────────────────────────

export async function GET(_request: Request, context: Params) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  const tenant = await requireTenant(authUser);
  if (!tenant.ok) return tenant.response;

  const { id } = await context.params;

  const patient = await prisma.patient.findFirst({
    where: { id },
    include: {
      appointments: {
        where: { deleted_at: null },
        orderBy: { datetime: "desc" },
        take: 50,
        include: {
          doctor: { include: { user: { select: { name: true } } } },
        },
      },
    },
  });

  if (!patient) return fail("Paciente no encontrado", 404);
  return ok({
    ...patient,
    document: "",
    contact: patient.phone,
  });
}

// ── PUT /api/patients/:id ─────────────────────────────────────────────────────

export async function PUT(request: Request, context: Params) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  if (!hasRole(authUser, ["secretaria", "recepcionista", "admin"])) return fail("Sin permisos", 403);
  const tenant = await requireTenant(authUser);
  if (!tenant.ok) return tenant.response;

  const { id } = await context.params;

  try {
    const parsed = patientUpdateSchema.safeParse(await request.json());
    const meta = requestMeta(request);
    if (!parsed.success) return fail("Payload invalido", 422, parsed.error.flatten());

    const existing = await prisma.patient.findFirst({ where: { id }, select: { id: true } });
    if (!existing) return fail("Paciente no encontrado", 404);

    const updated = await prisma.patient.update({
      where: { id },
      data: {
        name: parsed.data.name,
        phone: parsed.data.contact,
        notes: parsed.data.notes,
      },
    });

    await logAudit({
      userId: authUser.userId,
      role: authUser.role,
      action: "patient.update",
      entity: "patient",
      entityId: updated.id,
      details: parsed.data,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return ok({
      ...updated,
      document: "",
      contact: updated.phone,
    });
  } catch (error) {
    return fail("No se pudo actualizar paciente", 500, error instanceof Error ? error.message : null);
  }
}

// ── DELETE /api/patients/:id ──────────────────────────────────────────────────
// La eliminación falla con 409 si el paciente tiene turnos activos (no cancelados/ausentes).
// Turnos cancelados o ausentes no bloquean la eliminación; se eliminan en cascada
// usando una transacción que primero borra los turnos terminales.

export async function DELETE(request: Request, context: Params) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  if (!hasRole(authUser, ["secretaria", "recepcionista", "admin"])) return fail("Sin permisos", 403);
  const tenant = await requireTenant(authUser);
  if (!tenant.ok) return tenant.response;

  const { id } = await context.params;

  try {
    const meta = requestMeta(request);

    // Verificar si tiene turnos activos (planned)
    const activeCount = await prisma.appointment.count({
      where: {
        patient_id: id,
        deleted_at: null,
        status: { notIn: ["cancelled", "no_show", "completed"] },
      },
    });

    if (activeCount > 0) {
      return fail(
        `No se puede eliminar: el paciente tiene ${activeCount} turno(s) activo(s)`,
        409,
        { active_appointments: activeCount },
      );
    }

    // Transacción: eliminar turnos históricos y luego el paciente
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.appointment.deleteMany({ where: { patient_id: id } });
      await tx.patient.delete({ where: { id } });
    });

    await logAudit({
      userId: authUser.userId,
      role: authUser.role,
      action: "patient.delete",
      entity: "patient",
      entityId: id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return ok({ deleted: true });
  } catch (error) {
    return fail("No se pudo eliminar paciente", 500, error instanceof Error ? error.message : null);
  }
}
