import { z } from "zod";

import { fail, ok } from "@/lib/api-response";
import { requireClinicApi, touchLastSeen } from "@/lib/clinic-auth";
import { getMetaOAuthConfig } from "@/lib/meta-whatsapp";
import { prisma } from "@/lib/prisma";
import { decryptText } from "@/lib/security/encryption";

const registerSchema = z.object({
  pin: z.string().regex(/^\d{6}$/, "El PIN debe tener 6 digitos"),
  phone_number_id: z.string().trim().min(4).optional(),
}).strict();

export async function POST(request: Request) {
  const ctx = await requireClinicApi();
  if (!ctx.ok) return ctx.response;
  await touchLastSeen(ctx.auth);

  const parsed = registerSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return fail("Payload invalido", 422, parsed.error.flatten());

  const config = getMetaOAuthConfig();
  const apiVersion = config.ok ? config.apiVersion : process.env.WHATSAPP_API_VERSION || "v18.0";

  const account = await prisma.clinicWhatsappAccount.findFirst({
    where: {
      tenantId: ctx.clinic.id,
      isActive: true,
      ...(parsed.data.phone_number_id ? { phoneNumberId: parsed.data.phone_number_id } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, phoneNumberId: true, accessTokenEncrypted: true },
  });

  if (!account?.phoneNumberId || !account.accessTokenEncrypted) {
    return fail("No hay cuenta WhatsApp conectada para esta clinica", 404);
  }

  const response = await fetch(`https://graph.facebook.com/${apiVersion}/${account.phoneNumberId}/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${decryptText(account.accessTokenEncrypted)}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      pin: parsed.data.pin,
    }),
  });

  const body = await response.json().catch(() => ({})) as { success?: boolean; error?: { message?: string } };
  if (!response.ok || body.error) {
    await prisma.clinicWhatsappAccount.update({
      where: { id: account.id },
      data: {
        status: "error",
        lastErrorAt: new Date(),
        lastError: body.error?.message?.slice(0, 1000) ?? `Meta register HTTP ${response.status}`,
      },
    });
    return fail("No se pudo registrar el numero en Meta", 502, { message: body.error?.message ?? `HTTP ${response.status}` });
  }

  const updated = await prisma.clinicWhatsappAccount.update({
    where: { id: account.id },
    data: { status: "connected", lastErrorAt: null, lastError: null },
    select: { phoneNumberId: true, status: true },
  });

  return ok(updated);
}

