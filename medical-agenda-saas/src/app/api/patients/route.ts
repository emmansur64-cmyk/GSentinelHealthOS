import { fail, ok } from "@/lib/api-response";
import { logAudit, requestMeta } from "@/lib/audit";
import { requireTenant } from "@/middleware/tenantMiddleware";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";
import { patientCreateSchema } from "@/lib/validators";

export async function GET() {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  const tenant = await requireTenant(authUser);
  if (!tenant.ok) return tenant.response;

  const patients = await prisma.patient.findMany({
    orderBy: { created_at: "desc" },
  });
  return ok(
    patients.map((patient) => ({
      ...patient,
      document: "",
      contact: patient.phone,
    })),
  );
}

export async function POST(request: Request) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  if (!hasRole(authUser, ["secretaria", "recepcionista", "admin"])) return fail("Sin permisos", 403);
  const tenant = await requireTenant(authUser);
  if (!tenant.ok) return tenant.response;

  try {
    const parsed = patientCreateSchema.safeParse(await request.json());
    const meta = requestMeta(request);
    if (!parsed.success) return fail("Payload invalido", 422, parsed.error.flatten());

    const created = await prisma.patient.create({
      data: {
        name: parsed.data.name,
        phone: parsed.data.contact,
        notes: parsed.data.notes,
      },
    });
    await logAudit({
      userId: authUser.userId,
      role: authUser.role,
      action: "patient.create",
      entity: "patient",
      entityId: created.id,
      details: { name: created.name, document: parsed.data.document, contact: created.phone },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return ok(
      {
        ...created,
        document: "",
        contact: created.phone,
      },
      201,
    );
  } catch (error) {
    return fail("No se pudo crear paciente", 500, error instanceof Error ? error.message : null);
  }
}