import { fail, ok } from "@/lib/api-response";
import { logAudit, requestMeta } from "@/lib/audit";
import { requireTenant } from "@/middleware/tenantMiddleware";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";
import { availabilityRuleSchema } from "@/lib/validators";

export async function GET(request: Request) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  const tenant = await requireTenant(authUser);
  if (!tenant.ok) return tenant.response;

  const { searchParams } = new URL(request.url);
  const doctorId = searchParams.get("doctor_id");

  const rules = await prisma.availabilityRule.findMany({
    where: doctorId ? { tenant_id: tenant.tenant.id, doctor_id: doctorId } : { tenant_id: tenant.tenant.id },
    orderBy: [{ doctor_id: "asc" }, { day_of_week: "asc" }, { start_time: "asc" }],
  });

  return ok(rules);
}

export async function POST(request: Request) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  if (!hasRole(authUser, ["secretaria", "recepcionista", "admin"])) return fail("Sin permisos", 403);
  const tenant = await requireTenant(authUser);
  if (!tenant.ok) return tenant.response;

  try {
    const parsed = availabilityRuleSchema.safeParse(await request.json());
    const meta = requestMeta(request);
    if (!parsed.success) return fail("Payload invalido", 422, parsed.error.flatten());

    const doctor = await prisma.doctorProfile.findFirst({
      where: { tenant_id: tenant.tenant.id, user_id: parsed.data.doctor_id },
    });
    if (!doctor) return fail("Doctor inexistente", 404);

    const specificDate = parsed.data.specific_date ? new Date(`${parsed.data.specific_date}T00:00:00.000Z`) : null;

    const existing = await prisma.availabilityRule.findFirst({
      where: {
        tenant_id: tenant.tenant.id,
        doctor_id: parsed.data.doctor_id,
        day_of_week: parsed.data.day_of_week,
        specific_date: specificDate,
        start_time: parsed.data.start_time,
        end_time: parsed.data.end_time,
        slot_duration: parsed.data.slot_duration,
      },
    });

    if (existing) {
      return ok(existing);
    }

    const created = await prisma.availabilityRule.create({
      data: {
        tenant_id: tenant.tenant.id,
        doctor_id: parsed.data.doctor_id,
        day_of_week: parsed.data.day_of_week,
        specific_date: specificDate,
        start_time: parsed.data.start_time,
        end_time: parsed.data.end_time,
        slot_duration: parsed.data.slot_duration,
      },
    });
    await logAudit({
      userId: authUser.userId,
      role: authUser.role,
      action: "schedule.create",
      entity: "availability_rule",
      entityId: created.id,
      details: parsed.data,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return ok(created, 201);
  } catch (error) {
    return fail("No se pudo crear regla de agenda", 500, error instanceof Error ? error.message : null);
  }
}
