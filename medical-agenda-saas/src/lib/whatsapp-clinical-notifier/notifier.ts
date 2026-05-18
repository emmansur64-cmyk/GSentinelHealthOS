import { resolveWhatsAppAccount } from "@/lib/whatsapp/account-resolver";
import { getClinicalNotifierConfig } from "@/lib/whatsapp-clinical-notifier/config";
import { extractE164 } from "@/lib/whatsapp-clinical-notifier/phone";

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

  const account = await resolveWhatsAppAccount({
    tenantId: input.tenantId,
    phoneNumberId: cfg.phoneNumberId || undefined,
  });

  const url = `${cfg.baseUrl}/${cfg.apiVersion}/${cfg.phoneNumberId || account.phoneNumberId}/messages`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.token || account.accessToken}`,
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
