import { fail, ok } from "@/lib/api-response";
import { logAudit, requestMeta } from "@/lib/audit";
import { auditLog } from "@/lib/compliance/audit-log";
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
    where: { id, tenant_id: tenant.tenant.id },
    include: {
      appointments: {
        where: { tenant_id: tenant.tenant.id, deleted_at: null },
        orderBy: { datetime: "desc" },
        take: 50,
        include: {
          doctor: { include: { user: { select: { name: true } } } },
        },
      },
    },
  });

  if (!patient) return fail("Paciente no encontrado", 404);

  await auditLog({
    tenantId: tenant.tenant.id,
    actorUserId: authUser.userId,
    patientId: patient.id,
    entityType: "patient",
    entityId: patient.id,
    action: "READ",
    metadata: { endpoint: "/api/patients/:id" },
  });

  return ok({
    ...patient,
    document: patient.document ?? "",
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

    const existing = await prisma.patient.findFirst({
      where: { id, tenant_id: tenant.tenant.id },
      select: { id: true, document: true },
    });
    if (!existing) return fail("Paciente no encontrado", 404);

    if (parsed.data.document && parsed.data.document !== existing.document) {
      const taken = await prisma.patient.findFirst({
        where: {
          tenant_id: tenant.tenant.id,
          document: parsed.data.document,
          id: { not: id },
        },
        select: { id: true },
      });
      if (taken) return fail("Ya existe un paciente con ese DNI", 409);
    }

    await prisma.patient.updateMany({
      where: { id, tenant_id: tenant.tenant.id },
      data: {
        name: parsed.data.name,
        document: parsed.data.document,
        phone: parsed.data.contact,
        insurance: parsed.data.insurance,
        notes: parsed.data.notes,
      },
    });

    const updated = await prisma.patient.findFirst({
      where: { id, tenant_id: tenant.tenant.id },
    });
    if (!updated) return fail("Paciente no encontrado", 404);

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
      document: updated.document ?? "",
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

    const patient = await prisma.patient.findFirst({
      where: { id, tenant_id: tenant.tenant.id },
      select: { id: true },
    });
    if (!patient) return fail("Paciente no encontrado", 404);

    // Verificar si tiene turnos activos (planned)
    const activeCount = await prisma.appointment.count({
      where: {
        tenant_id: tenant.tenant.id,
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
      await tx.appointment.deleteMany({ where: { tenant_id: tenant.tenant.id, patient_id: id } });
      await tx.patient.deleteMany({ where: { id, tenant_id: tenant.tenant.id } });
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
