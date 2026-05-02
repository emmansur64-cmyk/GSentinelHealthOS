import { ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminApi } from "@/lib/super-admin";

export async function GET() {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;

  const rows = await prisma.clinicWhatsappAccount.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      tenantId: true,
      clinicId: true,
      status: true,
      phoneNumberId: true,
      wabaId: true,
      webhookVerified: true,
      updatedAt: true,
      lastError: true,
    },
  });

  return ok(rows);
}
