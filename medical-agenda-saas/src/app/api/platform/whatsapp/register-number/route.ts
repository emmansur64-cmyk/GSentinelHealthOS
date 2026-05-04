import { z } from "zod";

import { fail, ok } from "@/lib/api-response";
import { logAudit, requestMeta } from "@/lib/audit";
import { requireClinicApi, touchLastSeen } from "@/lib/clinic-auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import {
  isValidE164Phone,
  normalizeE164Phone,
  PLATFORM_WHATSAPP_AUDIT,
  PLATFORM_WHATSAPP_ROLES,
  toSafeWhatsappConfig,
} from "@/lib/platform-whatsapp";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  whatsappPhoneNumber: z.string().trim().min(8).max(16),
}).strict();

export async function POST(request: Request) {
  const ctx = await requireClinicApi([...PLATFORM_WHATSAPP_ROLES]);
  if (!ctx.ok) return ctx.response;
  await touchLastSeen(ctx.auth);

  const rate = consumeRateLimit({
    key: `platform-whatsapp-register:${ctx.clinic.id}:${ctx.auth.userId}`,
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!rate.allowed) return fail("Demasiados intentos. Intentá nuevamente más tarde.", 429);

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return fail("Payload invalido", 422, parsed.error.flatten());

  const whatsappPhoneNumber = normalizeE164Phone(parsed.data.whatsappPhoneNumber);
  if (!isValidE164Phone(whatsappPhoneNumber)) {
    return fail("El número debe estar en formato internacional E.164. Ejemplo: +549261XXXXXXX", 422);
  }

  const existing = await prisma.clinicWhatsappAccount.findFirst({
    where: { tenantId: ctx.clinic.id, isActive: true },
    orderBy: { updatedAt: "desc" },
  });

  const account = existing
    ? await prisma.clinicWhatsappAccount.update({
        where: { id: existing.id },
        data: {
          registeredPhoneNumber: whatsappPhoneNumber,
          status: existing.status === "connected" ? "connected" : "pending",
          lastErrorAt: null,
          lastError: null,
        },
      })
    : await prisma.clinicWhatsappAccount.create({
        data: {
          tenantId: ctx.clinic.id,
          clinicId: ctx.clinic.id,
          registeredPhoneNumber: whatsappPhoneNumber,
          status: "pending",
          isActive: true,
        },
      });

  const meta = requestMeta(request);
  await logAudit({
    userId: ctx.auth.userId,
    role: ctx.auth.role,
    action: PLATFORM_WHATSAPP_AUDIT.registerNumber,
    entity: "ClinicWhatsappAccount",
    entityId: account.id,
    details: { whatsappPhoneNumber },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return ok(toSafeWhatsappConfig(account));
}
