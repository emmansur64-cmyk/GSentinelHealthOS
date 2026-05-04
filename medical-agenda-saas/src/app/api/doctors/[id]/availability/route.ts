import { fail, ok } from "@/lib/api-response";
import { hasOverlappingTimeRanges } from "@/lib/doctor-availability";
import { logAudit, requestMeta } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { doctorAvailabilityMonthQuerySchema, doctorAvailabilityMonthSaveSchema } from "@/lib/validators";
import { requireTenant } from "@/middleware/tenantMiddleware";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";
import type { Prisma } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

function toUtcDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function isDateInsideMonth(date: string, year: number, month: number): boolean {
  const normalized = toUtcDateOnly(date);
  return normalized.getUTCFullYear() === year && normalized.getUTCMonth() + 1 === month;
}

async function assertDoctorBelongsToTenant(tenantId: string, doctorId: string) {
  return prisma.doctorProfile.findFirst({
    where: { tenant_id: tenantId, user_id: doctorId },
    select: { user_id: true },
  });
}

export async function GET(request: Request, context: Params) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);

  const tenant = await requireTenant(authUser);
  if (!tenant.ok) return tenant.response;

  const { id } = await context.params;
  const parsedQuery = doctorAvailabilityMonthQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsedQuery.success) return fail("Parametros invalidos", 422, parsedQuery.error.flatten());

  const doctor = await assertDoctorBelongsToTenant(tenant.tenant.id, id);
  if (!doctor) return fail("El profesional no pertenece a esta clinica", 404);

  const monthRecord = await prisma.doctorAvailabilityMonth.findUnique({
    where: {
      tenant_id_doctor_id_year_month: {
        tenant_id: tenant.tenant.id,
        doctor_id: id,
        year: parsedQuery.data.year,
        month: parsedQuery.data.month,
      },
    },
    include: {
      slots: {
        where: { is_available: true },
        orderBy: [{ date: "asc" }, { start_time: "asc" }],
      },
    },
  });

  return ok({
    professional_id: id,
    year: parsedQuery.data.year,
    month: parsedQuery.data.month,
    month_id: monthRecord?.id ?? null,
    slots: (monthRecord?.slots ?? []).map((slot) => ({
      id: slot.id,
      date: slot.date.toISOString().slice(0, 10),
      day_of_week: slot.day_of_week,
      start_time: slot.start_time,
      end_time: slot.end_time,
      is_available: slot.is_available,
    })),
  });
}

export async function PUT(request: Request, context: Params) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  if (!hasRole(authUser, ["admin", "secretaria", "recepcionista"])) return fail("Sin permisos", 403);

  const tenant = await requireTenant(authUser);
  if (!tenant.ok) return tenant.response;

  const { id } = await context.params;

  try {
    const parsed = doctorAvailabilityMonthSaveSchema.safeParse(await request.json());
    const meta = requestMeta(request);
    if (!parsed.success) return fail("Payload invalido", 422, parsed.error.flatten());

    const doctor = await assertDoctorBelongsToTenant(tenant.tenant.id, id);
    if (!doctor) return fail("El profesional no pertenece a esta clinica", 404);

    for (const day of parsed.data.days) {
      if (!isDateInsideMonth(day.date, parsed.data.year, parsed.data.month)) {
        return fail("Fecha invalida para el mes seleccionado", 422, { date: day.date });
      }

      for (const slot of day.slots) {
        if (slot.start_time >= slot.end_time) {
          return fail("La hora de inicio debe ser menor a la hora de fin", 422, { date: day.date, slot });
        }
      }

      if (hasOverlappingTimeRanges(day.slots)) {
        return fail("Hay horarios superpuestos", 422, { date: day.date });
      }
    }

    const normalizedSlots = parsed.data.days.flatMap((day) => {
      const baseDate = toUtcDateOnly(day.date);
      return day.slots.map((slot) => ({
        date: baseDate,
        day_of_week: baseDate.getUTCDay(),
        start_time: slot.start_time,
        end_time: slot.end_time,
      }));
    });

    const saved = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const monthRecord = await tx.doctorAvailabilityMonth.upsert({
        where: {
          tenant_id_doctor_id_year_month: {
            tenant_id: tenant.tenant.id,
            doctor_id: id,
            year: parsed.data.year,
            month: parsed.data.month,
          },
        },
        create: {
          tenant_id: tenant.tenant.id,
          doctor_id: id,
          year: parsed.data.year,
          month: parsed.data.month,
        },
        update: {},
      });

      await tx.doctorAvailabilitySlot.deleteMany({
        where: {
          availability_month_id: monthRecord.id,
          tenant_id: tenant.tenant.id,
          doctor_id: id,
        },
      });

      if (normalizedSlots.length > 0) {
        await tx.doctorAvailabilitySlot.createMany({
          data: normalizedSlots.map((slot) => ({
            availability_month_id: monthRecord.id,
            tenant_id: tenant.tenant.id,
            doctor_id: id,
            date: slot.date,
            day_of_week: slot.day_of_week,
            start_time: slot.start_time,
            end_time: slot.end_time,
            is_available: true,
          })),
        });
      }

      return tx.doctorAvailabilityMonth.findUnique({
        where: { id: monthRecord.id },
        include: {
          slots: {
            where: { is_available: true },
            orderBy: [{ date: "asc" }, { start_time: "asc" }],
          },
        },
      });
    });

    await logAudit({
      userId: authUser.userId,
      role: authUser.role,
      action: "doctor.availability_month.save",
      entity: "doctor_availability_month",
      entityId: saved?.id,
      details: {
        doctor_id: id,
        year: parsed.data.year,
        month: parsed.data.month,
        slots: normalizedSlots.length,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return ok({
      professional_id: id,
      year: parsed.data.year,
      month: parsed.data.month,
      month_id: saved?.id ?? null,
      slots: (saved?.slots ?? []).map((slot) => ({
        id: slot.id,
        date: slot.date.toISOString().slice(0, 10),
        day_of_week: slot.day_of_week,
        start_time: slot.start_time,
        end_time: slot.end_time,
        is_available: slot.is_available,
      })),
    });
  } catch (error) {
    return fail("No se pudo guardar la disponibilidad mensual", 500, error instanceof Error ? error.message : null);
  }
}