import { ok } from "@/lib/api-response";
import { requireClinicApi, touchLastSeen } from "@/lib/clinic-auth";
import { toSafeWhatsappConfig, PLATFORM_WHATSAPP_ROLES } from "@/lib/platform-whatsapp";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const ctx = await requireClinicApi([...PLATFORM_WHATSAPP_ROLES]);
  if (!ctx.ok) return ctx.response;
  await touchLastSeen(ctx.auth);

  const account = await prisma.clinicWhatsappAccount.findFirst({
    where: { tenantId: ctx.clinic.id, isActive: true },
    orderBy: { updatedAt: "desc" },
  });

  return ok(toSafeWhatsappConfig(account));
}
