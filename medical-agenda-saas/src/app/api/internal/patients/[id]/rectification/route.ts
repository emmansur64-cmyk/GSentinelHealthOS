import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/compliance/audit-log";
import { requireRole, requireSessionWithTenant } from "@/lib/compliance/access";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

const requestSchema = z.object({
  note: z.string().trim().min(10).max(2000),
});

export async function POST(request: Request, context: Params) {
  const session = await requireSessionWithTenant();
  if (!session.ok) return session.response;

  const role = await requireRole(session.authUser, ["CLINIC_ADMIN", "DOCTOR", "SECRETARY", "AUDITOR"]);
  if (!role.ok) return role.response;

  const { id } = await context.params;

  const patient = await prisma.patient.findFirst({
    where: { id, tenant_id: session.tenantId },
    select: { id: true },
  });

  if (!patient) return fail("Paciente no encontrado", 404);

  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return fail("Payload invalido", 422, parsed.error.flatten());

  const created = await prisma.patientDataRequest.create({
    data: {
      tenant_id: session.tenantId,
      patient_id: patient.id,
      requested_by_user_id: session.authUser.userId,
      request_type: "RECTIFICATION",
      status: "OPEN",
      note: parsed.data.note,
    },
  });

  await auditLog({
    tenantId: session.tenantId,
    actorUserId: session.authUser.userId,
    patientId: patient.id,
    entityType: "patient_data_request",
    entityId: created.id,
    action: "CREATE",
    metadata: {
      request_type: created.request_type,
      status: created.status,
    },
  });

  return ok({ request_id: created.id, status: created.status }, 201);
}
