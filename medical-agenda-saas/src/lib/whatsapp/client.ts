import { logServer, logServerError } from "@/lib/server-logger";
import { prisma } from "@/lib/prisma";
import { observeStageLatency } from "@/lib/observability/metrics";
import { withSpan } from "@/lib/observability/tracing";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;
const TIMEOUT_MS = 10_000;

export function normalizeWhatsAppRecipient(phone: string): string {
  const digits = String(phone ?? "").replace(/\D/g, "");

  // Meta muestra los destinatarios de prueba argentinos como 54 + area + 15 + numero.
  // Ejemplo: +54 9 263 472 3151 -> 54263154723151.
  if (digits.startsWith("549") && digits.length >= 13) {
    const national = digits.slice(3);
    const areaLength = national.startsWith("11") ? 2 : national.length === 10 ? 3 : 4;
    return `54${national.slice(0, areaLength)}15${national.slice(areaLength)}`;
  }

  return digits;
}

function getConfig() {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const apiVersion = process.env.WHATSAPP_API_VERSION || "v21.0";

  if (!accessToken || !phoneNumberId) {
    throw new Error("WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID are required");
  }

  return { accessToken, phoneNumberId, apiVersion };
}

type SendResult = {
  success: boolean;
  waMessageId?: string;
  error?: string;
};

/**
 * Envía un mensaje de texto via WhatsApp Cloud API con retry automático.
 * Guarda en outgoing_messages independientemente del resultado.
 */
export async function sendWhatsAppMessage(
  phone: string,
  message: string,
): Promise<SendResult> {
  const sendStarted = performance.now();
  const recipientPhone = normalizeWhatsAppRecipient(phone);

  const outgoing = await prisma.outgoingMessage.create({
    data: { phone, message, status: "pending" },
  });

  const { accessToken, phoneNumberId, apiVersion } = getConfig();
  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

  let lastError: string | undefined;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await withSpan(
        "send_message",
        { provider: "meta_whatsapp", attempt },
        async () => fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: recipientPhone,
            type: "text",
            text: { body: message },
          }),
          signal: controller.signal,
        }),
      );

      clearTimeout(timeout);

      const body = await response.json() as {
        messages?: Array<{ id: string }>;
        error?: { message: string; code: number };
      };

      if (response.ok && body.messages?.[0]?.id) {
        const waId = body.messages[0].id;

        await prisma.outgoingMessage.update({
          where: { id: outgoing.id },
          data: {
            wa_id: waId,
            status: "sent",
            sent_at: new Date(),
          },
        });

        logServer("info", "whatsapp.send.success", {
          phone,
          recipient_phone: recipientPhone,
          wa_id: waId,
          attempt,
        });

        observeStageLatency("send_message", performance.now() - sendStarted);

        return { success: true, waMessageId: waId };
      }

      lastError = body.error?.message ?? `HTTP ${response.status}`;

      // No retry en errores 4xx (salvo 429)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        break;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Unknown error";
    }

    // Backoff exponencial
    if (attempt < MAX_RETRIES - 1) {
      await new Promise((r) => setTimeout(r, BASE_DELAY_MS * 2 ** attempt));
    }
  }

  await prisma.outgoingMessage.update({
    where: { id: outgoing.id },
    data: {
      status: "failed",
      error: lastError?.slice(0, 1000) ?? "Unknown error",
    },
  });

  logServerError("whatsapp.send.failed", new Error(lastError ?? "Unknown"), {
    phone,
    recipient_phone: recipientPhone,
    outgoing_id: outgoing.id,
  });

  observeStageLatency("send_message", performance.now() - sendStarted);

  return { success: false, error: lastError };
}

/**
 * Marca el status de un mensaje saliente al recibir status callback de Meta.
 */
export async function updateOutgoingStatus(
  waMessageId: string,
  status: "delivered" | "read" | "failed",
): Promise<void> {
  try {
    const existing = await prisma.outgoingMessage.findFirst({
      where: { wa_id: waMessageId },
      select: { id: true, status: true },
    });

    if (!existing) return;

    // No downgrade: read > delivered > sent
    const rank: Record<string, number> = { pending: 0, sent: 1, delivered: 2, read: 3, failed: -1 };
    const newRank = rank[status] ?? 0;
    const currentRank = rank[existing.status] ?? 0;

    if (newRank <= currentRank && status !== "failed") return;

    await prisma.outgoingMessage.update({
      where: { id: existing.id },
      data: { status },
    });

    logServer("info", "whatsapp.status.updated", { wa_id: waMessageId, status });
  } catch (error) {
    logServerError("whatsapp.status.update.failed", error, { wa_id: waMessageId });
  }
}
