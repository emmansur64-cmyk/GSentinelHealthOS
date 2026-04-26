/**
 * Response Worker: Tercera etapa del pipeline - Envío de respuestas.
 *
 * Responsabilidades:
 * - Enviar mensaje vía WhatsApp API
 * - Marcar mensaje como "done" en DB
 * - Manejar rate limiting de la API
 * - Retry con backoff para errores transitorios
 *
 * Separar el envío permite:
 * - Retry independiente de la lógica de negocio
 * - Mayor tolerancia a fallos de la API de WhatsApp
 * - Métricas específicas de entrega
 */
import { Worker, type Job } from "bullmq";
import { v4 as uuidv4 } from "uuid";

import { prisma } from "@/lib/prisma";
import { logServer, logServerError } from "@/lib/server-logger";
import { sendWhatsAppMessage } from "@/lib/whatsapp/client";
import { createTraceId, runWithObservabilityContext } from "@/lib/observability/context";
import { observeStageLatency } from "@/lib/observability/metrics";
import { withSpan } from "@/lib/observability/tracing";
import { getRedisConnection } from "./redis";
import { QUEUE_NAMES, type ResponseJobData } from "./queues";
import {
  trackJobStart,
  trackJobComplete,
  workerHeartbeat,
} from "./worker-metrics";
import { markAsResolvedIfRetry } from "./dead-letter";
import { canSend, recordSuccess, recordFailure } from "./circuit-breaker";
import { checkDLQAndAlert } from "./dlq-monitor";

// ─── Configuración ───────────────────────────────────────────────────────────

export type ResponseWorkerConfig = {
  /** Número de jobs concurrentes (default: 15) */
  concurrency?: number;
  /** ID único del worker (auto-generado si no se provee) */
  workerId?: string;
  /** Rate limit: máximo de mensajes por segundo (default: 50) */
  maxMessagesPerSecond?: number;
  /** Intervalo de heartbeat en ms (default: 10000) */
  heartbeatIntervalMs?: number;
};

const DEFAULT_CONFIG: Required<ResponseWorkerConfig> = {
  concurrency: 15,
  workerId: `response-${uuidv4().slice(0, 8)}`,
  maxMessagesPerSecond: 50,
  heartbeatIntervalMs: 10000,
};

// ─── Worker ──────────────────────────────────────────────────────────────────

let _worker: Worker | null = null;
let _heartbeatInterval: ReturnType<typeof setInterval> | null = null;

export function startResponseWorker(config: ResponseWorkerConfig = {}): Worker {
  if (_worker) return _worker;

  const cfg = { ...DEFAULT_CONFIG, ...config };
  const connection = getRedisConnection();

  logServer("info", "response_worker.starting", {
    workerId: cfg.workerId,
    concurrency: cfg.concurrency,
    maxMessagesPerSecond: cfg.maxMessagesPerSecond,
  });

  _worker = new Worker<ResponseJobData>(
    QUEUE_NAMES.RESPONSE,
    async (job: Job<ResponseJobData>) => {
      const startTime = await trackJobStart("response", job.id!);
      let success = false;

      try {
        await processResponseJob(job);
        success = true;
      } finally {
        await trackJobComplete("response", job.id!, startTime, success);
      }
    },
    {
      connection,
      concurrency: cfg.concurrency,
      // Rate limiter para respetar límites de la API de WhatsApp
      limiter: {
        max: cfg.maxMessagesPerSecond,
        duration: 1000,
      },
    },
  );

  // Heartbeat
  _heartbeatInterval = setInterval(() => {
    workerHeartbeat(cfg.workerId, "response").catch(() => {});
  }, cfg.heartbeatIntervalMs);
  workerHeartbeat(cfg.workerId, "response").catch(() => {});

  _worker.on("failed", (job, error) => {
    logServerError("response_worker.job_failed", error, {
      jobId: job?.id,
      messageId: job?.data.messageId,
      phone: job?.data.phone,
      attempt: job?.attemptsMade,
    });
  });

  _worker.on("error", (error) => {
    logServerError("response_worker.error", error, { workerId: cfg.workerId });
  });

  return _worker;
}

export async function stopResponseWorker(): Promise<void> {
  if (_heartbeatInterval) {
    clearInterval(_heartbeatInterval);
    _heartbeatInterval = null;
  }
  if (_worker) {
    await _worker.close();
    _worker = null;
  }
}

// ─── Job Handler ─────────────────────────────────────────────────────────────

async function processResponseJob(job: Job<ResponseJobData>): Promise<void> {
  const {
    messageId,
    phone,
    reply,
    intent,
    action,
    receivedAt,
    processingCompletedAt,
  } = job.data;

  await runWithObservabilityContext({ traceId: createTraceId(), messageId, userPhone: phone, intent }, async () => {
    logServer("debug", "response.start", {
      messageId,
      phone,
      jobId: job.id,
      replyLength: reply.length,
    });

    try {
      // ── Circuit Breaker: verificar si se puede enviar ─────────────────────
      const allowed = await canSend();
      if (!allowed) {
        // Lanzar error retryable: BullMQ reintentará cuando el CB se cierre
        throw new Error("circuit_breaker_open: outgoing messages temporarily blocked");
      }

      const sendStarted = performance.now();

      // 1. Enviar mensaje vía WhatsApp API
      await withSpan("send_message", { channel: "whatsapp" }, async () => sendWhatsAppMessage(phone, reply));
      observeStageLatency("send_message", performance.now() - sendStarted);

      // Registrar éxito en Circuit Breaker
      await recordSuccess();

      // 2. Marcar mensaje como done
      await withSpan(
        "db_operation",
        { model: "incomingMessage", operation: "update" },
        async () => prisma.incomingMessage.update({
          where: { message_id: messageId },
          data: {
            status: "done",
            processed_at: new Date(),
          },
        }),
      );

      // 3. Si era un retry de DLQ, marcarlo como resuelto
      await markAsResolvedIfRetry(messageId);

      const now = Date.now();
      logServer("info", "response.sent", {
        messageId,
        phone,
        intent,
        action: action ?? "reply",
        responseLatencyMs: now - processingCompletedAt,
        totalLatencyMs: now - receivedAt,
      });
    } catch (error) {
      // Clasificar error para decidir si hacer retry
      const errorMsg = error instanceof Error ? error.message : "Unknown error";

      // Registrar fallo en Circuit Breaker (salvo que sea el propio CB abierto)
      if (!errorMsg.startsWith("circuit_breaker_open")) {
        await recordFailure(errorMsg);
      }

      // ── Verificar DLQ después de cada fallo ───────────────────────────────
      checkDLQAndAlert().catch(() => {});

      const isRetryable = isRetryableError(error);

      logServerError("response.send_failed", error, {
        messageId,
        phone,
        isRetryable,
        attempt: job.attemptsMade,
      });

      if (!isRetryable) {
        // Error no recuperable: marcar como failed y no reintentar
        await prisma.incomingMessage.update({
          where: { message_id: messageId },
          data: {
            status: "failed",
            error: `Response delivery failed: ${errorMsg.slice(0, 500)}`,
          },
        }).catch(() => {});

        // Lanzar error especial para que BullMQ no reintente
        const nonRetryableError = new Error(errorMsg);
        (nonRetryableError as Error & { unrecoverable: boolean }).unrecoverable = true;
        throw nonRetryableError;
      }

      throw error; // Re-throw para que BullMQ haga retry
    }
  });
}

// ─── Error Classification ────────────────────────────────────────────────────

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return true;

  const msg = error.message.toLowerCase();

  // Errores de red/timeout son retryables
  if (
    msg.includes("timeout") ||
    msg.includes("network") ||
    msg.includes("econnrefused") ||
    msg.includes("econnreset") ||
    msg.includes("socket") ||
    msg.includes("503") ||
    msg.includes("502") ||
    msg.includes("504")
  ) {
    return true;
  }

  // Rate limit de WhatsApp - retryable con backoff
  if (msg.includes("rate") || msg.includes("429") || msg.includes("too many")) {
    return true;
  }

  // Errores de autenticación/autorización no son retryables
  if (msg.includes("401") || msg.includes("403") || msg.includes("invalid token")) {
    return false;
  }

  // Errores de payload inválido no son retryables
  if (msg.includes("400") || msg.includes("invalid") || msg.includes("malformed")) {
    return false;
  }

  // Por defecto, asumir retryable
  return true;
}
