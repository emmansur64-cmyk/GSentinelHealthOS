import { NextResponse } from "next/server";
import { logServer, logServerError } from "@/lib/server-logger";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature } from "@/lib/whatsapp/verify-signature";
import {
  parseWebhookPayload,
  extractMessages,
  extractStatuses,
} from "@/lib/whatsapp/parse-webhook";
import { enqueueIncomingMessage } from "@/lib/whatsapp/queue";
import { processIncomingMessage } from "@/lib/whatsapp/conversation-engine";
import { isRedisAvailable } from "@/lib/whatsapp/redis";
import { updateOutgoingStatus } from "@/lib/whatsapp/client";
import { startScaledWorkers } from "@/lib/whatsapp/scaled-workers";
import { runWithObservabilityContext, createTraceId, enrichObservabilityContext } from "@/lib/observability/context";
import { withSpan } from "@/lib/observability/tracing";
import { observeRequest, observeStageLatency } from "@/lib/observability/metrics";

let workersBootPromise: Promise<void> | null = null;
const QUEUE_ENQUEUE_TIMEOUT_MS = 1500;

function shouldAutoBootWorkers(): boolean {
  const raw = (process.env.WHATSAPP_AUTO_BOOT_WORKERS ?? "").trim().toLowerCase();
  if (raw === "true" || raw === "1" || raw === "yes") return true;
  if (raw === "false" || raw === "0" || raw === "no") return false;

  return process.env.NODE_ENV !== "production";
}

async function ensureWorkersBooted(): Promise<void> {
  if (!shouldAutoBootWorkers()) return;
  if (!isRedisAvailable()) return;

  if (!workersBootPromise) {
    workersBootPromise = startScaledWorkers().catch((error) => {
      workersBootPromise = null;
      throw error;
    });
  }

  await workersBootPromise;
}

async function dispatchIncomingMessage(messageId: string): Promise<"queued" | "inline"> {
  if (!isRedisAvailable()) {
    await processIncomingMessage(messageId);
    return "inline";
  }

  try {
    await Promise.race([
      enqueueIncomingMessage(messageId),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`QUEUE_ENQUEUE_TIMEOUT_${QUEUE_ENQUEUE_TIMEOUT_MS}MS`)), QUEUE_ENQUEUE_TIMEOUT_MS);
      }),
    ]);

    return "queued";
  } catch (error) {
    logServerError("webhook.queue_unavailable.inline_fallback", error, {
      message_id: messageId,
    });

    await processIncomingMessage(messageId);
    return "inline";
  }
}

async function resolveTenantFromPhoneNumber(phoneNumberId: string): Promise<{ tenantId: string; accountId: string | null } | null> {
  try {
    const account = await prisma.clinicWhatsappAccount.findFirst({
      where: {
        phoneNumberId,
        isActive: true,
      },
      select: { id: true, tenantId: true },
    });

    if (account?.tenantId) {
      await prisma.clinicWhatsappAccount.update({
        where: { id: account.id },
        data: { lastWebhookAt: new Date(), webhookVerified: true },
      });
      return { tenantId: account.tenantId, accountId: account.id };
    }
  } catch (error) {
    logServerError("webhook.tenant_resolution.error", error, { phone_number_id: phoneNumberId });
  }

  logServer("warn", "webhook.tenant_resolution.denied_unknown_phone_number", {
    phone_number_id: phoneNumberId,
  });

  return null;
}

// ── GET /api/webhooks/whatsapp ─ Verificación inicial de Meta ─────────────

export async function GET(request: Request) {
  const started = performance.now();
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken && verifyToken) {
    logServer("info", "webhook.verify.success");
    observeRequest("/api/webhooks/whatsapp", "GET", 200, performance.now() - started);
    return new NextResponse(challenge, { status: 200 });
  }

  logServer("warn", "webhook.verify.failed", { mode, token_match: token === verifyToken });
  observeRequest("/api/webhooks/whatsapp", "GET", 403, performance.now() - started);
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// ── POST /api/webhooks/whatsapp ─ Recepción de mensajes ───────────────────

export async function POST(request: Request) {
  const requestStarted = performance.now();
  const traceId = createTraceId();

  return runWithObservabilityContext({ traceId }, async () => {
  return withSpan(
    "incoming_request",
    {
      "http.route": "/api/webhooks/whatsapp",
      "http.method": "POST",
    },
    async () => {
  // Leer body como texto para verificar firma
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  const appSecret = process.env.WHATSAPP_APP_SECRET;

  // Verificar firma de Meta
  if (appSecret && !verifyWebhookSignature(rawBody, signature, appSecret)) {
    logServer("warn", "webhook.signature.invalid");
    observeRequest("/api/webhooks/whatsapp", "POST", 401, performance.now() - requestStarted);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parsear payload
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    observeRequest("/api/webhooks/whatsapp", "POST", 400, performance.now() - requestStarted);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const payload = parseWebhookPayload(body);
  if (!payload) {
    logServer("warn", "webhook.payload.invalid");
    // Meta espera siempre 200
    observeRequest("/api/webhooks/whatsapp", "POST", 200, performance.now() - requestStarted);
    return NextResponse.json({ received: true }, { status: 200 });
  }

  try {
    await ensureWorkersBooted();
  } catch (error) {
    logServerError("webhook.workers_boot_failed", error);
  }

  // --- Procesar status updates (delivered/read) ---
  const statuses = extractStatuses(payload);
  for (const status of statuses) {
    if (status.status === "delivered" || status.status === "read" || status.status === "failed") {
      try {
        const stageStarted = performance.now();
        await updateOutgoingStatus(status.messageId, status.status);
        observeStageLatency("send_message", performance.now() - stageStarted);
      } catch (error) {
        logServerError("webhook.status.error", error, { wa_id: status.messageId });
      }
    }
  }

  // --- Procesar mensajes entrantes ---
  const messages = extractMessages(payload);
  for (const msg of messages) {
    try {
      // Idempotencia: intentar insertar, si ya existe ignorar
      const existing = await prisma.incomingMessage.findUnique({
        where: { message_id: msg.messageId },
        select: { id: true, status: true },
      });

      enrichObservabilityContext({ messageId: msg.messageId, userPhone: msg.fromPhone });

      if (existing) {
        logServer("info", "webhook.message.duplicate", {
          message_id: msg.messageId,
          existing_status: existing.status,
        });
        continue;
      }

      const resolvedTenant = await resolveTenantFromPhoneNumber(msg.phoneNumberId);
      if (!resolvedTenant) {
        logServer("warn", "webhook.message.rejected_unknown_tenant", {
          message_id: msg.messageId,
          phone_number_id: msg.phoneNumberId,
        });
        continue;
      }

      await prisma.incomingMessage.create({
        data: {
          tenant_id: resolvedTenant.tenantId,
          message_id: msg.messageId,
          from_phone: msg.fromPhone,
          payload_json: {
            text: msg.text,
            type: msg.type,
            phoneNumberId: msg.phoneNumberId,
            wabaId: msg.wabaId,
            contactName: msg.contactName,
            timestamp: msg.timestamp,
            interactiveReplyId: msg.interactiveReplyId,
          },
          status: "pending",
        },
      });

      const dispatchMode = await dispatchIncomingMessage(msg.messageId);

      logServer("info", "webhook.message.enqueued", {
        message_id: msg.messageId,
        from_phone: msg.fromPhone,
        dispatch_mode: dispatchMode,
      });
    } catch (error) {
      // P2002 = unique constraint (duplicado concurrente) - es ok
      if (
        typeof error === "object" && error !== null &&
        "code" in error && (error as { code: string }).code === "P2002"
      ) {
        logServer("info", "webhook.message.duplicate.concurrent", {
          message_id: msg.messageId,
        });
        continue;
      }

      logServerError("webhook.message.error", error, {
        message_id: msg.messageId,
      });
    }
  }

  // SIEMPRE responder 200 a Meta
  observeRequest("/api/webhooks/whatsapp", "POST", 200, performance.now() - requestStarted);
  return NextResponse.json({ received: true }, { status: 200 });
    },
  );
  });
}

