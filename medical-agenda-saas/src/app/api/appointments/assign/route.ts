import { NextResponse } from "next/server";
import { z } from "zod";

import { fail } from "@/lib/api-response";
import { logAudit, requestMeta } from "@/lib/audit";
import { requireTenant } from "@/middleware/tenantMiddleware";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";
import { findNextAvailableSlot } from "@/lib/smart-schedule";

type DoctorCandidate = {
  user_id: string;
  specialty: string;
  user: { name: string };
  ai_tag: string;
};

const assignRequestSchema = z
  .object({
    doctorId: z.uuid().optional(),
    aiTag: z.string().trim().min(1).max(120).optional(),
    specialty: z.string().trim().min(2).max(120).optional(),
    preferredStart: z.iso.datetime().optional(),
    duration: z.number().int().min(10).max(240).default(30),
  })
  .strict();

const pad2 = (value: number) => String(value).padStart(2, "0");

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function formatTime(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

async function resolveDoctorCandidates(input: z.infer<typeof assignRequestSchema>): Promise<DoctorCandidate[]> {
  if (input.doctorId || input.aiTag) {
    const doctor = await prisma.doctorProfile.findFirst({
      where: input.doctorId
        ? { user_id: input.doctorId }
        : { ai_tag: input.aiTag },
      select: {
        user_id: true,
        specialty: true,
        ai_tag: true,
        user: { select: { name: true } },
      },
    });

    if (!doctor) return [];

    return [doctor];
  }

  if (!input.specialty) {
    return [];
  }

  const doctors = await prisma.doctorProfile.findMany({
    where: {
      specialty: {
        contains: input.specialty,
        mode: "insensitive",
      },
    },
    select: {
      user_id: true,
      specialty: true,
      ai_tag: true,
      user: { select: { name: true } },
    },
    orderBy: { user: { name: "asc" } },
  });

  return doctors;
}

export async function POST(request: Request) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  if (!hasRole(authUser, ["admin", "secretaria", "recepcionista", "doctor", "medico"])) {
    return fail("Sin permisos", 403);
  }
  const tenant = await requireTenant(authUser);
  if (!tenant.ok) return tenant.response;

  try {
    const parsed = assignRequestSchema.safeParse(await request.json());
    if (!parsed.success) return fail("Payload invalido", 422, parsed.error.flatten());

    if (!parsed.data.doctorId && !parsed.data.aiTag && !parsed.data.specialty) {
      return fail("Debes enviar doctorId, aiTag o specialty", 422);
    }

    const preferredStart = parsed.data.preferredStart ? new Date(parsed.data.preferredStart) : new Date();
    const candidates = await resolveDoctorCandidates(parsed.data);

    if (candidates.length === 0) {
      return fail("No se encontraron medicos para la solicitud", 404);
    }

    for (const doctor of candidates) {
      const slot = await findNextAvailableSlot(doctor.user_id, parsed.data.duration, {
        preferredStart,
        maxSearchDays: 60,
      });

      if (!slot) continue;

      const meta = requestMeta(request);
      await logAudit({
        userId: authUser.userId,
        role: authUser.role,
        action: "appointment.assign.preview",
        entity: "appointment",
        details: {
          doctor_id: doctor.user_id,
          ai_tag: doctor.ai_tag,
          datetime: slot.start,
          duration: parsed.data.duration,
          specialty: parsed.data.specialty ?? null,
        },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return NextResponse.json({
        doctorId: doctor.user_id,
        aiTag: doctor.ai_tag,
        fecha: formatDate(slot.start),
        hora: formatTime(slot.start),
        estado: "pendiente_confirmacion",
      });
    }

    const alternatives = await Promise.all(
      candidates.slice(0, 3).map(async (doctor) => {
        const slot = await findNextAvailableSlot(doctor.user_id, parsed.data.duration, {
          preferredStart: new Date(preferredStart.getTime() + 24 * 60 * 60 * 1000),
          maxSearchDays: 90,
        });

        if (!slot) return null;

        return {
          doctorId: doctor.user_id,
          aiTag: doctor.ai_tag,
          fecha: formatDate(slot.start),
          hora: formatTime(slot.start),
          estado: "pendiente_confirmacion" as const,
        };
      }),
    );

    return fail("Sin disponibilidad en la ventana solicitada", 409, {
      alternatives: alternatives.filter((value): value is NonNullable<typeof value> => value !== null),
    });
  } catch (error) {
    return fail("No se pudo resolver asignacion", 500, error instanceof Error ? error.message : null);
  }
}
