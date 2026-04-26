import { fail, ok } from "@/lib/api-response";
import { logAudit, requestMeta } from "@/lib/audit";
import { hashPassword } from "@/lib/auth";
import { requireTenant } from "@/middleware/tenantMiddleware";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";
import { userCreateSchema } from "@/lib/validators";
import { BillingLimitError, assertCanCreateDoctor } from "@/services/billingService";
import type { Prisma } from "@prisma/client";

export async function GET() {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  if (!hasRole(authUser, ["admin", "secretaria", "recepcionista"])) return fail("Sin permisos", 403);
  const tenant = await requireTenant(authUser);
  if (!tenant.ok) return tenant.response;

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      doctorProfile: { select: { specialty: true } },
    },
    orderBy: { created_at: "desc" },
  });

  return ok(users);
}

export async function POST(request: Request) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  if (!hasRole(authUser, ["admin", "secretaria", "recepcionista"])) return fail("Sin permisos", 403);
  const tenant = await requireTenant(authUser);
  if (!tenant.ok) return tenant.response;

  try {
    const parsed = userCreateSchema.safeParse(await request.json());
    const meta = requestMeta(request);
    if (!parsed.success) return fail("Payload invalido", 422, parsed.error.flatten());

    if (parsed.data.role === "doctor") {
      await assertCanCreateDoctor(authUser.tenantId);
    }

    const email = parsed.data.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) return fail("El email ya existe", 409);

    const passwordHash = await hashPassword(parsed.data.password);

    const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const user = await tx.user.create({
        data: {
          name: parsed.data.name,
          role: parsed.data.role,
          email,
          password_hash: passwordHash,
        },
      });

      if (parsed.data.role === "doctor") {
        await tx.doctorProfile.create({
          data: {
            user_id: user.id,
            specialty: parsed.data.specialty!,
            matricula: parsed.data.matricula!,
            ai_tag: parsed.data.ai_tag!,
          },
        });
      }

      return user;
    });

    await logAudit({
      userId: authUser.userId,
      role: authUser.role,
      action: "user.create",
      entity: "user",
      entityId: created.id,
      details: { role: created.role, email: created.email },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return ok(created, 201);
  } catch (error) {
    if (error instanceof BillingLimitError) {
      return fail("Limite de plan alcanzado", 402, {
        code: error.code,
        message: error.message,
      });
    }

    return fail("No se pudo crear usuario", 500, error instanceof Error ? error.message : null);
  }
}