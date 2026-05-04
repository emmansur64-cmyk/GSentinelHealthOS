import { fail, ok } from "@/lib/api-response";
import { logAudit, requestMeta } from "@/lib/audit";
import { requireClinicApi, touchLastSeen } from "@/lib/clinic-auth";
import { buildMetaOAuthUrl, getMetaOAuthConfig } from "@/lib/meta-whatsapp";
import {
  createOAuthStateValue,
  hashOAuthState,
  PLATFORM_WHATSAPP_AUDIT,
  PLATFORM_WHATSAPP_ROLES,
} from "@/lib/platform-whatsapp";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ctx = await requireClinicApi([...PLATFORM_WHATSAPP_ROLES]);
  if (!ctx.ok) return ctx.response;
  await touchLastSeen(ctx.auth);

  const rate = consumeRateLimit({
    key: `platform-whatsapp-oauth:${ctx.clinic.id}:${ctx.auth.userId}`,
    limit: 8,
    windowMs: 60 * 60 * 1000,
  });
  if (!rate.allowed) return fail("Demasiados intentos. Intentá nuevamente más tarde.", 429);

  const account = await prisma.clinicWhatsappAccount.findFirst({
    where: { tenantId: ctx.clinic.id, isActive: true },
    orderBy: { updatedAt: "desc" },
    select: { id: true, registeredPhoneNumber: true },
  });
  if (!account?.registeredPhoneNumber) return fail("Primero registrá el número de WhatsApp Business.", 409);

  const config = getMetaOAuthConfig();
  if (!config.ok) return fail("Meta OAuth no configurado", 503, { missing: config.missing });

  const state = createOAuthStateValue();
  await prisma.platformOAuthState.create({
    data: {
      tenant_id: ctx.clinic.id,
      user_id: ctx.auth.userId,
      state_hash: hashOAuthState(state),
      purpose: "platform_whatsapp_meta_oauth",
      expires_at: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  const meta = requestMeta(request);
  await logAudit({
    userId: ctx.auth.userId,
    role: ctx.auth.role,
    action: PLATFORM_WHATSAPP_AUDIT.startAuth,
    entity: "ClinicWhatsappAccount",
    entityId: account.id,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return ok({
    url: buildMetaOAuthUrl({
      appId: config.appId,
      redirectUri: config.redirectUri,
      state,
    }),
  });
}
