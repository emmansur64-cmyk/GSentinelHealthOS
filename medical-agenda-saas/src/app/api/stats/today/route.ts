import { fail, ok } from "@/lib/api-response";
import { requireTenant } from "@/middleware/tenantMiddleware";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/server-auth";

export async function GET() {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  const tenant = await requireTenant(authUser);
  if (!tenant.ok) return tenant.response;

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const appointmentsToday = await prisma.appointment.findMany({
    where: {
      tenant_id: tenant.tenant.id,
      deleted_at: null,
      datetime: { gte: startOfDay, lte: endOfDay },
    },
    select: { status: true },
  });

  const turnosHoy = appointmentsToday.length;
  const pacientesEnEspera = appointmentsToday.filter((item) => item.status === "scheduled").length;
  const cancelaciones = appointmentsToday.filter((item) => item.status === "cancelled").length;
  const turnosEfectivos = turnosHoy - cancelaciones;
  const ocupacionPct = turnosHoy === 0 ? 0 : Math.round((turnosEfectivos / turnosHoy) * 100);

  return ok({
    turnos_hoy: turnosHoy,
    pacientes_en_espera: pacientesEnEspera,
    ocupacion_pct: ocupacionPct,
    cancelaciones,
  });
}