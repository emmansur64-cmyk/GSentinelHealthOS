import { prisma } from "@/lib/prisma";
import { decryptText } from "@/lib/security/encryption";
import { getClinicalNotifierConfig } from "@/lib/whatsapp-clinical-notifier/config";
import { extractE164 } from "@/lib/whatsapp-clinical-notifier/phone";

type LocalNotifierCredentials = {
  accessToken: string;
  phoneNumberId: string;
};

export type ClinicalNotifierSendInput = {
  tenantId: string;
  to: string;
  body: string;
};

export type ClinicalNotifierSendResult = {
  sent: boolean;
  dryRun: boolean;
  providerMessageId: string | null;
  providerStatus: number | null;
  providerResponse: string;
};

async function resolveLocalCredentials(tenantId: string): Promise<LocalNotifierCredentials> {
  const cfg = getClinicalNotifierConfig();
  if (cfg.token && cfg.phoneNumberId) {
    return { accessToken: cfg.token, phoneNumberId: cfg.phoneNumberId };
  }

  const account = await prisma.clinicWhatsappAccount.findFirst({
    where: {
      tenantId,
      isActive: true,
      accessTokenEncrypted: { not: null },
      phoneNumberId: { not: null },
    },
    select: {
      accessTokenEncrypted: true,
      phoneNumberId: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!account?.accessTokenEncrypted || !account.phoneNumberId) {
    throw new Error("WHATSAPP_CLINICAL_NOTIFIER credentials are not configured");
  }

  return {
    accessToken: decryptText(account.accessTokenEncrypted),
    phoneNumberId: account.phoneNumberId,
  };
}

export async function sendClinicalWhatsAppNotification(input: ClinicalNotifierSendInput): Promise<ClinicalNotifierSendResult> {
  const cfg = getClinicalNotifierConfig();

  if (!cfg.enabled || cfg.dryRun) {
    return {
      sent: false,
      dryRun: true,
      providerMessageId: null,
      providerStatus: null,
      providerResponse: "dry_run",
    };
  }

  const credentials = await resolveLocalCredentials(input.tenantId);
  const url = `${cfg.baseUrl}/${cfg.apiVersion}/${credentials.phoneNumberId}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${credentials.accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: extractE164(input.to).replace(/^\+/, ""),
      type: "text",
      text: { body: input.body },
    }),
  });

  const responseText = await response.text();
  let providerMessageId: string | null = null;
  try {
    const parsed = JSON.parse(responseText) as { messages?: Array<{ id?: string }> };
    providerMessageId = parsed.messages?.[0]?.id ?? null;
  } catch {
    providerMessageId = null;
  }

  return {
    sent: response.ok,
    dryRun: false,
    providerMessageId,
    providerStatus: response.status,
    providerResponse: responseText.slice(0, 800),
  };
}
