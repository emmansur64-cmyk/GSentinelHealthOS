import { fail, ok } from "@/lib/api-response";
import { logAudit, requestMeta } from "@/lib/audit";
import { requireTenant } from "@/middleware/tenantMiddleware";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";
import { doctorUpdateSchema } from "@/lib/validators";
import type { Prisma } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Params) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  const tenant = await requireTenant(authUser);
  if (!tenant.ok) return tenant.response;

  const { id } = await context.params;

  const doctor = await prisma.doctorProfile.findFirst({
    where: { user_id: id, tenant_id: tenant.tenant.id },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      availabilityRule: {
        orderBy: [{ day_of_week: "asc" }, { start_time: "asc" }],
      },
    },
  });

  if (!doctor) return fail("Medico no encontrado", 404);

  const settings = await prisma.agendaSettings.findFirst({ where: { user_id: id, tenant_id: tenant.tenant.id } });

  return ok({
    ...doctor,
    appointment_duration: settings?.appointment_duration ?? 30,
    buffer_minutes: settings?.buffer_minutes ?? 10,
    start_time: settings?.start_time ?? "08:00",
    end_time: settings?.end_time ?? "18:00",
    working_days: settings?.working_days ?? ["monday", "tuesday", "wednesday", "thursday", "friday"],
  });
}

async function handleUpdate(request: Request, context: Params) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  if (!hasRole(authUser, ["admin", "secretaria", "recepcionista"])) return fail("Sin permisos", 403);
  const tenant = await requireTenant(authUser);
  if (!tenant.ok) return tenant.response;

  const { id } = await context.params;

  try {
    const parsed = doctorUpdateSchema.safeParse(await request.json());
    const meta = requestMeta(request);
    if (!parsed.success) return fail("Payload invalido", 422, parsed.error.flatten());

    const doctor = await prisma.doctorProfile.findFirst({
      where: { user_id: id, tenant_id: tenant.tenant.id },
      select: { user_id: true },
    });
    if (!doctor) return fail("Medico no encontrado", 404);

    if (parsed.data.matricula) {
      const taken = await prisma.doctorProfile.findFirst({
        where: {
          matricula: parsed.data.matricula,
          tenant_id: tenant.tenant.id,
          user_id: { not: id },
        },
        select: { user_id: true },
      });
      if (taken) return fail("La matricula ya existe", 409);
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (parsed.data.name) {
        await tx.user.updateMany({
          where: { id, tenant_id: tenant.tenant.id },
          data: { name: parsed.data.name },
        });
      }

      await tx.doctorProfile.updateMany({
        where: { user_id: id, tenant_id: tenant.tenant.id },
        data: {
          specialty: parsed.data.specialty,
          matricula: parsed.data.matricula,
          ai_tag: parsed.data.ai_tag,
        },
      });

      const hasSettingsPatch =
        parsed.data.appointment_duration !== undefined ||
        parsed.data.buffer_minutes !== undefined ||
        parsed.data.start_time !== undefined ||
        parsed.data.end_time !== undefined ||
        parsed.data.working_days !== undefined;

      if (hasSettingsPatch) {
        await tx.agendaSettings.upsert({
          where: { user_id: id },
          create: {
            user_id: id,
            tenant_id: tenant.tenant.id,
            appointment_duration: parsed.data.appointment_duration ?? 30,
            buffer_minutes: parsed.data.buffer_minutes ?? 10,
            start_time: parsed.data.start_time ?? "08:00",
            end_time: parsed.data.end_time ?? "18:00",
            working_days: parsed.data.working_days ?? ["monday", "tuesday", "wednesday", "thursday", "friday"],
          },
          update: {
            appointment_duration: parsed.data.appointment_duration,
            buffer_minutes: parsed.data.buffer_minutes,
            start_time: parsed.data.start_time,
            end_time: parsed.data.end_time,
            working_days: parsed.data.working_days,
          },
        });
      }
    });

    await logAudit({
      userId: authUser.userId,
      role: authUser.role,
      action: "doctor.update",
      entity: "doctor",
      entityId: id,
      details: parsed.data,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    const updated = await prisma.doctorProfile.findFirst({
      where: { user_id: id, tenant_id: tenant.tenant.id },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    return ok(updated);
  } catch (error) {
    return fail("No se pudo actualizar medico", 500, error instanceof Error ? error.message : null);
  }
}

export const PUT = handleUpdate;
export const PATCH = handleUpdate;

export async function DELETE(request: Request, context: Params) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  if (!hasRole(authUser, ["admin", "secretaria", "recepcionista"])) return fail("Sin permisos", 403);
  const tenant = await requireTenant(authUser);
  if (!tenant.ok) return tenant.response;

  const { id } = await context.params;

  try {
    const meta = requestMeta(request);

    const doctor = await prisma.doctorProfile.findFirst({
      where: { user_id: id, tenant_id: tenant.tenant.id },
      select: { user_id: true },
    });
    if (!doctor) return fail("Medico no encontrado", 404);

    const activeAppointments = await prisma.appointment.count({
      where: {
        doctor_id: id,
        tenant_id: tenant.tenant.id,
        deleted_at: null,
        status: { notIn: ["cancelled", "no_show", "completed"] },
      },
    });

    if (activeAppointments > 0) {
      return fail("No se puede eliminar: el medico tiene turnos activos", 409, {
        active_appointments: activeAppointments,
      });
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.appointment.updateMany({
        where: { tenant_id: tenant.tenant.id, doctor_id: id, deleted_at: null },
        data: { deleted_at: new Date(), status: "cancelled" },
      });
      await tx.availabilityRule.deleteMany({ where: { tenant_id: tenant.tenant.id, doctor_id: id } });
      await tx.agendaSettings.deleteMany({ where: { tenant_id: tenant.tenant.id, user_id: id } });
      await tx.doctorProfile.deleteMany({ where: { user_id: id, tenant_id: tenant.tenant.id } });
      await tx.user.deleteMany({ where: { id, tenant_id: tenant.tenant.id } });
    });

    await logAudit({
      userId: authUser.userId,
      role: authUser.role,
      action: "doctor.delete",
      entity: "doctor",
      entityId: id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return ok({ deleted: true });
  } catch (error) {
    return fail("No se pudo eliminar medico", 500, error instanceof Error ? error.message : null);
  }
}
