import { fail, ok } from "@/lib/api-response";
import { logAudit, requestMeta } from "@/lib/audit";
import { hashPassword } from "@/lib/auth";
import { requireTenant } from "@/middleware/tenantMiddleware";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";
import { doctorCreateSchema } from "@/lib/validators";
import { BillingLimitError, assertCanCreateDoctor } from "@/services/billingService";
import type { Prisma } from "@prisma/client";

export async function GET() {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  const tenant = await requireTenant(authUser);
  if (!tenant.ok) return tenant.response;

  const doctors = await prisma.doctorProfile.findMany({
    select: {
      user_id: true,
      specialty: true,
      matricula: true,
      ai_tag: true,
      user: { select: { name: true, email: true } },
      availabilityRule: {
        select: {
          id: true,
          day_of_week: true,
          specific_date: true,
          start_time: true,
          end_time: true,
          slot_duration: true,
        },
        orderBy: [{ day_of_week: "asc" }, { start_time: "asc" }],
      },
    },
    orderBy: { user: { name: "asc" } },
  });

  const settings = await prisma.agendaSettings.findMany({
    select: {
      user_id: true,
      appointment_duration: true,
      buffer_minutes: true,
      start_time: true,
      end_time: true,
      working_days: true,
    },
  });

  const settingsByDoctor = new Map(settings.map((item) => [item.user_id, item]));

  return ok(
    doctors.map((doctor) => ({
      ...doctor,
      availability_weekly: doctor.availabilityRule,
      appointment_duration: settingsByDoctor.get(doctor.user_id)?.appointment_duration ?? 30,
      buffer_minutes: settingsByDoctor.get(doctor.user_id)?.buffer_minutes ?? 10,
      working_days: settingsByDoctor.get(doctor.user_id)?.working_days ?? ["monday", "tuesday", "wednesday", "thursday", "friday"],
      start_time: settingsByDoctor.get(doctor.user_id)?.start_time ?? "08:00",
      end_time: settingsByDoctor.get(doctor.user_id)?.end_time ?? "18:00",
    })),
  );
}

export async function POST(request: Request) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  if (!hasRole(authUser, ["admin", "secretaria", "recepcionista"])) return fail("Sin permisos", 403);
  const tenant = await requireTenant(authUser);
  if (!tenant.ok) return tenant.response;

  try {
    const parsed = doctorCreateSchema.safeParse(await request.json());
    const meta = requestMeta(request);
    if (!parsed.success) return fail("Payload invalido", 422, parsed.error.flatten());

    await assertCanCreateDoctor(authUser.tenantId);

    const existingMatricula = await prisma.doctorProfile.findUnique({
      where: { matricula: parsed.data.matricula },
      select: { user_id: true },
    });
    if (existingMatricula) return fail("La matricula ya existe", 409);

    const existingEmail = await prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } });
    if (existingEmail) return fail("El email ya existe", 409);

    const passwordHash = await hashPassword(parsed.data.password);

    const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const user = await tx.user.create({
        data: {
          name: parsed.data.name,
          email: parsed.data.email,
          role: "doctor",
          password_hash: passwordHash,
        },
      });

      await tx.doctorProfile.create({
        data: {
          user_id: user.id,
          specialty: parsed.data.specialty,
          matricula: parsed.data.matricula,
          ai_tag: parsed.data.ai_tag,
        },
      });

      await tx.agendaSettings.create({
        data: {
          user_id: user.id,
          appointment_duration: parsed.data.appointment_duration,
          buffer_minutes: parsed.data.buffer_minutes,
          start_time: parsed.data.start_time,
          end_time: parsed.data.end_time,
          working_days: parsed.data.working_days,
        },
      });

      return user;
    });

    await logAudit({
      userId: authUser.userId,
      role: authUser.role,
      action: "doctor.create",
      entity: "doctor",
      entityId: created.id,
      details: {
        email: parsed.data.email,
        specialty: parsed.data.specialty,
        matricula: parsed.data.matricula,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return ok({ id: created.id }, 201);
  } catch (error) {
    if (error instanceof BillingLimitError) {
      return fail("Limite de plan alcanzado", 402, {
        code: error.code,
        message: error.message,
      });
    }

    return fail("No se pudo crear medico", 500, error instanceof Error ? error.message : null);
  }

}