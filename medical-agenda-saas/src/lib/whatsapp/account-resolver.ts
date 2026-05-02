import { prisma } from "@/lib/prisma";
import { decryptText } from "@/lib/security/encryption";
import { logServer, logServerError } from "@/lib/server-logger";

export type ResolvedWhatsAppAccount = {
  accessToken: string;
  phoneNumberId: string;
  source: "tenant" | "global";
};

export async function resolveWhatsAppAccount(input: {
  tenantId?: string;
  phoneNumberId?: string;
}): Promise<ResolvedWhatsAppAccount> {
  const tenantId = input.tenantId?.trim();

  if (tenantId) {
    try {
      const account = await prisma.clinicWhatsappAccount.findFirst({
        where: {
          tenantId,
          isActive: true,
          ...(input.phoneNumberId ? { phoneNumberId: input.phoneNumberId } : {}),
        },
        select: {
          id: true,
          accessTokenEncrypted: true,
          phoneNumberId: true,
          expiresAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      if (account?.accessTokenEncrypted && account.phoneNumberId) {
        if (account.expiresAt && account.expiresAt.getTime() <= Date.now()) {
          await prisma.clinicWhatsappAccount.update({
            where: { id: account.id },
            data: {
              status: "error",
              lastErrorAt: new Date(),
              lastError: "Meta access token expired",
            },
          });
          throw new Error("Meta access token expired for clinic WhatsApp account");
        }

        return {
          accessToken: decryptText(account.accessTokenEncrypted),
          phoneNumberId: account.phoneNumberId,
          source: "tenant",
        };
      }
    } catch (error) {
      logServerError("whatsapp.account_resolver.tenant_failed", error, { tenant_id: tenantId });
    }
  }

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = input.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) {
    throw new Error("WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID are required");
  }

  logServer("warn", "whatsapp.account_resolver.using_global_fallback", { tenant_id: tenantId ?? null });
  return { accessToken, phoneNumberId, source: "global" };
}
