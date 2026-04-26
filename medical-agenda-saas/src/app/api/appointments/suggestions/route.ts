import { fail, ok } from "@/lib/api-response";
import { logAudit, requestMeta } from "@/lib/audit";
import { requireTenant } from "@/middleware/tenantMiddleware";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";
import { suggestOptimalSlots } from "@/lib/smart-schedule";
import { appointmentSuggestionsQuerySchema } from "@/lib/validators";

export async function GET(request: Request) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  if (!hasRole(authUser, ["admin", "secretaria", "recepcionista", "doctor", "medico"])) {
    return fail("Sin permisos", 403);
  }
  const tenant = await requireTenant(authUser);
  if (!tenant.ok) return tenant.response;

  try {
    const url = new URL(request.url);
    const parsed = appointmentSuggestionsQuerySchema.safeParse({
      doctor_id: url.searchParams.get("doctor_id") ?? undefined,
      duration: url.searchParams.get("duration") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      preferred_start: url.searchParams.get("preferred_start") ?? undefined,
    });

    if (!parsed.success) return fail("Query invalida", 422, parsed.error.flatten());

    const doctor = await prisma.doctorProfile.findUnique({
      where: { user_id: parsed.data.doctor_id },
      select: { user_id: true },
    });
    if (!doctor) return fail("Doctor inexistente", 404);

    const preferredStart = parsed.data.preferred_start ? new Date(parsed.data.preferred_start) : undefined;
    const limit = parsed.data.limit ?? 5;

    const suggestions = await suggestOptimalSlots(
      parsed.data.doctor_id,
      parsed.data.duration,
      limit,
      {
        preferredStart,
        maxSearchDays: 60,
      },
    );

    const meta = requestMeta(request);
    await logAudit({
      userId: authUser.userId,
      role: authUser.role,
      action: "appointment.suggestions.read",
      entity: "appointment",
      details: {
        doctor_id: parsed.data.doctor_id,
        duration: parsed.data.duration,
        limit,
        preferred_start: parsed.data.preferred_start ?? null,
        returned: suggestions.length,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return ok({
      doctor_id: parsed.data.doctor_id,
      duration: parsed.data.duration,
      limit,
      suggestions: suggestions.map((slot) => ({
        start: slot.start,
        end: slot.end,
        day_of_week: slot.day_of_week,
        slot_duration: slot.slot_duration,
        source: slot.source,
      })),
    });
  } catch (error) {
    return fail("No se pudieron calcular sugerencias", 500, error instanceof Error ? error.message : null);
  }
}
