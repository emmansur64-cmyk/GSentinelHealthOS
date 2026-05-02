import { fail, ok } from "@/lib/api-response";
import { logAudit, requestMeta } from "@/lib/audit";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";
import { requireTenant } from "@/middleware/tenantMiddleware";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

const ingestSchema = z
  .object({
    autoCreateDoctors: z.boolean().optional().default(false),
    doctor: z
      .object({
        user_id: z.uuid().optional(),
        name: z.string().trim().min(2).max(120),
        email: z.email().optional(),
        initial_password: z.string().min(12).max(128).optional(),
        specialty: z.string().trim().min(2).max(120),
        matricula: z.string().trim().min(3).max(60),
        ai_tag: z.string().trim().min(3).max(80),
        appointment_duration: z.number().int().min(10).max(240).default(30),
        buffer_minutes: z.number().int().min(0).max(60).default(10),
        start_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).default("08:00"),
        end_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).default("18:00"),
        working_days: z.array(z.string().min(2).max(16)).min(1).default(["monday", "tuesday", "wednesday", "thursday", "friday"]),
      })
      .strict(),
    availability_rules: z
      .array(
        z
          .object({
            day_of_week: z.number().int().min(0).max(6),
            specific_date: z.string().date().optional(),
            start_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
            end_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
            slot_duration: z.number().int().min(10).max(180),
          })
          .strict(),
      )
      .min(1),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (!data.doctor.user_id) {
      if (!data.doctor.email) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["doctor", "email"],
          message: "email es obligatorio cuando se crea un medico nuevo desde IA",
        });
      }
      if (!data.doctor.initial_password) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["doctor", "initial_password"],
          message: "initial_password es obligatorio cuando se crea un medico nuevo desde IA",
        });
      }
    }

    for (let i = 0; i < data.availability_rules.length; i += 1) {
      const rule = data.availability_rules[i];
      if (rule.start_time >= rule.end_time) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["availability_rules", i, "start_time"],
          message: "start_time debe ser anterior a end_time",
        });
      }
    }
  });

export async function POST(request: Request) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  if (!hasRole(authUser, ["admin", "secretaria"])) return fail("Sin permisos", 403);
  const tenant = await requireTenant(authUser);
  if (!tenant.ok) return tenant.response;

  try {
    const parsed = ingestSchema.safeParse(await request.json());
    const meta = requestMeta(request);
    if (!parsed.success) return fail("Payload invalido", 422, parsed.error.flatten());

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      let doctorUserId = parsed.data.doctor.user_id;
      const autoCreateDoctors = Boolean(parsed.data.autoCreateDoctors);

      if (doctorUserId) {
        const existingDoctor = await tx.doctorProfile.findFirst({
          where: { user_id: doctorUserId, tenant_id: tenant.tenant.id },
          select: { user_id: true },
        });
        if (!existingDoctor) {
          if (!autoCreateDoctors) {
            throw new Error("DOCTOR_NOT_FOUND");
          }
          doctorUserId = undefined;
        }
      }

      if (!doctorUserId) {
        const existingByMatricula = await tx.doctorProfile.findFirst({
          where: { tenant_id: tenant.tenant.id, matricula: parsed.data.doctor.matricula },
          select: { user_id: true },
        });

        if (existingByMatricula) {
          doctorUserId = existingByMatricula.user_id;
        } else {
          const existingEmail = await tx.user.findFirst({
            where: { tenant_id: tenant.tenant.id, email: parsed.data.doctor.email! },
            select: { id: true },
          });
          if (existingEmail) {
            throw new Error("EMAIL_ALREADY_EXISTS");
          }

          const passwordHash = await hashPassword(parsed.data.doctor.initial_password!);
          const user = await tx.user.create({
            data: {
              name: parsed.data.doctor.name,
              email: parsed.data.doctor.email!,
              role: "doctor",
              tenant_id: tenant.tenant.id,
              password_hash: passwordHash,
            },
          });

          await tx.doctorProfile.create({
            data: {
              user_id: user.id,
              tenant_id: tenant.tenant.id,
              specialty: parsed.data.doctor.specialty,
              matricula: parsed.data.doctor.matricula,
              ai_tag: parsed.data.doctor.ai_tag,
            },
          });

          doctorUserId = user.id;
        }
      }

      if (!doctorUserId) {
        throw new Error("DOCTOR_ID_RESOLUTION_FAILED");
      }

      await tx.agendaSettings.upsert({
        where: { user_id: doctorUserId },
        create: {
          user_id: doctorUserId,
          tenant_id: tenant.tenant.id,
          appointment_duration: parsed.data.doctor.appointment_duration,
          buffer_minutes: parsed.data.doctor.buffer_minutes,
          start_time: parsed.data.doctor.start_time,
          end_time: parsed.data.doctor.end_time,
          working_days: parsed.data.doctor.working_days,
        },
        update: {
          appointment_duration: parsed.data.doctor.appointment_duration,
          buffer_minutes: parsed.data.doctor.buffer_minutes,
          start_time: parsed.data.doctor.start_time,
          end_time: parsed.data.doctor.end_time,
          working_days: parsed.data.doctor.working_days,
        },
      });

      const createdRules: string[] = [];
      for (const rule of parsed.data.availability_rules) {
        const specificDate = rule.specific_date ? new Date(`${rule.specific_date}T00:00:00.000Z`) : null;

        const existingRule = await tx.availabilityRule.findFirst({
          where: {
            tenant_id: tenant.tenant.id,
            doctor_id: doctorUserId,
            day_of_week: rule.day_of_week,
            specific_date: specificDate,
            start_time: rule.start_time,
            end_time: rule.end_time,
            slot_duration: rule.slot_duration,
          },
          select: { id: true },
        });

        if (existingRule) {
          createdRules.push(existingRule.id);
          continue;
        }

        const created = await tx.availabilityRule.create({
          data: {
            tenant_id: tenant.tenant.id,
            doctor_id: doctorUserId,
            day_of_week: rule.day_of_week,
            specific_date: specificDate,
            start_time: rule.start_time,
            end_time: rule.end_time,
            slot_duration: rule.slot_duration,
          },
        });
        createdRules.push(created.id);
      }

      return {
        doctor_user_id: doctorUserId,
        persisted_rules: createdRules.length,
      };
    });

    await logAudit({
      userId: authUser.userId,
      role: authUser.role,
      action: "import.agenda.ingest",
      entity: "availability_rule",
      entityId: result.doctor_user_id,
      details: {
        doctor_user_id: result.doctor_user_id,
        persisted_rules: result.persisted_rules,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return ok(result, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "DOCTOR_NOT_FOUND") {
      return fail("El doctor indicado no existe", 404);
    }
    if (error instanceof Error && error.message === "EMAIL_ALREADY_EXISTS") {
      return fail("El email del medico ya existe", 409);
    }

    return fail("No se pudo persistir la importacion de agenda", 500, error instanceof Error ? error.message : null);
  }
}
