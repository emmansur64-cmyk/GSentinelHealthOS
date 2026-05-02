import { fail, ok } from "@/lib/api-response";
import { logAudit, requestMeta } from "@/lib/audit";
import { requireTenant } from "@/middleware/tenantMiddleware";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";
import { autoAssignAppointment } from "@/services/appointmentEngine";

function summarizeInput(input: unknown) {
  if (!input || typeof input !== "object") return null;
  const payload = input as {
    patient?: { nombre?: string; documento?: string; telefono?: string };
    filters?: {
      especialidad?: string;
      doctor_id?: string;
      fecha_desde?: string;
      fecha_hasta?: string;
      preferencia_horaria?: string;
      tipo_consulta?: string;
    };
  };

  return {
    patient_nombre: payload.patient?.nombre ?? null,
    patient_documento: payload.patient?.documento ?? null,
    patient_telefono: payload.patient?.telefono ?? null,
    especialidad: payload.filters?.especialidad ?? null,
    doctor_id: payload.filters?.doctor_id ?? null,
    fecha_desde: payload.filters?.fecha_desde ?? null,
    fecha_hasta: payload.filters?.fecha_hasta ?? null,
    preferencia_horaria: payload.filters?.preferencia_horaria ?? null,
    tipo_consulta: payload.filters?.tipo_consulta ?? null,
  };
}

function parseInvalidPayload(error: unknown): unknown | null {
  if (!(error instanceof Error)) return null;

  try {
    const parsed = JSON.parse(error.message) as { code?: string; details?: unknown };
    if (parsed.code === "INVALID_PAYLOAD") {
      return parsed.details ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  if (!hasRole(authUser, ["admin", "secretaria", "recepcionista", "doctor", "medico"])) return fail("Sin permisos", 403);
  const tenant = await requireTenant(authUser);
  if (!tenant.ok) return tenant.response;

  const meta = requestMeta(request);
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return fail("JSON invalido", 400);
  }

  try {
    const decision = await autoAssignAppointment(payload, { tenantId: tenant.tenant.id });

    await logAudit({
      userId: authUser.userId,
      role: authUser.role,
      action: "appointment.auto_assign",
      entity: "appointment",
      entityId: decision.status === "assigned" ? decision.appointment.id : null,
      details: {
        input: summarizeInput(payload),
        status: decision.status,
        attempts: decision.attempts,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    if (decision.status === "no_availability") {
      return ok({
        status: "no_availability",
      });
    }

    return ok({
      status: "assigned",
      appointment: decision.appointment,
    }, 201);
  } catch (error) {
    const validationDetails = parseInvalidPayload(error);
    if (validationDetails) {
      return fail("Payload invalido", 422, validationDetails);
    }

    await logAudit({
      userId: authUser.userId,
      role: authUser.role,
      action: "appointment.auto_assign.error",
      entity: "appointment",
      details: {
        input: summarizeInput(payload),
        error: error instanceof Error ? error.message : "unknown_error",
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return fail("No se pudo auto-asignar turno", 500, error instanceof Error ? error.message : null);
  }
}
