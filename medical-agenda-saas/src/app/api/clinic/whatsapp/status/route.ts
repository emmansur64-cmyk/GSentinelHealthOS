import { ok } from "@/lib/api-response";
import { requireClinicApi, touchLastSeen } from "@/lib/clinic-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const ctx = await requireClinicApi();
  if (!ctx.ok) return ctx.response;
  await touchLastSeen(ctx.auth);

  const account = await prisma.clinicWhatsappAccount.findFirst({
    where: { tenantId: ctx.clinic.id, isActive: true },
    orderBy: { createdAt: "desc" },
    select: {
      status: true,
      phoneNumberId: true,
      wabaId: true,
      webhookVerified: true,
    },
  });

  return ok({
    connected: account?.status === "connected",
    status: account?.status ?? "pending",
    phoneNumberId: account?.phoneNumberId ?? null,
    wabaId: account?.wabaId ?? null,
    webhookVerified: account?.webhookVerified ?? false,
  });
}
