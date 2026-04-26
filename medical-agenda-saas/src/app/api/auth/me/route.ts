import { fail, ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/server-auth";

export async function GET() {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);

  const user = await prisma.user.findUnique({
    where: { id: authUser.userId },
    select: { id: true, name: true, email: true, role: true },
  });

  if (!user) return fail("Usuario no encontrado", 404);
  return ok({ ...user, tenant_id: authUser.tenantId });
}