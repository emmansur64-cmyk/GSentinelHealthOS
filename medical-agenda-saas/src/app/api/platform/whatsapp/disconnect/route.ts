import { fail, ok } from "@/lib/api-response";
import { logAudit, requestMeta } from "@/lib/audit";
import { requireClinicApi, touchLastSeen } from "@/lib/clinic-auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import { PLATFORM_WHATSAPP_AUDIT, PLATFORM_WHATSAPP_ROLES, toSafeWhatsappConfig } from "@/lib/platform-whatsapp";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const ctx = await requireClinicApi([...PLATFORM_WHATSAPP_ROLES]);
  if (!ctx.ok) return ctx.response;
  await touchLastSeen(ctx.auth);

  const rate = consumeRateLimit({
    key: `platform-whatsapp-disconnect:${ctx.clinic.id}:${ctx.auth.userId}`,
    limit: 6,
    windowMs: 60 * 60 * 1000,
  });
  if (!rate.allowed) return fail("Demasiados intentos. Intentá nuevamente más tarde.", 429);

  const account = await prisma.clinicWhatsappAccount.findFirst({
    where: { tenantId: ctx.clinic.id, isActive: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!account) return ok(toSafeWhatsappConfig(null));

  const updated = await prisma.clinicWhatsappAccount.update({
    where: { id: account.id },
    data: {
      status: "disconnected",
      accessTokenEncrypted: null,
      refreshTokenEncrypted: null,
      tokenType: null,
      expiresAt: null,
      isActive: true,
      lastVerifiedAt: new Date(),
      lastErrorAt: null,
      lastError: null,
    },
  });

  const meta = requestMeta(request);
  await logAudit({
    userId: ctx.auth.userId,
    role: ctx.auth.role,
    action: PLATFORM_WHATSAPP_AUDIT.disconnect,
    entity: "ClinicWhatsappAccount",
    entityId: updated.id,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return ok(toSafeWhatsappConfig(updated));
}
