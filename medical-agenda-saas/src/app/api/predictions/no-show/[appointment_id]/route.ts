import { fail, ok } from "@/lib/api-response";
import { requireTenant } from "@/middleware/tenantMiddleware";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";
import { predictNoShowByAppointmentId } from "@/services/predictionEngine";

export async function GET(_request: Request, context: { params: Promise<{ appointment_id: string }> }) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  if (!hasRole(authUser, ["admin", "secretaria", "recepcionista", "doctor", "medico"])) return fail("Sin permisos", 403);
  const tenant = await requireTenant(authUser);
  if (!tenant.ok) return tenant.response;

  const { appointment_id } = await context.params;
  if (!appointment_id) return fail("appointment_id requerido", 400);

  try {
    const prediction = await predictNoShowByAppointmentId(appointment_id);

    return ok({
      appointment_id,
      probabilidad_no_show: Number(prediction.probability.toFixed(4)),
      risk_level: prediction.riskLevel,
      model_version: prediction.modelVersion,
      features: {
        day_of_week: prediction.features.dayOfWeek,
        hour_of_day: prediction.features.hourOfDay,
        lead_time_days: Number(prediction.features.leadTimeDays.toFixed(2)),
        franja_horaria: prediction.features.timeBucket,
        no_show_rate_paciente: Number(prediction.features.patientNoShowRate.toFixed(4)),
        no_show_rate_medico: Number(prediction.features.doctorNoShowRate.toFixed(4)),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "APPOINTMENT_NOT_FOUND") {
      return fail("Turno no encontrado", 404);
    }

    return fail("No se pudo calcular prediccion", 500, error instanceof Error ? error.message : null);
  }
}
