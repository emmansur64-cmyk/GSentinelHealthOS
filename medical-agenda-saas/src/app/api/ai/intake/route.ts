import { fail, ok } from "@/lib/api-response";
import { logAudit, requestMeta } from "@/lib/audit";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";
import { AiIntakeServiceError, processAiIntake } from "@/services/aiIntakeService";

function summarizePayload(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const parsed = payload as {
    doctor?: { nombre?: string; especialidad?: string; matricula?: string };
    schedule?: Array<{ fecha?: string; bloques?: unknown[] }>;
  };

  return {
    doctor: parsed.doctor
      ? {
          nombre: parsed.doctor.nombre ?? null,
          especialidad: parsed.doctor.especialidad ?? null,
          matricula: parsed.doctor.matricula ?? null,
        }
      : null,
    schedule_days: Array.isArray(parsed.schedule) ? parsed.schedule.length : 0,
    block_count: Array.isArray(parsed.schedule)
      ? parsed.schedule.reduce((acc, day) => acc + (Array.isArray(day.bloques) ? day.bloques.length : 0), 0)
      : 0,
  };
}

export async function POST(request: Request) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  if (!hasRole(authUser, ["admin", "secretaria"])) return fail("Sin permisos", 403);

  const meta = requestMeta(request);
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    await logAudit({
      userId: authUser.userId,
      role: authUser.role,
      action: "ai.intake.invalid_json",
      entity: "ai_intake",
      details: { message: "JSON invalido" },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return fail("JSON invalido", 400);
  }

  try {
    const result = await processAiIntake(payload, { tenantId: authUser.tenantId });

    await logAudit({
      userId: authUser.userId,
      role: authUser.role,
      action: "ai.intake.success",
      entity: "ai_intake",
      entityId: result.doctor_id,
      details: {
        input: summarizePayload(payload),
        output: result,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return ok(result, 201);
  } catch (error) {
    if (error instanceof AiIntakeServiceError) {
      await logAudit({
        userId: authUser.userId,
        role: authUser.role,
        action: "ai.intake.error",
        entity: "ai_intake",
        details: {
          input: summarizePayload(payload),
          message: error.message,
          details: error.details ?? null,
          status_code: error.statusCode,
        },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return fail(error.message, error.statusCode, error.details ?? null);
    }

    await logAudit({
      userId: authUser.userId,
      role: authUser.role,
      action: "ai.intake.unhandled_error",
      entity: "ai_intake",
      details: {
        input: summarizePayload(payload),
        message: error instanceof Error ? error.message : "Error desconocido",
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return fail("No se pudo procesar la ingesta de IA", 500);
  }
}
